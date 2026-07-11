// Jest moduleNameMapper target for `*.tflite` imports (see package.json's
// jest.moduleNameMapper). Metro resolves a `.tflite` require/import to a
// numeric asset id (see src/segmentation/assets.d.ts); Jest has no Metro
// asset pipeline, so this stub stands in for that numeric id without ever
// reading the (large, binary) real model file from disk during tests.
module.exports = 1;
