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

## Running the tests

```bash
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

| Area | Flow file | Automated? |
|---|---|---|
| App launches, both tabs reachable (the Iteration-4 crash signature) | `flows/00-launch.yaml` | Yes |
| Search: text query -> parser -> scorer -> results render (hairstyle + color) | `flows/01-search.yaml` | Yes |
| Preview tab renders, "Pick a photo" entry point visible | `flows/02-preview-mock-badge.yaml` | Yes |
| Photo picking (library picker / camera intent) | — | No — system picker UI is outside the app's accessibility tree; Maestro cannot drive it deterministically. Manual: pick a photo, confirm it decodes and renders in the Canvas. |
| Segmentation quality (mask actually follows hair, not face/background) | — | No — visual judgment call, not a text/accessibility assertion. Manual: check the recolored region tracks hair boundaries on a real photo. |
| Recolor visual correctness (does the swatch color look right on hair) | — | No — same reasoning; color perception isn't assertable via accessibility tree. Manual: compare before/after (press-and-hold) for a few colors. |
| tflite vs. mock segmenter toggle (long-press badge) | — | No — the badge's *label* is technically assertable, but exercising the toggle meaningfully requires a photo already picked (manual precondition). Manual: long-press the badge, confirm the label flips and the mask visibly changes. |
| Live camera / video | — | Not built yet (M5, gated — see docs/HANDOFF.md) |

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
| Search flow can't type into the field | The `TextInput` in `SearchScreen.tsx` carries `testID="search-input"` specifically so Maestro can target it (it has a placeholder, not a visible label — text-matching would be ambiguous/flaky) |
| `eraseText` doesn't fully clear the query | Increase the count in `flows/01-search.yaml` (currently 30, comfortably above the longest query typed) |

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
