module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin must be the LAST plugin entry —
    // removed in the SDK 54 bump (babel-preset-expo auto-manages worklets).
    plugins: ['react-native-reanimated/plugin'],
  }
}
