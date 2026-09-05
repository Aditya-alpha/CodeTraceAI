const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const Repository = require('../db/models/Repository');
const CodeFile = require('../db/models/CodeFile');
const Route = require('../db/models/Route');
const FunctionDef = require('../db/models/FunctionDef');
const Orchestrator = require('../pipeline/orchestrator');
const Cloner = require('../pipeline/cloner');

// POST /api/repos/analyze - Start analyzing a repository
router.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL must be a non-empty string' });
    }

    const validation = Cloner.validateUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    const repo = new Repository({
      url: url.trim(),
      name: validation.repoName || 'analyzing-repo',
      status: 'pending',
      progressStep: 'Queued for analysis',
      progressPercent: 5,
    });
    await repo.save();

    // Run pipeline asynchronously so client can poll progress
    Orchestrator.processRepository(repo._id, url).catch((err) => {
      console.error(`[API] Async processing failed for ${repo._id}:`, err);
    });

    return res.status(202).json({
      repoId: repo._id,
      status: repo.status,
      message: 'Analysis initiated',
    });
  } catch (err) {
    console.error('[API] /analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/repos - List recent repositories
router.get('/', async (req, res) => {
  try {
    const repos = await Repository.find().sort({ createdAt: -1 }).limit(20).lean();
    return res.json({ repos });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id - Get repository status & progress
router.get('/:id', async (req, res) => {
  try {
    const repo = await Repository.findById(req.params.id).lean();
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    return res.json({ repo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id/overview - Get repository overview
router.get('/:id/overview', async (req, res) => {
  try {
    const repo = await Repository.findById(req.params.id).lean();
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const routes = await Route.find({ repoId: req.params.id }).limit(50).lean();
    const files = await CodeFile.find({ repoId: req.params.id }).select('relativePath fileName extension size lineCount').lean();

    return res.json({
      repo,
      files,
      routesSummary: {
        total: repo.stats.routeCount,
        sampleRoutes: routes.slice(0, 10),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id/files - List files or fetch specific file content
router.get('/:id/files', async (req, res) => {
  try {
    const repo = await Repository.findById(req.params.id).lean();
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const requestedPath = req.query.path;

    if (requestedPath && repo.workspacePath) {
      const fullPath = path.resolve(repo.workspacePath, requestedPath);
      // Security check: ensure path stays within workspacePath
      if (!fullPath.startsWith(path.resolve(repo.workspacePath))) {
        return res.status(403).json({ error: 'Access denied outside repository workspace' });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found on disk' });
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      return res.json({ path: requestedPath, content });
    }

    const files = await CodeFile.find({ repoId: req.params.id }).lean();
    return res.json({ files });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id/apis - Get formal route inventory
router.get('/:id/apis', async (req, res) => {
  try {
    const { method, search } = req.query;
    const filter = { repoId: req.params.id };

    if (method && method !== 'ALL') {
      filter.method = method.toUpperCase();
    }
    if (search) {
      filter.resolvedPath = { $regex: search, $options: 'i' };
    }

    const routes = await Route.find(filter).sort({ resolvedPath: 1 }).lean();
    return res.json({ routes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id/functions - Get discovered functions
router.get('/:id/functions', async (req, res) => {
  try {
    const functions = await FunctionDef.find({ repoId: req.params.id }).limit(100).lean();
    return res.json({ functions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
