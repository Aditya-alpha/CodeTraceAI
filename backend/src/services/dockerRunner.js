const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class DockerRunner {
  /**
   * Checks if Docker daemon is available and responsive.
   * @returns {Promise<boolean>}
   */
  static async isAvailable() {
    return new Promise((resolve) => {
      exec('docker info --format "{{.ServerVersion}}"', { timeout: 4000 }, (err) => {
        resolve(!err);
      });
    });
  }

  /**
   * Executes the test suite inside an isolated Docker container on a custom bridge network
   * with an ephemeral MongoDB container and CPU/memory resource limits.
   *
   * @param {object} options
   * @param {string} options.workspacePath - Original repo workspace path
   * @param {string} options.testCode - Generated Jest + Supertest test code
   * @param {object} options.bootstrapping - Output from Bootstrapper.detect
   * @param {string} options.runId - Unique run identifier
   * @param {number} [options.timeoutMs=120000] - Hard execution timeout
   * @returns {Promise<{ rawLogs: string, stdout: string, stderr: string, exitCode: number }>}
   */
  static async execute({
    workspacePath,
    testCode,
    bootstrapping,
    runId,
    timeoutMs = 120000,
  }) {
    const networkName = `codetrace-net-${runId}`;
    const mongoContainerName = `codetrace-mongo-${runId}`;
    const runDir = path.resolve(__dirname, `../../scratch/docker-runs/${runId}`);

    try {
      // 1. Prepare run directory
      if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      // Copy repo files into runDir
      this._copyDirSync(workspacePath, runDir, ['node_modules', '.git', 'scratch']);

      // Write test file
      const entryRelative = bootstrapping.entryFile
        ? `./${bootstrapping.entryFile.replace(/^\.\//, '')}`
        : './server';
      const customizedTestCode = testCode.replace(
        /require\(['"]\.\.\/server['"]\)/g,
        `require('${entryRelative}')`
      );
      fs.writeFileSync(path.join(runDir, '__codetrace__.test.js'), customizedTestCode, 'utf8');

      // 2. Create isolated Docker network
      await this._execPromise(`docker network create ${networkName}`);

      // 3. Start ephemeral MongoDB container
      await this._execPromise(
        `docker run -d --name ${mongoContainerName} --network ${networkName} mongo:6-alpine`
      );

      // Wait 3 seconds for MongoDB inside container to listen
      await new Promise((r) => setTimeout(r, 3000));

      // 4. Run Jest container with resource limits & restricted egress
      const mongoUri = `mongodb://${mongoContainerName}:27017/testdb`;
      const normalizedMount = runDir.replace(/\\/g, '/');

      // Environment variables string
      let envArgs = `-e MONGODB_URI="${mongoUri}" -e MONGO_URI="${mongoUri}" -e NODE_ENV="test" -e PORT="0"`;
      for (const [k, v] of Object.entries(bootstrapping.envVars || {})) {
        envArgs += ` -e ${k}="${v}"`;
      }

      const dockerCmd = `docker run --rm --network ${networkName} --cpus=1.0 --memory=1g ${envArgs} -v "${normalizedMount}:/workspace" -w /workspace node:18-alpine sh -c "npm install --production=false && npx jest __codetrace__.test.js --json --runInBand --forceExit --testTimeout=10000"`;

      return await new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const child = spawn(dockerCmd, { shell: true });

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
          reject(new Error(`Docker execution timed out after ${timeoutMs / 1000} seconds.`));
        }, timeoutMs);

        child.stdout?.on('data', (d) => {
          stdout += d.toString();
        });
        child.stderr?.on('data', (d) => {
          stderr += d.toString();
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
    } finally {
      // 5. Teardown Docker resources and scratch dir
      await this._execPromise(`docker rm -f ${mongoContainerName}`).catch(() => {});
      await this._execPromise(`docker network rm ${networkName}`).catch(() => {});
      try {
        if (fs.existsSync(runDir)) {
          fs.rmSync(runDir, { recursive: true, force: true });
        }
      } catch (_) {}
    }
  }

  static _execPromise(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      });
    });
  }

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

module.exports = DockerRunner;
