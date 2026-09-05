const path = require('path');
const Detector = require('../src/pipeline/detector');

describe('Framework Detector', () => {
  const fixturesDir = path.resolve(__dirname, '../fixtures');

  test('detects Express in express-sample-app', () => {
    const samplePath = path.join(fixturesDir, 'express-sample-app');
    const result = Detector.detectExpress(samplePath);

    expect(result.isExpress).toBe(true);
    expect(result.expressVersion).toMatch(/4\./);
    expect(result.reason).toBeNull();
  });

  test('gracefully rejects non-Express project with a clear message', () => {
    const nonExpressPath = path.join(fixturesDir, 'non-express-sample');
    const result = Detector.detectExpress(nonExpressPath);

    expect(result.isExpress).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain('Unsupported repository');
    expect(result.reason).toContain('Express');
  });
});
