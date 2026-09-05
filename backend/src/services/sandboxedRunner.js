const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

class SandboxedRunner {
  /**
   * Executes a test suite in an isolated scratch workspace with an ephemeral in-memory MongoDB.
   *
   * @param {object} options
   * @param {string} options.workspacePath - Original repo workspace path
   * @param {string} options.testCode - Generated Jest + Supertest test code
   * @param {object} options.bootstrapping - Output from Bootstrapper.detect
   * @param {string} options.runId - Unique run identifier
   * @param {number} [options.timeoutMs=60000] - Hard execution timeout
   * @returns {Promise<{ rawLogs: string, exitCode: number }>}
   */
  static async execute({
    workspacePath,
    testCode,
    bootstrapping,
    runId,
    timeoutMs = 60000,
  }) {
    let mongod = null;
    const runDir = path.resolve(__dirname, `../../scratch/runs/${runId}`);

    try {
      // 1. Provision ephemeral in-memory MongoDB instance
      mongod = await MongoMemoryServer.create();
      const mongoUri = mongod.getUri();

      // 2. Prepare isolated scratch workspace
      if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      // Copy repo files into runDir (excluding node_modules and .git for speed)
      this._copyDirSync(workspacePath, runDir, ['node_modules', '.git', 'scratch']);

      // 3. Write generated test file
      const testFilePath = path.join(runDir, '__codetrace__.test.js');
      // Ensure app import path points to the server entry point in runDir
      const entryRelative = bootstrapping.entryFile ? `./${bootstrapping.entryFile.replace(/^\.\//, '')}` : './server';
      const customizedTestCode = testCode.replace(
        /require\(['"]\.\.\/server['"]\)/g,
        `require('${entryRelative}')`
      );
      fs.writeFileSync(testFilePath, customizedTestCode, 'utf8');

      // 4. Configure environment variables
      const env = {
        ...process.env,
        ...bootstrapping.envVars,
        [bootstrapping.dbKey || 'MONGODB_URI']: mongoUri,
        MONGO_URI: mongoUri,
        DATABASE_URL: mongoUri,
        NODE_ENV: 'test',
        PORT: '0',
        // Point NODE_PATH to backend node_modules so jest, supertest, and core drivers are instantly available
        NODE_PATH: [
          path.resolve(__dirname, '../../node_modules'),
          path.resolve(workspacePath, 'node_modules'),
        ].filter(fs.existsSync).join(path.delimiter),
      };

      // 5. Run Jest via child_process
      const jestCli = path.resolve(__dirname, '../../node_modules/.bin/jest.cmd');
      const jestExec = process.platform === 'win32' && fs.existsSync(jestCli) ? jestCli : 'npx';
      const jestArgs =
        jestExec === 'npx'
          ? ['jest', '__codetrace__.test.js', '--json', '--runInBand', '--forceExit', '--testTimeout=10000']
          : ['__codetrace__.test.js', '--json', '--runInBand', '--forceExit', '--testTimeout=10000'];

      const runPromise = new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const child = spawn(jestExec, jestArgs, {
          cwd: runDir,
          env,
          shell: true,
        });

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          reject(new Error(`Test execution timed out after ${timeoutMs / 1000} seconds.`));
        }, timeoutMs);

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (exitCode) => {
          clearTimeout(timer);
          if (!timedOut) {
            resolve({
              rawLogs: stdout + (stderr ? `\n--- STDERR ---\n${stderr}` : ''),
              stdout,
              stderr,
              exitCode: exitCode || 0,
            });
          }
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      return await runPromise;
    } finally {
      // 6. Teardown ephemeral MongoDB and clean scratch directory
      if (mongod) {
        try {
          await mongod.stop();
        } catch (_) {}
      }
      try {
        if (fs.existsSync(runDir)) {
          fs.rmSync(runDir, { recursive: true, force: true });
        }
      } catch (_) {}
    }
  }

  /**
   * Recursively copies directory contents ignoring specified folder names.
   */
  static _copyDirSync(src, dest, ignoreList = []) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoreList.includes(entry.name)) continue;

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this._copyDirSync(srcPath, destPath, ignoreList);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

module.exports = SandboxedRunner;
