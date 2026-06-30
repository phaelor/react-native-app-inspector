const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {getConfig} = require('react-native-builder-bob/metro-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

/**
 * Metro configuration.
 *
 * `getConfig` (from react-native-builder-bob) watches the library root so
 * changes to ../src hot-reload here, and dedupes react / react-native by
 * blocking the copies in the repo-root node_modules and aliasing them to the
 * versions installed in example/node_modules.
 */
module.exports = getConfig(
  mergeConfig(getDefaultConfig(__dirname), {}),
  {
    root,
    pkg,
    project: __dirname,
  },
);
