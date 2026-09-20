const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

// The library is consumed from ../src, so its imports would resolve to the
// repo-root node_modules first. Block those copies and alias them to the ones
// installed here, otherwise two React / React Native versions get bundled.
const singletons = [
  '@react-native/assets-registry',
  ...Object.keys(pkg.peerDependencies),
];

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  watchFolders: [root],
  resolver: {
    blockList: [defaultConfig.resolver.blockList]
      .flat()
      .concat(
        singletons.map(
          name =>
            new RegExp(
              `^${escapeRegExp(path.join(root, 'node_modules', name))}\\/.*$`,
            ),
        ),
      ),
    extraNodeModules: Object.fromEntries(
      singletons.map(name => [
        name,
        path.join(__dirname, 'node_modules', name),
      ]),
    ),
  },
};

module.exports = mergeConfig(defaultConfig, config);
