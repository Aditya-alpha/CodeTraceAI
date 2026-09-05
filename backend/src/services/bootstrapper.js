const fs = require('fs');
const path = require('path');

class Bootstrapper {
  /**
   * Analyzes the repository workspace to deduce how to boot the application,
   * configure its environment, and provision its database.
   *
   * @param {string} workspacePath - Absolute path to cloned repository
   * @returns {object} Bootstrapping plan
   */
  static detect(workspacePath) {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return {
        canBoot: false,
        reason: 'Workspace directory does not exist or is inaccessible',
        strategy: 'none',
        entryFile: null,
        envVars: {},
        missingSecrets: [],
      };
    }

    // 1. Check for Dockerfile / docker-compose.yml
    const hasCompose =
      fs.existsSync(path.join(workspacePath, 'docker-compose.yml')) ||
      fs.existsSync(path.join(workspacePath, 'docker-compose.yaml'));
    const hasDockerfile = fs.existsSync(path.join(workspacePath, 'Dockerfile'));

    let strategy = 'package_json';
    if (hasCompose) strategy = 'docker_compose';
    else if (hasDockerfile) strategy = 'dockerfile';

    // 2. Read package.json for start scripts and entry points (supports monorepos & backend/ subfolders)
    const packageSubDirs = ['', 'backend', 'server', 'api', 'app', 'packages/backend', 'packages/server', 'src'];
    let packageJson = {};
    let packageJsonRelDir = '';

    for (const sub of packageSubDirs) {
      const candidatePkgPath = path.join(workspacePath, sub, 'package.json');
      if (fs.existsSync(candidatePkgPath)) {
        try {
          packageJson = JSON.parse(fs.readFileSync(candidatePkgPath, 'utf8'));
          packageJsonRelDir = sub;
          break;
        } catch (_) {}
      }
    }

    const scripts = packageJson.scripts || {};
    let startCommand = scripts.start || scripts.dev || '';
    let entryFile = null;

    if (packageJson.main) {
      const mainPath = packageJsonRelDir
        ? path.posix.join(packageJsonRelDir, packageJson.main)
        : packageJson.main;
      if (fs.existsSync(path.join(workspacePath, mainPath))) {
        entryFile = mainPath;
      }
    }

    // Detect entry file if not specified in package.json main
    const candidateEntries = [
      'server.js',
      'app.js',
      'index.js',
      'main.js',
      'src/server.js',
      'src/app.js',
      'src/index.js',
      'src/main.js',
      'backend/server.js',
      'backend/app.js',
      'backend/index.js',
      'backend/main.js',
      'backend/src/server.js',
      'backend/src/app.js',
      'backend/src/index.js',
      'server/server.js',
      'server/app.js',
      'server/index.js',
      'server/src/server.js',
      'server/src/app.js',
      'server/src/index.js',
      'api/server.js',
      'api/app.js',
      'api/index.js',
      'app/server.js',
      'app/app.js',
      'app/index.js',
      'bin/www',
    ];

    if (!entryFile) {
      for (const candidate of candidateEntries) {
        if (fs.existsSync(path.join(workspacePath, candidate))) {
          entryFile = candidate;
          break;
        }
      }
    }

    // Fallback: search for any .js/.ts file that initializes express()
    if (!entryFile) {
      entryFile = this._findExpressEntryFile(workspacePath);
    }

    if (!startCommand && entryFile) {
      startCommand = `node ${entryFile}`;
    }

    // 3. Scan for .env.example / .env.sample / .env.test across root and subfolders
    const envBaseNames = [
      '.env.example',
      '.env.sample',
      '.env.test',
      '.env.defaults',
      '.env.local.example',
      '.env',
    ];
    const envCandidateFiles = [];
    for (const sub of ['', 'backend', 'server', 'api', 'app']) {
      for (const base of envBaseNames) {
        envCandidateFiles.push(sub ? path.posix.join(sub, base) : base);
      }
    }

    const detectedEnvKeys = new Map(); // key -> defaultVal or null

    for (const envFile of envCandidateFiles) {
      const fullEnvPath = path.join(workspacePath, envFile);
      if (fs.existsSync(fullEnvPath)) {
        try {
          const content = fs.readFileSync(fullEnvPath, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const key = trimmed.slice(0, eqIdx).trim();
              const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
              if (key && !detectedEnvKeys.has(key)) {
                detectedEnvKeys.set(key, val || null);
              }
            }
          }
        } catch (_) {}
      }
    }

    // 4. Classify Environment Variables
    const envVars = {
      NODE_ENV: 'test',
      PORT: '0', // dynamic port allocation
    };

    let dbKey = 'MONGODB_URI';
    const missingSecrets = [];

    // Identify DB connection variable
    const dbKeyCandidates = ['MONGODB_URI', 'MONGO_URI', 'DATABASE_URL', 'MONGO_URL', 'MONGODB_URL'];
    for (const k of dbKeyCandidates) {
      if (detectedEnvKeys.has(k)) {
        dbKey = k;
        break;
      }
    }

    for (const [key, val] of detectedEnvKeys.entries()) {
      const upperKey = key.toUpperCase();

      // Database URI is injected by ephemeral Mongo
      if (dbKeyCandidates.includes(upperKey)) {
        continue;
      }

      // Safe defaults for JWT and Auth Secrets
      if (/JWT_SECRET|SECRET_KEY|SESSION_SECRET|TOKEN_SECRET|AUTH_SECRET/i.test(upperKey)) {
        envVars[key] = val || 'supersecretkey1234567890testrunner';
        continue;
      }

      // Safe defaults for ports/hosts
      if (/PORT/i.test(upperKey)) {
        envVars[key] = '0';
        continue;
      }
      if (/HOST/i.test(upperKey)) {
        envVars[key] = 'localhost';
        continue;
      }

      // If val is already present in example file, keep it
      if (val) {
        envVars[key] = val;
        continue;
      }

      // Check for mandatory un-mocked external cloud dependencies
      if (/STRIPE|AWS|SENDGRID|TWILIO|REDIS|SENTRY|PAYPAL|SLACK|FIREBASE/i.test(upperKey)) {
        missingSecrets.push(key);
      } else {
        // Generic fallback placeholder for unspecified variables
        envVars[key] = `test_mock_${key.toLowerCase()}`;
      }
    }

    // 5. Determine Bootability
    if (!entryFile && !startCommand) {
      return {
        canBoot: false,
        reason: 'Could not detect an Express server entry point (server.js, app.js, or index.js) or start script in package.json.',
        strategy,
        entryFile: null,
        startCommand: '',
        envVars,
        dbKey,
        missingSecrets,
      };
    }

    if (missingSecrets.length > 0) {
      return {
        canBoot: false,
        reason: `Application requires external cloud secrets (${missingSecrets.join(', ')}) that cannot be automatically mocked or provisioned locally in Phase 3.`,
        strategy,
        entryFile,
        startCommand,
        envVars,
        dbKey,
        missingSecrets,
      };
    }

    return {
      canBoot: true,
      reason: 'Application entry point and dependencies successfully detected.',
      strategy,
      entryFile,
      startCommand,
      envVars,
      dbKey,
      missingSecrets: [],
    };
  }

  /**
   * Scans repository files to locate any JavaScript/TypeScript file that initializes Express.
   * Useful for non-standard folder layouts and monorepos.
   *
   * @param {string} dir - Base directory to scan
   * @param {string} [relBase=''] - Relative path accumulator
   * @returns {string|null} Relative path to entry file
   */
  static _findExpressEntryFile(dir, relBase = '') {
    if (!fs.existsSync(dir)) return null;

    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', 'scratch'];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      // First check files in current directory
      for (const entry of entries) {
        if (entry.isFile() && /\.(js|mjs|cjs|ts)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
          const filePath = path.join(dir, entry.name);
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('express()') || (content.includes('require("express")') && content.includes('app.listen')) || (content.includes("require('express')") && content.includes('app.listen'))) {
              return relBase ? path.posix.join(relBase, entry.name) : entry.name;
            }
          } catch (_) {}
        }
      }

      // Then recurse into subdirectories
      for (const entry of entries) {
        if (entry.isDirectory() && !ignoreDirs.includes(entry.name)) {
          const subDir = path.join(dir, entry.name);
          const nextRel = relBase ? path.posix.join(relBase, entry.name) : entry.name;
          const found = this._findExpressEntryFile(subDir, nextRel);
          if (found) return found;
        }
      }
    } catch (_) {}

    return null;
  }
}

module.exports = Bootstrapper;
