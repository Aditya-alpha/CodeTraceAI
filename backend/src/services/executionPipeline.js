const fs = require('fs');
const Repository = require('../db/models/Repository');
const Route = require('../db/models/Route');
const TestPlan = require('../db/models/TestPlan');
const TestRun = require('../db/models/TestRun');
const Bootstrapper = require('./bootstrapper');
const SandboxedRunner = require('./sandboxedRunner');
const DockerRunner = require('./dockerRunner');
const TestGeneratorService = require('./testGeneratorService');
const Cloner = require('../pipeline/cloner');

class ExecutionPipeline {
  /**
   * Executes tests for a specific route or all routes in a repository.
   *
   * @param {object} options
   * @param {string} options.repoId - Repository ObjectId
   * @param {string} [options.routeId=null] - Specific route ObjectId (optional)
   * @param {string} [options.preferredMode='auto'] - 'auto' | 'docker' | 'sandboxed'
   * @returns {Promise<object>} Persisted TestRun document
   */
  static async run({ repoId, routeId = null, preferredMode = 'auto' }) {
    const repo = await Repository.findById(repoId);
    if (!repo) throw new Error(`Repository ${repoId} not found`);

    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Self-healing: if workspace path is missing or was cleaned up, restore it from repo.url
    if (!repo.workspacePath || !fs.existsSync(repo.workspacePath)) {
      if (repo.url) {
        console.log(`[ExecutionPipeline] Restoring workspace for ${repo.name} from ${repo.url}...`);
        const cloneInfo = await Cloner.cloneRepo(repo.url, repo._id);
        repo.workspacePath = cloneInfo.workspacePath;
        await repo.save();
      }
    }

    // Step 1: Detect Bootstrapping Strategy & Dependencies
    const bootstrapping = Bootstrapper.detect(repo.workspacePath);

    // If application cannot be booted, record graceful cannot_boot run
    if (!bootstrapping.canBoot) {
      const failedBootRun = await TestRun.create({
        repoId,
        routeId,
        executionMode: 'sandboxed',
        status: 'cannot_boot',
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          durationMs: 0,
          passRate: 0,
        },
        results: [],
        bootstrapping: {
          strategy: bootstrapping.strategy,
          startCommand: bootstrapping.startCommand || '',
          entryFile: bootstrapping.entryFile || '',
          missingSecrets: bootstrapping.missingSecrets || [],
          errorReason: bootstrapping.reason,
        },
        rawLogs: `[Bootstrapper Error] ${bootstrapping.reason}`,
        completedAt: new Date(),
      });

      return failedBootRun;
    }

    // Step 2: Prepare Test Code
    let combinedTestCode = '';
    let testPlanId = null;

    if (routeId) {
      // Single route test
      let plan = await TestPlan.findOne({ repoId, routeId });
      if (!plan || !plan.testCode) {
        const route = await Route.findById(routeId);
        const generated = await TestGeneratorService.generateTestPlan(route);
        plan = await TestPlan.create({
          repoId,
          routeId,
          method: route.method,
          resolvedPath: route.resolvedPath,
          scenarios: generated.scenarios,
          testCode: generated.testCode,
          syntaxValid: generated.syntaxValid,
          status: 'generated',
        });
      }
      combinedTestCode = plan.testCode;
      testPlanId = plan._id;
    } else {
      // Multi-route / Full repo test
      const allPlans = await TestPlan.find({ repoId });
      if (allPlans.length > 0) {
        combinedTestCode = this.combineTestCodes(allPlans.map((p) => p.testCode));
      } else {
        // Generate for all routes first
        const routes = await Route.find({ repoId });
        const codeBlocks = [];
        for (const r of routes) {
          const generated = await TestGeneratorService.generateTestPlan(r);
          codeBlocks.push(generated.testCode);
        }
        combinedTestCode = this.combineTestCodes(codeBlocks);
      }
    }

    if (!combinedTestCode.trim()) {
      throw new Error('No test code available to execute.');
    }

    // Step 3: Determine Execution Mode (Docker vs Sandboxed Fallback)
    let executionMode = 'sandboxed';
    if (preferredMode === 'docker' || preferredMode === 'auto') {
      const dockerAvailable = await DockerRunner.isAvailable();
      if (dockerAvailable) {
        executionMode = 'docker';
      }
    }

    // Create Initial TestRun in 'running' state
    const testRun = await TestRun.create({
      repoId,
      routeId,
      testPlanId,
      executionMode,
      status: 'running',
      bootstrapping: {
        strategy: bootstrapping.strategy,
        startCommand: bootstrapping.startCommand || '',
        entryFile: bootstrapping.entryFile || '',
        envVarsInjected: Object.keys(bootstrapping.envVars || {}),
        missingSecrets: bootstrapping.missingSecrets || [],
      },
      createdAt: new Date(),
    });

    // Step 4: Execute via Selected Runner
    let executionResult = null;
    try {
      if (executionMode === 'docker') {
        executionResult = await DockerRunner.execute({
          workspacePath: repo.workspacePath,
          testCode: combinedTestCode,
          bootstrapping,
          runId,
          timeoutMs: 120000,
        });
      } else {
        executionResult = await SandboxedRunner.execute({
          workspacePath: repo.workspacePath,
          testCode: combinedTestCode,
          bootstrapping,
          runId,
          timeoutMs: 60000,
        });
      }
    } catch (execErr) {
      testRun.status = 'failed';
      testRun.rawLogs = `[Execution Failure] ${execErr.message}\n${execErr.stack || ''}`;
      testRun.completedAt = new Date();
      await testRun.save();
      return testRun;
    }

    // Step 5: Parse Jest Output Telemetry
    const parsed = this.parseJestOutput(executionResult.rawLogs || executionResult.stdout || '');

    testRun.status = parsed.failed > 0 ? 'failed' : 'completed';
    testRun.summary = {
      total: parsed.total,
      passed: parsed.passed,
      failed: parsed.failed,
      skipped: parsed.skipped,
      durationMs: parsed.durationMs,
      passRate: parsed.total > 0 ? Math.round((parsed.passed / parsed.total) * 100) : 0,
    };
    testRun.results = parsed.results;
    testRun.rawLogs = executionResult.rawLogs || '';
    testRun.completedAt = new Date();

    await testRun.save();
    return testRun;
  }

  /**
   * Parses Jest JSON or formatted output into structured test telemetry.
   *
   * @param {string} output - Raw execution stdout/stderr
   * @returns {object} Parsed metrics and test items
   */
  static parseJestOutput(output = '') {
    const results = [];
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let durationMs = 0;

    // 1. Try to extract Jest JSON output from stdout (before STDERR delimiter)
    const stdoutPart = output.split('--- STDERR ---')[0];
    const firstBrace = stdoutPart.indexOf('{');
    const lastBrace = stdoutPart.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const json = JSON.parse(stdoutPart.substring(firstBrace, lastBrace + 1));
        if (typeof json.numTotalTests === 'number') {
          total = json.numTotalTests || 0;
          passed = json.numPassedTests || 0;
          failed = json.numFailedTests || 0;
          skipped = json.numPendingTests || 0;

        const startTime = json.startTime || 0;
        const testResults = json.testResults || [];

        for (const suite of testResults) {
          if (suite.perfStats?.end && suite.perfStats?.start) {
            durationMs += suite.perfStats.end - suite.perfStats.start;
          }

          // If suite had a runtime error (e.g. module error, compilation failure)
          if (suite.status === 'failed' && (!suite.assertionResults || suite.assertionResults.length === 0)) {
            const suiteError = suite.message || 'Test suite failed to execute';
            results.push({
              testName: (suite.name ? suite.name.split(/[\\/]/).pop() : 'Test Suite Execution'),
              scenarioId: null,
              status: 'failed',
              durationMs: suite.perfStats?.end && suite.perfStats?.start ? suite.perfStats.end - suite.perfStats.start : 0,
              expected: null,
              actual: null,
              errorMessage: suiteError.slice(0, 1000),
              stackTrace: suiteError,
              consoleOutput: '',
            });
          }

          for (const assertion of suite.assertionResults || []) {
            const isPass = assertion.status === 'passed';
            const isFail = assertion.status === 'failed';
            const errorMsg = (assertion.failureMessages || []).join('\n');

            // Try to extract expected vs actual
            let expected = null;
            let actual = null;
            const expMatch = errorMsg.match(/Expected:\s*([^\n]+)/);
            const actMatch = errorMsg.match(/Received:\s*([^\n]+)/);
            if (expMatch) expected = expMatch[1].trim();
            if (actMatch) actual = actMatch[1].trim();

            results.push({
              testName: assertion.title || 'unnamed test',
              scenarioId: null,
              status: isPass ? 'passed' : isFail ? 'failed' : 'skipped',
              durationMs: assertion.duration || 0,
              expected,
              actual,
              errorMessage: errorMsg ? errorMsg.slice(0, 1000) : null,
              stackTrace: errorMsg || null,
              consoleOutput: '',
            });
          }
        }

          if (total === 0 && results.length > 0) {
            total = results.length;
            failed = results.filter((r) => r.status === 'failed').length;
            passed = results.filter((r) => r.status === 'passed').length;
          }

          return { total, passed, failed, skipped, durationMs, results };
        }
      } catch (_) {}
    }

    // 2. Fallback heuristic parser for text output (e.g. PASS / FAIL lines)
    const lines = output.split('\n');
    for (const line of lines) {
      const passMatch = line.match(/(?:√|✓|PASS)\s+(.+?)(?:\s+\((\d+)\s*(?:ms|s)\))?$/i);
      const failMatch = line.match(/(?:×|✕|FAIL)\s+(.+?)(?:\s+\((\d+)\s*(?:ms|s)\))?$/i);

      if (passMatch) {
        passed++;
        total++;
        results.push({
          testName: passMatch[1].trim(),
          status: 'passed',
          durationMs: parseInt(passMatch[2] || '10', 10),
          expected: null,
          actual: null,
          errorMessage: null,
          stackTrace: null,
          consoleOutput: '',
        });
      } else if (failMatch) {
        failed++;
        total++;
        results.push({
          testName: failMatch[1].trim(),
          status: 'failed',
          durationMs: parseInt(failMatch[2] || '10', 10),
          expected: null,
          actual: null,
          errorMessage: 'Assertion failed during test execution',
          stackTrace: null,
          consoleOutput: '',
        });
      }
    }

    return { total, passed, failed, skipped, durationMs, results };
  }

  /**
   * Combines multiple route test code blocks into a single valid Jest file,
   * deduplicating top-level require statements for supertest and app.
   *
   * @param {Array<string>} codeBlocks
   * @returns {string} Combined valid test code
   */
  static combineTestCodes(codeBlocks = []) {
    let hasSupertest = false;
    let hasApp = false;
    const headerLines = [];
    const suiteLines = [];

    for (const block of codeBlocks) {
      if (!block || !block.trim()) continue;
      const lines = block.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        // Capture first require of supertest
        if (/^(?:const|let|var)\s+request\s*=\s*require\(['"]supertest['"]\)/.test(trimmed)) {
          if (!hasSupertest) {
            headerLines.push("const request = require('supertest');");
            hasSupertest = true;
          }
          continue;
        }
        // Capture first require of app
        if (/^(?:const|let|var)\s+app\s*=\s*require\(/.test(trimmed)) {
          if (!hasApp) {
            headerLines.push(line);
            hasApp = true;
          }
          continue;
        }

        suiteLines.push(line);
      }
      suiteLines.push('');
    }

    if (!hasSupertest) {
      headerLines.unshift("const request = require('supertest');");
    }

    return [...headerLines, '', ...suiteLines].join('\n');
  }
}

module.exports = ExecutionPipeline;
