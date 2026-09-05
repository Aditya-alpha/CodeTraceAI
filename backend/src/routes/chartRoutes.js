const express = require('express');
const router = express.Router();
const Route = require('../db/models/Route');
const FunctionDef = require('../db/models/FunctionDef');
const FlowchartService = require('../services/flowchartService');

// GET /api/repos/:id/flowcharts/route/:routeId
router.get('/:id/flowcharts/route/:routeId', async (req, res) => {
  try {
    const route = await Route.findOne({
      _id: req.params.routeId,
      repoId: req.params.id,
    }).lean();

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const depth = parseInt(req.query.depth, 10) || 4;
    const mermaid = FlowchartService.generateApiFlowchart(route, depth);

    return res.json({
      type: 'api_flow',
      route: {
        method: route.method,
        resolvedPath: route.resolvedPath,
        filePath: route.filePath,
        handlerName: route.handlerName,
        branchCount: (route.branches || []).length,
      },
      mermaid,
    });
  } catch (err) {
    console.error('[API] /flowcharts/route error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id/flowcharts/function/:funcId
router.get('/:id/flowcharts/function/:funcId', async (req, res) => {
  try {
    const func = await FunctionDef.findOne({
      _id: req.params.funcId,
      repoId: req.params.id,
    }).lean();

    if (!func) {
      return res.status(404).json({ error: 'Function not found' });
    }

    const mermaid = FlowchartService.generateFunctionFlowchart(func);

    return res.json({
      type: 'function_flow',
      function: {
        name: func.name,
        filePath: func.filePath,
        kind: func.kind,
        params: func.params,
      },
      mermaid,
    });
  } catch (err) {
    console.error('[API] /flowcharts/function error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id/flowcharts/architecture - Codebase architecture & module dependency graph
router.get('/:id/flowcharts/architecture', async (req, res) => {
  try {
    const CodeFile = require('../db/models/CodeFile');
    const files = await CodeFile.find({ repoId: req.params.id }).lean();
    const routes = await Route.find({ repoId: req.params.id }).lean();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'No files found for this repository' });
    }

    const { mermaid, layerStats } = FlowchartService.generateCodebaseArchitectureFlowchart(files, routes);

    return res.json({
      type: 'architecture_flow',
      title: 'Codebase Architecture & Dependency Graph',
      mermaid,
      layerStats,
    });
  } catch (err) {
    console.error('[API] /flowcharts/architecture error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id/flowcharts/file-tree - Visual directory & file structure
router.get('/:id/flowcharts/file-tree', async (req, res) => {
  try {
    const CodeFile = require('../db/models/CodeFile');
    const files = await CodeFile.find({ repoId: req.params.id }).lean();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'No files found for this repository' });
    }

    const mermaid = FlowchartService.generateFileTreeFlowchart(files);

    return res.json({
      type: 'file_tree_flow',
      title: 'Repository Directory Hierarchy',
      mermaid,
      fileCount: files.length,
    });
  } catch (err) {
    console.error('[API] /flowcharts/file-tree error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
