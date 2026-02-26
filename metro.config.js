const { getDefaultConfig: getRnDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { getDefaultConfig: getExpoDefaultConfig } = require('expo/metro-config');

const isExpoWebBuild = process.argv.includes('--platform') && process.argv.includes('web');

if (isExpoWebBuild) {
  module.exports = getExpoDefaultConfig(__dirname);
} else {
  const config = getRnDefaultConfig(__dirname);
  module.exports = mergeConfig(config, {});
}
