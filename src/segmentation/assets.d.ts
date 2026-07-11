/**
 * Ambient module declaration so `import model from '....tflite'` type-checks.
 * Metro (via metro.config.js's `assetExts`) resolves a `.tflite` import the
 * same way it resolves an image: to a numeric asset id that
 * `Image.resolveAssetSource` (used internally by
 * `react-native-fast-tflite`'s `loadTensorflowModel`) can turn into a URI.
 */
declare module '*.tflite' {
  const assetId: number;
  export default assetId;
}
