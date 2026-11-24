#!/usr/bin/env node
/**
 * Renders the app icon (an SVG drawn below) to the PNG sizes used by the web manifest,
 * including full-bleed "maskable" variants for Android adaptive icons.
 *
 * Usage: npm run app-icons   (uses Playwright's Chromium)
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/icons');

const BG = '#1d6b5f';

/** The artwork (box + magnifying glass) drawn in a 512×512 coordinate space. */
const artwork = `
  <g>
    <!-- box body -->
    <path d="M128 208 h256 v160 a24 24 0 0 1 -24 24 h-208 a24 24 0 0 1 -24 -24 z" fill="#f2c27b"/>
    <!-- lid -->
    <rect x="108" y="150" width="296" height="70" rx="18" fill="#dca159"/>
    <!-- tape -->
    <rect x="232" y="150" width="48" height="118" fill="#fbe4bd"/>
    <!-- label -->
    <rect x="164" y="292" width="88" height="54" rx="8" fill="#fbe4bd"/>
    <!-- magnifying glass -->
    <circle cx="334" cy="318" r="66" fill="rgba(255,255,255,0.28)" stroke="#ffffff" stroke-width="26"/>
    <line x1="382" y1="366" x2="428" y2="412" stroke="#ffffff" stroke-width="36" stroke-linecap="round"/>
  </g>`;

/** Regular icon: rounded square, transparent corners. */
const anySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BG}"/>
  ${artwork}
</svg>`;

/** Maskable icon: full bleed, artwork scaled into the 80% safe zone. */
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(256 256) scale(0.78) translate(-256 -256)">${artwork}</g>
</svg>`;

const ANY_SIZES = [48, 72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

async function render(page, svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
       <div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>
     </body></html>`,
  );
  await page.screenshot({ path: join(outDir, file), omitBackground: true });
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(root, 'public/icon.svg'), anySvg);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of ANY_SIZES) await render(page, anySvg, size, `icon-${size}x${size}.png`);
for (const size of MASKABLE_SIZES) {
  await render(page, maskableSvg, size, `maskable-${size}x${size}.png`);
}
await render(page, maskableSvg, 180, 'apple-touch-icon.png');
await render(page, anySvg, 32, 'favicon-32x32.png');
await browser.close();
console.log('App icons written to public/icons');
