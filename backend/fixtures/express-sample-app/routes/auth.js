const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Simulated user lookup
  if (email !== 'admin@example.com') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: 'u123', email }, 'supersecretkey123', { expiresIn: '1h' });
  return res.status(200).json({ token, message: 'Login successful' });
});

// POST /register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  return res.status(201).json({
    message: 'User registered successfully',
    user: { id: 'u124', email, name },
  });
});

module.exports = router;
