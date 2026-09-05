const babelParser = require('@babel/parser');

class AstParser {
  static parse(code, filename = 'file.js') {
    const isTypeScript = /\.(ts|tsx)$/i.test(filename);
    const isJsx = /\.(jsx|tsx)$/i.test(filename);

    const basePlugins = [
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'decorators-legacy',
      'dynamicImport',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'asyncGenerators',
      'objectRestSpread',
      'topLevelAwait',
      'optionalChaining',
      'nullishCoalescingOperator',
    ];

    if (isTypeScript) {
      basePlugins.push('typescript');
    }
    if (isJsx) {
      basePlugins.push('jsx');
    }

    try {
      return babelParser.parse(code, {
        sourceType: 'unambiguous',
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        plugins: basePlugins,
      });
    } catch (primaryErr) {
      // Fallback: try with both typescript and jsx enabled, or generic fallback
      try {
        return babelParser.parse(code, {
          sourceType: 'unambiguous',
          allowReturnOutsideFunction: true,
          allowImportExportEverywhere: true,
          plugins: [...basePlugins, 'typescript', 'jsx'],
        });
      } catch (fallbackErr) {
        console.warn(`[AstParser] Failed to parse ${filename}:`, fallbackErr.message);
        return null;
      }
    }
  }
}

module.exports = AstParser;
