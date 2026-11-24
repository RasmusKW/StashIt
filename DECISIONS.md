# DECISIONS

Choices made where the brief left room for interpretation. Newest phases at the bottom.

## Setup & tooling

- **Angular 22.3 (latest stable at build time)**, zoneless, standalone components, signals,
  `OnPush` everywhere. `strict` TypeScript plus `strictTemplates` and Angular extended diagnostics
  as errors.
- **Unit tests use Vitest** (the Angular CLI default since v21) in jsdom with
  `fake-indexeddb`. jsdom's `Blob` cannot be structured-cloned, so `src/test-setup.ts` swaps in
  Node's native `Blob`/`File`; otherwise photos would silently be stored as `{}` in tests.
- **Playwright is pinned to 1.63.0** to match the Chromium build pre-installed in the
  development container. Locally, run `npx playwright install chromium` once.
- **E2E tests run against a production build served from `/hvor-er-den/`** by a tiny
  dependency-free Node static server (`scripts/serve.mjs`). This exercises the real service
  worker and proves the configurable base-href at the same time.
- **Hash-based routing** (`#/n/<id>`). The app can then be dropped into any folder on any static
  host (GitHub Pages, Netlify, a NAS…) without server rewrite rules, and deep links always work.
- **Base href** is set at build time: `npm run build -- --base-href /sub/folder/`. The manifest
  uses relative `start_url`/`scope`/`id` (`./`), so it follows the base href automatically.
- **Icons are inline SVG** (Material Symbols, generated into `src/app/core/icons.generated.ts`
  by `npm run icons`) instead of an icon font: smaller, nothing to download, works offline.
- **System font stack** instead of Roboto – no external fonts, and Danish letters render
  natively on every platform.
- **App icon** is drawn as SVG (a moving box with a magnifying glass) and rendered to PNG with
  Playwright (`npm run app-icons`), with separate `any` and full-bleed `maskable` variants.
- **Theme**: Material 3 palettes generated from the icon's green (`#1d6b5f`) and a cardboard
  tertiary colour; `color-scheme: light dark` makes every token follow the system theme.
- **Service worker registers immediately** (instead of "when stable") so the first visit is
  enough to make the app work offline. All app files and icons are prefetched.
