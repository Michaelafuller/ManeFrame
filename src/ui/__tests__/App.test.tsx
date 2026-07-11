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
    Image: { MakeImageFromEncoded: jest.fn(), MakeImage: jest.fn() },
  },
  Canvas: () => null,
  Image: () => null,
  ColorType: { RGBA_8888: 4 },
  AlphaType: { Unknown: 0, Opaque: 1, Premul: 2, Unpremul: 3 },
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
});
