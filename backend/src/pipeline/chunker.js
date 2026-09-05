class Chunker {
  /**
   * Chunks repository source code into semantic, AST-aligned units.
   * @param {Array<object>} fileResults - Array of file extraction objects
   * @param {Array<object>} resolvedRoutes - Array of fully resolved routes
   * @returns {Array<object>} Semantic chunks ready for embedding
   */
  static createSemanticChunks(fileResults, resolvedRoutes) {
    const chunks = [];

    // Map file routes by filePath
    const routesByFile = new Map();
    for (const r of resolvedRoutes) {
      if (!routesByFile.has(r.filePath)) {
        routesByFile.set(r.filePath, []);
      }
      routesByFile.get(r.filePath).push(r);
    }

    for (const file of fileResults) {
      const { relativePath, content, functions, imports, exports } = file;
      const fileRoutes = routesByFile.get(relativePath) || [];

      // 1. Create chunks for each discovered Route
      for (const route of fileRoutes) {
        const routeHeader = `// File: ${relativePath} (Lines ${route.loc?.startLine || '?'}-${route.loc?.endLine || '?'})\n` +
          `// Express Route: ${route.method} ${route.resolvedPath}\n` +
          `// Middlewares: ${route.middlewares.length > 0 ? route.middlewares.join(', ') : 'none'}\n` +
          `// Handler: ${route.handlerName}\n`;

        const chunkText = route.handlerCodeSnippet
          ? `${routeHeader}\n${route.handlerCodeSnippet}`
          : `${routeHeader}\n// Registration:\n${route.method}('${route.rawPath}', ${route.handlerName});`;

        chunks.push({
          filePath: relativePath,
          name: `${route.method} ${route.resolvedPath}`,
          type: 'route_handler',
          content: chunkText,
          loc: route.loc ? { startLine: route.loc.startLine, endLine: route.loc.endLine } : null,
          associatedRoute: route.resolvedPath,
          associatedMethod: route.method,
          calls: (route.dbCalls || []).map((d) => `${d.callee}.${d.method}`).concat(
            (route.httpCalls || []).map((h) => `${h.callee}.${h.method}`)
          ),
          imports: (imports || []).map((i) => i.source),
        });
      }

      // 2. Create chunks for Functions (controllers, middlewares, helpers)
      const isMiddlewareFile = /(auth|middleware|protect|guard|verify|validate)/i.test(relativePath);

      for (const fn of functions || []) {
        // Skip tiny anonymous functions unless they have substantial code
        if (fn.name === 'anonymous' && (!fn.codeSnippet || fn.codeSnippet.length < 50)) {
          continue;
        }

        const isMw =
          isMiddlewareFile ||
          /(auth|token|verify|check|validate|protect|guard|session|role)/i.test(fn.name) ||
          fn.params.includes('next');

        const fnType = isMw
          ? 'middleware'
          : /(controller|service|handler)/i.test(relativePath) || fn.name.endsWith('Controller')
          ? 'controller'
          : 'function';

        const fnHeader = `// File: ${relativePath} (Lines ${fn.loc?.startLine || '?'}-${fn.loc?.endLine || '?'})\n` +
          `// ${fnType.toUpperCase()}: ${fn.name}(${(fn.params || []).join(', ')})\n` +
          `// Async: ${fn.isAsync}\n`;

        chunks.push({
          filePath: relativePath,
          name: fn.name,
          type: fnType,
          content: `${fnHeader}\n${fn.codeSnippet || `function ${fn.name}() {}`}`,
          loc: fn.loc ? { startLine: fn.loc.startLine, endLine: fn.loc.endLine } : null,
          associatedRoute: null,
          associatedMethod: null,
          calls: fn.calls || [],
          imports: (imports || []).map((i) => i.source),
        });
      }

      // 3. Create a Module / File Overview chunk if file has exports or imports
      if (fileRoutes.length === 0 && (functions || []).length === 0 && content.trim().length > 0) {
        // Fallback for config/model/utility files without explicit top-level functions
        const lines = content.split('\n');
        const snippet = lines.slice(0, 100).join('\n'); // bounded snippet
        chunks.push({
          filePath: relativePath,
          name: `Module: ${relativePath}`,
          type: 'module',
          content: `// File: ${relativePath}\n${snippet}`,
          loc: { startLine: 1, endLine: Math.min(lines.length, 100) },
          associatedRoute: null,
          associatedMethod: null,
          calls: [],
          imports: (imports || []).map((i) => i.source),
        });
      }
    }

    return chunks;
  }
}

module.exports = Chunker;
