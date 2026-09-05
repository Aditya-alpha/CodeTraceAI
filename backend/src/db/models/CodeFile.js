const mongoose = require('mongoose');

const CodeFileSchema = new mongoose.Schema({
  repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  relativePath: { type: String, required: true },
  fileName: { type: String, required: true },
  extension: { type: String, required: true },
  size: { type: Number, default: 0 },
  lineCount: { type: Number, default: 0 },
  isExpressEntry: { type: Boolean, default: false },
  imports: [{
    source: String,
    specifiers: [String],
    isDefault: Boolean,
    isNamespace: Boolean,
  }],
  exports: [{
    name: String,
    exportType: { type: String, default: 'default' },
  }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CodeFile', CodeFileSchema);
