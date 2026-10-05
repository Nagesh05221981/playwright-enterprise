import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.spec.js'],
    rules: {
      'no-empty-pattern': 'off', // Playwright fixtures use destructuring
    },
  },
];
