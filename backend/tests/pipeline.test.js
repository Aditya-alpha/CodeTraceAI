const path = require('path');
const { connectDb, disconnectDb } = require('../src/db');
const Repository = require('../src/db/models/Repository');
const Route = require('../src/db/models/Route');
const CodeChunk = require('../src/db/models/CodeChunk');
const Orchestrator = require('../src/pipeline/orchestrator');
const RagService = require('../src/services/ragService');

describe('Full Pipeline Ingestion & RAG Verification', () => {
  beforeAll(async () => {
    await connectDb();
  }, 30000);

  afterAll(async () => {
    await disconnectDb();
  });

  let testRepo = null;

  test('ingests, parses AST, resolves routes, and indexes express-sample-app', async () => {
    testRepo = new Repository({
      url: 'fixture:express-sample-app',
      name: 'express-sample-app',
      status: 'pending',
    });
    await testRepo.save();

    const processed = await Orchestrator.processRepository(testRepo._id, 'fixture:express-sample-app');

    expect(processed.status).toBe('ready');
    expect(processed.framework).toBe('express');
    expect(processed.stats.fileCount).toBeGreaterThanOrEqual(6);
    expect(processed.stats.routeCount).toBeGreaterThanOrEqual(6);
    expect(processed.stats.chunkCount).toBeGreaterThan(0);

    // Verify resolved routes
    const routes = await Route.find({ repoId: testRepo._id }).lean();
    const resolvedPaths = routes.map((r) => `${r.method} ${r.resolvedPath}`);

    expect(resolvedPaths).toContain('POST /api/v1/auth/login');
    expect(resolvedPaths).toContain('POST /api/v1/auth/register');
    expect(resolvedPaths).toContain('GET /api/v1/users');
    expect(resolvedPaths).toContain('GET /api/v1/articles');
    expect(resolvedPaths).toContain('POST /api/v1/articles');
  }, 40000);

  test('RAG accurately answers auth question citing actual middleware file', async () => {
    expect(testRepo).not.toBeNull();

    const result = await RagService.answerQuestion(testRepo._id, 'How does authentication work?');

    expect(result.answer).toBeDefined();
    expect(result.citations.length).toBeGreaterThan(0);

    // Verify that the actual middleware file is cited
    const citedFiles = result.citations.map((c) => c.filePath);
    const hasAuthMiddleware = citedFiles.some((f) => /auth\.js/i.test(f));
    expect(hasAuthMiddleware).toBe(true);

    // Verify that context chunks contain the actual token verification code
    const authChunk = result.contextChunks.find((c) => /auth\.js/i.test(c.filePath));
    expect(authChunk).toBeDefined();
  }, 30000);
});
