const Repository = require('../db/models/Repository');
const CodeFile = require('../db/models/CodeFile');
const Route = require('../db/models/Route');
const FunctionDef = require('../db/models/FunctionDef');
const CodeChunk = require('../db/models/CodeChunk');

const Cloner = require('./cloner');
const Detector = require('./detector');
const FileWalker = require('./fileWalker');
const AstParser = require('./ast/parser');
const RouteExtractor = require('./ast/routeExtractor');
const RouterResolver = require('./ast/routerResolver');
const Chunker = require('./chunker');
const Embedder = require('./embedder');

class Orchestrator {
  /**
   * Runs the complete Phase 1 ingestion, AST analysis, and indexing pipeline.
   * @param {string} repoId
   * @param {string} url
   */
  static async processRepository(repoId, url) {
    const repo = await Repository.findById(repoId);
    if (!repo) throw new Error(`Repository ${repoId} not found`);

    try {
      // Step 1: Clone
      await this._updateProgress(repo, 'cloning', 'Cloning repository workspace...', 15);
      const cloneInfo = await Cloner.cloneRepo(url, repoId);
      repo.workspacePath = cloneInfo.workspacePath;
      repo.name = cloneInfo.name;
      repo.defaultBranch = cloneInfo.branch;
      await repo.save();

      // Step 2: Detect Express
      await this._updateProgress(repo, 'analyzing', 'Detecting project framework & dependencies...', 30);
      const detection = Detector.detectExpress(cloneInfo.workspacePath);

      if (!detection.isExpress) {
        repo.status = 'unsupported';
        repo.errorReason = detection.reason;
        repo.progressStep = 'Rejected: Unsupported repository type';
        repo.progressPercent = 100;
        await repo.save();
        console.log(`[Orchestrator] Repository rejected: ${detection.reason}`);
        return repo;
      }

      repo.framework = 'express';
      repo.metadata = {
        hasTypeScript: detection.hasTypeScript,
        expressVersion: detection.expressVersion,
        packageJson: detection.packageJson || {},
      };
      await repo.save();

      // Step 3: Discover Source Files
      await this._updateProgress(repo, 'analyzing', 'Discovering source files...', 45);
      const rawFiles = FileWalker.walk(cloneInfo.workspacePath);
      console.log(`[Orchestrator] Discovered ${rawFiles.length} source files.`);

      // Step 4: Parse AST & Extract Route facts
      await this._updateProgress(repo, 'analyzing', 'Running Babel AST parser on source files...', 60);
      const fileResults = [];

      for (const file of rawFiles) {
        const ast = AstParser.parse(file.content, file.fileName);
        const extraction = RouteExtractor.extractFromFile(ast, file.content, file.relativePath);

        fileResults.push({
          ...file,
          ...extraction,
        });
      }

      // Step 5: Resolve cross-router prefixes
      await this._updateProgress(repo, 'analyzing', 'Resolving mounted router prefixes...', 75);
      const resolvedRoutes = RouterResolver.resolveAllRoutes(fileResults);
      console.log(`[Orchestrator] Discovered and resolved ${resolvedRoutes.length} callable routes.`);

      // Step 6: Create Semantic Chunks & Embeddings
      await this._updateProgress(repo, 'analyzing', 'Chunking code & computing vector embeddings...', 85);
      const chunks = Chunker.createSemanticChunks(fileResults, resolvedRoutes);
      console.log(`[Orchestrator] Generated ${chunks.length} semantic code chunks.`);

      // Step 7: Persist Data to MongoDB
      // Clean previous analysis data for this repo
      await Promise.all([
        CodeFile.deleteMany({ repoId }),
        Route.deleteMany({ repoId }),
        FunctionDef.deleteMany({ repoId }),
        CodeChunk.deleteMany({ repoId }),
      ]);

      // Save CodeFiles
      const savedFiles = await CodeFile.insertMany(
        fileResults.map((f) => ({
          repoId,
          relativePath: f.relativePath,
          fileName: f.fileName,
          extension: f.extension,
          size: f.size,
          lineCount: f.lineCount,
          imports: f.imports || [],
          exports: (f.exports || []).map((e) => ({
            name: e.name,
            exportType: e.type || 'default',
          })),
        }))
      );

      const fileIdMap = new Map();
      savedFiles.forEach((sf) => fileIdMap.set(sf.relativePath, sf._id));

      // Save Routes
      let totalDbCalls = 0;
      let totalHttpCalls = 0;

      const routeDocs = resolvedRoutes.map((r) => {
        totalDbCalls += (r.dbCalls || []).length;
        totalHttpCalls += (r.httpCalls || []).length;

        return {
          repoId,
          fileId: fileIdMap.get(r.filePath) || null,
          filePath: r.filePath,
          method: r.method,
          rawPath: r.rawPath,
          resolvedPath: r.resolvedPath,
          middlewares: r.middlewares || [],
          handlerName: r.handlerName,
          handlerCodeSnippet: r.handlerCodeSnippet || '',
          loc: r.loc,
          branches: r.branches || [],
          dbCalls: r.dbCalls || [],
          httpCalls: r.httpCalls || [],
          responses: r.responses || [],
        };
      });
      await Route.insertMany(routeDocs);

      // Save Functions
      let totalFunctions = 0;
      const funcDocs = [];
      for (const f of fileResults) {
        for (const fn of f.functions || []) {
          totalFunctions++;
          funcDocs.push({
            repoId,
            fileId: fileIdMap.get(f.relativePath) || null,
            filePath: f.relativePath,
            name: fn.name,
            kind: fn.kind,
            isAsync: fn.isAsync,
            params: fn.params,
            loc: fn.loc,
            calls: fn.calls,
            codeSnippet: fn.codeSnippet,
          });
        }
      }
      if (funcDocs.length > 0) {
        await FunctionDef.insertMany(funcDocs);
      }

      // Compute Embeddings & Save Chunks
      const chunkDocs = [];
      for (const chunk of chunks) {
        const embedding = await Embedder.embed(chunk.content);
        chunkDocs.push({
          repoId,
          filePath: chunk.filePath,
          name: chunk.name,
          type: chunk.type,
          content: chunk.content,
          loc: chunk.loc,
          associatedRoute: chunk.associatedRoute,
          associatedMethod: chunk.associatedMethod,
          calls: chunk.calls || [],
          imports: chunk.imports || [],
          embedding,
        });
      }
      if (chunkDocs.length > 0) {
        await CodeChunk.insertMany(chunkDocs);
      }

      // Step 8: Mark Ready
      repo.status = 'ready';
      repo.progressStep = 'Analysis complete';
      repo.progressPercent = 100;
      repo.stats = {
        fileCount: rawFiles.length,
        routeCount: resolvedRoutes.length,
        functionCount: totalFunctions,
        chunkCount: chunks.length,
        dbCallCount: totalDbCalls,
        httpCallCount: totalHttpCalls,
      };
      await repo.save();

      console.log(`[Orchestrator] Repository ${repo.name} successfully analyzed!`);
      return repo;
    } catch (err) {
      console.error(`[Orchestrator] Error processing repository:`, err);
      repo.status = 'error';
      repo.errorReason = err.message;
      repo.progressStep = `Failed: ${err.message}`;
      await repo.save();
      throw err;
    }
  }

  static async _updateProgress(repo, status, step, percent) {
    repo.status = status;
    repo.progressStep = step;
    repo.progressPercent = percent;
    await repo.save();
  }
}

module.exports = Orchestrator;
