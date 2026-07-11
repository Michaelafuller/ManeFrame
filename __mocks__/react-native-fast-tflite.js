/* global jest */
// Manual Jest mock for `react-native-fast-tflite`.
//
// The real package's `loadTensorflowModel` module calls
// `NitroModules.createHybridObject(...)` at import time, which throws
// outside a real native runtime. Since `src/segmentation/tflite.ts` is
// imported (transitively, via PreviewScreen) by UI smoke tests, this stub
// makes that import safe under Jest without ever exercising real
// inference - matching the handoff's "real inference is device-only; do
// not attempt it in Jest" instruction. Jest auto-applies any manual mock
// placed here (adjacent to node_modules) for this module, with no
// per-test `jest.mock(...)` call needed.
module.exports = {
  loadTensorflowModel: jest.fn(() =>
    Promise.reject(new Error('react-native-fast-tflite is mocked in Jest'))
  ),
  useTensorflowModel: jest.fn(() => ({ state: 'error', model: null })),
};
