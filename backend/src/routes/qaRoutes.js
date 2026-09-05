const express = require('express');
const router = express.Router();
const RagService = require('../services/ragService');
const Repository = require('../db/models/Repository');

// POST /api/repos/:id/qa - Ask a free-text question about the repository
router.post('/:id/qa', async (req, res) => {
  try {
    const { question } = req.body;
    const repoId = req.params.id;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Question must be a non-empty string' });
    }

    const repo = await Repository.findById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (repo.status !== 'ready') {
      return res.status(400).json({
        error: `Repository is not ready for Q&A yet (current status: ${repo.status})`,
      });
    }

    const result = await RagService.answerQuestion(repoId, question.trim());

    return res.json({
      question: question.trim(),
      answer: result.answer,
      citations: result.citations,
      contextChunks: result.contextChunks,
    });
  } catch (err) {
    console.error('[API] /qa error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
