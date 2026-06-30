/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      // Pure-TS logic tests — fast, no RN runtime.
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
      modulePathIgnorePatterns: ['<rootDir>/example', '<rootDir>/lib'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: {
              module: 'CommonJS',
              moduleResolution: 'Node',
              verbatimModuleSyntax: false,
            },
          },
        ],
      },
    },
    {
      // Component render tests (react-native preset + Testing Library).
      displayName: 'ui',
      preset: 'react-native',
      testMatch: ['<rootDir>/__tests__/**/*.test.tsx'],
      modulePathIgnorePatterns: ['<rootDir>/example', '<rootDir>/lib'],
    },
  ],
};
