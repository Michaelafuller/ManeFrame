import { useColorScheme } from 'react-native';

/**
 * Semantic theme tokens (Iteration 6 / M-Style). Token *names* describe the
 * UI role a color plays, not the color itself — screens consume
 * `theme.<role>`, never a literal hex. The literal values below are the
 * planner-decided palette/role table in docs/HANDOFF.md; do not improvise
 * new values here without a handoff update.
 *
 * Content colors (the photo canvas, dye swatches, evidence overlays) are
 * deliberately NOT part of this theme — they represent real photo pixels /
 * real hair-dye colors and must not shift with the UI theme.
 */
export interface Theme {
  /** Screen background. */
  background: string;
  /** Card / sheet / input-field surface. */
  surface: string;
  /** Primary button background; also used as the active-tab / title-accent
   *  text color where there's no filled background to put it on. */
  primary: string;
  /** Text color for content drawn on top of a `primary`-filled background. */
  onPrimary: string;
  /** Secondary accent: links, selected chip border, focus rings. */
  accent: string;
  /** Selected chip / selected intensity preset background fill. */
  selectionBackground: string;
  /** Text color for content drawn on top of `selectionBackground`. */
  onSelectionBackground: string;
  /** Muted text, placeholders, borders, disabled state. */
  muted: string;
  /** Body text. */
  text: string;
  /** Informational hints ("Art coming soon", style-length note, no-hair /
   *  no-face hints) — informational, not a warning, so it's deliberately
   *  not the `error` color. */
  hint: string;
  /** Translucent badge overlay drawn on top of the photo (e.g. the
   *  segmenter badge). Identical in both themes by design. */
  badgeOverlay: string;
  /** Text color on top of `badgeOverlay`. Identical in both themes. */
  badgeText: string;
  /** Error text. */
  error: string;
}

/** Every token name a `Theme` must define — used by the coverage test. */
export const THEME_TOKENS: (keyof Theme)[] = [
  'background',
  'surface',
  'primary',
  'onPrimary',
  'accent',
  'selectionBackground',
  'onSelectionBackground',
  'muted',
  'text',
  'hint',
  'badgeOverlay',
  'badgeText',
  'error',
];

export const lightTheme: Theme = {
  background: '#FCFAFE',
  surface: '#FFFFFF',
  primary: '#4E5283',
  onPrimary: '#FFFFFF',
  accent: '#7871AA',
  selectionBackground: '#D9BBF9',
  onSelectionBackground: '#4E5283',
  muted: '#AA9FB1',
  text: '#2B2A3E',
  hint: '#7F6A93',
  badgeOverlay: 'rgba(0,0,0,0.55)',
  badgeText: '#FFFFFF',
  error: '#B00020',
};

export const darkTheme: Theme = {
  background: '#1C1B2E',
  surface: '#262544',
  primary: '#7871AA',
  onPrimary: '#FFFFFF',
  accent: '#D9BBF9',
  selectionBackground: '#4E5283',
  onSelectionBackground: '#ECE8F4',
  muted: '#AA9FB1',
  text: '#ECE8F4',
  hint: '#9B8FAE',
  badgeOverlay: 'rgba(0,0,0,0.55)',
  badgeText: '#FFFFFF',
  error: '#FF6B81',
};

/**
 * Resolves the active theme from the system color scheme
 * (`useColorScheme()` from react-native — no in-app toggle this iteration).
 * Falls back to `lightTheme` when the scheme is `null`/`undefined` (e.g.
 * unsupported platform, or not yet determined).
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
