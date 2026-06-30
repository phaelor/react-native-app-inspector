module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    es2021: true,
    node: true,
    jest: true,
  },
  ignorePatterns: ['lib/', 'node_modules/', 'coverage/', 'example/'],
  rules: {
    'prettier/prettier': 'warn',
    // TypeScript handles undefined-symbol checks; the core rule false-positives on types/globals.
    'no-undef': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
