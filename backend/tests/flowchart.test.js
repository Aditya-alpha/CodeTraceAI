const FlowchartService = require('../src/services/flowchartService');

describe('Flowchart Generation', () => {
  test('generates valid Mermaid diagram for route with multiple branches', () => {
    const mockRoute = {
      method: 'POST',
      resolvedPath: '/api/v1/articles',
      middlewares: ['authMiddleware'],
      handlerName: 'createArticle',
      branches: [
        { type: 'if', condition: '!title || !content' },
        { type: 'if', condition: 'title.length < 5' },
      ],
      dbCalls: [
        { callee: 'Article', method: 'create' },
      ],
      responses: [
        { statusCode: 201, method: 'json' },
      ],
    };

    const mermaid = FlowchartService.generateApiFlowchart(mockRoute);

    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('POST /api/v1/articles');
    expect(mermaid).toContain('authMiddleware');
    expect(mermaid).toContain('createArticle');
    expect(mermaid).toContain('!title || !content');
    expect(mermaid).toContain('title.length &lt; 5');
    expect(mermaid).toContain('Article.create()');
    expect(mermaid).toContain('res.status(200).json(...)');
  });

  test('generates valid Mermaid diagram for function without reserved keywords', () => {
    const mockFunc = {
      name: 'connectDB',
      isAsync: true,
      params: [],
      calls: ['connect', 'replace', 'log', 'error', 'exit'],
    };

    const mermaid = FlowchartService.generateFunctionFlowchart(mockFunc);

    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('classDef fnCall');
    expect(mermaid).not.toContain('classDef call ');
    expect(mermaid).not.toContain(':::call\n');
    expect(mermaid).toContain('async connectDB()');
    expect(mermaid).toContain('call: connect()');
    expect(mermaid).toContain('call: exit()');
    expect(mermaid).toContain('Return Result');
  });
});

