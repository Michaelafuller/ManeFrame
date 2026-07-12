# HANDOFF — next iteration (pending user try-on after 5R)

**Author:** Fable 5 (planner) · **Status: BLOCKED — awaiting user verdict on preview build `347e14ca`**

## Gate

Iteration 5R is planner-accepted: 3 of 6 styles ship with real donor-hair
overlays (pixie-crop, curly-shag, long-beach-waves), placement is driven
by the face-skin channel (works on bald heads by design), overlays
recolor through the Lab engine, and honest hints cover the no-hair /
no-face / gapped-style cases. Build `347e14ca` is installed on the
user's phone. The user's try-on verdict shapes what's next:

- **Placement/scale wrong on the user's own head** → remediation on the
  placement engine first (the bundled test portrait is a young woman
  with long hair; a bald male head is the primary real case and may
  expose head-box expansion assumptions).
- **Art looks good, wants more styles** → August donor round (EAS quota
  gone until 2026-08-01, but donor vetting/extraction is dev-client
  work and can proceed anytime; only the release build waits).
- **Good enough, move on** → M5 (live camera) — needs a NEW dev-client
  build (native deps: vision-camera, worklets, gesture-handler) which
  also waits on the August quota. Interim JS-only polish candidates:
  camera-capture UX (user's standing complaint), per-row occlusion gate,
  uniform-scale nudge improvements, style-card thumbnails in Search.

## Hard constraints for whatever comes next

- **EAS Android build quota exhausted until 2026-08-01.** No release
  builds, no new dev clients this month. Dev client `32841af6` (JS/asset
  iteration) and installed preview `347e14ca` are what exists.
- Loop protocol per docs/PROGRESS.md; executor never edits HANDOFF /
  PROGRESS / REMEDIATION / .claude/. Incremental commits are mandatory
  (they are what has survived repeated session losses).
- Automation never opens/browses the phone photo library. Donor
  downloads and APK installs always go through main-session approval.
- Planner visual review is a mandatory stage for any art change — the
  occlusion gate measures area, not salience (see ART.md).
- D1–D7; no hand-written native code without STOP-and-report; no push,
  analytics, or runtime network calls.
