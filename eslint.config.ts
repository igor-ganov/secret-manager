import tseslint from 'typescript-eslint';

/* The site client follows the functional-frontend rules: no `if`, no
   ternary, no logical control flow, one small file per function. The server
   and the bot predate those rules and keep the project-wide TypeScript style
   only, so the branch-free rules are scoped to `src/web`. */
const BRANCHING_SELECTORS = [
  { selector: 'IfStatement', message: 'Use an exhaustive switch or a strategy map instead of if.' },
  { selector: 'ConditionalExpression', message: 'Use an exhaustive switch or a strategy map instead of ?:.' },
  {
    selector: 'ExpressionStatement > LogicalExpression',
    message: 'No && / || / ?? as a statement — that is control flow; use a switch.',
  },
];

export default tseslint.config(
  { ignores: ['node_modules/**', 'public/**', 'dist/**', 'test-results/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'off',
    },
  },
  {
    files: ['src/web/**/*.ts'],
    ignores: ['src/web/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...BRANCHING_SELECTORS],
      'max-lines': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
    },
  },
);
