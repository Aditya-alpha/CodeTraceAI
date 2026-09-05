const fs = require('fs');
const path = require('path');

class Detector {
  static detectExpress(workspacePath) {
    const result = {
      isExpress: false,
      reason: null,
      packageJson: null,
      expressVersion: null,
      hasTypeScript: false,
    };

    // 1. Check for package.json
    const packageJsonPath = path.join(workspacePath, 'package.json');
    let pkg = null;

    if (fs.existsSync(packageJsonPath)) {
      try {
        const raw = fs.readFileSync(packageJsonPath, 'utf8');
        pkg = JSON.parse(raw);
        result.packageJson = {
          name: pkg.name || 'unnamed',
          version: pkg.version || '1.0.0',
          dependencies: pkg.dependencies || {},
          devDependencies: pkg.devDependencies || {},
          scripts: pkg.scripts || {},
        };

        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
          ...(pkg.peerDependencies || {}),
        };

        if (allDeps['express']) {
          result.isExpress = true;
          result.expressVersion = allDeps['express'];
        }

        if (allDeps['typescript'] || fs.existsSync(path.join(workspacePath, 'tsconfig.json'))) {
          result.hasTypeScript = true;
        }
      } catch (err) {
        console.warn('[Detector] Error reading package.json:', err.message);
      }
    }

    // 2. If not detected via package.json, scan source files for express imports
    if (!result.isExpress) {
      const expressPattern = /(?:require\s*\(\s*['"]express['"]\s*\)|from\s*['"]express['"])/i;
      const foundInCode = this._scanFilesForPattern(workspacePath, expressPattern);
      if (foundInCode) {
        result.isExpress = true;
        result.expressVersion = 'inferred-from-source';
      }
    }

    if (!result.isExpress) {
      result.reason =
        'Unsupported repository: No Express dependency found in package.json and no Express imports detected in source code. CodeTraceAI v1 currently supports Node.js Express repositories only.';
    }

    return result;
  }

  static _scanFilesForPattern(dir, pattern, depth = 0) {
    if (depth > 3) return false;
    if (!fs.existsSync(dir)) return false;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (this._scanFilesForPattern(fullPath, pattern, depth + 1)) return true;
      } else if (/\.(js|mjs|cjs|ts|tsx)$/i.test(entry.name)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (pattern.test(content)) return true;
        } catch (_) {
          // ignore read error
        }
      }
    }
    return false;
  }
}

module.exports = Detector;
