const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const BranchExtractor = require('./branchExtractor');
const HeuristicTagger = require('./heuristicTagger');

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'all',
]);

class RouteExtractor {
  /**
   * Extracts routes, router mounts, imports, and exports from a parsed file AST.
   * @param {object} ast - Babel AST
   * @param {string} fullSourceCode - Source code string
   * @param {string} relativeFilePath - Relative path of the file
   * @returns {object} { routes, mounts, exports, functions, imports }
   */
  static extractFromFile(ast, fullSourceCode, relativeFilePath) {
    const routes = [];
    const mounts = [];
    const exportsList = [];
    const functions = [];
    const imports = [];

    if (!ast) {
      return { routes, mounts, exports: exportsList, functions, imports };
    }

    // Helper to get raw code
    const getCode = (node) => {
      if (!node || typeof node.start !== 'number' || typeof node.end !== 'number') return '';
      return fullSourceCode.slice(node.start, node.end).trim();
    };

    // Track variable definitions to resolve router instances & requires
    // e.g., const userRouter = require('./routes/user')
    const requireMap = new Map(); // varName -> './routes/user'

    traverse(ast, {
      // 1. Capture CommonJS requires: const x = require('./y')
      VariableDeclarator(path) {
        const init = path.node.init;
        if (
          init &&
          init.type === 'CallExpression' &&
          init.callee.name === 'require' &&
          init.arguments[0]?.type === 'StringLiteral' &&
          path.node.id.type === 'Identifier'
        ) {
          requireMap.set(path.node.id.name, init.arguments[0].value);
        }
      },

      // 2. Capture ESM imports: import x from './y'
      ImportDeclaration(path) {
        const source = path.node.source.value;
        const specifiers = [];
        let isDefault = false;

        for (const spec of path.node.specifiers) {
          if (spec.type === 'ImportDefaultSpecifier') {
            isDefault = true;
            requireMap.set(spec.local.name, source);
            specifiers.push(spec.local.name);
          } else if (spec.type === 'ImportSpecifier') {
            specifiers.push(spec.local.name);
          }
        }

        imports.push({
          source,
          specifiers,
          isDefault,
        });
      },

      // 3. Capture Function Declarations & Methods
      Function(path) {
        // Skip functions nested deep inside route handlers for the top-level list
        const isTopLevel =
          path.parentPath?.isProgram() ||
          path.parentPath?.isExportNamedDeclaration() ||
          path.parentPath?.isExportDefaultDeclaration() ||
          path.parentPath?.isVariableDeclarator();

        let funcName = 'anonymous';
        if (path.node.id?.name) {
          funcName = path.node.id.name;
        } else if (path.parentPath?.isVariableDeclarator() && path.parentPath.node.id?.name) {
          funcName = path.parentPath.node.id.name;
        }

        const calls = [];
        path.traverse({
          CallExpression(callPath) {
            if (callPath.node.callee.type === 'Identifier') {
              calls.push(callPath.node.callee.name);
            } else if (callPath.node.callee.type === 'MemberExpression') {
              const prop = callPath.node.callee.property?.name;
              if (prop) calls.push(prop);
            }
          },
        });

        functions.push({
          name: funcName,
          kind: path.node.type === 'ArrowFunctionExpression' ? 'arrow' : 'function',
          isAsync: Boolean(path.node.async),
          params: (path.node.params || []).map((p) => (p.name ? p.name : getCode(p))),
          loc: path.node.loc
            ? {
                startLine: path.node.loc.start.line,
                endLine: path.node.loc.end.line,
                startColumn: path.node.loc.start.column,
                endColumn: path.node.loc.end.column,
              }
            : null,
          calls: Array.from(new Set(calls)),
          codeSnippet: getCode(path.node),
          isTopLevel,
        });
      },

      // 4. Capture Express Route registrations and Mounts
      CallExpression(path) {
        const callee = path.node.callee;
        if (!callee || callee.type !== 'MemberExpression') return;

        const methodName = callee.property?.name?.toLowerCase();
        if (!methodName) return;

        // Check if it's app.use('/prefix', router)
        if (methodName === 'use') {
          const args = path.node.arguments;
          if (args.length >= 2 && args[0].type === 'StringLiteral') {
            const mountPrefix = args[0].value;
            const targetArg = args[1];

            let routerTarget = null;
            // Case A: app.use('/api', routerVariable)
            if (targetArg.type === 'Identifier') {
              const importedFrom = requireMap.get(targetArg.name);
              routerTarget = {
                varName: targetArg.name,
                importedFrom: importedFrom || null,
              };
            }
            // Case B: app.use('/api', require('./routes/api'))
            else if (
              targetArg.type === 'CallExpression' &&
              targetArg.callee.name === 'require' &&
              targetArg.arguments[0]?.type === 'StringLiteral'
            ) {
              routerTarget = {
                varName: null,
                importedFrom: targetArg.arguments[0].value,
              };
            }

            if (routerTarget) {
              mounts.push({
                prefix: mountPrefix,
                target: routerTarget,
                loc: path.node.loc
                  ? { startLine: path.node.loc.start.line, endLine: path.node.loc.end.line }
                  : null,
              });
            }
          }
          return;
        }

        // Check if it's app.get / router.post / etc.
        if (HTTP_METHODS.has(methodName)) {
          const args = path.node.arguments;
          if (args.length < 1) return;

          // First arg is usually the path string, e.g. '/users' or '/:id'
          let rawRoutePath = '/';
          let handlerIndex = 1;

          if (args[0].type === 'StringLiteral') {
            rawRoutePath = args[0].value;
            handlerIndex = 1;
          } else if (args[0].type === 'TemplateLiteral' && args[0].quasis.length > 0) {
            rawRoutePath = args[0].quasis.map((q) => q.value.raw).join('*');
            handlerIndex = 1;
          } else {
            // e.g. router.get(authMiddleware, handler) without explicit path => '/'
            handlerIndex = 0;
          }

          const middlewareNames = [];
          let handlerNode = null;
          let handlerName = 'anonymous';

          for (let i = handlerIndex; i < args.length; i++) {
            const arg = args[i];
            const isLast = i === args.length - 1;

            if (arg.type === 'Identifier') {
              if (isLast) {
                handlerName = arg.name;
              } else {
                middlewareNames.push(arg.name);
              }
            } else if (
              arg.type === 'FunctionExpression' ||
              arg.type === 'ArrowFunctionExpression'
            ) {
              if (isLast) {
                handlerNode = arg;
                handlerName = arg.id?.name || 'anonymous_handler';
              } else {
                middlewareNames.push(arg.id?.name || 'anonymous_middleware');
              }
            } else if (arg.type === 'CallExpression') {
              // e.g. authMiddleware() or validate(schema)
              const mwCallName = getCode(arg.callee) || 'middleware_call';
              if (isLast) {
                handlerName = mwCallName;
              } else {
                middlewareNames.push(mwCallName);
              }
            }
          }

          // Analyze internal flow if handler node exists
          let branches = [];
          let dbCalls = [];
          let httpCalls = [];
          let responses = [];

          if (handlerNode) {
            const flow = BranchExtractor.extractBranchesAndFlow(handlerNode, fullSourceCode);
            branches = flow.branches;
            responses = flow.responses;

            // Extract DB and HTTP calls from handlerNode
            traverse(
              handlerNode,
              {
                noScope: true,
                CallExpression(callPath) {
                  const dbTag = HeuristicTagger.checkDbCall(callPath.node);
                  if (dbTag) dbCalls.push(dbTag);

                  const httpTag = HeuristicTagger.checkHttpCall(callPath.node);
                  if (httpTag) httpCalls.push(httpTag);
                },
              },
              undefined,
              {}
            );
          }

          routes.push({
            method: methodName.toUpperCase(),
            rawPath: rawRoutePath,
            middlewares: middlewareNames,
            handlerName,
            handlerCodeSnippet: handlerNode ? getCode(handlerNode) : '',
            loc: path.node.loc
              ? {
                  startLine: path.node.loc.start.line,
                  endLine: path.node.loc.end.line,
                  startColumn: path.node.loc.start.column,
                  endColumn: path.node.loc.end.column,
                }
              : null,
            branches,
            dbCalls,
            httpCalls,
            responses,
          });
        }
      },

      // 5. Capture Exports: module.exports = router or export default router
      AssignmentExpression(path) {
        const left = path.node.left;
        if (
          left.type === 'MemberExpression' &&
          left.object.name === 'module' &&
          left.property.name === 'exports'
        ) {
          exportsList.push({
            name: path.node.right.name || 'default',
            type: 'default',
          });
        }
      },
      ExportDefaultDeclaration(path) {
        exportsList.push({
          name: path.node.declaration.name || 'default',
          type: 'default',
        });
      },
    });

    return {
      routes,
      mounts,
      exports: exportsList,
      functions,
      imports,
    };
  }
}

module.exports = RouteExtractor;
