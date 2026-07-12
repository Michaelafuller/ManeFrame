import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { THEME_TOKENS, darkTheme, lightTheme, useTheme } from '../theme';

// Isolate the mock to react-native's own useColorScheme module (rather than
// mocking all of 'react-native') so every other RN export theme.ts doesn't
// even use stays real. Mocked by its underlying path (react-native/index.js
// re-exports `useColorScheme` via a getter over this same module), then
// imported/typed through the public 'react-native' entry point above.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.Mock;

describe('theme tokens', () => {
  it('lightTheme and darkTheme both define every token in THEME_TOKENS', () => {
    for (const token of THEME_TOKENS) {
      expect(lightTheme[token]).toEqual(expect.any(String));
      expect(darkTheme[token]).toEqual(expect.any(String));
    }
  });

  it('lightTheme and darkTheme have exactly the same set of keys as THEME_TOKENS', () => {
    expect(Object.keys(lightTheme).sort()).toEqual([...THEME_TOKENS].sort());
    expect(Object.keys(darkTheme).sort()).toEqual([...THEME_TOKENS].sort());
  });

  it('lightTheme and darkTheme differ (dark mode is not just an alias for light)', () => {
    expect(darkTheme).not.toEqual(lightTheme);
  });
});

describe('useTheme', () => {
  afterEach(() => {
    mockUseColorScheme.mockReset();
  });

  it('returns lightTheme when the system scheme is "light"', async () => {
    mockUseColorScheme.mockReturnValue('light');
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(lightTheme);
  });

  it('returns darkTheme when the system scheme is "dark"', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(darkTheme);
  });

  it('falls back to lightTheme when the system scheme is null', async () => {
    mockUseColorScheme.mockReturnValue(null);
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(lightTheme);
  });

  it('falls back to lightTheme when the system scheme is undefined', async () => {
    mockUseColorScheme.mockReturnValue(undefined);
    const { result } = await renderHook(() => useTheme());
    expect(result.current).toBe(lightTheme);
  });
});
