const ExecutionPipeline = require('../src/services/executionPipeline');

describe('ExecutionPipeline (Telemetry & Output Parsing)', () => {
  test('correctly parses structured Jest JSON output', () => {
    const mockJestJsonOutput = `
      Some arbitrary console logs from express app...
      {
        "numFailedTests": 1,
        "numPassedTests": 2,
        "numTotalTests": 3,
        "numPendingTests": 0,
        "startTime": 1725500000000,
        "testResults": [
          {
            "perfStats": { "start": 1725500000000, "end": 1725500000350 },
            "assertionResults": [
              {
                "title": "Happy Path: Successfully POST /api/v1/articles",
                "status": "passed",
                "duration": 120,
                "failureMessages": []
              },
              {
                "title": "Auth: Reject request when token is missing",
                "status": "passed",
                "duration": 45,
                "failureMessages": []
              },
              {
                "title": "Branch: Reject when title length < 5",
                "status": "failed",
                "duration": 85,
                "failureMessages": [
                  "Error: expect(received).toBe(expected)\\n\\nExpected: 422\\nReceived: 400\\n    at Object.test (/workspace/__codetrace__.test.js:34:25)"
                ]
              }
            ]
          }
        ]
      }
    `;

    const parsed = ExecutionPipeline.parseJestOutput(mockJestJsonOutput);

    expect(parsed.total).toBe(3);
    expect(parsed.passed).toBe(2);
    expect(parsed.failed).toBe(1);
    expect(parsed.durationMs).toBe(350);
    expect(parsed.results.length).toBe(3);

    const failedItem = parsed.results.find((r) => r.status === 'failed');
    expect(failedItem).toBeDefined();
    expect(failedItem.expected).toBe('422');
    expect(failedItem.actual).toBe('400');
    expect(failedItem.errorMessage).toContain('Expected: 422');
    expect(failedItem.stackTrace).toContain('__codetrace__.test.js');
  });

  test('falls back gracefully to text pattern parsing when JSON is missing', () => {
    const mockTextOutput = `
      PASS  Happy Path: Successfully GET /api/v1/articles (45 ms)
      FAIL  Branch: Invalid ID format (20 ms)
    `;

    const parsed = ExecutionPipeline.parseJestOutput(mockTextOutput);

    expect(parsed.total).toBe(2);
    expect(parsed.passed).toBe(1);
    expect(parsed.failed).toBe(1);
  });
});
