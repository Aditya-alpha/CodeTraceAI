const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'out',
  'coverage',
  '.vscode',
  '.idea',
  'scratch',
  'temp',
  'tmp',
  'vendor',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
]);

class FileWalker {
  static walk(dir, baseDir = dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          files = files.concat(this.walk(fullPath, baseDir));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // Skip minified files
        if (entry.name.endsWith('.min.js') || entry.name.endsWith('.bundle.js')) {
          continue;
        }

        if (ALLOWED_EXTENSIONS.has(ext)) {
          try {
            const stat = fs.statSync(fullPath);
            // Skip files larger than 1MB (likely bundles/data)
            if (stat.size > 1024 * 1024) continue;

            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            const content = fs.readFileSync(fullPath, 'utf8');
            const lineCount = content.split('\n').length;

            files.push({
              absolutePath: fullPath,
              relativePath,
              fileName: entry.name,
              extension: ext,
              size: stat.size,
              lineCount,
              content,
            });
          } catch (err) {
            console.warn(`[FileWalker] Error processing file ${fullPath}:`, err.message);
          }
        }
      }
    }

    return files;
  }
}

module.exports = FileWalker;
