const ScenarioEnumerator = require('../src/services/scenarioEnumerator');

describe('ScenarioEnumerator (AST-Driven Test Scenarios)', () => {
  const mockArticleRoute = {
    method: 'POST',
    resolvedPath: '/api/v1/articles',
    middlewares: ['authMiddleware'],
    parameters: {
      pathParams: [],
      queryParams: [],
      bodyParams: [
        { name: 'title', paramType: 'string', required: true, validationRule: 'length < 5' },
        { name: 'content', paramType: 'string', required: true, validationRule: 'non-empty' },
        { name: 'tags', paramType: 'string', required: false, validationRule: '' }, // unvalidated -> low confidence
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
  };

  test('enumerates happy path, auth, validation, branch, and boundary scenarios', () => {
    const scenarios = ScenarioEnumerator.enumerate(mockArticleRoute);

    expect(scenarios.length).toBeGreaterThanOrEqual(6);

    // 1. Happy Path
    const happy = scenarios.find((s) => s.type === 'happy_path');
    expect(happy).toBeDefined();
    expect(happy.expectedStatus).toBe(201);
    expect(happy.headers?.Authorization).toContain('Bearer');
    expect(happy.payloadSample?.title).toBeDefined();
    expect(happy.confidence).toBe('high');

    // 2. Auth Scenarios
    const authMissing = scenarios.find((s) => s.id === 'scenario_auth_missing');
    expect(authMissing).toBeDefined();
    expect(authMissing.expectedStatus).toBe(401);

    const authInvalid = scenarios.find((s) => s.id === 'scenario_auth_invalid');
    expect(authInvalid).toBeDefined();
    expect(authInvalid.expectedStatus).toBe(403);

    // 3. Validation Failures
    const valMissingTitle = scenarios.find((s) => s.id === 'scenario_val_missing_title');
    expect(valMissingTitle).toBeDefined();
    expect(valMissingTitle.expectedStatus).toBe(400);

    const valMissingContent = scenarios.find((s) => s.id === 'scenario_val_missing_content');
    expect(valMissingContent).toBeDefined();
    expect(valMissingContent.expectedStatus).toBe(400);

    // 4. Branch Scenarios
    const branchLength = scenarios.find((s) => s.id === 'scenario_branch_length_title');
    expect(branchLength).toBeDefined();
    expect(branchLength.expectedStatus).toBe(422);

    // 5. Boundary Scenarios
    const emptyBody = scenarios.find((s) => s.id === 'scenario_boundary_empty_body');
    expect(emptyBody).toBeDefined();
    expect(emptyBody.expectedStatus).toBe(400);

    // 6. Honest Low-Confidence Flagging
    const lowConfidence = scenarios.find((s) => s.confidence === 'low');
    expect(lowConfidence).toBeDefined();
    expect(lowConfidence.confidenceReason).toContain('Needs review');
    expect(lowConfidence.id).toContain('tags');
  });

  test('enumerates GET route scenarios with path parameter validation', () => {
    const mockGetRoute = {
      method: 'GET',
      resolvedPath: '/api/v1/articles/:id',
      middlewares: [],
      parameters: {
        pathParams: [{ name: 'id', required: true, paramType: 'string' }],
        queryParams: [],
        bodyParams: [],
      },
      authRequirement: { required: false },
      branches: [
        { condition: '!id || id.length !== 24', loc: { startLine: 49, endLine: 51 } },
        { condition: '!article', loc: { startLine: 56, endLine: 58 } },
      ],
      responses: [
        { statusCode: 200, method: 'json' },
        { statusCode: 400, method: 'json' },
        { statusCode: 404, method: 'json' },
      ],
    };

    const scenarios = ScenarioEnumerator.enumerate(mockGetRoute);
    const happy = scenarios.find((s) => s.type === 'happy_path');
    expect(happy.expectedStatus).toBe(200);

    const branchId = scenarios.find((s) => s.id === 'scenario_branch_invalid_id');
    expect(branchId).toBeDefined();
    expect(branchId.expectedStatus).toBe(400);

    const branch404 = scenarios.find((s) => s.id === 'scenario_branch_not_found_article');
    expect(branch404).toBeDefined();
    expect(branch404.expectedStatus).toBe(404);
  });
});
