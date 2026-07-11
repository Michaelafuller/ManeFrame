# REMEDIATION — Iteration 4R-3 (safe-area insets: the "corrupted title" is edge-to-edge overlap)

**Author:** Fable 5 (planner) · **Executor:** Sonnet 5 · **Date:** 2026-07-11
**Supersedes 4R-2's open blocker.** 4R-2's execution is otherwise judged
good: the search-flow root-cause was correct, the STOP-and-report on the
title defect was the right call, and its evidence collection was exactly
what made this diagnosis possible.

## Planner diagnosis (verified on-device — this replaces 4R-2's GPU-race hypothesis)

The "corrupted, overlapping glyphs" on the SearchScreen title are the
**Android status bar's clock and icons drawn over the title text**. SDK 57
apps are edge-to-edge on Android; React Native's built-in `SafeAreaView` is
a documented no-op on Android (Iteration 3 flagged exactly this risk for the
tab bar). Evidence:

- The overlap glyphs sit at x≈167–267 — exactly the status-bar clock's
  bounds from 4R-2's own Maestro hierarchy dump.
- Planner re-dumped uiautomator with the preview build: the title TextView
  EXISTS at bounds `[44,33][1036,131]` — inside the status-bar zone
  (clock `[167,6][267,136]`). 4R-2's "zero accessibility node" observation
  was occlusion-dependent visibility filtering, not a missing node.
- Same class of bug at the bottom: the gesture-nav pill overlaps the
  Search/Preview tab bar (visible in `docs/evidence/preview-launch.png`).

No GPU/Skia involvement. Do not pursue that thread.

## Scope

### 1. Fix insets properly with `react-native-safe-area-context`

- `npx expo install react-native-safe-area-context` (the ecosystem-standard
  solution; native module — the preview APK must be rebuilt, see step 3).
- Wrap the app root (`App.tsx`) in `SafeAreaProvider`.
- Replace the deprecated RN `SafeAreaView` imports in `SearchScreen.tsx` /
  `PreviewScreen.tsx` with the library's `SafeAreaView` (or
  `useSafeAreaInsets` padding — executor's choice, be consistent).
- Give the bottom tab bar safe-area bottom padding so it clears the
  gesture bar.
- Jest: use the library's provided mock
  (`react-native-safe-area-context/jest/mock`) via `jest.setup` or
  moduleNameMapper so the existing UI smoke tests keep working; the RN
  `SafeAreaView` deprecation warning in test output should disappear.

### 2. Local verification

- `npm run typecheck && npm run lint && npm test` clean;
  `npx expo export --platform android` bundles.

### 3. One preview rebuild + green E2E (the acceptance gate)

- Commit first (see step 4), then
  `eas build --platform android --profile preview --non-interactive`
  (`--no-wait` + poll). Build 5 of 15 this month; max one retry.
- **Do NOT rebuild the development profile.** The dev client `68834a2f`
  becomes temporarily stale (it lacks the new native module, so Metro-mode
  JS loading will error until M5's natural dev-client rebuild). Note this
  prominently in `docs/E2E.md`'s two-modes section.
- Download + `adb install -r` on the attached phone (serial
  `0A131FDD4006VE`), then:
  - Screenshot evidence: title fully below the status bar, tab bar clear
    of the gesture pill (add to `docs/evidence/`, replace stale ones).
  - `npm run e2e` — **all 3 flows must pass.** Archive results.xml
    verbatim in SUMMARY.md. If `00-launch` still fails with the title
    visibly correct on the screenshot, investigate the assertion itself
    (occlusion filtering) before touching app code, and report findings.

### 4. Commit + report

- One commit before the EAS build:
  `Iteration 4R-3: safe-area insets via safe-area-context, green E2E` —
  include the prior uncommitted `docs/SUMMARY.md` (4R-2 report) state.
  A second small commit for post-device e2e/evidence updates is permitted.
- Overwrite `docs/SUMMARY.md` with the 4R-3 report (uncommitted, usual
  five sections + evidence + results XML + "Verification requests for the
  user": fresh preview APK link; the still-outstanding Iteration-4 manual
  checks — tflite badge, hair-vs-face recolor, latency — now unblocked).

## Hard constraints

- Do not edit `docs/HANDOFF.md`, `docs/PROGRESS.md`, `docs/REMEDIATION.md`,
  `.claude/`.
- New dependencies: `react-native-safe-area-context` ONLY.
- Max 2 EAS builds (preview profile only; target 1). Never touch
  credentials; `eas whoami`/`eas build`/`eas build:list` only.
- No push, no analytics, no runtime network calls, no local prebuild, no
  hand-written native code.
- Only touch `com.maneframe.app` on the phone.
