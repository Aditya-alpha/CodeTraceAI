const express = require('express');
const router = express.Router();
const Route = require('../db/models/Route');
const TestPlan = require('../db/models/TestPlan');
const TestRun = require('../db/models/TestRun');
const TestGeneratorService = require('../services/testGeneratorService');
const ExecutionPipeline = require('../services/executionPipeline');
const AstParser = require('../pipeline/ast/parser');

/**
 * GET /api/repos/:id/tests
 * Lists all test plans generated for this repository with summary metrics.
 */
router.get('/:id/tests', async (req, res) => {
  try {
    const { id } = req.params;
    const [testPlans, routes] = await Promise.all([
      TestPlan.find({ repoId: id }).sort({ createdAt: -1 }),
      Route.find({ repoId: id }).select('_id method resolvedPath handlerName parameters authRequirement'),
    ]);

    const totalRoutes = routes.length;
    const generatedTests = testPlans.length;
    const reviewedTests = testPlans.filter((t) => t.isReviewed).length;

    return res.status(200).json({
      testPlans,
      routes,
      stats: {
        totalRoutes,
        generatedTests,
        reviewedTests,
        pendingReview: generatedTests - reviewedTests,
      },
    });
  } catch (err) {
    console.error('[TestRoutes] Error fetching repo tests:', err);
    return res.status(500).json({ error: 'Failed to fetch test plans', details: err.message });
  }
});

/**
 * GET /api/repos/:id/routes/:routeId/tests
 * Retrieves or auto-generates test plan for a specific route.
 */
router.get('/:id/routes/:routeId/tests', async (req, res) => {
  try {
    const { id, routeId } = req.params;
    let testPlan = await TestPlan.findOne({ repoId: id, routeId });

    if (!testPlan) {
      const route = await Route.findOne({ _id: routeId, repoId: id });
      if (!route) {
        return res.status(404).json({ error: 'Route not found' });
      }

      const generated = await TestGeneratorService.generateTestPlan(route);
      testPlan = await TestPlan.create({
        repoId: id,
        routeId,
        method: route.method,
        resolvedPath: route.resolvedPath,
        scenarios: generated.scenarios,
        testCode: generated.testCode,
        syntaxValid: generated.syntaxValid,
        status: 'generated',
      });
    }

    return res.status(200).json({ testPlan });
  } catch (err) {
    console.error('[TestRoutes] Error retrieving route test:', err);
    return res.status(500).json({ error: 'Failed to get test plan', details: err.message });
  }
});

/**
 * POST /api/repos/:id/routes/:routeId/generate-tests
 * Forces regeneration of test suite for a specific route.
 */
router.post('/:id/routes/:routeId/generate-tests', async (req, res) => {
  try {
    const { id, routeId } = req.params;
    const route = await Route.findOne({ _id: routeId, repoId: id });
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const generated = await TestGeneratorService.generateTestPlan(route);

    let testPlan = await TestPlan.findOne({ repoId: id, routeId });
    if (testPlan) {
      testPlan.scenarios = generated.scenarios;
      testPlan.testCode = generated.testCode;
      testPlan.syntaxValid = generated.syntaxValid;
      testPlan.status = 'generated';
      testPlan.updatedAt = new Date();
      await testPlan.save();
    } else {
      testPlan = await TestPlan.create({
        repoId: id,
        routeId,
        method: route.method,
        resolvedPath: route.resolvedPath,
        scenarios: generated.scenarios,
        testCode: generated.testCode,
        syntaxValid: generated.syntaxValid,
        status: 'generated',
      });
    }

    return res.status(200).json({ testPlan, message: 'Test plan generated successfully' });
  } catch (err) {
    console.error('[TestRoutes] Error generating route test:', err);
    return res.status(500).json({ error: 'Failed to generate test plan', details: err.message });
  }
});

/**
 * POST /api/repos/:id/generate-all-tests
 * Batch generates test suites for all routes in the repository.
 */
router.post('/:id/generate-all-tests', async (req, res) => {
  try {
    const { id } = req.params;
    const routes = await Route.find({ repoId: id });

    if (!routes || routes.length === 0) {
      return res.status(400).json({ error: 'No routes found to generate tests for' });
    }

    const generatedPlans = [];
    for (const route of routes) {
      try {
        const generated = await TestGeneratorService.generateTestPlan(route);
        let testPlan = await TestPlan.findOne({ repoId: id, routeId: route._id });

        if (testPlan) {
          testPlan.scenarios = generated.scenarios;
          testPlan.testCode = generated.testCode;
          testPlan.syntaxValid = generated.syntaxValid;
          testPlan.updatedAt = new Date();
          await testPlan.save();
        } else {
          testPlan = await TestPlan.create({
            repoId: id,
            routeId: route._id,
            method: route.method,
            resolvedPath: route.resolvedPath,
            scenarios: generated.scenarios,
            testCode: generated.testCode,
            syntaxValid: generated.syntaxValid,
            status: 'generated',
          });
        }
        generatedPlans.push(testPlan);
      } catch (genErr) {
        console.warn(`[TestRoutes] Failed to generate test for route ${route.method} ${route.resolvedPath}:`, genErr.message);
      }
    }

    return res.status(200).json({
      testPlans: generatedPlans,
      count: generatedPlans.length,
      message: `Generated ${generatedPlans.length} test suites`,
    });
  } catch (err) {
    console.error('[TestRoutes] Error batch generating tests:', err);
    return res.status(500).json({ error: 'Batch test generation failed', details: err.message });
  }
});

/**
 * PATCH /api/repos/:id/tests/:testPlanId
 * Updates test plan review status, custom developer notes, or edited test code.
 */
router.patch('/:id/tests/:testPlanId', async (req, res) => {
  try {
    const { id, testPlanId } = req.params;
    const { isReviewed, developerNotes, testCode } = req.body;

    const testPlan = await TestPlan.findOne({ _id: testPlanId, repoId: id });
    if (!testPlan) {
      return res.status(404).json({ error: 'Test plan not found' });
    }

    if (typeof isReviewed === 'boolean') {
      testPlan.isReviewed = isReviewed;
      testPlan.reviewedAt = isReviewed ? new Date() : null;
      testPlan.status = isReviewed ? 'reviewed' : 'generated';
    }

    if (typeof developerNotes === 'string') {
      testPlan.developerNotes = developerNotes;
    }

    if (typeof testCode === 'string') {
      testPlan.testCode = testCode;
      try {
        AstParser.parse(testCode, 'editedTest.js');
        testPlan.syntaxValid = true;
      } catch (parseErr) {
        testPlan.syntaxValid = false;
      }
      testPlan.status = 'modified';
    }

    testPlan.updatedAt = new Date();
    await testPlan.save();

    return res.status(200).json({ testPlan, message: 'Test plan updated' });
  } catch (err) {
    console.error('[TestRoutes] Error updating test plan:', err);
    return res.status(500).json({ error: 'Failed to update test plan', details: err.message });
  }
});

// ==========================================================
// PHASE 3: DOCKER / SANDBOXED TEST EXECUTION ENDPOINTS
// ==========================================================

/**
 * POST /api/repos/:id/tests/run
 * Triggers execution of tests inside an isolated Docker or sandboxed container.
 */
router.post('/:id/tests/run', async (req, res) => {
  try {
    const { id } = req.params;
    const { routeId = null, preferredMode = 'auto' } = req.body || {};

    const testRun = await ExecutionPipeline.run({
      repoId: id,
      routeId,
      preferredMode,
    });

    return res.status(200).json({
      testRun,
      message: testRun.status === 'cannot_boot'
        ? `Cannot boot: ${testRun.bootstrapping?.errorReason}`
        : `Execution ${testRun.status}`,
    });
  } catch (err) {
    console.error('[TestRoutes] Error executing tests:', err);
    return res.status(500).json({ error: 'Failed to execute tests', details: err.message });
  }
});

/**
 * GET /api/repos/:id/tests/runs
 * Lists historical test execution runs for a repository.
 */
router.get('/:id/tests/runs', async (req, res) => {
  try {
    const { id } = req.params;
    const runs = await TestRun.find({ repoId: id }).sort({ createdAt: -1 }).limit(30);
    return res.status(200).json({ runs });
  } catch (err) {
    console.error('[TestRoutes] Error fetching test runs:', err);
    return res.status(500).json({ error: 'Failed to fetch test runs', details: err.message });
  }
});

/**
 * GET /api/repos/:id/tests/runs/:runId
 * Retrieves detailed telemetry for a single test run.
 */
router.get('/:id/tests/runs/:runId', async (req, res) => {
  try {
    const { id, runId } = req.params;
    const run = await TestRun.findOne({ _id: runId, repoId: id });
    if (!run) {
      return res.status(404).json({ error: 'Test run not found' });
    }
    return res.status(200).json({ run });
  } catch (err) {
    console.error('[TestRoutes] Error fetching test run details:', err);
    return res.status(500).json({ error: 'Failed to fetch test run details', details: err.message });
  }
});

module.exports = router;

