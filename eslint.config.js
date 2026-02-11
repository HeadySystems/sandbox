// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: eslint.config.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ESLint configuration for Heady ecosystem
const tsEslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsEslint
    },
    rules: {
      ...tsEslint.configs.recommended.rules,
      // Additional TypeScript rules
    }
  },
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value="api.headysystems.com"], Literal[value="api.headysystems.com"]',
          message: 'Use internal.headyio.com or api.headyio.com instead of api.headysystems.com/api.headysystems.com'
        }
      ]
    }
  },
  {
    ignores: [
      "!.*",
      "dist",
      "node_modules"
    ]
  }
];

