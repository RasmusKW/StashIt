# PLAN – "Hvor er den?"

Offline-first PWA for keeping track of belongings at home. Angular (latest stable),
Angular Material M3, Dexie (IndexedDB), MiniSearch, @angular/service-worker.

After every phase: `npm run lint`, `npm test`, `npm run build` → fix → `git commit`.

## Phase 1 – Project setup
- [x] Scaffold Angular workspace (standalone, zoneless, signals, strict TS, SCSS, Vitest)
- [x] ESLint (angular-eslint) + `npm run lint`
- [x] Angular Material + CDK, M3 theme following system light/dark, system font stack (no external fonts)
- [x] Bundled SVG icons (no icon font / CDN)
- [x] Service worker + manifest ("Hvor er den?"), generated app icons (incl. maskable)
- [x] Hash routing + configurable base-href (relative manifest/start_url)
- [x] Danish locale (`da`) registered, `lang="da"`
- [x] Unit test setup works (`npm test`), Playwright installed and configured

## Phase 2 – Core domain logic (pure, unit tested)
- [x] Models: `ItemNode`, `Photo`, meta
- [x] Danish normalization (case, æ/ae, ø/oe, å/aa, diacritics)
- [x] Natural sort (Kasse 2 < Kasse 10)
- [x] Quick-add parser (multi-line, `#tag`, `x200`/`200x`, "4x40" stays in name, empty lines, tag-only lines)
- [x] Tree rules: descendants, path, `canMoveTo` (no move into self/descendants)
- [x] Next free number ("Kasse 1", "Kasse 2" → "Kasse 3", global)

## Phase 3 – Data layer
- [x] Dexie DB (`nodes`, `photos`, `meta`), `navigator.storage.persist()` on startup
- [x] Signal-based `NodeStore` (in-memory index of all nodes, write-through to IndexedDB)
- [x] Create (single + bulk), rename, update tags/quantity/notes, favorite, lastViewedAt
- [x] Move (validated) with undo
- [x] Delete subtree + photos with undo (tombstones, purged after undo window / on startup)
- [x] Recently used move targets, last backup time
- [x] Unit tests (fake-indexeddb)

## Phase 4 – Search engine
- [x] MiniSearch index: name, tags, notes, path; fuzzy + prefix; Danish normalization
- [x] Incremental index updates (rename/move update the subtree's paths)
- [x] Scope (subtree) + filters (tags multi-select, favorites, has photo), filters without text
- [x] Ranking: exact/phrase matches first
- [x] Unit tests incl. typo search and 5 000-node performance smoke test

## Phase 5 – UI shell, home, node view, quick-add
- [x] App shell, top bar, settings link, snackbar-based undo service
- [x] Home: search field, favorites, recently viewed (10), rooms, backup banner
- [x] Node view: breadcrumb, inline rename, star, tags chips (with autocomplete), quantity, notes
- [x] Children list: containers first with counts, natural sort, thumbnail/tags/quantity, virtual scroll
- [x] Quick-add bar: Enter creates + keeps focus, multi-line, inline syntax, `#` autocomplete,
      next-number chip, camera button (attaches to last created node / current node)
- [x] "/" focuses search on desktop

## Phase 6 – Photos
- [x] Compression (max 1600 px, WebP/JPEG q≈0.8) + 300 px thumbnail
- [x] Photo row in node view, add photos, thumbnails in lists
- [x] Fullscreen viewer: swipe between photos, keyboard arrows, delete

## Phase 7 – Search UI
- [x] Results update as you type (~100 ms debounce), thumbnail, name, tags, full path
- [x] Inside a node: subtree by default + "Søg overalt" chip
- [x] Filter chips: tags (multi), favorites only, has photo; work without text
- [x] Search state in URL query params (back button returns to results)

## Phase 8 – Multi-select & moving
- [x] Long press (and right-click) starts multi-select; tap toggles afterwards
- [x] Actions: Move, Delete, Favorite, Add tag
- [x] "Flyt til…" bottom sheet: search, favorites, recently used, tree (virtual scroll),
      invalid targets disabled, top level option
- [x] Undo snackbars ("Fortryd", ~8 s) for delete and move, no confirmation dialogs

## Phase 9 – Backup & settings
- [x] Export zip (data.json with schemaVersion + photos/) via Web Share API (canShare) or download
- [x] Restore: pick zip → full validation → confirm dialog → overwrite
- [x] Last backup time stored; banner on home (> 30 days / never)
- [x] Storage estimate + persistent storage status
- [x] Unit test: backup round trip (export → restore → identical data and photos)

## Phase 10 – E2E (Playwright)
- [x] Create room → multi-line add → typo search with correct path → move → delete + undo
      → favorite on home → offline reload works (`context.setOffline(true)`)
- [x] No console errors during E2E

## Phase 11 – Polish & docs
- [ ] Accessibility pass (labels, focus order, contrast), desktop layout
- [ ] README.md (run, test, build, static HTTPS hosting, Android install, base-href)
- [ ] DECISIONS.md complete
- [ ] Final: lint, unit, E2E, build all green; push + PR
