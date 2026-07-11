// Manual Jest mock for `react-native-safe-area-context`.
//
// The library ships its own recommended test double at
// `react-native-safe-area-context/jest/mock.tsx`, but it's an ES module
// with only a *default* export (an object bundling SafeAreaProvider,
// useSafeAreaInsets, etc.). Our source imports named bindings
// (`import { SafeAreaProvider, useSafeAreaInsets } from '...'`), which
// Babel compiles to direct top-level property access on the required
// module - so pointing straight at the library's mock (e.g. via
// moduleNameMapper) leaves every named import `undefined` (only
// `.default.SafeAreaProvider` would exist, not `.SafeAreaProvider`).
// Re-exporting the default object's properties as this mock's top-level
// `module.exports` fixes that. Jest auto-applies any manual mock placed
// here (adjacent to node_modules) for this module, with no per-test
// `jest.mock(...)` call needed - same pattern as
// `__mocks__/react-native-fast-tflite.js`.
module.exports = require('react-native-safe-area-context/jest/mock').default;
