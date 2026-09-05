/**
 * ScenarioEnumerator
 *
 * Deterministically derives test scenarios strictly from AST facts:
 * - Happy Path
 * - Auth Missing & Invalid Cases (if auth middleware exists)
 * - Validation Failures (per required field)
 * - Branch Conditions (one test per detected AST condition)
 * - Boundary & Edge Cases (empty payloads, format bounds, loose inferences flagged as low confidence)
 *
 * Per Phase 2 spec:
 * "the LLM writes the test code, but the scenario list comes from AST analysis, not the LLM."
 */
class ScenarioEnumerator {
  /**
   * Enumerate all test scenarios for a given Route document.
   *
   * @param {object} route - Route object from DB / AST
   * @returns {Array<object>} List of scenario objects
   */
  static enumerate(route) {
    if (!route) return [];

    const scenarios = [];
    const method = (route.method || 'GET').toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH'].includes(method);
    const bodyParams = route.parameters?.bodyParams || [];
    const pathParams = route.parameters?.pathParams || [];
    const queryParams = route.parameters?.queryParams || [];
    const branches = route.branches || [];
    const responses = route.responses || [];
    const authReq = route.authRequirement || { required: false };

    // Determine default success status code
    let successStatus = method === 'POST' ? 201 : 200;
    const okRes = responses.find((r) => r.statusCode >= 200 && r.statusCode < 300);
    if (okRes) {
      successStatus = okRes.statusCode;
    }

    // Build sample valid payload
    const validPayload = {};
    for (const p of bodyParams) {
      if (p.name.toLowerCase().includes('email')) {
        validPayload[p.name] = 'user.test@example.com';
      } else if (p.name.toLowerCase().includes('password')) {
        validPayload[p.name] = 'P@ssword123!';
      } else if (p.name.toLowerCase().includes('title')) {
        validPayload[p.name] = 'Test Article Title Example';
      } else if (p.name.toLowerCase().includes('content') || p.name.toLowerCase().includes('desc')) {
        validPayload[p.name] = 'Detailed valid description content for automated Supertest assertions.';
      } else if (p.name.toLowerCase().includes('id')) {
        validPayload[p.name] = '507f1f77bcf86cd799439011';
      } else if (p.paramType === 'number') {
        validPayload[p.name] = 42;
      } else if (p.paramType === 'boolean') {
        validPayload[p.name] = true;
      } else {
        validPayload[p.name] = `valid_${p.name}_value`;
      }
    }

    // Determine auth headers
    const authHeaders = authReq.required
      ? { Authorization: 'Bearer test_valid_jwt_token' }
      : null;

    // ----------------------------------------------------
    // 1. HAPPY PATH SCENARIO
    // ----------------------------------------------------
    scenarios.push({
      id: 'scenario_happy_path',
      name: `Happy Path: Successfully ${method} ${route.resolvedPath}`,
      type: 'happy_path',
      confidence: 'high',
      confidenceReason: 'Inferred directly from route handler success response',
      expectedStatus: successStatus,
      payloadSample: isMutation && Object.keys(validPayload).length > 0 ? validPayload : null,
      headers: authHeaders,
      description: `Returns HTTP ${successStatus} when valid request parameters and necessary credentials are provided.`,
      astOrigin: {
        branchCondition: 'normal execution flow',
        loc: route.loc,
      },
    });

    // ----------------------------------------------------
    // 2. AUTHENTICATION SCENARIOS (If Auth Required)
    // ----------------------------------------------------
    if (authReq.required) {
      // 2A. Missing Token
      scenarios.push({
        id: 'scenario_auth_missing',
        name: 'Auth: Reject request when Authorization token is missing',
        type: 'auth_case',
        confidence: 'high',
        confidenceReason: `Protected by '${authReq.middlewareName || 'auth'}' middleware`,
        expectedStatus: 401,
        payloadSample: isMutation ? validPayload : null,
        headers: {},
        description: 'Returns HTTP 401 Unauthorized when the Authorization header is omitted.',
        astOrigin: {
          branchCondition: '!authHeader',
          loc: null,
        },
      });

      // 2B. Invalid Token
      scenarios.push({
        id: 'scenario_auth_invalid',
        name: 'Auth: Reject request when Authorization token is invalid or malformed',
        type: 'auth_case',
        confidence: 'high',
        confidenceReason: 'Token verification failure in authentication middleware',
        expectedStatus: 403,
        payloadSample: isMutation ? validPayload : null,
        headers: { Authorization: 'Bearer invalid_or_expired_token' },
        description: 'Returns HTTP 403 Forbidden (or 401) when the bearer token signature is invalid.',
        astOrigin: {
          branchCondition: 'jwt.verify error',
          loc: null,
        },
      });
    }

    // ----------------------------------------------------
    // 3. VALIDATION FAILURE SCENARIOS
    // ----------------------------------------------------
    const requiredBodyParams = bodyParams.filter((p) => p.required);
    for (const p of requiredBodyParams) {
      const omittedPayload = { ...validPayload };
      delete omittedPayload[p.name];

      scenarios.push({
        id: `scenario_val_missing_${p.name}`,
        name: `Validation: Reject request when required '${p.name}' is missing`,
        type: 'validation_failure',
        confidence: 'high',
        confidenceReason: `Field '${p.name}' explicitly checked for non-empty presence in AST branch`,
        expectedStatus: 400,
        payloadSample: omittedPayload,
        headers: authHeaders,
        description: `Returns HTTP 400 Bad Request when required field '${p.name}' is not supplied in request body.`,
        astOrigin: {
          branchCondition: `!${p.name}`,
          loc: null,
        },
      });
    }

    // ----------------------------------------------------
    // 4. AST BRANCH CONDITIONS
    // ----------------------------------------------------
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      const cond = b.condition || '';

      // Skip generic !title || !content if already handled as validation failures above
      if (cond.match(/^!([a-zA-Z0-9_]+)(\s*\|\|\s*!([a-zA-Z0-9_]+))*$/) && requiredBodyParams.length > 0) {
        continue;
      }

      // 4A. String length constraint: e.g. title.length < 5 or id.length !== 24
      const lengthMatch = cond.match(/([a-zA-Z0-9_]+)\.length\s*(<|<=|!==|!=|>|>=)\s*([0-9]+)/);
      if (lengthMatch) {
        const [, varName, op, valStr] = lengthMatch;
        const limitVal = parseInt(valStr, 10);

        // Special case: ID length constraint (e.g. 24 chars for Mongo ObjectId)
        if (varName === 'id' || cond.includes('24')) {
          scenarios.push({
            id: 'scenario_branch_invalid_id',
            name: 'Branch: Reject request with malformed ID parameter format',
            type: 'branch',
            confidence: 'high',
            confidenceReason: `Explicit branch condition: ${cond}`,
            expectedStatus: 400,
            payloadSample: null,
            headers: authHeaders,
            description: `Returns HTTP 400 Bad Request when resource ID does not conform to required format (${cond}).`,
            astOrigin: {
              branchCondition: cond,
              loc: b.loc,
            },
          });
          continue;
        }

        let testVal = 'abc';
        if (op === '<' || op === '<=') testVal = 'a'.repeat(Math.max(0, limitVal - 1));

        const branchPayload = { ...validPayload, [varName]: testVal };
        const branchRes = responses.find((r) => r.statusCode === 422) || responses.find((r) => r.statusCode === 400);
        const expectedStatus = branchRes ? branchRes.statusCode : 422;

        scenarios.push({
          id: `scenario_branch_length_${varName}`,
          name: `Branch: Reject when '${varName}' violates length constraint (${op} ${limitVal})`,
          type: 'branch',
          confidence: 'high',
          confidenceReason: `Explicit branch condition: ${cond}`,
          expectedStatus,
          payloadSample: branchPayload,
          headers: authHeaders,
          description: `Returns HTTP ${expectedStatus} when '${varName}' fails length constraint (${cond}).`,
          astOrigin: {
            branchCondition: cond,
            loc: b.loc,
          },
        });
        continue;
      }

      // 4B. ID format check: e.g. !id
      if (cond.includes('id') && !bodyParams.some((p) => p.name === 'id')) {
        scenarios.push({
          id: 'scenario_branch_invalid_id',
          name: 'Branch: Reject request with malformed ID parameter format',
          type: 'branch',
          confidence: 'high',
          confidenceReason: `Explicit branch condition: ${cond}`,
          expectedStatus: 400,
          payloadSample: null,
          headers: authHeaders,
          description: `Returns HTTP 400 Bad Request when resource ID is missing or invalid (${cond}).`,
          astOrigin: {
            branchCondition: cond,
            loc: b.loc,
          },
        });
        continue;
      }

      // 4C. Resource existence check: e.g. !article or !user
      if (cond.match(/^!([a-zA-Z0-9_]+)$/) && !bodyParams.some((p) => p.name === cond.replace('!', ''))) {
        const resourceName = cond.replace('!', '');
        scenarios.push({
          id: `scenario_branch_not_found_${resourceName}`,
          name: `Branch: Return 404 when '${resourceName}' is not found`,
          type: 'branch',
          confidence: 'high',
          confidenceReason: `Database entity lookup check: ${cond}`,
          expectedStatus: 404,
          payloadSample: null,
          headers: authHeaders,
          description: `Returns HTTP 404 Not Found when lookup for '${resourceName}' yields null or undefined.`,
          astOrigin: {
            branchCondition: cond,
            loc: b.loc,
          },
        });
        continue;
      }

      // 4D. Other generic branches
      scenarios.push({
        id: `scenario_branch_${i}`,
        name: `Branch: Handle condition (${cond.slice(0, 40)})`,
        type: 'branch',
        confidence: 'high',
        confidenceReason: `AST conditional branch: ${cond}`,
        expectedStatus: 400,
        payloadSample: validPayload,
        headers: authHeaders,
        description: `Verifies behavior under branch check: ${cond}`,
        astOrigin: {
          branchCondition: cond,
          loc: b.loc,
        },
      });
    }

    // ----------------------------------------------------
    // 5. BOUNDARY & EDGE CASES
    // ----------------------------------------------------
    if (isMutation) {
      // 5A. Completely Empty Body
      scenarios.push({
        id: 'scenario_boundary_empty_body',
        name: 'Boundary: Handle completely empty JSON request body',
        type: 'boundary',
        confidence: 'high',
        confidenceReason: 'Standard REST API boundary condition for mutation operations',
        expectedStatus: 400,
        payloadSample: {},
        headers: authHeaders,
        description: 'Returns HTTP 400 Bad Request when request body is empty object {}.',
        astOrigin: {
          branchCondition: 'empty request body boundary',
          loc: null,
        },
      });
    }

    // 5B. Ambiguous / Low-Confidence Scenarios
    // If there are body parameters that have no explicit validation rules discovered
    const unvalidatedParams = bodyParams.filter((p) => !p.required && !p.validationRule);
    for (const p of unvalidatedParams.slice(0, 2)) {
      scenarios.push({
        id: `scenario_boundary_loose_${p.name}`,
        name: `Boundary: Type boundaries for loosely inferred field '${p.name}'`,
        type: 'boundary',
        confidence: 'low',
        confidenceReason: `⚠️ Needs review — validation logic for '${p.name}' was inferred loosely from variable destructuring without explicit schema or branch constraint.`,
        expectedStatus: 400,
        payloadSample: { ...validPayload, [p.name]: null },
        headers: authHeaders,
        description: `Tests handling of unexpected or null values for '${p.name}'. Marked as low confidence because no explicit validator was detected.`,
        astOrigin: {
          branchCondition: 'unvalidated optional field',
          loc: null,
        },
      });
    }

    return scenarios;
  }
}

module.exports = ScenarioEnumerator;
