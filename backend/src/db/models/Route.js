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
  // Phase 2: Formal API Inventory & Schema Definitions
  parameters: {
    pathParams: [{
      name: String,
      paramType: { type: String, default: 'string' },
      required: { type: Boolean, default: true },
      description: String,
    }],
    queryParams: [{
      name: String,
      paramType: { type: String, default: 'string' },
      required: { type: Boolean, default: false },
      description: String,
    }],
    bodyParams: [{
      name: String,
      paramType: { type: String, default: 'string' },
      required: { type: Boolean, default: false },
      validationRule: String,
      schemaSource: String,
    }],
  },
  authRequirement: {
    required: { type: Boolean, default: false },
    authType: { type: String, default: 'none' }, // 'jwt_bearer' | 'api_key' | 'session' | 'basic' | 'custom'
    middlewareName: String,
    headerName: String,
  },
  validationDetails: {
    library: { type: String, default: 'none' }, // 'express-validator' | 'joi' | 'zod' | 'inline_manual' | 'mongoose' | 'none'
    rules: [{
      field: String,
      rule: String,
      min: Number,
      max: Number,
      message: String,
    }],
  },
  knownResponseShapes: [{
    statusCode: Number,
    keys: [{ type: String }],
    sampleJson: String,
  }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Route', RouteSchema);
