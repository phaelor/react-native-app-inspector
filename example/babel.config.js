const path = require('path');
const pkg = require('../package.json');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        extensions: ['.tsx', '.ts', '.js', '.json'],
        alias: {
          // Resolve the library to its source so Metro rebuilds on changes to
          // ../src without a separate `bob build` step during development.
          [pkg.name]: path.join(__dirname, '..', pkg.source),
        },
      },
    ],
  ],
};
