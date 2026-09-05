const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const authMiddleware = require('../middleware/auth');

// GET /api/v1/articles
router.get('/', async (req, res) => {
  try {
    const articles = await Article.find({ status: 'published' }).limit(20);
    return res.status(200).json({ articles });
  } catch (err) {
    return res.status(500).json({ error: 'Database query failed' });
  }
});

// POST /api/v1/articles - Multiple conditional branches
router.post('/', authMiddleware, async (req, res) => {
  const { title, content } = req.body;

  // Branch 1: Missing required fields
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  // Branch 2: Validation constraint
  if (title.length < 5) {
    return res.status(422).json({ error: 'Title must be at least 5 characters long' });
  }

  try {
    const article = await Article.create({
      title,
      content,
      authorId: req.user?.id || 'anonymous',
      status: 'draft',
    });

    return res.status(201).json({ article, message: 'Article created successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create article' });
  }
});

// GET /api/v1/articles/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // Branch 1: ID check
  if (!id || id.length !== 24) {
    return res.status(400).json({ error: 'Invalid article ID format' });
  }

  const article = await Article.findById(id);

  // Branch 2: Existence check
  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }

  return res.status(200).json({ article });
});

module.exports = router;
