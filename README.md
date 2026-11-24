# Hvor er den?

An offline-first Progressive Web App for keeping track of your things at home – the basement,
cabinets, drawers and moving boxes. Everything is stored locally in the browser (IndexedDB); the
app makes **no network calls** after it has been loaded once, has no backend, no accounts and no
analytics. The UI is in Danish.

![Icon](public/icons/icon-192x192.png)

## Features

- **One kind of element – a node.** Any node can contain other nodes, and items can sit at any
  level ("Skruer" next to "Kasse 1" directly on "Reol 2").
- **Quick-add bar** at the bottom of every view: Enter creates and keeps focus, several lines
  create several nodes, `#tag` and `x200`/`200x` are parsed inline ("Skruer 4x40 x200" keeps
  "4x40" in the name), tag autocomplete after `#`, a "Kasse 3" chip when "Kasse 1" and
  "Kasse 2" exist, and a camera button that attaches a photo to the node you just created.
- **Node view**: breadcrumb, tap-to-rename, favorite star, photo row with fullscreen swipe
  viewer, tags, quantity and notes – all edited inline. Contents list with containers first,
  natural sorting ("Kasse 2" before "Kasse 10") and virtual scrolling for long lists.
- **Search** as you type (fuzzy + prefix, Danish normalization æ/ae, ø/oe, å/aa) over name, tags,
  notes and path; results show where each thing is. Scoped to the current node with a
  "Søg overalt" chip; filter chips for tags, favorites and photos (also without text).
- **Multi-select** with long press: move (bottom sheet with search, favorites, recent places and
  the tree – invalid targets disabled), delete, favorite, add tag.
- **Undo instead of "are you sure?"** for delete and move (snackbar with "Fortryd").
- **Photos** compressed on import (max 1600 px, WebP/JPEG ~0.8) with 300 px thumbnails.
- **Backup** as a zip (`data.json` + `photos/`), shared via the Web Share API or downloaded;
  validated restore; reminder banner after 30 days; storage usage and persistence status.
- Installable on Android, works **100 % offline**, follows the system light/dark theme,
  keyboard shortcut `/` for search on desktop, changes sync between open tabs.

## Requirements

- Node.js 22 or newer, npm 10+
- For E2E tests: Playwright's Chromium (`npx playwright install chromium`, once)

## Run locally

```bash
npm install
npm start            # dev server on http://localhost:4200 (service worker disabled in dev)
```

To try the real PWA (service worker, offline, install) locally:

```bash
npm run build
npm run preview      # serves dist/hvor-er-den/browser on http://localhost:4200
```

`localhost` counts as a secure context, so the service worker and installation work without
HTTPS there.

## Tests and checks

```bash
npm run lint         # ESLint (angular-eslint, incl. template accessibility rules)
npm test             # unit tests (Vitest + jsdom + fake-indexeddb), single run
npm run test:watch   # unit tests in watch mode
npm run e2e          # production build in a sub folder + Playwright (mobile + desktop)
npm run verify       # all of the above, in order
```

Unit tests cover the quick-add parser, Danish normalization, natural sorting, fuzzy/prefix/path
search (incl. a 5 000-node performance check), move rules (never into itself or a descendant),
next free number, the stores (undoable delete/move, photos), components (quick-add, long press,
search state) and a backup round trip (export → restore gives identical data and photos).

E2E tests (`e2e/`) run against the production build served from `/hvor-er-den/` with the real
service worker. They cover: create a room → add several items with multiple lines → typo search
with the correct path → move → delete + undo → favorite on the home screen → offline reload
(`context.setOffline(true)`), plus move restrictions, quick-add suggestions, scoped search and
filters, photos, cross-tab sync, an axe accessibility scan (WCAG 2.1 AA), Chrome's PWA
installability check and search latency with 5 000 nodes. Every E2E test fails on any console
error.

## Build

```bash
npm run build
```

The output in `dist/hvor-er-den/browser/` is a fully static site.

### Hosting in a sub folder (base href)

The app uses hash URLs (`#/n/<id>`) and a relative manifest, so the only thing that depends on
the location is the base href, set at build time:

```bash
npm run build -- --base-href /hvor-er-den/
```

Upload the contents of `dist/hvor-er-den/browser/` to that folder. (The E2E tests use exactly
this: `npm run build:e2e`.)

## Host statically over HTTPS

Service workers require HTTPS (except on `localhost`). Any static host works – no server-side
code and no rewrite rules are needed thanks to hash routing:

- **GitHub Pages**: build with `--base-href /<repository-name>/` and publish
  `dist/hvor-er-den/browser/` (e.g. with the `actions/deploy-pages` action). HTTPS is automatic.
- **Netlify / Cloudflare Pages / Vercel**: publish directory `dist/hvor-er-den/browser`,
  build command `npm run build`.
- **Your own server** (nginx, Caddy, a NAS…): copy the files and serve them over HTTPS.

Recommended cache headers so updates are picked up quickly:

| File                                         | Cache-Control                         |
| -------------------------------------------- | ------------------------------------- |
| `index.html`, `ngsw.json`, `ngsw-worker.js`  | `no-cache`                            |
| everything else (hashed JS/CSS, icons)       | `public, max-age=31536000, immutable` |

Example for Caddy:

```
hvorerden.example.dk {
  root * /srv/hvor-er-den
  file_server
  @nocache path /index.html /ngsw.json /ngsw-worker.js
  header @nocache Cache-Control "no-cache"
}
```

When a new version is deployed, open apps download it in the background and show
"Der er en ny version af appen – Genindlæs".

## Install on the Android home screen

1. Open the app's HTTPS address in **Chrome** on the phone.
2. Wait a moment (the app is cached for offline use on the first visit), then tap
   **⋮ → "Installer app"** (or "Føj til startskærm"). Chrome may also offer an install banner.
3. Confirm. "Hvor er den?" now has its own icon and opens full screen without the browser UI.
4. It works offline from then on. Installed apps are also more likely to get *persistent
   storage*, so the browser won't evict the data when space is low – check the status under
   **Indstillinger → Lagerplads**.

Remember to **export a backup** now and then (Indstillinger → Eksportér backup) – the data
exists only on that device. On Android the share sheet lets you save it straight to Google
Drive, send it by mail, etc.

## Backup format

A zip file:

```
data.json            { "schemaVersion": 1, "app": "hvor-er-den", "exportedAt": "...",
                       "nodes": [ ... ], "photos": [ { "id", "nodeId", "createdAt",
                       "file", "type", "thumbnailFile", "thumbnailType" } ] }
photos/<id>.webp     full-size photo (or .jpg)
photos/<id>-thumb.webp
```

Restoring validates the whole file first and asks for confirmation before it replaces
everything on the device.

## Project structure

```
src/app/core/       domain logic and services (no UI): models, Dexie DB, NodeStore,
                    PhotoStore, quick-add parser, search engine, backup, tree rules, …
src/app/shared/     reusable UI: quick-add bar, node rows/lists, breadcrumb, move sheet,
                    selection bar, dialogs, long-press directive
src/app/features/   pages: home, node view, search, photos, settings
e2e/                Playwright tests
scripts/            icon generators and the static preview server
```

See [PLAN.md](PLAN.md) for the build plan and [DECISIONS.md](DECISIONS.md) for the design
decisions.

## Known limitations

- **One device, one browser.** Data is not synced between devices; use backup/restore to move
  it. Installations on the same origin share one database, even in different sub folders.
- **Backups are built and read in memory.** With thousands of photos a backup can be several
  hundred MB, which may be too much for low-memory phones.
- **HEIC photos** (iPhone's default format) can only be decoded by Safari; other browsers show
  an error for such files. Photos taken with the camera button on Android are JPEG and work.
- **iOS/Safari**: works, but Safari may delete data of non-installed web apps after 7 days
  without use – add it to the home screen. The Web Share API with files requires iOS 15+.
- **Undo window**: if the app is closed while the "Fortryd" snackbar is showing, the delete is
  completed on the next start.
- Edits made while another tab changes the same node: the last write wins (other tabs reload
  their data automatically after a change).
