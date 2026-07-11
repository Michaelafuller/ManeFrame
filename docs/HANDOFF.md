# HANDOFF — Iteration 1 (Milestone M1: Scaffold + domain types + seed catalogs)

**Author:** Fable 5 (planner) · **Executor:** Sonnet 5 · **Date:** 2026-07-10

## Context

ManeFrame is an offline, on-device hair-color simulator (Expo React Native,
Android-first, zero backend). This is the first code iteration. The repo root
is `C:\Users\e146796\source\repos\ManeFrame` and currently contains only
`.claude\` and `docs\`. Read `docs/PROGRESS.md` for the settled architecture
decisions (D1–D6) before starting.

## Scope — do ALL of the following, and NOTHING outside it

### 1. Git + scaffold

- `git init` in the repo root. Author commits as normal (no push — there is no
  remote).
- Scaffold an Expo TypeScript app. The root is non-empty (`.claude`, `docs`),
  so scaffold with `npx create-expo-app@latest` into a temporary sibling
  directory, then move its contents into the repo root, preserving `.claude/`
  and `docs/`. Use the **blank TypeScript** template (`--template
  blank-typescript`) — we do not want expo-router's tab demo app.
- App name/slug: `maneframe`. Do not run `expo prebuild` and do not install any
  native-code libraries this iteration (no vision-camera, no skia, no tflite).
- Ensure `.gitignore` covers node_modules, .expo, android/, ios/, coverage.

### 2. Tooling

- TypeScript `strict: true`.
- ESLint with `eslint-config-expo` (flat config if the installed versions
  support it; otherwise legacy config is fine). `npm run lint` must work.
- Jest via `jest-expo` preset. `npm test` must work. Add
  `npm run typecheck` → `tsc --noEmit`.
- Prettier with default config; don't fight ESLint over it (use
  eslint-config-prettier if needed).

### 3. Directory structure

```
src/
  catalog/     # data + loaders + validation
  search/      # (empty this iteration, add .gitkeep)
  color/       # (empty this iteration, add .gitkeep)
  segmentation/# (empty this iteration, add .gitkeep)
  ui/          # (empty this iteration, add .gitkeep)
```

Keep the default `App.tsx` mostly as-is; just render the app name and the
count of loaded colors/hairstyles from the catalog (proves the catalog wires
into the app).

### 4. Domain types — `src/catalog/types.ts`

Implement exactly these shapes (they are settled; do not redesign):

```ts
export interface HairColor {
  id: string;                       // kebab-case, unique, e.g. "level-6-copper"
  displayName: string;              // e.g. "Dark Copper Blonde"
  level: 1|2|3|4|5|6|7|8|9|10;      // depth, 1=black .. 10=lightest blonde
  family: "natural"|"ash"|"gold"|"copper"|"red"|"violet"|"mahogany"|"fashion";
  temperature: "cool"|"neutral"|"warm";
  targetLab: { l: number; a: number; b: number };  // CIELAB, D65
  opacity: number;                  // 0..1, how strongly it covers
  highlightRetention: number;       // 0..1, how much original luminance survives
  minimumRecommendedStartingLevel?: number; // 1..10
}

export interface Hairstyle {
  id: string;                       // kebab-case, unique
  name: string;
  assets: { front: string; leftThreeQuarter?: string; rightThreeQuarter?: string };
  lengths: Array<"buzzed"|"short"|"chin"|"shoulder"|"medium"|"long">;
  fringe: Array<"none"|"blunt-bangs"|"wispy-bangs"|"curtain-bangs"|"side-swept">;
  textures: Array<"straight"|"wavy"|"curly"|"coily">;
  attributes: string[];             // free-form tags, e.g. "bob", "layered"
}
```

### 5. Seed data

- `src/catalog/data/colors.json` — **40 shades**: the 10 natural levels, plus
  ash/gold/copper/red/violet/mahogany variants across sensible levels, plus
  ~6 fashion shades (pastel pink, silver, blue-black, etc.). Lab values must
  be *plausible*: L should rise with level (level 1 ≈ L 8–15, level 10 ≈ L
  75–90); ash shades slightly negative/low a,b; copper/gold positive b; red
  positive a. Fashion shades may break the level-L correlation but stay in
  gamut (L 0–100, a/b within ±60). `minimumRecommendedStartingLevel` on shades
  that only read on pre-lightened hair (pastels, silver).
- `src/catalog/data/hairstyles.json` — **16 styles** with honest metadata
  covering the length/fringe/texture space (pixie, buzz, bob, lob, shoulder
  layers, long straight, long waves, curly shag, coily afro, curtain-bang
  midi, blunt-bang bob, side-swept lob, etc.). Asset paths are placeholders
  like `assets/hairstyles/<id>/front.webp` — do NOT create image files.

### 6. Catalog loader + validation — `src/catalog/index.ts`

- `loadColors(): HairColor[]` and `loadHairstyles(): Hairstyle[]` returning
  validated, frozen arrays from the JSON.
- Hand-rolled validation (no zod — keep deps minimal): unique ids, kebab-case
  ids, level in 1..10, opacity/highlightRetention in 0..1, Lab in range
  (L 0..100, |a|,|b| ≤ 60), non-empty lengths/textures for styles, fringe
  non-empty (use `["none"]` for no-bangs styles). Throw a descriptive
  `CatalogValidationError` on violation.

### 7. Tests — `src/catalog/__tests__/catalog.test.ts`

- Both catalogs load without throwing; counts are 40 and 16.
- Id uniqueness and shape constraints (exercise the validator against the real
  data AND against small inline invalid fixtures to prove the validator
  actually rejects bad data).
- Plausibility: for natural-family colors, Lab L is monotonically
  non-decreasing when sorted by level.

### 8. Verification (mandatory before writing SUMMARY.md)

Run and capture real output of:

```
npm run typecheck
npm run lint
npm test
```

All three must pass. Also run `npx expo export --platform android` OR at
minimum confirm the Metro bundler starts (`npx expo start` briefly) — we need
evidence the app itself isn't broken, not just the unit tests. If Node 25
causes engine warnings, note them; only act if something actually fails.

### 9. Commit

One commit: `Iteration 1: scaffold, tooling, domain types, seed catalogs`.

## Deliverable back to Fable 5

Write `docs/SUMMARY.md` containing:

1. What was done (bullet list mapped to the numbered scope items).
2. Any deviations from this handoff and why.
3. Verbatim (trimmed) output of typecheck/lint/test + the bundler/export check.
4. File inventory of everything created/modified.
5. Known issues / risks / suggestions for the next iteration.

## Hard constraints

- Do not edit `docs/HANDOFF.md`, `docs/PROGRESS.md`, or anything in `.claude/`.
- Do not install native-module libraries or run prebuild.
- Do not add a backend, analytics, or any network calls.
- Do not push, and do not create a GitHub repo.
