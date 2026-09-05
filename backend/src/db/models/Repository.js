const mongoose = require('mongoose');

const RepositorySchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'cloning', 'analyzing', 'ready', 'unsupported', 'error'],
    default: 'pending',
  },
  progressStep: { type: String, default: 'Initialized' },
  progressPercent: { type: Number, default: 0 },
  errorReason: { type: String, default: null },
  framework: { type: String, default: null },
  defaultBranch: { type: String, default: 'main' },
  workspacePath: { type: String, default: null },
  stats: {
    fileCount: { type: Number, default: 0 },
    routeCount: { type: Number, default: 0 },
    functionCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    dbCallCount: { type: Number, default: 0 },
    httpCallCount: { type: Number, default: 0 },
  },
  metadata: {
    hasTypeScript: { type: Boolean, default: false },
    expressVersion: { type: String, default: null },
    packageJson: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Repository', RepositorySchema);
