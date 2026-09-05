const TestGeneratorService = require('../src/services/testGeneratorService');
const AstParser = require('../src/pipeline/ast/parser');

describe('TestGeneratorService (Jest + Supertest Generation)', () => {
  const mockRoute = {
    method: 'POST',
    resolvedPath: '/api/v1/articles',
    handlerName: 'createArticle',
    middlewares: ['authMiddleware'],
    parameters: {
      pathParams: [],
      queryParams: [],
      bodyParams: [
        { name: 'title', paramType: 'string', required: true, validationRule: 'length < 5' },
        { name: 'content', paramType: 'string', required: true, validationRule: 'non-empty' },
        { name: 'authorNotes', paramType: 'string', required: false, validationRule: '' }, // low confidence
      ],
    },
    authRequirement: {
      required: true,
      authType: 'jwt_bearer',
      middlewareName: 'authMiddleware',
      headerName: 'Authorization',
    },
    branches: [
      { condition: '!title || !content', loc: { startLine: 21, endLine: 23 } },
      { condition: 'title.length < 5', loc: { startLine: 26, endLine: 28 } },
    ],
    responses: [
      { statusCode: 201, method: 'json' },
      { statusCode: 400, method: 'json' },
      { statusCode: 422, method: 'json' },
    ],
    handlerCodeSnippet: `
      const { title, content } = req.body;
      if (!title || !content) return res.status(400).json({ error: 'Missing fields' });
      if (title.length < 5) return res.status(422).json({ error: 'Title too short' });
      return res.status(201).json({ article: { title, content } });
    `,
  };

  test('generates syntactically valid Jest + Supertest test file via deterministic fallback', async () => {
    const scenarios = require('../src/services/scenarioEnumerator').enumerate(mockRoute);
    const code = TestGeneratorService._generateDeterministicOfflineTest(mockRoute, scenarios, '../server');

    expect(code).toContain("const request = require('supertest');");
    expect(code).toContain("describe('POST /api/v1/articles'");
    expect(code).toContain("it('Happy Path:");
    expect(code).toContain("expect(res.status).toBe(201)");
    expect(code).toContain("expect(res.status).toBe(401)");
    expect(code).toContain("expect(res.status).toBe(400)");
    expect(code).toContain("expect(res.status).toBe(422)");

    // Low confidence annotation
    expect(code).toContain('⚠️ [CodeTraceAI Notice: Needs Review');

    // Syntax validity assertion via Babel parser
    expect(() => {
      AstParser.parse(code, 'test.js');
    }).not.toThrow();
  });

  test('generateTestPlan returns scenarios, code, and syntaxValid: true', async () => {
    const plan = await TestGeneratorService.generateTestPlan(mockRoute, '../server');

    expect(plan.scenarios.length).toBeGreaterThanOrEqual(6);
    expect(plan.testCode.length).toBeGreaterThan(100);
    expect(plan.syntaxValid).toBe(true);

    // Verify syntax
    expect(() => {
      AstParser.parse(plan.testCode, 'test.js');
    }).not.toThrow();
  });
});
