const mongoose = require('mongoose');

const FunctionDefSchema = new mongoose.Schema({
  repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodeFile' },
  filePath: { type: String, required: true },
  name: { type: String, required: true },
  kind: {
    type: String,
    enum: ['function', 'arrow', 'method', 'class'],
    default: 'function',
  },
  isAsync: { type: Boolean, default: false },
  isGenerator: { type: Boolean, default: false },
  params: [{ type: String }],
  loc: {
    startLine: Number,
    endLine: Number,
    startColumn: Number,
    endColumn: Number,
  },
  calls: [{ type: String }],
  isMiddleware: { type: Boolean, default: false },
  isRouteHandler: { type: Boolean, default: false },
  codeSnippet: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('FunctionDef', FunctionDefSchema);
