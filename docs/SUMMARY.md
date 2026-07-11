# SUMMARY — Iteration 4R-2 (complete the interrupted 4R: preview build + green E2E)

**Executor:** Sonnet 5 · **Date:** 2026-07-11
**Supersedes the Iteration-4 SUMMARY.md** (that report described the original
Iteration 4 EAS dev-client build; this report covers the 4R-2 remediation:
finishing and verifying the interrupted 4R session's work).

## Outcome at a glance

| Scope item | Status |
|---|---|
| 1. Sanity-check inherited tree | **Done** |
| 2. Metro-connected smoke on already-installed dev client | **Done — passed** |
| 3. Fresh preview build | **Done** |
| 4. Acceptance gate: green E2E on preview build | **BLOCKED — 2/3 flows pass.** `00-launch` fails on a real, reproducible on-device rendering defect (not a flow bug). STOPPING per the remediation's explicit instruction rather than attempting an unauthorized fix. See "Known issues" below. |
| 5. Commit + report | **Done** (two commits, as permitted) |

**E2E result: 2/3 flows passing on the preview build** (`01-search`,
`02-preview-mock-badge` pass; `00-launch` fails on a genuine app defect).

---

## 1. Scope-item mapping (what was done)

### 1. Sanity-check the inherited tree

Read `flows/00-launch.yaml`, `flows/01-search.yaml`,
`flows/02-preview-mock-badge.yaml`, `docs/E2E.md`, the `SearchScreen.tsx`
diff, and `patches/@shopify+react-native-skia+2.6.2.patch`. Everything was
coherent and complete — no half-finished state found beyond what the
REMEDIATION's "state reconstruction" section already described. No rewrites
needed.

Verification suite, all clean:

```
npm install                                    → patch-package applied cleanly
npm run typecheck && npm run lint && npm test  → clean / clean / 126 passed
npx expo export --platform android             → clean, 881 modules
```

### 2. Metro-connected smoke on the already-installed dev client

- Started Metro (`npx expo start --dev-client`) in the background, ready at
  `http://localhost:8081`.
- `adb reverse tcp:8081 tcp:8081`, then deep-linked the dev client
  (`exp+maneframe://expo-development-client/?url=...`).
- **Result: PASS.** The Search screen loaded fully — title, search box,
  catalog results, both tabs — with no redbox. The Iteration-4R Skia patch
  is working: without it, this would have thrown at module-load time before
  any UI rendered (per the patch's own comment and `flows/00-launch.yaml`'s
  header comment). Screenshot: `docs/evidence/metro-smoke-2.png`.
- Ran `npm run e2e` in this mode too (informational only, not the
  acceptance gate, per the remediation's own instruction). All 3 flows
  failed with "element not found" — expected: Maestro's `launchApp`
  reopens the dev-client launcher screen, not the Metro-deep-linked bundle.
  This is now documented in `docs/E2E.md`'s "Two modes" section and a new
  troubleshooting row.

### 3. Fresh preview build

- Committed first (see section 5), then:
  `eas build --platform android --profile preview --non-interactive --no-wait`,
  polled `eas build:list` every 30s.
- **Build finished successfully, first attempt, no retry** — 1 of 2
  permitted builds this session, 4th of 15 this month.
  - Build ID: `6121bda2-b033-4e94-9d54-f473e0b4716b`
  - Build page: https://expo.dev/accounts/michaelafuller/projects/maneframe/builds/6121bda2-b033-4e94-9d54-f473e0b4716b
  - APK: https://expo.dev/artifacts/eas/ugmea4MtCdiJXWQ5WJPduV9RDJzWC5tFOVKglDxX-us.apk
  - Started 2026-07-11T06:35:46Z, finished 2026-07-11T06:46:14Z (~10m22s).
  - Git commit built: `a285532` (the first Iteration-4R commit, matches
    exactly what was intended to be built).
  - Fingerprint `e2658baa...` — differs from the earlier stale
    `0cb773cb` preview build (built before the nitro fix), confirming this
    is a genuinely fresh build reflecting the fix.
- Downloaded (141.5 MB) and `adb install -r`'d over the dev-client build
  (same `applicationId`, expected replacement).
- Launched: **opens straight into ManeFrame, no dev-launcher screen.**
  Screenshot: `docs/evidence/preview-launch.png`.

### 4. Acceptance gate: green E2E on the preview build

First run: `npm run e2e` → **2 flows failed** (`00-launch`, `01-search`),
`02-preview-mock-badge` passed. Investigated both failures on-device rather
than assuming either was a real app regression:

- **`01-search` — a real flow-authoring bug, fixed.** The flow's second
  query, `"warm red"`, has no length/fringe/texture/attribute hint.
  `searchHairstyles` (`src/search/scorer.ts`) only returns "all styles
  unranked" when the *entire* query is empty; a color-only query takes the
  scored path, every style scores exactly 0, and the function's documented
  behavior ("zero-score results are omitted") drops all of them — so **no**
  hairstyle cards, and therefore **no** color swatches, ever render.
  Confirmed on-device: typing "warm red" alone renders "0 hairstyles · 4
  colors" / "No matching hairstyles.". Fixed the flow to use the canonical,
  unit-tested query `"warm red shoulder-length bob"`
  (`scorer.test.ts` canonical query 4), which guarantees a style match.
  This bug would have failed identically on *any* build, dev or preview —
  it was never a preview-build defect. Re-ran: **passes.**
- **`00-launch` — a real, reproducible app defect. STOPPED per the
  remediation's explicit instruction; no fix attempted.** See "Known
  issues" below for full investigation and evidence.

Final acceptance run against the preview build (`flows/results.xml`,
archived verbatim):

```xml
<?xml version='1.0' encoding='UTF-8'?>
<testsuites>
  <testsuite name="Test Suite" device="0A131FDD4006VE" tests="3" failures="1" time="60.0">
    <testcase id="00-launch" name="00-launch" classname="00-launch" file="flows\00-launch.yaml" time="24.0" status="ERROR">
      <failure>Assertion is false: "ManeFrame" is visible</failure>
    </testcase>
    <testcase id="01-search" name="01-search" classname="01-search" file="flows\01-search.yaml" time="29.0" status="SUCCESS"/>
    <testcase id="02-preview-mock-badge" name="02-preview-mock-badge" classname="02-preview-mock-badge" file="flows\02-preview-mock-badge.yaml" time="7.0" status="SUCCESS"/>
  </testsuite>
</testsuites>
```

`docs/E2E.md` updated: added a "Two modes" section (dev-client+Metro for
iteration vs. preview standalone for acceptance) with the `adb reverse`
deep-link recipe, a troubleshooting row for "all flows time out at launch →
you're on the dev-client launcher", a row explaining the color-only-query
empty-result behavior, and the coverage table now has a "Last acceptance
run" column reflecting actual pass/fail status instead of just
"Automated? Yes/No".

### 5. Commit + report

Two commits, as permitted:

1. `a285532` "Iteration 4R: fix Nitro launch crash, Skia reanimated patch,
   Maestro E2E" — everything inherited from the crashed session (nitro dep,
   Skia patch, flow files, E2E.md, testID) plus the Metro-smoke evidence,
   committed **before** the EAS build so the build's recorded commit
   matches its content.
2. `fbc0697` "Iteration 4R: e2e fixes from device run" — the `01-search`
   flow fix, updated `results.xml`, updated `docs/E2E.md`, and the
   `00-launch` defect evidence (screenshot, hierarchy dump, logcat).

`docs/HANDOFF.md`, `docs/PROGRESS.md`, and `.claude/` were not edited by
this executor (their pre-existing uncommitted state, made by the planner
before the crash, was carried into commit 1 unmodified — "commit everything
inherited" per the remediation, not "edit these files").

---

## 2. What the crashed session had done vs. what this session added

| | Crashed 4R session (inherited, uncommitted) | This session (4R-2) |
|---|---|---|
| nitro-modules dep + patch-package | Added | Verified, committed |
| Skia reanimated patch | Written | Verified working on-device (Metro smoke), committed |
| Maestro flows + `docs/E2E.md` | Written | Fixed `01-search`'s flawed query; documented two modes + troubleshooting; committed |
| `results.xml` | 3/3 failures (against dev-launcher, no Metro — a red herring, not a broken app) | 2/3 → 1/3 real failures after investigation (see below) |
| EAS builds | `b2445fad` dev/broken, `0cb773cb` preview/stale, `68834a2f` dev/fixed | `6121bda2` preview/fixed (fresh, matches committed source) |
| On-device verification | None beyond "dev-launcher shows, no crash" | Full Metro-connected smoke (pass), full preview-build smoke (pass), full e2e acceptance run (2/3 pass), root-caused both e2e failures |
| Known issues | Not discovered (never got past the dev-launcher screen) | **Discovered a real, reproducible rendering defect** (title text) — this session's main finding |

---

## 3. Known issues / STOP-and-report: title text rendering defect

**This is the blocking issue for scope item 4.** Per the remediation's
explicit instruction ("if the app itself misbehaves, STOP and report with
logcat + screenshot"), no fix was attempted — this is a native/graphics-
layer defect, out of reach of the hard constraints (no prebuild, no
hand-written Kotlin, no new dependencies) and outside this session's
authorized scope.

**Symptom:** On every cold launch of the preview build (`pm clear` +
launch, or `launchApp: clearState: true` via Maestro), the SearchScreen
title (`<Text style={styles.title}>ManeFrame</Text>`, `SearchScreen.tsx`
line 72) renders with visibly corrupted, overlapping/double-exposed glyphs
— see `docs/evidence/title-zoom.png` (a cropped, nearest-neighbor-zoomed
region of a full-screen screenshot). No other text on the screen is
affected — "Search"/"Preview" tab labels, hairstyle names ("Pixie Crop"
etc.), and the "18 hairstyles · 40 colors" result-count line all render
and expose accessibility text correctly.

**It is not a rendering-timing race.** Reproduced identically:
- Immediately after Maestro's `launchApp: clearState: true` (fails
  consistently across 3 separate flow runs).
- Via manual `pm clear` + `am start`, checked at 2s, 3s, 5s, and 8s
  post-launch (`maestro hierarchy`, cross-checked against
  `adb shell uiautomator dump`).
- After forcing a full remount via tab-switch (Search → Preview → Search).
- After forcing a relayout via tapping the search box.

**The accessibility tree has zero nodes for this text at all** — not a
text-content mismatch, an outright absence. `maestro hierarchy` sorted by
vertical position shows the view tree jumping directly from the status-bar
clock (`bounds: [167,6][267,136]`) to the search `EditText`
(`bounds: [44,164][1036,291]`) with no `TextView` in between, where the
title should be. Full dump: `docs/evidence/maestro-hierarchy-title-missing.json`
(`grep -c "ManeFrame"` → 0 matches anywhere in the file). All other Text
elements on screen (including the result-count line directly below the
search box, and every hairstyle-card title) have normal, present
`TextView` nodes with correct `text` attributes.

**No exception is thrown.** `adb logcat -d --pid=<app pid>` for a fresh
cold launch (`docs/evidence/logcat-pid-full.txt`) shows only benign,
already-known `BridgelessReactContext`/`SafeAreaView`-deprecation warnings
— no crash, no caught exception, no red screen. This is a silent
graphics-compositing/text-rendering defect, not a JS-level bug.

**Suspected cause (not confirmed — flagged for the next iteration's
investigation, not acted on):** the title is the *first* text painted
after the native splash screen is torn down (logcat shows
`InputManager-JNI: Input channel object '...Splash Screen...' was disposed
without first being removed with the input manager!` within ~180ms of the
first JS render). `@shopify/react-native-skia`'s native module registers
(`WebGPUViewManager`, `SkiaPictureViewManager`) at the same point in
startup, before any screen actually uses a Skia `Canvas` (PreviewScreen,
untouched by this flow). A GPU/EGL context race between Skia's
initialization and the very first standard-Android-widget text paint is
the most likely explanation for corruption isolated to exactly the first
text element painted — but this is a hypothesis, not a diagnosis; no
native debugging tools (Android Studio, GPU profiler) were available in
this environment to confirm it.

**Scope note:** this defect was not visible to any earlier iteration's
verification. Iteration 3/4's Skia work was verified only via
`typecheck`/`lint`/`test`/`expo export` (no device/emulator available at
the time); this 4R-2 session's planner-verified state only confirmed the
dev-client build reached the dev-launcher screen (never deep-linked into
the actual bundle). This is the first time any iteration has visually
inspected the real Search screen content on the preview/standalone build.

---

## 4. Verbatim verification output

### `npm run typecheck` / `npm run lint`
Both clean, no output, exit 0.

### `npm test`
```
Test Suites: 12 passed, 12 total
Tests:       126 passed, 126 total
Snapshots:   0 total
Ran all test suites.
```

### `npx expo export --platform android`
```
Android Bundled 3843ms index.ts (881 modules)
› Assets (1): assets\models\hair_segmenter.tflite (782KB)
› android bundles (1): _expo/static/js/android/index-...hbc (2MB)
Exported: dist
```

### `npm run e2e` (final, against preview build `6121bda2`)
```
[Failed] 00-launch (24s) (Assertion is false: "ManeFrame" is visible)
[Passed] 01-search (29s)
[Passed] 02-preview-mock-badge (7s)

1/3 Flow Failed
```
(Full JUnit XML archived above and in `flows/results.xml`.)

### EAS build
```
id:          6121bda2-b033-4e94-9d54-f473e0b4716b
status:      FINISHED
buildProfile: preview
gitCommitHash: a2855324f2368bd1b209ceaee12bf4d143695ece
createdAt:   2026-07-11T06:35:46.010Z
completedAt: 2026-07-11T06:46:14.648Z
artifacts.applicationArchiveUrl: https://expo.dev/artifacts/eas/ugmea4MtCdiJXWQ5WJPduV9RDJzWC5tFOVKglDxX-us.apk
```

---

## 5. File inventory

**Commit `a285532`** (everything inherited from the crashed 4R session,
plus this session's Metro-smoke evidence):
```
docs/E2E.md                                   (new, from crashed session)
docs/REMEDIATION.md                           (new — this work order)
docs/evidence/metro-smoke-1.png               (this session)
docs/evidence/metro-smoke-2.png               (this session — clean, no dev-menu overlay)
flows/00-launch.yaml                          (new, from crashed session)
flows/01-search.yaml                          (new, from crashed session)
flows/02-preview-mock-badge.yaml              (new, from crashed session)
flows/results.xml                             (new, from crashed session — dev-client-mode failures)
patches/@shopify+react-native-skia+2.6.2.patch (new, from crashed session)
package.json / package-lock.json              (react-native-nitro-modules, patch-package, e2e scripts)
src/ui/SearchScreen.tsx                       (testID="search-input", from crashed session)
docs/HANDOFF.md / docs/PROGRESS.md            (planner's pre-existing uncommitted state, carried through unmodified)
```

**Commit `fbc0697`** (this session's e2e fixes + defect evidence):
```
.gitignore                                    (+*.apk, +*.aab — exclude downloaded build artifacts)
docs/E2E.md                                   (two-modes section, troubleshooting rows, coverage table pass status)
flows/01-search.yaml                          (fixed "warm red" -> "warm red shoulder-length bob")
flows/results.xml                             (final acceptance run: 2/3 pass)
docs/evidence/logcat-pid-full.txt             (new — no-exception evidence for the title defect)
docs/evidence/maestro-hierarchy-title-missing.json (new — accessibility-tree evidence)
docs/evidence/preview-launch.png              (new — preview build launches straight into the app)
docs/evidence/title-zoom.png                  (new — zoomed evidence of the corrupted glyphs)
docs/evidence/metro-smoke-1.png removed       (superseded by metro-smoke-2.png; had a dev-menu overlay obscuring the screen)
```

**Not committed (intentionally):** `maneframe-preview.apk` (141.5 MB
downloaded build artifact, now gitignored) — not source, would bloat the
repo; the build is reproducible from the recorded build ID/commit.
`docs/SUMMARY.md` (this file) stays uncommitted per the remediation's
instruction.

---

## Verification requests for the user

1. **Install the preview build on your own phone** to see the current
   state independently:
   https://expo.dev/artifacts/eas/ugmea4MtCdiJXWQ5WJPduV9RDJzWC5tFOVKglDxX-us.apk
   (build page: https://expo.dev/accounts/michaelafuller/projects/maneframe/builds/6121bda2-b033-4e94-9d54-f473e0b4716b).
   This replaces the dev-client build (same `applicationId`) — expected.
2. **Look at the app title on first launch** and confirm/deny what this
   report describes (corrupted "ManeFrame" text at the top of the Search
   screen). A second device/screen would help rule out something specific
   to the Pixel 5 test unit.
3. Once the title-rendering defect is triaged by the planner (root cause
   still unconfirmed — see "Suspected cause" above), the outstanding
   manual checks from Iteration 4 remain open: tflite badge after picking
   a photo, recolor tracking hair vs. face, rough segmentation latency,
   and the Mock↔TFLite toggle. Recommend doing those *after* the title
   defect is resolved, in case the same root cause (a Skia-init GPU race)
   also affects the Preview tab's Canvas rendering.

## Verification commands (repro for the planner)

```bash
adb install -r maneframe-preview.apk   # re-download from the artifact URL above
adb shell pm clear com.maneframe.app
adb shell am start -n com.maneframe.app/.MainActivity
# wait ~3s, then:
adb exec-out screencap -p > check.png   # look at the title
maestro hierarchy | grep -c "ManeFrame" # expect 0
npm run e2e                             # expect 00-launch to fail, 01-search + 02-preview-mock-badge to pass
```
