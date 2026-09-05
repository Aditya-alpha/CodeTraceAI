const path = require('path');
const Bootstrapper = require('../src/services/bootstrapper');

describe('Bootstrapper (Dependency & Start Command Detection)', () => {
  const fixturePath = path.resolve(__dirname, '../fixtures/express-sample-app');

  test('successfully detects Express entry point, start script, and env in express-sample-app', () => {
    const result = Bootstrapper.detect(fixturePath);

    expect(result.canBoot).toBe(true);
    expect(result.entryFile).toBe('server.js');
    expect(result.startCommand).toContain('server.js');
    expect(result.dbKey).toBe('MONGODB_URI');
    expect(result.missingSecrets.length).toBe(0);
  });

  test('gracefully rejects non-existent workspace path', () => {
    const result = Bootstrapper.detect('C:/path/to/non/existent/repo/workspace');

    expect(result.canBoot).toBe(false);
    expect(result.reason).toContain('does not exist');
  });
});
