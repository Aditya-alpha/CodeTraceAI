const VectorSearch = require('./vectorSearch');
const CodeChunk = require('../db/models/CodeChunk');
const Route = require('../db/models/Route');
const FunctionDef = require('../db/models/FunctionDef');
const llmService = require('./llmService');

class RagService {
  /**
   * Executes the full RAG Q&A pipeline for a user question.
   *
   * @param {string} repoId
   * @param {string} question
   * @returns {Promise<{ answer: string, citations: Array<object>, contextChunks: Array<object> }>}
   */
  static async answerQuestion(repoId, question) {
    if (!question || typeof question !== 'string' || !question.trim()) {
      throw new Error('Question must be a non-empty string');
    }

    // 1. Vector Search
    const topChunks = await VectorSearch.search(repoId, question, 6);

    // 2. AST Metadata Expansion
    const expandedChunks = await this._expandContextWithAst(repoId, question, topChunks);

    // 3. Assemble Bounded Context
    const boundedContext = this._assembleBoundedContext(expandedChunks, 14000); // ~3500 tokens

    // 4. Construct System & User Prompt
    const systemPrompt =
      "You are CodeTraceAI, an expert repository intelligence assistant specialized in static analysis, Express architecture, and API flow.\n\n" +
      "RULES FOR YOUR ANSWER:\n" +
      "1. Ground all answers strictly in the provided code context. Do NOT speculate or hallucinate.\n" +
      "2. You MUST cite specific files, functions, and lines for every technical claim using the format: `[filePath:startLine-endLine (function/route)]`.\n" +
      "3. If explaining authentication, routing, or database flow, trace the exact file path and middleware/controller function name from the context.\n" +
      "4. If the retrieved context does not contain sufficient information to answer the question with certainty, state clearly: 'The retrieved codebase context does not contain enough information to answer this completely.'\n\n" +
      `### REPOSITORY CODE CONTEXT:\n${boundedContext}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    // 5. Call LLM Service
    const answer = await llmService.complete(messages, {
      temperature: 0.2,
      maxTokens: 2048,
    });

    // 6. Extract structured citations
    const citations = expandedChunks.map((c) => ({
      filePath: c.filePath,
      name: c.name,
      type: c.type,
      loc: c.loc,
      associatedRoute: c.associatedRoute,
    }));

    return {
      answer,
      citations,
      contextChunks: expandedChunks.map((c) => ({
        filePath: c.filePath,
        name: c.name,
        type: c.type,
        loc: c.loc,
      })),
    };
  }

  /**
   * Expands context using AST structural relationships:
   * - If asking about auth, explicitly search for middleware files.
   * - If a route is retrieved, fetch its middleware functions.
   */
  static async _expandContextWithAst(repoId, question, initialChunks) {
    const chunkMap = new Map();
    for (const c of initialChunks) {
      chunkMap.set(`${c.filePath}::${c.name}`, c);
    }

    const lowerQ = question.toLowerCase();

    // Expansion A: If question mentions auth, token, jwt, login, permissions
    if (/(auth|token|jwt|login|protect|permission|role|user|session)/i.test(lowerQ)) {
      const authChunks = await CodeChunk.find({
        repoId,
        $or: [
          { type: 'middleware' },
          { filePath: { $regex: /auth|middleware|jwt|passport|protect/i } },
          { name: { $regex: /auth|token|verify|protect|check/i } },
        ],
      })
        .limit(3)
        .lean();

      for (const ac of authChunks) {
        chunkMap.set(`${ac.filePath}::${ac.name}`, ac);
      }
    }

    // Expansion B: For retrieved routes, check if they reference named middleware
    for (const chunk of initialChunks) {
      if (chunk.type === 'route_handler' && chunk.associatedRoute) {
        const routeDoc = await Route.findOne({
          repoId,
          resolvedPath: chunk.associatedRoute,
        }).lean();

        if (routeDoc && routeDoc.middlewares && routeDoc.middlewares.length > 0) {
          const mwChunks = await CodeChunk.find({
            repoId,
            name: { $in: routeDoc.middlewares },
          }).lean();

          for (const mwc of mwChunks) {
            chunkMap.set(`${mwc.filePath}::${mwc.name}`, mwc);
          }
        }
      }
    }

    return Array.from(chunkMap.values());
  }

  /**
   * Bounded context builder that avoids overflowing token limits.
   */
  static _assembleBoundedContext(chunks, maxCharBudget = 14000) {
    let budgetRemaining = maxCharBudget;
    const parts = [];

    for (const chunk of chunks) {
      const startLine = chunk.loc?.startLine || 1;
      const endLine = chunk.loc?.endLine || '?';
      const header = `### File: ${chunk.filePath} (Lines ${startLine}-${endLine}) | ${chunk.type}: ${chunk.name}\n`;

      const content = chunk.content || '';
      const allowedSnippetLen = Math.min(content.length, budgetRemaining - header.length - 20);

      if (allowedSnippetLen <= 50) break;

      const snippet = content.slice(0, allowedSnippetLen);
      parts.push(`${header}\`\`\`javascript\n${snippet}\n\`\`\`\n`);

      budgetRemaining -= header.length + snippet.length + 20;
    }

    return parts.join('\n');
  }
}

module.exports = RagService;
