const FlowchartService = require('../src/services/flowchartService');

describe('Codebase Architecture & File Tree Flowcharts', () => {
  const mockFiles = [
    {
      relativePath: 'server.js',
      fileName: 'server.js',
      isExpressEntry: true,
      lineCount: 45,
      imports: [{ source: './routes/index' }, { source: './config/db' }],
    },
    {
      relativePath: 'routes/index.js',
      fileName: 'index.js',
      lineCount: 20,
      imports: [{ source: './auth' }, { source: './users' }],
    },
    {
      relativePath: 'routes/auth.js',
      fileName: 'auth.js',
      lineCount: 65,
      imports: [{ source: '../models/User' }, { source: '../middleware/auth' }],
    },
    {
      relativePath: 'middleware/auth.js',
      fileName: 'auth.js',
      lineCount: 30,
      imports: [],
    },
    {
      relativePath: 'models/User.js',
      fileName: 'User.js',
      lineCount: 35,
      imports: [],
    },
    {
      relativePath: 'config/db.js',
      fileName: 'db.js',
      lineCount: 25,
      imports: [],
    },
  ];

  const mockRoutes = [
    { method: 'POST', resolvedPath: '/api/v1/auth/login', filePath: 'routes/auth.js' },
    { method: 'GET', resolvedPath: '/api/v1/users', filePath: 'routes/users.js' },
  ];

  test('generates codebase architecture flowchart with layers and dependency edges', () => {
    const { mermaid, layerStats } = FlowchartService.generateCodebaseArchitectureFlowchart(mockFiles, mockRoutes);

    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('Application Entry Point');
    expect(mermaid).toContain('Routing & Controllers');
    expect(mermaid).toContain('Middlewares & Guards');
    expect(mermaid).toContain('Database & Schemas');
    expect(mermaid).toContain('Config & Utilities');

    // Verify layer counts
    expect(layerStats.entry).toBe(1);
    expect(layerStats.routes).toBe(2);
    expect(layerStats.middlewares).toBe(1);
    expect(layerStats.models).toBe(1);
    expect(layerStats.config).toBe(1);

    // Verify cross-file import connections
    expect(mermaid).toContain('-->');
  });

  test('generates file tree directory flowchart', () => {
    const mermaid = FlowchartService.generateFileTreeFlowchart(mockFiles);

    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('Repository Root');
    expect(mermaid).toContain('📁 routes/');
    expect(mermaid).toContain('📁 middleware/');
    expect(mermaid).toContain('📁 models/');
    expect(mermaid).toContain('📁 config/');
    expect(mermaid).toContain('📄 server.js');
  });
});
