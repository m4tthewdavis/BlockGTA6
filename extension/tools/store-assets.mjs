// Generates store screenshots (1280x800) and the small promo tile (440x280) into ../store/images/.
// Uses the built extension (dist/chrome) on illustrative mock pages; no real site content or game art.
// Run: npm run build && node tools/store-assets.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const ext = path.join(root, 'dist', 'chrome');
const out = path.join(root, '..', 'store', 'images');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'safehouse-assets-'));
fs.mkdirSync(out, { recursive: true });

const icon = `data:image/png;base64,${fs.readFileSync(path.join(root, 'icons', 'icon-128.png')).toString('base64')}`;

// An unbranded "video feed" mock. Cards use the same element names our YouTube adapter handles.
const FEED = [
  ['GTA 6 ending explained (FULL SPOILERS)', 'Gaming Daily', '#7c5cff'],
  ['Sourdough for beginners', 'Bread Lab', '#e0a458'],
  ['GTA VI map leak compared', 'LeakWatch', '#2bb3a3'],
  ['Lo-fi beats to study to', 'Chill Room', '#5a8dee'],
  ["Jason Duval's backstory, every clue", 'Theory Hub', '#d95d7a'],
  ['GTA 5 Online: best heist payouts', 'Heist Guide', '#6aa84f'],
  ['Every Leonida location ranked', 'Map Nerds', '#c27ba0'],
  ['Morning stretch routine (10 min)', 'Move Better', '#f1c232'],
];
const feedHtml = `<!doctype html><html><head><title>Feed</title><style>
body{margin:0;background:#f9f9f9;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f0f0f}
header{height:56px;display:flex;align-items:center;padding:0 24px;font-weight:700;font-size:18px;border-bottom:1px solid #e5e5e5;background:#fff}
main{display:grid;grid-template-columns:repeat(4,1fr);gap:24px 16px;padding:24px}
ytd-rich-item-renderer{display:block}
.thumb{aspect-ratio:16/9;border-radius:12px}
.t{font-weight:600;margin-top:10px} .c{color:#606060;font-size:13px}
</style></head><body><header>Your feed</header><main>
${FEED.map(([t, c, col]) => `<ytd-rich-item-renderer><div class="thumb" style="background:linear-gradient(135deg,${col},#222)"></div><div class="t">${t}</div><div class="c">${c}</div></ytd-rich-item-renderer>`).join('')}
</main></body></html>`;

const frame = (title, sub, img, dark = false) => `<!doctype html><html><head><style>
html,body{margin:0;width:1280px;height:800px;overflow:hidden}
body{display:flex;align-items:center;gap:48px;padding:0 56px;box-sizing:border-box;
 background:${dark ? '#0f1720' : '#f7f5f0'};color:${dark ? '#f2efe8' : '#1b2430'};font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.copy{flex:0 0 360px} .brand{display:flex;align-items:center;gap:12px;margin-bottom:28px;font-weight:700;font-size:22px}
.brand img{width:44px;height:44px} h1{font-size:40px;line-height:1.15;margin:0 0 16px} p{font-size:19px;line-height:1.5;margin:0;color:${dark ? '#b9c2cc' : '#5d6875'}}
.shot{flex:1;display:flex;justify-content:center} .shot img{max-width:100%;max-height:680px;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25);border:1px solid ${dark ? '#2c3846' : '#dfdad0'}}
</style></head><body><div class="copy"><div class="brand"><img src="${icon}">Safehouse</div><h1>${title}</h1><p>${sub}</p></div>
<div class="shot"><img src="${img}"></div></body></html>`;

const context = await chromium.launchPersistentContext(tmp, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
await context.route('**/*', (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === 'www.youtube.com' && u.pathname === '/watch')
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Video</title><script>var ytInitialPlayerResponse={videoDetails:{videoId:"x",title:"GTA 6 ending explained"}}</script>' });
  if (u.hostname === 'www.youtube.com') return route.fulfill({ status: 200, contentType: 'text/html', body: feedHtml });
  if (u.hostname === 'www.reddit.com') return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>r/GTA6</h1>' });
  return route.continue();
});
let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
await new Promise((r) => setTimeout(r, 500));
for (const p of context.pages()) if (p.url().includes('options.html')) await p.close();

const page = await context.newPage();
const shot = async (url, w, h, opts = {}) => {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url).catch(() => {});
  if (opts.waitFor) await page.waitForSelector(opts.waitFor, { state: 'attached' });
  await page.waitForTimeout(500);
  return `data:image/png;base64,${(await page.screenshot({ fullPage: !!opts.full })).toString('base64')}`;
};
const render = async (html, file, w = 1280, h = 800) => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, file) });
  console.log('wrote', path.relative(path.join(root, '..'), path.join(out, file)));
};
const setBlur = async (on) => {
  const o = await context.newPage();
  await o.goto(`chrome-extension://${id}/options.html`);
  await o.click(`label:has(input[value="${on ? 'blur' : 'hide'}"])`);
  await o.waitForTimeout(300);
  await o.close();
};

// 1. Feed with GTA 6 blurred (blur mode makes the effect visible).
await setBlur(true);
const feedBlur = await shot('https://www.youtube.com/', 1100, 640);
await render(frame('GTA 6 stays out of your feed', 'Videos, posts and search results about GTA 6 are hidden or blurred. GTA 5 and everything else stays.', feedBlur), '1-feed.png');

// 2. Full-page cover.
await setBlur(false);
const cover = await shot('https://www.youtube.com/watch?v=x', 1000, 620, { waitFor: 'safehouse-shield' });
await render(frame('Opened a GTA 6 link?', "Safehouse covers the page and pauses the video before you see anything. You decide: go back or show anyway.", cover, true), '2-cover.png', 1280, 800);

// 3. Settings.
const settings = await shot(`chrome-extension://${id}/options.html`, 760, 1000);
await render(frame('You stay in control', 'Hide or blur, choose sites, add your own keywords, and set phrases that are never hidden.', settings), '3-settings.png');

// 4. Block page + popup.
const blocked = await shot('https://www.reddit.com/r/GTA6/', 1000, 620);
await render(frame('GTA 6 sites stay locked', 'GTA 6 communities and fan sites are blocked. Works on YouTube, Google, Reddit, X, TikTok, Instagram, Facebook and Twitch.', blocked), '4-blocked.png');

// Small promo tile 440x280.
await render(`<!doctype html><html><body style="margin:0;width:440px;height:280px;display:flex;align-items:center;justify-content:center;gap:18px;background:#0f1720;color:#f2efe8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
<img src="${icon}" style="width:96px;height:96px"><div><div style="font-size:36px;font-weight:800">Safehouse</div>
<div style="font-size:16px;color:#f5c451;margin-top:6px">Your safehouse from spoilers</div></div></body></html>`, 'promo-440x280.png', 440, 280);

await context.close();
fs.rmSync(tmp, { recursive: true, force: true });
