module.exports = function (api) {
  const platform = api.caller((caller) => caller?.platform);
  api.cache.using(() => platform);

  if (platform === 'web') {
    return {
      presets: ['babel-preset-expo'],
    };
  }

  return {
    presets: ['module:@react-native/babel-preset'],
  };
};
