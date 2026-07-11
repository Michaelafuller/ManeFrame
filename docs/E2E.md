# E2E.md — Maestro acceptance test protocol

`typecheck`, `lint`, and `test` verify code correctness but never run the
app. Maestro drives a real Android build against the app's actual
accessibility tree. It is the only layer that would have caught the
Iteration-4 launch crash (an uncaught JS exception at module-load time,
before any React component rendered — invisible to unit tests, invisible
to `expo export`, only visible on-device).

---

## Prerequisites (one-time setup)

```bash
# 1. Install the Maestro CLI (standalone binary, not npm)
curl -Ls "https://get.maestro.mobile.dev" | bash
# Restart your shell after install, then confirm:
maestro --version

# 2. Enable USB Debugging on the Android phone
#    Settings → About phone → tap Build number 7x → Developer options → USB Debugging ON

# 3. Connect the phone via USB and confirm adb sees it
adb devices
# Expected: one device listed as "device" (not "unauthorized")

# 4. Install a dev-client build (EAS Build — see docs/PROGRESS.md D7)
#    Download the APK from the EAS build artifact URL, then:
adb install -r maneframe-dev-client.apk
```

> **No emulator required.** Maestro targets whatever `adb devices` lists —
> a physical phone over USB works exactly the same as an emulator.

---

## Two modes: iteration vs. acceptance

Maestro always targets whatever's currently installed as `com.maneframe.app`
— it has no idea whether that's a dev client or a standalone build. Which
one is installed changes what `npm run e2e` is actually testing:

| Mode | What's installed | What `launchApp` opens | Use for |
|---|---|---|---|
| **Dev-client + Metro** | An EAS `development`-profile APK (needs `expo-dev-client`) | The Expo **dev-launcher** screen (a picker/menu), not the app — *unless* you've already deep-linked it into a running Metro bundle this session | Fast JS iteration against a running Metro server. Flows will fail at `assertVisible` on launch because `clearState`/`launchApp` reopens the dev-launcher, not the last-loaded bundle. |
| **Preview standalone** | An EAS `preview`-profile APK | ManeFrame directly — no dev-launcher, no Metro dependency, release JS bundle | **The acceptance gate.** This is the only mode where `npm run e2e` results mean anything about real app behavior. |

> **⚠️ The dev client is temporarily STALE (as of Iteration 4R-3,
> 2026-07-11).** 4R-3 added `react-native-safe-area-context` — a *native*
> module — and rebuilt only the **preview** profile. The last dev-client
> build (`68834a2f`) predates it, so loading current JS through that dev
> client via Metro will error at startup (the bundle requires a native
> module that APK doesn't contain). Don't debug that error — it's
> expected. The dev client becomes usable again after M5's natural
> dev-client rebuild (M5 adds VisionCamera, forcing one anyway).

To connect the dev-client mode to Metro for manual iteration (not for
`npm run e2e` acceptance runs):

```bash
npx expo start --dev-client          # start Metro, wait for "Waiting on http://localhost:8081"
adb reverse tcp:8081 tcp:8081        # forward the device's 8081 to the host
adb shell am start -a android.intent.action.VIEW \
  -d "exp+maneframe://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

Before running `npm run e2e` for real (acceptance), install the **preview**
build instead — see "Running the tests" below.

---

## Running the tests

```bash
# 0. Build + install the preview (standalone) APK — the acceptance target.
#    Do NOT run npm run e2e against a dev-client build (see "Two modes" above).
eas build --platform android --profile preview --non-interactive --no-wait
#    poll `eas build:list --platform android --limit 1 --json --non-interactive`
#    until status is FINISHED, then:
adb install -r <downloaded-preview.apk>

# Run all flows
npm run e2e

# Run one flow (during development / debugging)
npm run e2e:flow flows/01-search.yaml

# Equivalent to npm run e2e, spelled out:
maestro test flows/ --format junit --output flows/results.xml
```

> **App state:** every flow calls `launchApp: clearState: true` at the top,
> so flows are independent and can run in any order. ManeFrame has no
> accounts and no persisted state beyond in-memory React state, so
> `clearState` mainly resets OS-level permission grants (photo library,
> camera) between runs.

---

## Coverage

| Area | Flow file | Automated? | Last acceptance run (preview build `b297b77f`, 2026-07-11) |
|---|---|---|---|
| App launches, both tabs reachable (the Iteration-4 crash signature) | `flows/00-launch.yaml` | Yes | **PASSED** — the 4R-2 "corrupted title" failure was the Android status bar drawn over the title (edge-to-edge + RN `SafeAreaView` being a no-op on Android), fixed in 4R-3 by `react-native-safe-area-context`. The title now has a normal accessibility node below the status bar. |
| Search: text query -> parser -> scorer -> results render (hairstyle + color) | `flows/01-search.yaml` | Yes | **PASSED** |
| Preview tab renders, "Pick a photo" entry point visible | `flows/02-preview-mock-badge.yaml` | Yes | **PASSED** |
| Photo picker entry point launches and returns cleanly | `flows/03-photo-tflite.yaml` | Yes (entry point only - see below) | **PASSED** |
| Photo picking - actual selection (library picker / camera intent) | — | No, and this is now a deliberate, safety-motivated decision, not just a tooling gap. On this physical device the library-picker handler is the full Google Photos app, not a scoped system Photo Picker sheet - browsing to a specific pushed test image (by "most recent", by folder, or by search) repeatedly surfaced the phone owner's real personal photos (a government ID, family photos) while probing for a safe, deterministic selector. Automating past the picker's landing screen was abandoned for that reason during Iteration 4R-4, and `flows/03-photo-tflite.yaml` intentionally backs out (`back`) right after confirming the picker opened. Manual: pick a photo yourself, confirm it decodes and renders in the Canvas. |
| tflite model load in a release-mode bundle (Iteration 4R-4's actual fix) | — | No (see above), but verified via a **camera-capture probe** instead of the library picker - camera capture creates a brand-new photo rather than browsing existing ones, so it carries none of the library's privacy risk. Confirmed via `adb logcat`: before the fix (build `ffa74b55`), `Resolved Model path: assets_models_hair_segmenter` (an Android resource name, not openable outside DEV) with no further tflite log and a silent "mock segmentation" badge; after the fix (build `b297b77f`), `[tflite] Resolved model localUri (expo-asset): file:///data/user/0/com.maneframe.app/cache/ExponentAsset-....tflite` (a real local file), the TFLite runtime initializes, and the model *file* loads successfully - proving the expo-asset fix works. See docs/SUMMARY.md for the full logcat excerpts and the newly-uncovered follow-on issue (an unresolved custom op in the model itself) this exposed. |
| Segmentation quality (mask actually follows hair, not face/background) | — | No — visual judgment call, not a text/accessibility assertion. Manual: check the recolored region tracks hair boundaries on a real photo. |
| Recolor visual correctness (does the swatch color look right on hair) | — | No — same reasoning; color perception isn't assertable via accessibility tree. Manual: compare before/after (press-and-hold) for a few colors. |
| tflite vs. mock segmenter toggle (long-press badge) | — | No — the badge's *label* is technically assertable, but exercising the toggle meaningfully requires a photo already picked (manual precondition). Manual: long-press the badge, confirm the label flips and the mask visibly changes. |
| Live camera / video | — | Not built yet (M5, gated — see docs/HANDOFF.md) |

`flows/01-search.yaml`'s second query was originally just `"warm red"`
(color-only, no length/fringe/texture/attribute hint). `searchHairstyles`
(`src/search/scorer.ts`) only returns "all styles unranked" for a fully
empty query; a color-only query takes the scored path, every style scores
0, and zero-score results are omitted — so no hairstyle cards, and
therefore no color swatches, ever render. Confirmed on-device: "warm red"
alone renders "0 hairstyles · 4 colors" / "No matching hairstyles.". Fixed
by using the canonical, unit-tested query `"warm red shoulder-length bob"`
(`scorer.test.ts`, canonical query 4), which guarantees at least one style
match. This was a flow-authoring bug, not an app bug — it would have failed
identically against any build (dev or preview).

**Standing rule:** every future iteration's `SUMMARY.md` must include an
`npm run e2e` result whenever a device is attached during that iteration's
work. If no device is attached, say so explicitly ("no device — flows not
run this iteration") rather than omitting the section.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No connected devices` | `adb devices` shows nothing — check USB cable, re-enable USB debugging, try a different port |
| `Flow failed: Element not found` | Accessibility text/testID changed in code — check the component and update the flow |
| `App not found: com.maneframe.app` | Dev-client build not installed — `adb install -r <apk>` |
| **All flows time out at launch / `assertVisible` fails immediately on every flow** | You're targeting the **dev-client launcher**, not the app — either install the **preview** build (`eas build --profile preview`) for a real acceptance run, or deep-link the dev client into a running Metro bundle first (see "Two modes" above) before running flows manually. `clearState`/`launchApp` always reopens the dev-launcher on a dev-client install; it never resumes a previous Metro deep link. |
| Search flow can't type into the field | The `TextInput` in `SearchScreen.tsx` carries `testID="search-input"` specifically so Maestro can target it (it has a placeholder, not a visible label — text-matching would be ambiguous/flaky) |
| `eraseText` doesn't fully clear the query | Increase the count in `flows/01-search.yaml` (currently 30, comfortably above the longest query typed) |
| A color-only search query renders "No matching hairstyles." | Expected — `searchHairstyles` only returns unranked results for a fully empty query; a query with only color terms scores every style 0 and omits all of them. Add a length/fringe/texture/attribute word to the query. |
| `adb shell screencap -p /sdcard/*.png` files clutter the system photo picker's "Recent" grid | Android indexes anything under `/sdcard` into MediaStore, including ad-hoc debug screenshots - they'll outrank a just-pushed test image in the picker's recency sort (and a synthetic PNG with no EXIF date can sort unpredictably, sometimes far from "recent"). Delete debug screenshots (`adb shell rm /sdcard/*.png`) once you're done with them rather than leaving them on the device. |
| `adb shell input tap`/`swipe` silently does nothing when tapping "Choose from Library" / "Take a Photo" | Observed repeatedly in Iteration 4R-4 on the reference Pixel 5: raw `adb shell input` does not reliably trigger the system picker/camera Activity launch from inside the RN app (the app-level `Pressable` taps work fine; it's specifically the native picker/camera intent that doesn't fire). `maestro`'s own `tapOn` succeeded where raw `adb input` did not - prefer driving these steps through a Maestro flow, even ad hoc, over raw `adb shell input`. |

---

## Adding a flow for a new feature

1. Write `flows/<n>-<feature>.yaml` targeting the new screen's visible text,
   falling back to `testID`/`accessibilityLabel` only when text matching
   would be genuinely ambiguous (no visible label, or the same text appears
   in multiple places you need to disambiguate).
2. Add a row to the Coverage table above (mark manual items honestly — a
   flow that can't deterministically assert something is worth less than
   an explicit "manual" note).
3. Run `npm run e2e:flow flows/<your-flow>.yaml` against a connected device
   to confirm it passes before committing.
