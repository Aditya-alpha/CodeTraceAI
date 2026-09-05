const mongoose = require('mongoose');

const TestResultItemSchema = new mongoose.Schema(
  {
    testName: { type: String, required: true },
    scenarioId: { type: String },
    status: {
      type: String,
      enum: ['passed', 'failed', 'skipped'],
      required: true,
    },
    durationMs: { type: Number, default: 0 },
    expected: { type: String, default: null },
    actual: { type: String, default: null },
    errorMessage: { type: String, default: null },
    stackTrace: { type: String, default: null },
    consoleOutput: { type: String, default: '' },
  },
  { _id: false }
);

const TestRunSchema = new mongoose.Schema({
  repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', index: true },
  testPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestPlan', index: true },
  executionMode: {
    type: String,
    enum: ['docker', 'sandboxed'],
    default: 'sandboxed',
  },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed', 'cannot_boot'],
    default: 'running',
    index: true,
  },
  summary: {
    total: { type: Number, default: 0 },
    passed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    passRate: { type: Number, default: 0 },
  },
  results: [TestResultItemSchema],
  bootstrapping: {
    strategy: { type: String, default: 'standard_express' },
    startCommand: { type: String, default: '' },
    entryFile: { type: String, default: '' },
    envVarsInjected: [{ type: String }],
    missingSecrets: [{ type: String }],
    errorReason: { type: String, default: '' },
  },
  rawLogs: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date },
});

module.exports = mongoose.model('TestRun', TestRunSchema);
