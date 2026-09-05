const llmService = require('./llmService');
const ScenarioEnumerator = require('./scenarioEnumerator');
const AstParser = require('../pipeline/ast/parser');

class TestGeneratorService {
  /**
   * Generates a complete, syntactically valid Jest + Supertest test file for a route.
   *
   * @param {object} route - Route document from DB
   * @param {string} [appImportPath='../server'] - Relative import path to Express app
   * @returns {Promise<{ testCode: string, scenarios: Array<object>, syntaxValid: boolean }>}
   */
  static async generateTestPlan(route, appImportPath = '../server') {
    if (!route) throw new Error('Route is required to generate tests');

    // Step 1: Deterministically enumerate test scenarios from AST
    const scenarios = ScenarioEnumerator.enumerate(route);

    // Step 2: Attempt LLM generation using Groq
    let testCode = '';
    let syntaxValid = false;

    try {
      testCode = await this._generateWithLlm(route, scenarios, appImportPath);
      // Clean up markdown fences if LLM wrapped it in ```javascript ... ```
      testCode = this._cleanCodeBlock(testCode);

      // Verify syntax using Babel parser
      AstParser.parse(testCode, 'generatedTest.js');
      syntaxValid = true;
    } catch (err) {
      console.warn('[TestGenerator] LLM generation or syntax parsing failed, using deterministic AST test generator:', err.message);
      testCode = this._generateDeterministicOfflineTest(route, scenarios, appImportPath);
      syntaxValid = true;
    }

    return {
      testCode,
      scenarios,
      syntaxValid,
    };
  }

  /**
   * Prompts LLM to synthesize Jest + Supertest code based on AST scenarios.
   */
  static async _generateWithLlm(route, scenarios, appImportPath) {
    const method = (route.method || 'GET').toUpperCase();
    const path = route.resolvedPath || route.rawPath || '/';

    const systemPrompt = `You are a Principal Backend QA Automation Engineer specializing in Node.js, Express, Jest, and Supertest.
Your task is to generate clean, robust, and syntactically valid Jest + Supertest test code for an Express API endpoint.

RULES:
1. Output ONLY valid, executable JavaScript code. Do NOT output markdown explanations or conversational text outside of the code block.
2. Structure the test suite using standard Jest and Supertest:
   const request = require('supertest');
   const app = require('${appImportPath}');

   describe('${method} ${path}', () => { ... });
3. Implement a dedicated it(...) test block for EVERY SINGLE enumerated scenario in the list below. Do not omit any scenario.
4. For each test:
   - Make the HTTP request using supertest: request(app).${method.toLowerCase()}('${path.replace(/:[a-zA-Z0-9_]+/g, '507f1f77bcf86cd799439011')}')
   - Set headers (.set('Authorization', ...)) if required by the scenario.
   - Send payload (.send(...)) if applicable.
   - Assert expected status code: expect(res.status).toBe(expectedStatus)
   - Assert relevant response properties where inferable.
5. For any scenario with "confidence": "low", include this exact comment at the top of the it() block:
   // ⚠️ [CodeTraceAI Notice: Needs Review - Inferred loosely from ambiguous validation logic]
6. Ensure all JavaScript syntax is 100% valid with no unclosed braces or syntax errors.`;

    const userPrompt = `Generate a Jest + Supertest test suite for this API:

ROUTE SPEC:
- HTTP Method: ${method}
- Path: ${path}
- Handler Name: ${route.handlerName || 'anonymous'}
- Auth Required: ${route.authRequirement?.required ? `Yes (${route.authRequirement.authType})` : 'No'}
- Validation Library: ${route.validationDetails?.library || 'inline_manual'}

SOURCE CODE SNIPPET:
\`\`\`javascript
${route.handlerCodeSnippet || '// No handler snippet available'}
\`\`\`

ENUMERATED TEST SCENARIOS (Derived deterministically from AST analysis):
${JSON.stringify(scenarios, null, 2)}

Output the complete, syntactically valid Jest + Supertest JavaScript file.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await llmService.complete(messages, { timeoutMs: 35000 });
    return response;
  }

  /**
   * Deterministic template generator for offline or fallback environments.
   */
  static _generateDeterministicOfflineTest(route, scenarios, appImportPath) {
    const method = (route.method || 'GET').toUpperCase();
    const path = route.resolvedPath || route.rawPath || '/';
    const cleanUrl = path.replace(/:[a-zA-Z0-9_]+/g, '507f1f77bcf86cd799439011');

    const testBlocks = scenarios
      .map((s) => {
        const hasHeaders = s.headers && Object.keys(s.headers).length > 0;
        const hasPayload = s.payloadSample !== null && s.payloadSample !== undefined;
        const lowConfNotice =
          s.confidence === 'low'
            ? `    // ⚠️ [CodeTraceAI Notice: Needs Review - ${s.confidenceReason || 'Inferred loosely'}]\n`
            : '';

        let reqChain = `const res = await request(app)\n      .${method.toLowerCase()}('${cleanUrl}')`;

        if (hasHeaders) {
          for (const [k, v] of Object.entries(s.headers)) {
            reqChain += `\n      .set('${k}', '${v}')`;
          }
        }

        if (hasPayload) {
          reqChain += `\n      .send(${JSON.stringify(s.payloadSample, null, 6).trim()})`;
        }

        return `  // Scenario: ${s.name}
${lowConfNotice}  it('${s.name.replace(/'/g, "\\'")}', async () => {
    ${reqChain};

    expect(res.status).toBe(${s.expectedStatus});
    ${
      s.expectedStatus >= 200 && s.expectedStatus < 300
        ? 'expect(res.body).toBeDefined();'
        : 'expect(res.body).toBeDefined();'
    }
  });`;
      })
      .join('\n\n');

    return `const request = require('supertest');
const app = require('${appImportPath}');

describe('${method} ${path}', () => {
${testBlocks}
});
`;
  }

  /**
   * Cleans code blocks from markdown fences (```javascript ... ```).
   */
  static _cleanCodeBlock(rawText) {
    if (!rawText) return '';
    let text = rawText.trim();
    if (text.startsWith('```')) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1) {
        text = text.slice(firstNewline + 1);
      }
      if (text.endsWith('```')) {
        text = text.slice(0, -3);
      }
    }
    return text.trim();
  }
}

module.exports = TestGeneratorService;
