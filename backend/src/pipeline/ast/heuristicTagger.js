/**
 * HEURISTIC TAGGER
 *
 * NOTE: This tagging is best-effort and heuristic-based. Without runtime execution
 * or a full TypeScript semantic type-checker, we cannot guarantee whether an object
 * method invocation is genuinely a database query or an external HTTP call.
 *
 * HEURISTICS USED:
 * 1. Database Calls:
 *    - Common ORM / ODM methods: find, findOne, findById, findByIdAndUpdate,
 *      findByIdAndDelete, create, save, updateOne, updateMany, deleteOne,
 *      deleteMany, aggregate, countDocuments, distinct, populate, exec.
 *    - Model name patterns: PascalCase identifiers (e.g., User.find(), Article.create()),
 *      variables matching /(model|repo|repository|dao|schema)$/i.
 *    - Prisma client: prisma.<model>.<op> (e.g., prisma.user.findMany()).
 *    - Knex / raw SQL: knex('...'), db.query('...'), db.collection('...').
 *
 * 2. External HTTP Calls:
 *    - Axios: axios(...), axios.get(...), axios.post(...), etc.
 *    - Fetch API: fetch(...), global.fetch(...)
 *    - Popular HTTP clients: got(...), superagent(...), request(...), needle(...)
 *    - Node core HTTP: http.request(...), https.get(...)
 */

const DB_METHODS = new Set([
  'find',
  'findone',
  'findbyid',
  'findbyidandupdate',
  'findbyidanddelete',
  'create',
  'save',
  'updateone',
  'updatemany',
  'deleteone',
  'deletemany',
  'aggregate',
  'countdocuments',
  'distinct',
  'populate',
  'exec',
  'findmany',
  'findunique',
  'findfirst',
  'upsert',
]);

const HTTP_CLIENTS = new Set([
  'axios',
  'fetch',
  'got',
  'superagent',
  'request',
  'needle',
  'urllib',
  'http',
  'https',
]);

class HeuristicTagger {
  /**
   * Evaluates a CallExpression node to check if it looks like a DB call.
   * @param {object} callNode - Babel AST CallExpression
   * @param {string} code - source code snippet for context
   * @returns {object|null} Tag result with callee, method, and heuristic explanation
   */
  static checkDbCall(callNode) {
    if (!callNode || callNode.type !== 'CallExpression') return null;

    const callee = callNode.callee;

    // Pattern 1: object.method(...) -> e.g. User.findById(...) or user.save()
    if (callee.type === 'MemberExpression') {
      const methodName = callee.property?.name?.toLowerCase();
      let objectName = '';

      if (callee.object.type === 'Identifier') {
        objectName = callee.object.name;
      } else if (callee.object.type === 'MemberExpression' && callee.object.property?.type === 'Identifier') {
        objectName = `${callee.object.object?.name || ''}.${callee.object.property.name}`;
      }

      // Check Prisma: prisma.user.findMany()
      if (objectName.startsWith('prisma.')) {
        return {
          callee: objectName,
          method: callee.property?.name || 'unknown',
          heuristic: 'prisma_client_invocation',
          loc: callNode.loc
            ? { startLine: callNode.loc.start.line, endLine: callNode.loc.end.line }
            : null,
        };
      }

      // Check DB methods
      if (methodName && DB_METHODS.has(methodName)) {
        const isPascal = /^[A-Z][a-zA-Z0-9]*$/.test(objectName);
        const looksLikeModel = isPascal || /(model|repo|repository|dao|db|schema)$/i.test(objectName);

        return {
          callee: objectName || 'expression',
          method: callee.property?.name || methodName,
          heuristic: looksLikeModel ? 'orm_model_method_match' : 'common_db_method_name_match',
          loc: callNode.loc
            ? { startLine: callNode.loc.start.line, endLine: callNode.loc.end.line }
            : null,
        };
      }

      // Pattern 2: db.collection(...).find(...) or knex(...)
      if (['collection', 'table', 'query'].includes(methodName) && ['db', 'mongo', 'pool', 'connection', 'client'].includes(objectName.toLowerCase())) {
        return {
          callee: objectName,
          method: callee.property?.name || methodName,
          heuristic: 'raw_db_driver_invocation',
          loc: callNode.loc
            ? { startLine: callNode.loc.start.line, endLine: callNode.loc.end.line }
            : null,
        };
      }
    }

    // Pattern 3: direct knex('users')
    if (callee.type === 'Identifier' && ['knex', 'sql', 'query'].includes(callee.name.toLowerCase())) {
      return {
        callee: callee.name,
        method: 'invoke',
        heuristic: 'sql_builder_call',
        loc: callNode.loc
          ? { startLine: callNode.loc.start.line, endLine: callNode.loc.end.line }
          : null,
      };
    }

    return null;
  }

  /**
   * Evaluates a CallExpression node to check if it looks like an external HTTP call.
   * @param {object} callNode - Babel AST CallExpression
   * @returns {object|null} Tag result with callee, method, and heuristic explanation
   */
  static checkHttpCall(callNode) {
    if (!callNode || callNode.type !== 'CallExpression') return null;

    const callee = callNode.callee;

    // Pattern 1: fetch(...) or got(...)
    if (callee.type === 'Identifier') {
      const name = callee.name.toLowerCase();
      if (HTTP_CLIENTS.has(name)) {
        return {
          callee: callee.name,
          method: 'direct_call',
          heuristic: `http_client_global_${name}`,
          loc: callNode.loc
            ? { startLine: callNode.loc.start.line, endLine: callNode.loc.end.line }
            : null,
        };
      }
    }

    // Pattern 2: axios.get(...), superagent.post(...), http.request(...)
    if (callee.type === 'MemberExpression') {
      let objectName = '';
      if (callee.object.type === 'Identifier') {
        objectName = callee.object.name.toLowerCase();
      }

      if (HTTP_CLIENTS.has(objectName)) {
        const method = callee.property?.name || 'call';
        return {
          callee: objectName,
          method: method,
          heuristic: `http_client_method_${objectName}.${method}`,
          loc: callNode.loc
            ? { startLine: callNode.loc.start.line, endLine: callNode.loc.end.line }
            : null,
        };
      }
    }

    return null;
  }
}

module.exports = HeuristicTagger;
