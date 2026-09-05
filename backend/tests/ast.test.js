const AstParser = require('../src/pipeline/ast/parser');
const RouteExtractor = require('../src/pipeline/ast/routeExtractor');
const HeuristicTagger = require('../src/pipeline/ast/heuristicTagger');

describe('AST Parsing and Extraction', () => {
  test('extracts routes, methods, and middlewares from code', () => {
    const code = `
      const express = require('express');
      const router = express.Router();
      const auth = require('./middleware/auth');

      router.get('/users', auth, async (req, res) => {
        const users = await User.find();
        if (!users) {
          return res.status(404).json({ error: 'Not found' });
        }
        res.status(200).json(users);
      });

      module.exports = router;
    `;

    const ast = AstParser.parse(code, 'testRoute.js');
    expect(ast).not.toBeNull();

    const extraction = RouteExtractor.extractFromFile(ast, code, 'testRoute.js');

    expect(extraction.routes).toHaveLength(1);
    const route = extraction.routes[0];
    expect(route.method).toBe('GET');
    expect(route.rawPath).toBe('/users');
    expect(route.middlewares).toContain('auth');
    expect(route.branches.length).toBeGreaterThanOrEqual(1);
    expect(route.dbCalls.length).toBeGreaterThanOrEqual(1);
    expect(route.dbCalls[0].callee).toBe('User');
    expect(route.dbCalls[0].method).toBe('find');
  });

  test('heuristic tagger detects DB and HTTP calls', () => {
    const code = `
      async function handler() {
        const user = await User.findById('123');
        const resp = await axios.get('https://api.external.com/data');
      }
    `;
    const ast = AstParser.parse(code, 'testHeuristics.js');
    const extraction = RouteExtractor.extractFromFile(ast, code, 'testHeuristics.js');
    const fn = extraction.functions[0];
    expect(fn).toBeDefined();
    expect(fn.name).toBe('handler');
    expect(fn.calls).toContain('findById');
    expect(fn.calls).toContain('get');
  });
});
