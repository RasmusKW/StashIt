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
- [ ] Models: `ItemNode`, `Photo`, meta
- [ ] Danish normalization (case, æ/ae, ø/oe, å/aa, diacritics)
- [ ] Natural sort (Kasse 2 < Kasse 10)
- [ ] Quick-add parser (multi-line, `#tag`, `x200`/`200x`, "4x40" stays in name, empty lines, tag-only lines)
- [ ] Tree rules: descendants, path, `canMoveTo` (no move into self/descendants)
- [ ] Next free number ("Kasse 1", "Kasse 2" → "Kasse 3", global)

## Phase 3 – Data layer
- [ ] Dexie DB (`nodes`, `photos`, `meta`), `navigator.storage.persist()` on startup
- [ ] Signal-based `NodeStore` (in-memory index of all nodes, write-through to IndexedDB)
- [ ] Create (single + bulk), rename, update tags/quantity/notes, favorite, lastViewedAt
- [ ] Move (validated) with undo
- [ ] Delete subtree + photos with undo (tombstones, purged after undo window / on startup)
- [ ] Recently used move targets, last backup time
- [ ] Unit tests (fake-indexeddb)

## Phase 4 – Search engine
- [ ] MiniSearch index: name, tags, notes, path; fuzzy + prefix; Danish normalization
- [ ] Incremental index updates (rename/move update the subtree's paths)
- [ ] Scope (subtree) + filters (tags multi-select, favorites, has photo), filters without text
- [ ] Ranking: exact/phrase matches first
- [ ] Unit tests incl. typo search and 5 000-node performance smoke test

## Phase 5 – UI shell, home, node view, quick-add
- [ ] App shell, top bar, settings link, snackbar-based undo service
- [ ] Home: search field, favorites, recently viewed (10), rooms, backup banner
- [ ] Node view: breadcrumb, inline rename, star, tags chips (with autocomplete), quantity, notes
- [ ] Children list: containers first with counts, natural sort, thumbnail/tags/quantity, virtual scroll
- [ ] Quick-add bar: Enter creates + keeps focus, multi-line, inline syntax, `#` autocomplete,
      next-number chip, camera button (attaches to last created node / current node)
- [ ] "/" focuses search on desktop

## Phase 6 – Photos
- [ ] Compression (max 1600 px, WebP/JPEG q≈0.8) + 300 px thumbnail
- [ ] Photo row in node view, add photos, thumbnails in lists
- [ ] Fullscreen viewer: swipe between photos, keyboard arrows, delete

## Phase 7 – Search UI
- [ ] Results update as you type (~100 ms debounce), thumbnail, name, tags, full path
- [ ] Inside a node: subtree by default + "Søg overalt" chip
- [ ] Filter chips: tags (multi), favorites only, has photo; work without text
- [ ] Search state in URL query params (back button returns to results)

## Phase 8 – Multi-select & moving
- [ ] Long press (and right-click) starts multi-select; tap toggles afterwards
- [ ] Actions: Move, Delete, Favorite, Add tag
- [ ] "Flyt til…" bottom sheet: search, favorites, recently used, tree (virtual scroll),
      invalid targets disabled, top level option
- [ ] Undo snackbars ("Fortryd", ~8 s) for delete and move, no confirmation dialogs

## Phase 9 – Backup & settings
- [ ] Export zip (data.json with schemaVersion + photos/) via Web Share API (canShare) or download
- [ ] Restore: pick zip → full validation → confirm dialog → overwrite
- [ ] Last backup time stored; banner on home (> 30 days / never)
- [ ] Storage estimate + persistent storage status
- [ ] Unit test: backup round trip (export → restore → identical data and photos)

## Phase 10 – E2E (Playwright)
- [ ] Create room → multi-line add → typo search with correct path → move → delete + undo
      → favorite on home → offline reload works (`context.setOffline(true)`)
- [ ] No console errors during E2E

## Phase 11 – Polish & docs
- [ ] Accessibility pass (labels, focus order, contrast), desktop layout
- [ ] README.md (run, test, build, static HTTPS hosting, Android install, base-href)
- [ ] DECISIONS.md complete
- [ ] Final: lint, unit, E2E, build all green; push + PR
