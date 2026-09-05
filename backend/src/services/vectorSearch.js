const CodeChunk = require('../db/models/CodeChunk');
const Embedder = require('../pipeline/embedder');

class VectorSearch {
  /**
   * Performs vector search against CodeChunk collection for a given repository.
   * Uses MongoDB Atlas $vectorSearch if configured, falling back to exact cosine similarity.
   *
   * @param {string|mongoose.Types.ObjectId} repoId
   * @param {string} query
   * @param {number} topK
   * @returns {Promise<Array<object>>} Top matching chunks with similarity score
   */
  static async search(repoId, query, topK = 6) {
    const queryVector = await Embedder.embed(query);

    // 1. Attempt MongoDB Atlas $vectorSearch
    try {
      const atlasPipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryVector,
            numCandidates: topK * 10,
            limit: topK,
            filter: { repoId: { $eq: repoId } },
          },
        },
        {
          $project: {
            filePath: 1,
            name: 1,
            type: 1,
            content: 1,
            loc: 1,
            associatedRoute: 1,
            calls: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      const results = await CodeChunk.aggregate(atlasPipeline);
      if (results && results.length > 0) {
        return results;
      }
    } catch (atlasErr) {
      // Atlas $vectorSearch not supported on local/non-Atlas instances - expected in local dev
    }

    // 2. Fallback: Exact In-Memory / MongoDB Cosine Similarity
    const chunks = await CodeChunk.find({ repoId }).lean();
    if (!chunks || chunks.length === 0) {
      return [];
    }

    const scored = chunks.map((chunk) => {
      const score = this._cosineSimilarity(queryVector, chunk.embedding);
      return {
        _id: chunk._id,
        filePath: chunk.filePath,
        name: chunk.name,
        type: chunk.type,
        content: chunk.content,
        loc: chunk.loc,
        associatedRoute: chunk.associatedRoute,
        calls: chunk.calls,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  static _cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

module.exports = VectorSearch;
