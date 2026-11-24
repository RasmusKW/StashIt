#!/usr/bin/env node
/**
 * Minimal dependency-free static file server for previewing a production build
 * (used by the Playwright E2E tests). Serves `--dir` under the URL prefix `--base`.
 *
 *   node scripts/serve.mjs --dir dist/hvor-er-den/browser --base / --port 4200
 *
 * `localhost` counts as a secure context, so the service worker works without HTTPS here.
 * For real hosting use any static HTTPS host (see README.md).
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split('--')
    .filter(Boolean)
    .map((part) => {
      const [key, ...rest] = part.trim().split(/\s+/);
      return [key, rest.join(' ')];
    }),
);

const dir = resolve(args.dir ?? 'dist/hvor-er-den/browser');
let base = args.base ?? '/';
if (!base.startsWith('/')) base = `/${base}`;
if (!base.endsWith('/')) base = `${base}/`;
const port = Number(args.port ?? 4200);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === base.slice(0, -1)) {
    res.writeHead(301, { Location: base });
    res.end();
    return;
  }
  if (!pathname.startsWith(base)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  pathname = pathname.slice(base.length) || 'index.html';
  const filePath = normalize(join(dir, pathname));
  if (!filePath.startsWith(dir)) {
    res.writeHead(403);
    res.end();
    return;
  }

  const target = isFile(filePath) ? filePath : join(dir, 'index.html');
  const type = TYPES[extname(target)] ?? 'application/octet-stream';
  const cache = target.endsWith('index.html') || target.endsWith('ngsw.json') ? 'no-cache' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
  createReadStream(target).pipe(res);
}).listen(port, () => {
  console.log(`Serving ${dir} at http://localhost:${port}${base}`);
});
