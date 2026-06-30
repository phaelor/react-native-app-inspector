const path = require('path');
const pkg = require('../package.json');

// The library lives one level up (consumed from source via the Babel alias).
// Point native autolinking at the repo root so its podspec / android project
// are picked up by `pod install` and Gradle.
module.exports = {
  dependencies: {
    [pkg.name]: {
      root: path.join(__dirname, '..'),
    },
  },
};
