const RouterResolver = require('../src/pipeline/ast/routerResolver');

describe('RouterResolver Prefix Resolution', () => {
  test('resolves nested router prefixes across files', () => {
    const fileResults = [
      // server.js mounts routes/index.js at /api/v1
      {
        relativePath: 'server.js',
        mounts: [
          {
            prefix: '/api/v1',
            target: { importedFrom: './routes/index' },
          },
        ],
        routes: [
          { method: 'GET', rawPath: '/health', middlewares: [] },
        ],
      },
      // routes/index.js mounts routes/users.js at /users and routes/auth.js at /auth
      {
        relativePath: 'routes/index.js',
        mounts: [
          {
            prefix: '/users',
            target: { importedFrom: './users' },
          },
          {
            prefix: '/auth',
            target: { importedFrom: './auth' },
          },
        ],
        routes: [],
      },
      // routes/users.js defines / and /:id
      {
        relativePath: 'routes/users.js',
        mounts: [],
        routes: [
          { method: 'GET', rawPath: '/', middlewares: ['auth'] },
          { method: 'GET', rawPath: '/:id', middlewares: ['auth'] },
        ],
      },
      // routes/auth.js defines /login
      {
        relativePath: 'routes/auth.js',
        mounts: [],
        routes: [
          { method: 'POST', rawPath: '/login', middlewares: [] },
        ],
      },
    ];

    const resolved = RouterResolver.resolveAllRoutes(fileResults);

    const paths = resolved.map((r) => `${r.method} ${r.resolvedPath}`);

    expect(paths).toContain('GET /health');
    expect(paths).toContain('GET /api/v1/users');
    expect(paths).toContain('GET /api/v1/users/:id');
    expect(paths).toContain('POST /api/v1/auth/login');
  });
});
