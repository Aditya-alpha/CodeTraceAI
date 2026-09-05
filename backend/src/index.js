const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { connectDb } = require('./db');

const repoRoutes = require('./routes/repoRoutes');
const qaRoutes = require('./routes/qaRoutes');
const chartRoutes = require('./routes/chartRoutes');
const configRoutes = require('./routes/configRoutes');
const testRoutes = require('./routes/testRoutes');

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/config', configRoutes);
app.use('/api/repos', repoRoutes);
app.use('/api/repos', qaRoutes);
app.use('/api/repos', chartRoutes);
app.use('/api/repos', testRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
async function start() {
  try {
    await connectDb();
    const server = app.listen(config.port, () => {
      console.log(`=================================================`);
      console.log(`🚀 CodeTraceAI Backend running on port ${config.port}`);
      console.log(`🌐 Health endpoint: http://localhost:${config.port}/health`);
      console.log(`=================================================`);
    });
    return server;
  } catch (err) {
    console.error('Failed to start CodeTraceAI server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
