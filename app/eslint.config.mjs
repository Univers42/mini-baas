import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    // Ignore build outputs, dependencies and coverage reports
    ignores: ['dist/**', 'node_modules/**', '.pnpm-store/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Require project for type-aware linting rules (essential for strict backend)
        project: './tsconfig.json',
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Load recommended TypeScript rules
      ...tsPlugin.configs.recommended.rules,

      // 🛡️ STRICT DEVOPS RULES

      // Disable base JS rules that conflict with TypeScript
      'no-undef': 'off',
      'no-unused-vars': 'off',

      // Enforce unused variables as an ERROR, not a warning (ignore args starting with _)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // STRICT: Ban the 'any' type to maintain absolute type safety in the BaaS engine
      '@typescript-eslint/no-explicit-any': 'error',

      // STRICT: Prevent floating promises (forgotten 'await'). Crucial to avoid memory leaks in Node.js
      '@typescript-eslint/no-floating-promises': 'error',

      // Good practice: Enforce return types on API endpoints and services
      '@typescript-eslint/explicit-function-return-type': 'warn',
    },
  },
];
