const mongoose = require('mongoose');

const CodeChunkSchema = new mongoose.Schema({
  repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  filePath: { type: String, required: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['route_handler', 'middleware', 'controller', 'function', 'class', 'module'],
    required: true,
  },
  content: { type: String, required: true },
  loc: {
    startLine: Number,
    endLine: Number,
  },
  associatedRoute: { type: String, default: null },
  associatedMethod: { type: String, default: null },
  calls: [{ type: String }],
  imports: [{ type: String }],
  embedding: {
    type: [Number],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

// Compound index for vector queries or text lookups
CodeChunkSchema.index({ repoId: 1, type: 1 });
CodeChunkSchema.index({ repoId: 1, filePath: 1 });

module.exports = mongoose.model('CodeChunk', CodeChunkSchema);
