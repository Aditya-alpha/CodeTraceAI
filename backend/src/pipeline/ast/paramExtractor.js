const traverse = require('@babel/traverse').default;

class ParamExtractor {
  /**
   * Extracts formal parameters, validation details, auth requirements, and response shapes from a route.
   *
   * @param {object} options
   * @param {string} options.rawPath - Raw route path e.g. '/:id'
   * @param {string} options.resolvedPath - Resolved route path e.g. '/api/v1/articles/:id'
   * @param {Array<string>} options.middlewares - List of middleware names
   * @param {object} options.handlerNode - Babel AST node for the handler function
   * @param {string} options.fullSourceCode - Complete file source code
   * @param {Array<object>} options.branches - Extracted branches from branchExtractor
   * @param {Array<object>} options.responses - Extracted responses from branchExtractor
   * @returns {object} { parameters, authRequirement, validationDetails, knownResponseShapes }
   */
  static extract({
    rawPath = '',
    resolvedPath = '',
    middlewares = [],
    handlerNode = null,
    fullSourceCode = '',
    branches = [],
    responses = [],
  }) {
    const pathParams = this._extractPathParams(resolvedPath || rawPath);
    const queryParamsMap = new Map();
    const bodyParamsMap = new Map();
    const validationRules = [];
    let validationLibrary = 'none';

    // 1. Traverse handler AST for req.params, req.query, req.body, and validations
    if (handlerNode) {
      traverse(
        handlerNode,
        {
          noScope: true,

          // A. Destructuring patterns: const { a, b } = req.body / req.query / req.params
          VariableDeclarator(path) {
            const init = path.node.init;
            if (!init || init.type !== 'MemberExpression') return;

            const isReq = init.object?.name === 'req' || init.object?.name === 'request';
            if (!isReq) return;

            const targetProp = init.property?.name;
            if (path.node.id.type === 'ObjectPattern') {
              for (const prop of path.node.id.properties) {
                const paramName = prop.key?.name || prop.key?.value;
                if (!paramName) continue;

                if (targetProp === 'body') {
                  bodyParamsMap.set(paramName, {
                    name: paramName,
                    paramType: 'string',
                    required: false,
                    validationRule: '',
                    schemaSource: 'destructuring',
                  });
                } else if (targetProp === 'query') {
                  queryParamsMap.set(paramName, {
                    name: paramName,
                    paramType: 'string',
                    required: false,
                    description: `Query parameter '${paramName}'`,
                  });
                } else if (targetProp === 'params') {
                  // Ensure it exists in pathParams
                  if (!pathParams.some((p) => p.name === paramName)) {
                    pathParams.push({
                      name: paramName,
                      paramType: 'string',
                      required: true,
                      description: `Path parameter '${paramName}'`,
                    });
                  }
                }
              }
            }
          },

          // B. Member access: req.body.title or req.query.page or req.params.id
          MemberExpression(path) {
            if (path.node.object?.type === 'MemberExpression') {
              const innerObj = path.node.object;
              const isReq = innerObj.object?.name === 'req' || innerObj.object?.name === 'request';
              if (!isReq) return;

              const targetProp = innerObj.property?.name;
              const paramName = path.node.property?.name;
              if (!paramName) return;

              if (targetProp === 'body' && !bodyParamsMap.has(paramName)) {
                bodyParamsMap.set(paramName, {
                  name: paramName,
                  paramType: 'string',
                  required: false,
                  validationRule: '',
                  schemaSource: 'member_expression',
                });
              } else if (targetProp === 'query' && !queryParamsMap.has(paramName)) {
                queryParamsMap.set(paramName, {
                  name: paramName,
                  paramType: 'string',
                  required: false,
                  description: `Query parameter '${paramName}'`,
                });
              }
            }
          },

          // C. Validation Library Calls (express-validator: body('title').isLength({ min: 5 }))
          CallExpression(path) {
            const callee = path.node.callee;

            // Pattern: body('title') or check('email')
            if (callee.type === 'Identifier' && ['body', 'check', 'query', 'param'].includes(callee.name)) {
              validationLibrary = 'express-validator';
              const fieldArg = path.node.arguments?.[0];
              if (fieldArg && fieldArg.type === 'StringLiteral') {
                const fieldName = fieldArg.value;
                if (callee.name === 'body' && !bodyParamsMap.has(fieldName)) {
                  bodyParamsMap.set(fieldName, {
                    name: fieldName,
                    paramType: 'string',
                    required: true,
                    validationRule: 'express-validator check',
                    schemaSource: 'express_validator',
                  });
                }
              }
            }
          },
        },
        undefined,
        {}
      );
    }

    // 2. Correlate with AST Branches for inline validations & required fields
    for (const b of branches) {
      const cond = b.condition || '';

      // Pattern: !title || !content -> required fields
      const missingMatch = cond.match(/!([a-zA-Z0-9_]+)/g);
      if (missingMatch) {
        missingMatch.forEach((m) => {
          const varName = m.replace('!', '');
          if (bodyParamsMap.has(varName)) {
            const existing = bodyParamsMap.get(varName);
            existing.required = true;
            existing.validationRule = existing.validationRule || 'Required non-empty check';
            validationRules.push({
              field: varName,
              rule: 'required',
              message: `${varName} is required`,
            });
            if (validationLibrary === 'none') validationLibrary = 'inline_manual';
          }
        });
      }

      // Pattern: title.length < 5 or id.length !== 24
      const lengthMatch = cond.match(/([a-zA-Z0-9_]+)\.length\s*(<|<=|!==|!=|>|>=|===|==)\s*([0-9]+)/);
      if (lengthMatch) {
        const [, varName, op, valStr] = lengthMatch;
        const val = parseInt(valStr, 10);
        if (bodyParamsMap.has(varName)) {
          const existing = bodyParamsMap.get(varName);
          existing.validationRule = `length ${op} ${val}`;
          validationRules.push({
            field: varName,
            rule: `length_${op}_${val}`,
            min: ['<', '<=', '!=='].includes(op) ? val : undefined,
            max: ['>', '>='].includes(op) ? val : undefined,
            message: `Must satisfy length ${op} ${val}`,
          });
          if (validationLibrary === 'none') validationLibrary = 'inline_manual';
        }

        // Check if length constraint applies to a path param (e.g. id.length !== 24 for ObjectId)
        const pathParam = pathParams.find((p) => p.name === varName);
        if (pathParam) {
          pathParam.description = `Must satisfy length ${op} ${val} (e.g., 24-hex ObjectId)`;
        }
      }
    }

    // 3. Detect Auth Requirements
    const authRequirement = this._detectAuth(middlewares, fullSourceCode);

    // 4. Extract Known Response Shapes
    const knownResponseShapes = this._extractResponseShapes(responses);

    return {
      parameters: {
        pathParams,
        queryParams: Array.from(queryParamsMap.values()),
        bodyParams: Array.from(bodyParamsMap.values()),
      },
      authRequirement,
      validationDetails: {
        library: validationLibrary,
        rules: validationRules,
      },
      knownResponseShapes,
    };
  }

  /**
   * Extracts path parameters (:id or {id}) from route path string.
   */
  static _extractPathParams(pathString) {
    const params = [];
    if (!pathString) return params;

    const matches = pathString.match(/:([a-zA-Z0-9_]+)/g);
    if (matches) {
      for (const m of matches) {
        const name = m.slice(1);
        params.push({
          name,
          paramType: 'string',
          required: true,
          description: `Path parameter '${name}'`,
        });
      }
    }
    return params;
  }

  /**
   * Detects whether route requires authentication and what kind.
   */
  static _detectAuth(middlewares = [], sourceCode = '') {
    const authKeywords = /auth|jwt|token|protect|verify|requireUser|guard|passport/i;

    // Check middleware names
    for (const mw of middlewares) {
      if (authKeywords.test(mw)) {
        let authType = 'jwt_bearer';
        if (/api_?key/i.test(mw)) authType = 'api_key';
        else if (/session/i.test(mw)) authType = 'session';
        else if (/basic/i.test(mw)) authType = 'basic';

        return {
          required: true,
          authType,
          middlewareName: mw,
          headerName: authType === 'api_key' ? 'x-api-key' : 'Authorization',
        };
      }
    }

    // Check source code for authorization header usage
    if (/req\.headers(\.authorization|\['authorization'\])/i.test(sourceCode)) {
      return {
        required: true,
        authType: 'jwt_bearer',
        middlewareName: 'inline_header_check',
        headerName: 'Authorization',
      };
    }

    return {
      required: false,
      authType: 'none',
      middlewareName: '',
      headerName: '',
    };
  }

  /**
   * Consolidates known response shapes by HTTP status code.
   */
  static _extractResponseShapes(responses = []) {
    const statusMap = new Map();

    for (const res of responses) {
      const code = res.statusCode || 200;
      if (!statusMap.has(code)) {
        statusMap.set(code, {
          statusCode: code,
          keys: new Set(res.keys || []),
          sampleJson: res.bodySnippet || '',
        });
      } else {
        const entry = statusMap.get(code);
        (res.keys || []).forEach((k) => entry.keys.add(k));
      }
    }

    return Array.from(statusMap.values()).map((e) => ({
      statusCode: e.statusCode,
      keys: Array.from(e.keys),
      sampleJson: e.sampleJson,
    }));
  }
}

module.exports = ParamExtractor;
