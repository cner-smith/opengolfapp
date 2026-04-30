module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-reanimated/plugin must be the LAST plugin entry —
    // it transforms worklets and depends on every other plugin running
    // first. Required for GestureDetector + Gesture.LongPress in HoleMap.
    plugins: ['react-native-reanimated/plugin'],
  }
}
