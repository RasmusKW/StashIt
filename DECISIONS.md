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

## Search

- **MiniSearch** indexes name (boost 3), tags (2), notes and path (1). The path is the names of
  all ancestors, so "reol 2" finds Reol 2 and everything inside it.
- **All words must match** (`AND`), each word may match in any field.
- **Fuzzy** matching (20 % edits) only for words of 4+ letters, to avoid noise on short words.
  **Prefix** matching for all words except pure numbers, so "reol 2" does not also match "Reol 20".
- **Ranking tiers on top of the MiniSearch score**: exact name > name starts with the query >
  a word in the name starts with it > the query appears as a phrase in the path+name > the rest.
  This puts "Reol 2" itself first and everything inside it right after.
- **Tag filters** are AND-combined (an item must have every selected tag) – filters narrow down.
- **Scoped search** (inside a node) returns that node's descendants, not the node itself.
- **Incremental index**: the store reports changed ids (a rename or move reports the whole
  subtree, since their paths change); the engine applies them lazily right before the next search.

## UI

- **Initial bundle budget raised to 800 kB** (≈155 kB gzipped). Angular, Dexie and Material's
  overlay/snackbar are needed before the first screen; everything is cached by the service
  worker after the first visit anyway.
- **Each route change with new parameters creates a fresh page** (custom `RouteReuseStrategy`),
  so per-node state (search field, quick-add "last created", inline edits) never leaks between
  nodes.
- **Rows are real links** (`href="#/n/<id>"`): middle-click/new tab work, and screen readers
  announce them as links. In selection mode a tap toggles selection instead.
- **"Containers"** (nodes with children) show a box icon and a count of their *direct* children
  ("4 ting") – the same number you see when you tap in.
- **Virtual scrolling** kicks in for lists longer than 60 rows and uses the window as scroll
  container (`cdk-virtual-scroll-viewport scrollWindow`), so the page scrolls naturally.
- **Quick-add**: Enter submits (Shift+Enter inserts a line break; pasted text keeps its lines).
  On virtual keyboards that don't report a usable Enter `keydown`, the line break is caught in
  `beforeinput`. The field is cleared immediately and creates are queued, so fast typists never
  wait. Accepting the "Kasse 3" chip keeps any tags/quantity typed in the field.
- **Camera button on the home screen** is disabled until a room has been created in this view
  (there is no "current node" at the top level to attach a photo to).
- **Inline syntax example** is shown as a hint above the field while it is focused and empty, to
  keep the placeholder short.
- `interactive-widget=resizes-content` in the viewport meta keeps the fixed quick-add bar above
  the Android keyboard.
- Contextual font alternates are turned off (`calt 0`) – some fonts render "4x40" as "4×40".
- **Settings has no quick-add bar** – there is no node to add to there.

## Photos

- **WebP at quality 0.8** (JPEG fallback where the browser cannot encode WebP, e.g. older
  Safari), longest side 1 600 px; thumbnails 300 px on the longest side at quality 0.75. Images
  are drawn on white so transparent PNGs don't turn black as JPEG.
- **Decoding uses `createImageBitmap(..., { imageOrientation: 'from-image' })`**, so phone photos
  keep their EXIF rotation. Formats the browser can't decode (e.g. HEIC on Android) give a
  Danish error message.
- **Two ways to add photos**: the quick-add camera button opens the camera directly
  (`capture=environment`); the "Billede" tile in the node view opens the normal picker (camera or
  gallery, several files at once).
- **Viewer swiping is native scrolling with CSS scroll-snap** – smooth on every touch device,
  no gesture library. Arrow buttons (mouse devices only) and ←/→/Delete keys work on desktop.
- **A node's first photo is its thumbnail** in lists and search results.
- **Search state lives in the URL** (`#/n/<id>?q=…&tag=…&fav=1&foto=1&alle=1`), written with
  `replaceState` (no extra history entries while typing). Opening a result and pressing Back
  restores the exact search.
- The search UI switches to results the instant you type; the actual search runs 100 ms after
  the last keystroke. Pressing Enter/Search on the keyboard hides it so the results are visible.
- **Filter chips** are always visible below the search field (so filters work without text):
  "Søg overalt" (only inside a node), "Favoritter", "Har billede", then the tags used in the
  current scope, most used first, selected ones first. One horizontally scrolling row.
- Search results support multi-select too (long press), handy for "move everything tagged X".

## Multi-select & moving

- **Long press = 500 ms without moving more than 10 px**; right-click / the context-menu key
  (and Android's native long-press `contextmenu`) also start selection, so it works with mouse
  and keyboard too. A short vibration confirms the long press where supported.
- While selecting, the top bar turns into a selection bar: close, "N valgt", select all,
  Move, Favorite, Add tag, Delete. Escape (desktop) or navigating away ends selection.
- **Favorite on a selection** marks all as favorites, or removes the mark if all already are.
- **The node menu ("⋮") has "Vælg indhold"**, which selects all contents – a keyboard-friendly
  way into multi-select, plus "Flyt…", "Tilføj billede" and "Slet" for the node itself.
- **"Flyt til…" bottom sheet**: search (fuzzy, same engine), "Øverste niveau", favorites,
  recently used targets (last 6), then the expandable tree. One virtual-scrolled list of
  52 px rows so even 5 000 nodes stay smooth. Disabled targets explain why ("kan ikke flyttes
  ind i sig selv" / "nuværende placering"). The search field is auto-focused only on devices
  with a fine pointer, so phones don't pop up the keyboard over the tree.
- **Undo for bulk favorite/tag too** – cheap to offer, and consistent with delete/move.

## Backup & settings

- **Zip via fflate** (small, dependency-free, synchronous API). Photos are stored uncompressed
  inside the zip (they are already WebP/JPEG); `data.json` is deflated. File name:
  `hvor-er-den-backup-YYYY-MM-DD.zip`.
- **data.json** has `schemaVersion: 1`, `app`, `exportedAt` (ISO), `nodes` (the documented node
  fields only) and `photos` (metadata + paths to `photos/<id>.webp` and `photos/<id>-thumb.webp`).
  Nodes waiting in the undo window are not exported.
- **Sharing**: `navigator.canShare({ files })` → `navigator.share`. If the user cancels the
  share sheet nothing happens; if sharing fails for another reason (e.g. the user gesture
  expired while a big zip was built) the file is downloaded instead. The last backup time is
  stored after a successful share or download.
- **Restore validates everything first** (zip, JSON, schema version, every node and photo field,
  unique ids, existing parents, no cycles, every photo file present) and only then shows the
  single confirmation dialog of the app. The overwrite is one IndexedDB transaction, so a crash
  half-way cannot leave a mix of old and new data.
- After a restore, "last backup" is set to the backup's `exportedAt` – the data on the device
  is exactly that backup.
- **Backup banner** on the home screen appears when there is data and no backup in 30 days (or
  ever); "Senere" hides it until the app is opened again. It is not shown on an empty app.
- Storage usage comes from `navigator.storage.estimate()`; the persistence status from
  `navigator.storage.persisted()`, with a button to ask again if it was not granted.
- Large backups are built in memory; with thousands of photos this needs a few hundred MB of RAM
  (see README "Known limitations").

## E2E tests

- Run on two Playwright projects: **mobile** (Pixel 7 emulation, long press as a real touch via
  CDP) and **desktop** (Chrome, long press with the mouse). Both against the production build
  in a sub folder, with the real service worker.
- **Every E2E test fails on any console error or uncaught exception** (auto fixture).
- The offline test waits until the service worker controls the page *and* the app's files are
  in the Cache Storage, then turns the network off, reloads, opens a fresh tab, adds items,
  searches and opens settings – all offline.
- The quick-add bar measures its own height (ResizeObserver) and publishes it as
  `--app-quick-add-space`, so the end of every list and the snackbars always clear it, even
  when suggestion chips or several lines make it taller.
