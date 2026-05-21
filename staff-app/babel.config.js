module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 split worklets into a separate package — the plugin moved
    // from react-native-reanimated/plugin to react-native-worklets/plugin.
    // Must stay last in the plugins array.
    plugins: ['react-native-worklets/plugin'],
  };
};
