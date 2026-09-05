const AstParser = require('../src/pipeline/ast/parser');
const RouteExtractor = require('../src/pipeline/ast/routeExtractor');
const RouterResolver = require('../src/pipeline/ast/routerResolver');
const ParamExtractor = require('../src/pipeline/ast/paramExtractor');

describe('ParamExtractor & Formal API Inventory', () => {
  const sampleArticleRouteCode = `
    const express = require('express');
    const router = express.Router();
    const authMiddleware = require('../middleware/auth');

    router.post('/', authMiddleware, async (req, res) => {
      const { title, content } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      if (title.length < 5) {
        return res.status(422).json({ error: 'Title must be at least 5 characters long' });
      }

      return res.status(201).json({ message: 'Article created successfully' });
    });

    router.get('/:id', async (req, res) => {
      const { id } = req.params;
      if (!id || id.length !== 24) {
        return res.status(400).json({ error: 'Invalid ID' });
      }
      return res.status(200).json({ article: { id } });
    });

    module.exports = router;
  `;

  test('extracts body parameters, validation rules, auth, and responses from POST route', () => {
    const ast = AstParser.parse(sampleArticleRouteCode, 'articles.js');
    const extraction = RouteExtractor.extractFromFile(ast, sampleArticleRouteCode, 'routes/articles.js');

    expect(extraction.routes.length).toBe(2);

    const postRoute = extraction.routes.find((r) => r.method === 'POST');
    expect(postRoute).toBeDefined();

    // Body parameters from destructuring
    const bodyParams = postRoute.parameters.bodyParams;
    expect(bodyParams.length).toBe(2);
    expect(bodyParams.map((p) => p.name)).toEqual(expect.arrayContaining(['title', 'content']));

    // Both title and content marked required from branch condition !title || !content
    const titleParam = bodyParams.find((p) => p.name === 'title');
    expect(titleParam.required).toBe(true);
    expect(titleParam.validationRule).toContain('length < 5');

    // Auth requirement detected from authMiddleware
    expect(postRoute.authRequirement.required).toBe(true);
    expect(postRoute.authRequirement.authType).toBe('jwt_bearer');
    expect(postRoute.authRequirement.middlewareName).toBe('authMiddleware');

    // Validation rules
    expect(postRoute.validationDetails.rules.length).toBeGreaterThanOrEqual(2);

    // Response shapes
    const responseCodes = postRoute.knownResponseShapes.map((r) => r.statusCode);
    expect(responseCodes).toEqual(expect.arrayContaining([400, 422, 201]));
  });

  test('extracts path parameters and resolves multi-file router prefix', () => {
    const sampleServerCode = `
      const express = require('express');
      const app = express();
      const articlesRouter = require('./routes/articles');
      app.use('/api/v1/articles', articlesRouter);
    `;

    const serverAst = AstParser.parse(sampleServerCode, 'server.js');
    const serverExt = RouteExtractor.extractFromFile(serverAst, sampleServerCode, 'server.js');

    const articlesAst = AstParser.parse(sampleArticleRouteCode, 'articles.js');
    const articlesExt = RouteExtractor.extractFromFile(articlesAst, sampleArticleRouteCode, 'routes/articles.js');

    const resolved = RouterResolver.resolveAllRoutes([
      { relativePath: 'server.js', ...serverExt },
      { relativePath: 'routes/articles.js', ...articlesExt },
    ]);

    const getByIdRoute = resolved.find((r) => r.method === 'GET' && r.resolvedPath.includes(':id'));
    expect(getByIdRoute).toBeDefined();
    expect(getByIdRoute.resolvedPath).toBe('/api/v1/articles/:id');

    // Path parameters
    expect(getByIdRoute.parameters.pathParams.length).toBe(1);
    expect(getByIdRoute.parameters.pathParams[0].name).toBe('id');
    expect(getByIdRoute.parameters.pathParams[0].required).toBe(true);
  });
});
