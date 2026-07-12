import { fireEvent, render, screen } from '@testing-library/react-native';

import App from '../../../App';

// Minimal Skia stub: the pixel pipeline is already covered by pure-function
// tests (src/color/__tests__/recolorImage.test.ts,
// src/segmentation/__tests__/mock.test.ts), so this smoke test never needs
// real Skia decoding/drawing - just enough surface for PreviewScreen to
// render without crashing.
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromURI: jest.fn(), fromBytes: jest.fn() },
    // Iteration 5R: PreviewScreen decodes the selected style's bundled
    // raster cutout (`decodeOverlayAsset`) via Skia.Image.MakeImageFromEncoded.
    // Stubbed to fail gracefully (returns null/undefined, which
    // `decodeOverlayAsset`'s try/catch already handles as "no overlay art
    // available") - this smoke test only needs the tree to render without
    // crashing when a style is pre-selected, not real Skia decoding
    // (that's device-only, see docs/E2E.md).
    Image: { MakeImageFromEncoded: jest.fn(), MakeImage: jest.fn() },
    Color: jest.fn(() => 0),
  },
  Canvas: () => null,
  Image: () => null,
  ColorType: { RGBA_8888: 4 },
  AlphaType: { Unknown: 0, Opaque: 1, Premul: 2, Unpremul: 3 },
}));

jest.mock('expo-asset', () => ({
  Asset: {
    // Iteration 5R: PreviewScreen resolves bundled overlay assets via
    // Asset.fromModule(...).localUri. Stubbed to a stable fake URI so
    // `decodeOverlayAsset` proceeds to the (also stubbed) Skia decode
    // instead of short-circuiting on asset resolution - either way it
    // resolves to null overlay pixels, which is all this smoke test needs.
    fromModule: jest.fn(() => ({ localUri: 'mock://overlay-asset', downloadAsync: jest.fn() })),
  },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

describe('App', () => {
  it('renders both tabs, defaulting to the Search screen', async () => {
    await render(<App />);

    expect(screen.getByText('Search')).toBeTruthy();
    expect(screen.getByText('Preview')).toBeTruthy();
    // SearchScreen content is visible by default.
    expect(screen.getByText('ManeFrame')).toBeTruthy();
  });

  it('switching to the Preview tab shows the "Pick a photo" button', async () => {
    await render(<App />);

    await fireEvent.press(screen.getByText('Preview'));

    expect(screen.getByText('Pick a photo')).toBeTruthy();
  });

  it('shows "Try on" for an art-bearing style and "Art coming soon" for one without art', async () => {
    await render(<App />);

    // Default (empty) search query renders every catalog style unranked -
    // no typing needed. Pixie Crop has real donor-hair overlay art
    // (Iteration 5R); Coily Afro does not.
    expect(screen.getByTestId('try-on-pixie-crop')).toBeTruthy();
    expect(screen.getAllByText('Art coming soon').length).toBeGreaterThan(0);
  });

  it('tapping "Try on" carries the style into the Preview tab as the pre-selected style chip', async () => {
    await render(<App />);

    await fireEvent.press(screen.getByTestId('try-on-pixie-crop'));

    // Preview tab should now be showing (its "Pick a photo" entry point
    // renders) with the Pixie Crop style chip pre-selected, and "None"
    // no longer selected.
    expect(screen.getByText('Pick a photo')).toBeTruthy();
    expect(screen.getByTestId('style-chip-pixie-crop').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByTestId('style-chip-none').props.accessibilityState).toEqual({
      selected: false,
    });
  });
});
