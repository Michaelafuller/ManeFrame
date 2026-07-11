# REMEDIATION — Iteration 4R-2 (complete the interrupted 4R: preview build + green E2E)

**Author:** Fable 5 (planner) · **Executor:** Sonnet 5 · **Date:** 2026-07-11
**Supersedes the 4R work order (executor session was killed by a host-machine
crash mid-run; this order finishes and verifies that work).**

## State reconstruction (planner-verified — trust this, re-verify cheaply)

The interrupted 4R session left the working tree in this state (uncommitted,
on top of `33c50f2`):

- `react-native-nitro-modules@^0.36.1` added to `package.json` dependencies
  (the launch-crash fix), plus `patch-package` postinstall.
- `patches/@shopify+react-native-skia+2.6.2.patch` — guards Skia's
  `useVideoLoading` module-level `createWorkletRuntime` call behind
  `HAS_REANIMATED_3` (without reanimated installed, that call throws during
  JS bundle evaluation). Legitimate second bug found on-device.
- `flows/00-launch.yaml`, `flows/01-search.yaml`,
  `flows/02-preview-mock-badge.yaml`, `docs/E2E.md`, e2e npm scripts,
  testID changes in `src/ui/SearchScreen.tsx`.
- EAS builds this month (3): `b2445fad` dev/broken, `0cb773cb` preview/
  **stale — same fingerprint as broken** (built before the nitro fix),
  `68834a2f` dev/**fixed** (fingerprint differs; planner launched it on the
  attached phone: process starts, no crash, dev-launcher screen shows).
- The failing Maestro results (`flows/results.xml`, 3/3 timeouts) came from
  running flows against the dev-client launcher with no Metro server — NOT
  against a broken app. The nitro fix is confirmed good.

Device: Pixel-class phone attached via USB, `adb devices` serial
`0A131FDD4006VE`, USB debugging authorized. The installed
`com.maneframe.app` is currently the dev-client build `68834a2f`.

## Scope

### 1. Sanity-check the inherited tree

- Read the inherited flow files, `docs/E2E.md`, the SearchScreen diff
  (`git diff src/ui/SearchScreen.tsx`), and the skia patch. Fix anything
  obviously half-finished (the session died mid-run). Do not rewrite
  wholesale.
- `npm install` (ensures patch-package postinstall applied), then the local
  suite: `npm run typecheck && npm run lint && npm test` — must be clean.
  `npx expo export --platform android` must bundle.

### 2. Metro-connected smoke on the ALREADY-INSTALLED dev client (no new build)

- Start Metro in the background: `npx expo start --dev-client` (use a
  background process; wait for it to report ready).
- `adb reverse tcp:8081 tcp:8081`, then launch the dev client into the
  bundle: `adb shell am start -a android.intent.action.VIEW -d
  "exp+maneframe://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`.
- Wait for the bundle to load (poll logcat / take `adb exec-out screencap`
  screenshots into the scratchpad and READ them). Success = ManeFrame's
  Search screen visible, no redbox. If a redbox/JS crash appears, capture
  it — if it's the Skia/reanimated throw, the patch isn't being applied;
  fix that before anything else. Screenshot evidence goes in SUMMARY.md
  (copy to `docs/evidence/` — create the dir, PNG ok, keep ≤3 small files).
- With Metro still up, optionally run `npm run e2e` against this mode; note
  results but do NOT treat dev-client-mode e2e as the acceptance gate.

### 3. Fresh preview build (the standalone Maestro/user artifact)

- Only after step 2 passes: commit first (see step 5 ordering note), then
  `eas build --platform android --profile preview --non-interactive`
  (`--no-wait` + poll). This is EAS build 4 of 15 this month; max one retry.
- Download the APK artifact (record URL/size), `adb install -r` it (this
  replaces the dev client — expected, same applicationId), launch, confirm
  via screencap it opens straight into ManeFrame (no dev launcher).

### 4. Acceptance gate: green E2E on the preview build

- `npm run e2e` — all 3 flows must pass against the installed preview
  build. Archive the passing `flows/results.xml` content verbatim into
  SUMMARY.md. If a flow fails for a REAL reason (assertion wrong, testID
  missing), fix the flow or the testID and re-run; if the app itself
  misbehaves, STOP and report with logcat + screenshot.
- Update `docs/E2E.md`: document the two modes (dev-client+Metro for
  iteration; preview standalone for acceptance runs), the
  `adb reverse` requirement, and a troubleshooting row for "all flows time
  out at launch → you're on the dev-client launcher, install the preview
  build or start Metro". Update the coverage table to reflect actual pass
  status.

### 5. Commit + report

- Commit BEFORE the EAS build (so the build's recorded commit matches its
  content): one commit with everything inherited + your fixes:
  `Iteration 4R: fix Nitro launch crash, Skia reanimated patch, Maestro E2E`.
  If step 4 then requires flow/testID fixes, a second small commit
  `Iteration 4R: e2e fixes from device run` is acceptable — no more than two.
- Overwrite `docs/SUMMARY.md` (uncommitted) with the 4R report: the usual
  five sections, plus screenshot evidence references, the e2e results XML,
  and a short "what the crashed session had done vs. what this session
  added" table. Include a "Verification requests for the user" section:
  the preview-build install link for their own phone use, and the manual
  checks that remain (tflite badge after picking a photo, recolor tracks
  hair, latency).

## Hard constraints

- Do not edit `docs/HANDOFF.md`, `docs/PROGRESS.md`, `docs/REMEDIATION.md`,
  or `.claude/`.
- No new dependencies beyond what the crashed session already added
  (nitro-modules, patch-package). No hand-written Kotlin/Swift. No local
  prebuild.
- Max 2 EAS builds this session (target 1, preview profile only — do NOT
  rebuild the development profile; `68834a2f` is good).
- Never `eas login`/credentials; `eas whoami`, `eas build`, `eas build:list`
  only.
- Do not push. No analytics. No runtime network calls.
- Do not uninstall/clear the phone's other apps; only touch
  `com.maneframe.app`.
