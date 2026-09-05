const path = require('path');

class RouterResolver {
  /**
   * Resolves full callable paths for all routes across mounted routers and files.
   * @param {Array<object>} fileResults - Array of file extraction outputs:
   *   { relativePath, absolutePath, routes, mounts, exports, imports }
   * @returns {Array<object>} Flat array of fully resolved Route objects
   */
  static resolveAllRoutes(fileResults) {
    const fileMap = new Map(); // relativePath -> fileResult
    for (const f of fileResults) {
      fileMap.set(this._normalizeRelPath(f.relativePath), f);
    }

    // Graph of mounts: targetFilePath -> Array<{ sourcePath, prefix }>
    // and outgoing mounts: sourceFilePath -> Array<{ targetPath, prefix }>
    const outgoingMounts = new Map();

    for (const file of fileResults) {
      const sourceNorm = this._normalizeRelPath(file.relativePath);
      const mounts = [];

      for (const m of file.mounts || []) {
        if (!m.target?.importedFrom) continue;

        const resolvedTargetRel = this._resolveModulePath(
          file.relativePath,
          m.target.importedFrom,
          fileMap
        );

        if (resolvedTargetRel) {
          mounts.push({
            targetPath: resolvedTargetRel,
            prefix: m.prefix,
          });
        }
      }

      outgoingMounts.set(sourceNorm, mounts);
    }

    // Find root files: files with express() calls, or files not mounted by any other file
    const targetedFiles = new Set();
    for (const mounts of outgoingMounts.values()) {
      for (const m of mounts) {
        targetedFiles.add(m.targetPath);
      }
    }

    // Determine cumulative prefixes for each file
    // filePrefixes: Map<filePath, Set<string>>
    const filePrefixes = new Map();

    // Initialize root files
    for (const file of fileResults) {
      const norm = this._normalizeRelPath(file.relativePath);
      if (!targetedFiles.has(norm)) {
        if (!filePrefixes.has(norm)) {
          filePrefixes.set(norm, new Set(['']));
        }
      }
    }

    // Breadth-first propagation of prefixes down the mount tree
    const queue = [];
    for (const [norm, prefixes] of filePrefixes.entries()) {
      for (const p of prefixes) {
        queue.push({ filePath: norm, currentPrefix: p });
      }
    }

    const visited = new Set(); // avoid cycles: `${filePath}::${prefix}`

    while (queue.length > 0) {
      const { filePath, currentPrefix } = queue.shift();
      const visitKey = `${filePath}::${currentPrefix}`;
      if (visited.has(visitKey)) continue;
      visited.add(visitKey);

      const mounts = outgoingMounts.get(filePath) || [];
      for (const m of mounts) {
        const nextPrefix = this._combinePaths(currentPrefix, m.prefix);

        if (!filePrefixes.has(m.targetPath)) {
          filePrefixes.set(m.targetPath, new Set());
        }
        filePrefixes.get(m.targetPath).add(nextPrefix);

        queue.push({
          filePath: m.targetPath,
          currentPrefix: nextPrefix,
        });
      }
    }

    // Now produce final resolved routes
    const resolvedRoutes = [];

    for (const file of fileResults) {
      const norm = this._normalizeRelPath(file.relativePath);
      const prefixes = filePrefixes.get(norm) || new Set(['']);

      for (const route of file.routes || []) {
        // If a file was mounted at multiple prefixes, emit the route for each mounted prefix!
        for (const prefix of prefixes) {
          const resolvedPath = this._combinePaths(prefix, route.rawPath);

          resolvedRoutes.push({
            ...route,
            filePath: file.relativePath,
            resolvedPath: resolvedPath || '/',
          });
        }
      }
    }

    return resolvedRoutes;
  }

  /**
   * Resolves a relative import path (e.g. './routes/users' from 'src/app.js')
   * to one of the known relative paths in fileMap.
   */
  static _resolveModulePath(currentFile, importSpecifier, fileMap) {
    if (!importSpecifier.startsWith('.')) {
      return null; // External npm package, not an internal router
    }

    const currentDir = path.dirname(currentFile);
    const candidateBase = path.normalize(path.join(currentDir, importSpecifier));
    const normalizedBase = this._normalizeRelPath(candidateBase);

    const extensions = ['', '.js', '.ts', '.mjs', '.cjs', '/index.js', '/index.ts'];

    for (const ext of extensions) {
      const candidate = this._normalizeRelPath(normalizedBase + ext);
      if (fileMap.has(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  static _normalizeRelPath(p) {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  static _combinePaths(prefix, rawPath) {
    let cleanPrefix = (prefix || '').trim();
    let cleanRaw = (rawPath || '').trim();

    if (!cleanPrefix.startsWith('/') && cleanPrefix.length > 0) {
      cleanPrefix = '/' + cleanPrefix;
    }
    if (cleanPrefix.endsWith('/')) {
      cleanPrefix = cleanPrefix.slice(0, -1);
    }

    if (!cleanRaw.startsWith('/')) {
      cleanRaw = '/' + cleanRaw;
    }

    let combined = (cleanPrefix + cleanRaw).replace(/\/+/g, '/');

    // Remove trailing slash unless root '/'
    if (combined.length > 1 && combined.endsWith('/')) {
      combined = combined.slice(0, -1);
    }

    return combined || '/';
  }
}

module.exports = RouterResolver;
