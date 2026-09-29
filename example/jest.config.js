module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community|-async-storage)?)/)',
  ],
  moduleNameMapper: {
    '^react(/.*)?$': '<rootDir>/node_modules/react$1',
    '^react-native$': '<rootDir>/node_modules/react-native',
  },
};
