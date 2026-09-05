const mongoose = require('mongoose');

const ScenarioSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['happy_path', 'auth_case', 'validation_failure', 'branch', 'boundary'],
      required: true,
    },
    description: { type: String, required: true },
    confidence: {
      type: String,
      enum: ['high', 'low'],
      default: 'high',
    },
    confidenceReason: { type: String, default: '' },
    expectedStatus: { type: Number, required: true },
    payloadSample: { type: mongoose.Schema.Types.Mixed, default: null },
    headers: { type: mongoose.Schema.Types.Mixed, default: null },
    astOrigin: {
      branchCondition: String,
      loc: {
        startLine: Number,
        endLine: Number,
      },
    },
  },
  { _id: false }
);

const TestPlanSchema = new mongoose.Schema({
  repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true, index: true },
  method: { type: String, required: true },
  resolvedPath: { type: String, required: true },
  scenarios: [ScenarioSchema],
  testCode: { type: String, default: '' },
  syntaxValid: { type: Boolean, default: true },
  isReviewed: { type: Boolean, default: false },
  reviewedAt: { type: Date },
  developerNotes: { type: String, default: '' },
  status: {
    type: String,
    enum: ['generated', 'reviewed', 'modified'],
    default: 'generated',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('TestPlan', TestPlanSchema);
