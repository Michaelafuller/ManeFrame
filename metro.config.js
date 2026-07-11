// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-fast-tflite loads .tflite models via `require(...)`; Metro
// needs to treat them as a binary asset (like an image), not try to parse
// them as source.
config.resolver.assetExts.push('tflite');

module.exports = config;
