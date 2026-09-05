const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGODB_URI || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  scratchDir: path.resolve(__dirname, '../../scratch'),
  fixturesDir: path.resolve(__dirname, '../../fixtures'),
};

module.exports = config;
