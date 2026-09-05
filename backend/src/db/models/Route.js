const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
  repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodeFile' },
  filePath: { type: String, required: true },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'ALL', 'USE'],
    uppercase: true,
  },
  rawPath: { type: String, required: true },
  resolvedPath: { type: String, required: true, index: true },
  middlewares: [{ type: String }],
  handlerName: { type: String, default: 'anonymous' },
  handlerCodeSnippet: { type: String, default: '' },
  loc: {
    startLine: Number,
    endLine: Number,
    startColumn: Number,
    endColumn: Number,
  },
  branches: [{
    type: { type: String }, // 'if' | 'switch_case' | 'ternary' | 'try_catch'
    condition: String,
    loc: {
      startLine: Number,
      endLine: Number,
    },
  }],
  dbCalls: [{
    callee: String,
    method: String,
    heuristic: String,
    loc: {
      startLine: Number,
      endLine: Number,
    },
  }],
  httpCalls: [{
    callee: String,
    method: String,
    heuristic: String,
    loc: {
      startLine: Number,
      endLine: Number,
    },
  }],
  responses: [{
    statusCode: Number,
    method: String, // 'json' | 'send' | 'sendStatus' | 'end'
    loc: {
      startLine: Number,
      endLine: Number,
    },
  }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Route', RouteSchema);
