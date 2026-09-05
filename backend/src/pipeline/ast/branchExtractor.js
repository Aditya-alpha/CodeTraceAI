const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

class BranchExtractor {
  /**
   * Extracts control flow branches and terminal responses from a function or AST node.
   * @param {object} astNode - Function node or block statement
   * @param {string} fullSourceCode - Source code of the file for slicing conditions
   * @returns {object} { branches, tryCatches, responses }
   */
  static extractBranchesAndFlow(astNode, fullSourceCode) {
    const branches = [];
    const tryCatches = [];
    const responses = [];

    if (!astNode) return { branches, tryCatches, responses };

    // Helper to get text representation from source
    const getCodeSnippet = (node) => {
      if (!node || !node.loc || !fullSourceCode) return '';
      try {
        const start = node.start;
        const end = node.end;
        if (typeof start === 'number' && typeof end === 'number') {
          return fullSourceCode.slice(start, end).trim();
        }
      } catch (_) {}
      return '';
    };

    // Traverse the subtree
    traverse(
      astNode,
      {
        noScope: true,

        IfStatement(path) {
          const testSnippet = getCodeSnippet(path.node.test);
          branches.push({
            type: 'if',
            condition: testSnippet || 'condition',
            hasElse: Boolean(path.node.alternate),
            loc: path.node.loc
              ? { startLine: path.node.loc.start.line, endLine: path.node.loc.end.line }
              : null,
          });
        },

        SwitchStatement(path) {
          const cases = (path.node.cases || []).map((c) => {
            return c.test ? getCodeSnippet(c.test) : 'default';
          });
          branches.push({
            type: 'switch',
            cases,
            loc: path.node.loc
              ? { startLine: path.node.loc.start.line, endLine: path.node.loc.end.line }
              : null,
          });
        },

        ConditionalExpression(path) {
          branches.push({
            type: 'ternary',
            condition: getCodeSnippet(path.node.test) || 'ternary_condition',
            loc: path.node.loc
              ? { startLine: path.node.loc.start.line, endLine: path.node.loc.end.line }
              : null,
          });
        },

        TryStatement(path) {
          tryCatches.push({
            hasCatch: Boolean(path.node.handler),
            catchParam: path.node.handler?.param?.name || 'err',
            hasFinally: Boolean(path.node.finalizer),
            loc: path.node.loc
              ? { startLine: path.node.loc.start.line, endLine: path.node.loc.end.line }
              : null,
          });
        },

        CallExpression(path) {
          // Detect HTTP response calls: res.status(200).json(...) or res.send(...) or res.json(...)
          const callee = path.node.callee;
          if (callee.type === 'MemberExpression') {
            const method = callee.property?.name;

            // Pattern: res.status(404).json(...)
            if (callee.object && callee.object.type === 'CallExpression') {
              const innerCallee = callee.object.callee;
              if (
                innerCallee.type === 'MemberExpression' &&
                innerCallee.property?.name === 'status'
              ) {
                const statusArg = callee.object.arguments?.[0];
                const statusCode =
                  statusArg && statusArg.type === 'NumericLiteral' ? statusArg.value : null;

                responses.push({
                  statusCode: statusCode || 200,
                  method: method || 'json',
                  loc: path.node.loc
                    ? { startLine: path.node.loc.start.line, endLine: path.node.loc.end.line }
                    : null,
                });
                return;
              }
            }

            // Pattern: res.json(...) or res.send(...) or res.sendStatus(400)
            const objName = callee.object?.name;
            if (['res', 'response'].includes(objName)) {
              if (['json', 'send', 'sendStatus', 'end'].includes(method)) {
                let statusCode = 200;
                if (method === 'sendStatus') {
                  const arg = path.node.arguments?.[0];
                  if (arg && arg.type === 'NumericLiteral') {
                    statusCode = arg.value;
                  }
                }
                responses.push({
                  statusCode,
                  method,
                  loc: path.node.loc
                    ? { startLine: path.node.loc.start.line, endLine: path.node.loc.end.line }
                    : null,
                });
              }
            }
          }
        },
      },
      undefined,
      {}
    );

    return { branches, tryCatches, responses };
  }
}

module.exports = BranchExtractor;
