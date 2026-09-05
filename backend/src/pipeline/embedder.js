const config = require('../config');

let pipelinePromise = null;

class Embedder {
  static async _getPipeline() {
    if (!pipelinePromise) {
      pipelinePromise = (async () => {
        try {
          const { pipeline } = await import('@xenova/transformers');
          console.log(`[Embedder] Loading local embedding model: ${config.embeddingModel}...`);
          const pipe = await pipeline('feature-extraction', config.embeddingModel, {
            quantized: true,
          });
          console.log('[Embedder] Embedding model loaded successfully.');
          return pipe;
        } catch (err) {
          console.warn('[Embedder] Could not initialize @xenova/transformers:', err.message);
          console.log('[Embedder] Falling back to deterministic semantic hashing embedder.');
          return null;
        }
      })();
    }
    return pipelinePromise;
  }

  /**
   * Generates a 384-dimensional vector embedding for text.
   * @param {string} text
   * @returns {Promise<Array<number>>}
   */
  static async embed(text) {
    if (!text || typeof text !== 'string') {
      return new Array(384).fill(0);
    }

    // Truncate to reasonable token limit (e.g. 512 tokens / ~2000 chars)
    const truncated = text.slice(0, 2000);

    try {
      const pipe = await this._getPipeline();
      if (pipe) {
        const output = await pipe(truncated, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
      }
    } catch (err) {
      console.warn('[Embedder] Error during transformer embedding:', err.message);
    }

    // Fallback: deterministic pseudo-semantic 384-dim hash vector
    return this._fallbackEmbed(truncated);
  }

  /**
   * Deterministic normalized vector generator based on word and token hashing.
   * Ensures cosine similarity gives meaningful distance even offline.
   */
  static _fallbackEmbed(text) {
    const dim = 384;
    const vec = new Array(dim).fill(0);
    const tokens = text.toLowerCase().match(/\b[a-z0-9_]{2,}\b/g) || [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let hash = 0;
      for (let j = 0; j < token.length; j++) {
        hash = (hash << 5) - hash + token.charCodeAt(j);
        hash |= 0;
      }
      const idx = Math.abs(hash) % dim;
      vec[idx] += 1.0;

      // also hash bigrams
      if (i > 0) {
        const bigram = tokens[i - 1] + '_' + token;
        let biHash = 0;
        for (let j = 0; j < bigram.length; j++) {
          biHash = (biHash << 5) - biHash + bigram.charCodeAt(j);
          biHash |= 0;
        }
        const biIdx = Math.abs(biHash) % dim;
        vec[biIdx] += 1.5;
      }
    }

    // Normalize vector (L2 norm)
    let sumSq = 0;
    for (let i = 0; i < dim; i++) {
      sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq) || 1;
    return vec.map((v) => v / norm);
  }
}

module.exports = Embedder;
