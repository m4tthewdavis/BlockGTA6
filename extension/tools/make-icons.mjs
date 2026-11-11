// Renders tools/icon.svg to icons/icon-{16,32,48,128}.png with the preinstalled Playwright Chromium.
import { createRequire } from 'node:module';
// Playwright is preinstalled globally in CI/dev containers; resolve it via require so NODE_PATH applies.
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8');
const out = path.join(root, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(out, `icon-${size}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('icons written to', out);
