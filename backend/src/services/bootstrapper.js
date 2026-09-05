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

    // 2. Read package.json for start scripts and entry points
    const packageJsonPath = path.join(workspacePath, 'package.json');
    let packageJson = {};
    if (fs.existsSync(packageJsonPath)) {
      try {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      } catch (_) {}
    }

    const scripts = packageJson.scripts || {};
    let startCommand = scripts.start || scripts.dev || '';
    let entryFile = packageJson.main || null;

    // Detect entry file if not specified in package.json main
    const candidateEntries = [
      'server.js',
      'app.js',
      'index.js',
      'src/server.js',
      'src/app.js',
      'src/index.js',
      'api/index.js',
      'bin/www',
    ];

    if (!entryFile || !fs.existsSync(path.join(workspacePath, entryFile))) {
      for (const candidate of candidateEntries) {
        if (fs.existsSync(path.join(workspacePath, candidate))) {
          entryFile = candidate;
          break;
        }
      }
    }

    if (!startCommand && entryFile) {
      startCommand = `node ${entryFile}`;
    }

    // 3. Scan for .env.example / .env.sample / .env.test
    const envCandidateFiles = [
      '.env.example',
      '.env.sample',
      '.env.test',
      '.env.defaults',
      '.env.local.example',
      '.env',
    ];

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
}

module.exports = Bootstrapper;
