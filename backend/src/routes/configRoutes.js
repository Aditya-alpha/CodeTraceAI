const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const config = require('../config');
const llmService = require('../services/llmService');

// GET /api/config - Status of configured services
router.get('/', (req, res) => {
  const key = process.env.GROQ_API_KEY || config.groqApiKey;
  res.json({
    hasGroqKey: Boolean(key && key.trim().length > 0),
    maskedKey: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null,
    model: config.groqModel || 'openai/gpt-oss-120b',
  });
});

// POST /api/config/groq-key - Set and validate Groq API Key
router.post('/groq-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({ error: 'API key must be a non-empty string' });
    }

    const trimmedKey = apiKey.trim();

    // Validate key by running a tiny completion with Groq
    try {
      const testGroq = new Groq({ apiKey: trimmedKey });
      await testGroq.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // lightweight probe
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
    } catch (testErr) {
      return res.status(400).json({
        error: `Invalid Groq API Key: ${testErr.message || 'Verification failed'}`,
      });
    }

    // Set in runtime process.env
    process.env.GROQ_API_KEY = trimmedKey;
    config.groqApiKey = trimmedKey;
    llmService.initClient(trimmedKey);

    // Persist to backend/.env
    const envPath = path.resolve(__dirname, '../../.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    if (envContent.includes('GROQ_API_KEY=')) {
      envContent = envContent.replace(/GROQ_API_KEY=.*/g, `GROQ_API_KEY=${trimmedKey}`);
    } else {
      envContent += `\nGROQ_API_KEY=${trimmedKey}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');

    return res.json({
      success: true,
      message: 'Groq API Key verified and saved successfully!',
      maskedKey: `${trimmedKey.slice(0, 4)}...${trimmedKey.slice(-4)}`,
    });
  } catch (err) {
    console.error('[API] Error setting Groq key:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
