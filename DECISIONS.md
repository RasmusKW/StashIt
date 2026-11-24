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

## Domain logic

- **Timestamps are epoch milliseconds** (`number`): compact, sortable, JSON-friendly.
- **Danish normalization** lower-cases and spells out æ→ae, ø→oe, å→aa (also ä/ö, which are
  the same letters in Swedish/German) and strips other diacritics. Both the index and the query
  go through it, so "kaelder" finds "Kælder" and vice versa.
- **Natural sort** uses `Intl.Collator('da', { numeric: true })`: "Kasse 2" before "Kasse 10",
  and æ/ø/å after z as in the Danish alphabet.
- **Quick-add parser**
  - A `#tag` must contain a letter, so "Kasse #1" keeps "#1" in the name.
  - Quantity words: `x200`, `200x`, case-insensitive, and `×`. If a line has several, the
    last one is the quantity and earlier ones stay in the name.
  - Lines with no name left (only tags and/or a quantity, or empty) are skipped – there is no
    sensible name to give such a node.
  - Leading list bullets (`- `, `* `, `• `, `[ ] `) from pasted lists are removed.
  - Tags are lower-cased but keep æ/ø/å; tags typed in the tag editor turn spaces into `-`.
- **Next free number** = highest existing number for that prefix + 1 (across the whole app,
  case-insensitive and Danish-normalized). Gaps are not refilled, because a deleted "Kasse 2"
  may still have its label on a physical box. The suggestion keeps the casing of the existing
  nodes. Only names separated from their number by whitespace count ("Kasse 3", not "Kasse3").

## Data layer

- **All nodes live in memory** (a `Map` plus lazily rebuilt child groups) with write-through to
  IndexedDB. 5 000 nodes is a few hundred kB, and it makes paths, counts, sorting and search
  instant. Writes go to IndexedDB first, then memory, so memory never claims more than is saved.
  A `revision` signal makes every derived view reactive.
- **Undoable delete uses tombstones**: deleted nodes get an internal `deletedAt`, vanish from the
  UI at once and are purged (with their photos) when the undo snackbar closes. If the app is
  closed inside the undo window, the purge happens on the next start. This keeps photos safe for
  undo without copying blobs into memory.
- **Photo index without blobs**: on start only the `[nodeId+createdAt]` index keys are read, so
  the app never loads image data until a thumbnail is actually shown.
- **Deleting a single photo** (in the viewer) copies its bytes into memory for the undo window,
  then deletes it; undo writes it back in its original position.
- **Orphan safety net**: a node whose parent is missing (should never happen) is moved to the
  top level on start instead of becoming invisible.
- **Moving a node to where it already is** is a no-op; nested selections only move/delete the
  topmost selected node (its descendants follow automatically).
- `navigator.storage.persist()` is requested on every start (no-op once granted).
