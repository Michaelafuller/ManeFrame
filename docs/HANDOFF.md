# HANDOFF — Iteration 6 (M-Style: palette, light/dark theming)

**Author:** Fable 5 (planner) · **Status: READY**

## Scope

User-supplied palette, applied app-wide with light and dark themes
driven by the system preference (`useColorScheme()` from react-native —
no new deps, no in-app toggle; a settings screen is a future iteration).
NO EAS builds, NO Maestro/e2e this iteration. JS-only.

## Palette and role assignments (planner-decided; do not improvise)

Base palette: Mauve `#D9BBF9`, Dusty Grape `#4E5283`, Lilac Ash
`#AA9FB1`, Lavender Purple `#7871AA`, Vintage Lavender `#7F6A93`.

Derived neutrals (planner-specified): light background `#FCFAFE`,
light surface `#FFFFFF`, light body text `#2B2A3E`; dark background
`#1C1B2E`, dark surface `#262544`, dark body text `#ECE8F4`.
Semantic error stays `#B00020` (light) / `#FF6B81` (dark). The amber
"style shorter than your hair" hint becomes Vintage Lavender in both
themes (it's informational, not a warning).

| Role | Light | Dark |
|---|---|---|
| Screen background | #FCFAFE | #1C1B2E |
| Card/sheet/surface | #FFFFFF | #262544 |
| Primary button bg / active tab / title accent | #4E5283 (text #FFFFFF) | #7871AA (text #FFFFFF) |
| Secondary accent (links, selected chip border, focus) | #7871AA | #D9BBF9 |
| Selection fill (selected chip/intensity bg) | #D9BBF9 (text #4E5283) | #4E5283 (text #ECE8F4) |
| Muted text, placeholders, borders, disabled | #AA9FB1 | #AA9FB1 |
| Body text | #2B2A3E | #ECE8F4 |
| Informational hints ("Art coming soon", style-length note) | #7F6A93 | #AA9FB1→#7F6A93 blend: use #9B8FAE |
| Badge overlay on photo | keep rgba(0,0,0,0.55), text #FFF | same |
| Error text | #B00020 | #FF6B81 |

## Work order

1. `src/ui/theme.ts`: typed `Theme` object (semantic token names, not
   color names), `lightTheme`/`darkTheme` constants, `useTheme()` hook
   wrapping `useColorScheme()`. Unit-test that both themes cover every
   token and that the hook falls back to light when scheme is null.
2. Refactor ALL hardcoded colors in `src/ui/*` (App tab bar included)
   onto `useTheme()` tokens. StyleSheets that need theme values move to
   theme-parameterized factories or inline token usage — keep the
   pattern consistent across files, minimal diff otherwise. The photo
   canvas, swatch colors (they represent real hair dyes), and evidence
   overlays are CONTENT, not chrome — do not theme them.
3. StatusBar + SafeArea backgrounds must follow the theme (expo-status-bar
   `style="auto"` or explicit per scheme).
4. App icon: verify `app.json` points at the user's new
   `assets/icon.png` (and note the android adaptiveIcon entries still
   reference the old template art — update foreground/background config
   only if the single PNG can serve; otherwise document what's needed).
   Effect requires a future native build (August) — say so in SUMMARY.
5. Verification (no e2e): jest + tsc + eslint green; then dev-client
   visual evidence for planner review — screenshots of Search and
   Preview (with a style applied) in BOTH themes (toggle via
   `adb shell cmd uimode night yes|no`), committed as
   `docs/evidence/iter6-{light,dark}-{search,preview}.png`.
6. SUMMARY.md "Iteration 6" section. Commit to `main` in increments
   ("Iteration 6:" prefix). The USER pushes to remote — never push.

## Constraints

- No new dependencies. No EAS actions of any kind. No e2e runs.
- Never edit HANDOFF / PROGRESS / REMEDIATION / .claude/.
- Photo-library privacy rule stands (screenshots use the bundled
  portrait via the dev diagnostic).
- Keep diffs tight; this is a styling pass, not a refactor of logic.
