# SUMMARY — Iteration 1 (Milestone M1)

**Executor:** Sonnet 5 · **Date:** 2026-07-10

## 1. What was done

1. **Git + scaffold**
   - `git init` in the repo root (author already configured: Fuller, Michael).
   - Scaffolded via `npx create-expo-app@latest maneframe-scaffold-tmp --template blank-typescript --yes` in a temporary sibling directory (`C:\Users\e146796\source\repos\maneframe-scaffold-tmp`), then moved its contents into the repo root, preserving `.claude\` and `docs\`. App name/slug set to `maneframe` in `package.json` and `app.json`. No `expo prebuild` run, no native-code libraries installed.
   - `.gitignore` covers `node_modules/`, `.expo/`, `/android`, `/ios`, plus an added `coverage/` entry (not present in the stock template).

2. **Tooling**
   - `tsconfig.json`: `strict: true` (extends `expo/tsconfig.base`, which already sets `resolveJsonModule: true`); added `types: ["jest"]` so test globals typecheck.
   - ESLint: flat config (`eslint.config.js`) using `eslint-config-expo@57.0.0` (`eslint-config-expo/flat`) + `eslint-config-prettier` to avoid formatting conflicts. `npm run lint` works (exit 0).
   - Jest: `jest-expo@~57.0.0` preset configured via a `"jest"` key in `package.json`. `npm test` works.
   - `npm run typecheck` → `tsc --noEmit`, added to `package.json` scripts.
   - Prettier: `.prettierrc.json` with `{ "singleQuote": true }`; `eslint-config-prettier` disables stylistic ESLint rules that would conflict.

3. **Directory structure** — created `src/catalog/{data,__tests__}`, plus empty `src/search`, `src/color`, `src/segmentation`, `src/ui`, each with `.gitkeep`.
   - `App.tsx` renders "ManeFrame" plus the loaded color/hairstyle counts from the catalog.

4. **Domain types** — `src/catalog/types.ts` implements `HairColor` and `Hairstyle` exactly as specified in the handoff (unchanged).

5. **Seed data**
   - `src/catalog/data/colors.json` — 40 shades: 10 natural levels (1–10, L rising 9→80), plus 4 shades each of ash, gold, copper, red, violet, mahogany (24 total, at levels chosen to suit each family's typical use), plus 6 fashion shades (pastel pink, silver, blue-black, teal, lavender, vivid cherry red). `minimumRecommendedStartingLevel` set on the four fashion shades that only read on pre-lightened hair (pastel pink, silver, teal, lavender) plus vivid cherry red; omitted on blue-black (works over darker natural hair).
   - `src/catalog/data/hairstyles.json` — 16 styles spanning all 6 lengths, all 5 fringe categories, and all 4 textures (verified by a dedicated test). Asset paths are placeholders (`assets/hairstyles/<id>/front.webp`, some with three-quarter variants); no image files created.

6. **Catalog loader + validation** — `src/catalog/index.ts` exports `loadColors()`, `loadHairstyles()`, `validateHairColor()`, `validateHairstyle()`, and `CatalogValidationError`. Hand-rolled validation (no zod): kebab-case unique ids, level 1–10, family/temperature enums, Lab in gamut (L 0–100, |a|,|b| ≤ 60), opacity/highlightRetention in 0–1, non-empty `lengths`/`fringe`/`textures` against their fixed enums. Loaded arrays and entries are frozen (`Object.freeze`) and cached.

7. **Tests** — `src/catalog/__tests__/catalog.test.ts`, 22 tests covering: both catalogs load without throwing with correct counts (40/16); frozen return values; id uniqueness/kebab-case for both catalogs; level/opacity/highlightRetention/Lab range checks; full length/fringe/texture space coverage across the hairstyle catalog; natural-family Lab L monotonically non-decreasing by level; validator acceptance of well-formed fixtures and rejection of bad ids, out-of-range level, invalid family, out-of-range opacity, out-of-gamut Lab, empty `lengths`/`fringe`, invalid texture, and missing `assets.front`.

8. **Verification** — all commands run and passing; see verbatim output below.

9. **Commit** — one commit: `Iteration 1: scaffold, tooling, domain types, seed catalogs` (root commit `0bbec82`, 26 files, 15083 insertions). This SUMMARY.md was written after the commit (deliverable to the reviewer, left uncommitted).

## 2. Deviations from the handoff

- **`create-expo-app` + Node 25**: no engine-compatibility errors were hit — `npx create-expo-app@latest ... --yes` and the subsequent `npm install` of tooling packages completed cleanly on Node v25.9.0 / npm 11.12.1. No workaround was needed beyond passing `--yes` to skip interactive prompts.
- **Scaffold move mishap (self-corrected)**: the first attempt to `mv` scaffold files into the repo root used a Bash double-quoted Windows path ending in `\$f`, which Bash collapsed into a literal `$f` with no path separator, so several plain files (`.gitignore`, `app.json`, `App.tsx`, `index.ts`, `package.json`, `package-lock.json`, `tsconfig.json`) were moved onto a single bogus sibling path (`...\ManeFrame$f`), each successive move overwriting the last. Caught immediately (the directory moves for `assets`/`node_modules` failed loudly with "cannot overwrite non-directory"). The stray file was deleted and all seven files were recreated by hand from the exact content already captured from the scaffold before the move, with only `name`/`slug` changed to `maneframe` per the handoff and a `coverage/` line added to `.gitignore`. `assets/` and `node_modules/` moved intact on a corrected retry (forward-slash destination paths).
- **Excluded scaffold template files**: `create-expo-app`'s template also shipped its own `.git/`, `.claude/settings.json`, `AGENTS.md`, `CLAUDE.md`, and `LICENSE`. None were part of the handoff scope, so they were deliberately not copied into the repo root — the repo's own `.git` (already `git init`'d) and pre-existing `.claude/` were left untouched.
- **ESLint warnings on `types.ts`**: `eslint-config-expo`'s `@typescript-eslint/array-type` rule warns (not errors) on the `Array<T>` syntax used in the three `Hairstyle` array fields. Since the handoff states the domain type shapes are "settled; do not redesign," `types.ts` was left exactly as specified rather than rewritten to `T[]`. `npm run lint` still exits 0 (0 errors, 3 warnings).
- **`.claude/settings.local.json` not committed**: a global (user-level, not project) git ignore rule at `~/.config/git/ignore` excludes `**/.claude/settings.local.json` on this machine. This machine-level policy was not touched; the file remains on disk exactly as it was, per the "preserve `.claude/`" instruction — it simply isn't tracked by git.

## 3. Verbatim verification output

### `npm run typecheck`

```
> maneframe@1.0.0 typecheck
> tsc --noEmit
```

(No output — clean pass, exit 0.)

### `npm run lint`

```
> maneframe@1.0.0 lint
> eslint .

C:\Users\e146796\source\repos\ManeFrame\src\catalog\types.ts
  29:12  warning  Array type using 'Array<T>' is forbidden. Use 'T[]' instead  @typescript-eslint/array-type
  30:11  warning  Array type using 'Array<T>' is forbidden. Use 'T[]' instead  @typescript-eslint/array-type
  33:13  warning  Array type using 'Array<T>' is forbidden. Use 'T[]' instead  @typescript-eslint/array-type

✖ 3 problems (0 errors, 3 warnings)
  0 errors and 3 warnings potentially fixable with the `--fix` option.
```

Exit code: 0.

### `npm test`

```
> maneframe@1.0.0 test
> jest

PASS src/catalog/__tests__/catalog.test.ts
  catalog loading
    √ loads colors without throwing and returns 40 entries (1 ms)
    √ loads hairstyles without throwing and returns 16 entries (1 ms)
    √ returns frozen arrays and entries
  color id uniqueness and shape
    √ has unique, kebab-case ids (1 ms)
    √ has levels in range 1..10 (2 ms)
    √ has opacity and highlightRetention in range 0..1 (3 ms)
    √ has Lab values within gamut (6 ms)
  hairstyle id uniqueness and shape
    √ has unique, kebab-case ids
    √ has non-empty lengths, fringe, and textures arrays (1 ms)
    √ covers the full length, fringe, and texture space across the catalog
  plausibility: natural family Lab L rises with level
    √ is monotonically non-decreasing when sorted by level
  validator rejects bad data
    √ accepts a well-formed HairColor
    √ rejects a non-kebab-case id (7 ms)
    √ rejects an out-of-range level (1 ms)
    √ rejects an invalid family
    √ rejects opacity outside 0..1
    √ rejects out-of-gamut Lab values (1 ms)
    √ accepts a well-formed Hairstyle
    √ rejects an empty lengths array
    √ rejects an empty fringe array (1 ms)
    √ rejects an invalid texture value
    √ rejects a missing assets.front

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
Snapshots:   0 total
Time:        2.004 s
Ran all test suites.
```

### `npx expo export --platform android`

```
Starting Metro Bundler

Android Bundled 7080ms index.ts (582 modules)

› android bundles (1):
_expo/static/js/android/index-83a039304b99b58b916e9f274651ed41.hbc (1.4MB)

› Files (1):
metadata.json (150B)

Exported: dist
```

This confirms Metro can bundle the app end-to-end (index.ts → App.tsx → catalog JSON imports → 582 modules) with no errors. `dist/` and `.expo/` were left behind by this command; both are covered by `.gitignore` and were not committed.

No Node-25 engine warnings were observed during scaffold, install, or verification.

## 4. File inventory

Everything below is new (repo had only `.claude/` and `docs/` before this iteration).

```
.gitignore
.prettierrc.json
App.tsx
app.json
assets/android-icon-background.png
assets/android-icon-foreground.png
assets/android-icon-monochrome.png
assets/favicon.png
assets/icon.png
assets/splash-icon.png
eslint.config.js
index.ts
package.json
package-lock.json
tsconfig.json
src/catalog/types.ts
src/catalog/index.ts
src/catalog/data/colors.json
src/catalog/data/hairstyles.json
src/catalog/__tests__/catalog.test.ts
src/search/.gitkeep
src/color/.gitkeep
src/segmentation/.gitkeep
src/ui/.gitkeep
docs/SUMMARY.md          (this file, written post-commit)
node_modules/            (installed, gitignored, not committed)
.expo/                   (generated by expo export, gitignored, not committed)
dist/                    (generated by expo export, gitignored, not committed)
```

Untouched (per hard constraints): `docs/HANDOFF.md`, `docs/PROGRESS.md`, `.claude/settings.local.json`.

Key dependency versions installed: `expo ~57.0.4`, `react 19.2.3`, `react-native 0.86.0`, `typescript ~6.0.3`, `eslint ^9.39.5`, `eslint-config-expo ^57.0.0`, `eslint-config-prettier ^9.1.2`, `jest ^29.7.0`, `jest-expo ~57.0.0`, `prettier ^3.9.5`, `@types/jest ^29.5.14`.

## 5. Known issues / risks / suggestions for next iteration

- **Lab values are hand-authored, not colorimetrically measured.** They follow the plausibility rules in the handoff (L rises with level; ash negative/low a,b; copper/gold positive b; red positive a; fashion shades in-gamut) but are not derived from real dye/swatch measurements. M2 color math should treat them as reasonable placeholders, not ground truth.
- **`opacity` / `highlightRetention` values are also hand-authored** (heuristic: darker shades get higher opacity + lower highlight retention, lighter/toner shades the reverse). No downstream code consumes them yet; worth a sanity pass when M2 recolor math is built.
- **ESLint `@typescript-eslint/array-type` warnings on `types.ts`** are left as-is because the type shapes are specified verbatim in the handoff. If a future iteration may touch `types.ts`, switching `Array<T>` to `T[]` silences them with no behavior change.
- **`npx expo export --platform android` was used instead of an `expo start` smoke test** since it is a stronger, non-interactive signal (full bundle, not just "server started"); no device/emulator was launched this iteration — first real Android emulator interaction is expected at M3 per the roadmap.
- **package-lock.json is large** (467+459 packages) — normal for an Expo/RN project; just noting it inflates this iteration's commit diff.
