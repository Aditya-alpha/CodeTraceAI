const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// GET /api/v1/users - protected with authMiddleware
router.get('/', authMiddleware, async (req, res) => {
  res.json({
    users: [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ],
  });
});

// GET /api/v1/users/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  return res.json({ id, name: 'Sample User' });
});

module.exports = router;
