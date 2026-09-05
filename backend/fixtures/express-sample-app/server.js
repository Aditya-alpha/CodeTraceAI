const express = require('express');
const apiRouter = require('./routes/index');

const app = express();
app.use(express.json());

// Mount the API router under /api/v1
app.use('/api/v1', apiRouter);

// Health route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;
