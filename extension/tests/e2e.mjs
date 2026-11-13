// End-to-end test: loads dist/chrome into Chromium and runs it against offline copies of
// YouTube, Google, Reddit and X (served via request interception; no real network needed).
// Run: npm run build && npm run e2e
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const ext = path.join(root, 'dist', 'chrome');
const fx = (f) => fs.readFileSync(path.join(root, 'tests', 'fixtures', f), 'utf8');

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push([true, name]);
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push([false, name]);
    console.log(`  ✗ ${name}\n    ${e.message.split('\n').join('\n    ')}`);
  }
}

const html = (body) => ({ status: 200, contentType: 'text/html; charset=utf-8', body });
const json = (body) => ({ status: 200, contentType: 'application/json; charset=utf-8', body });

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safehouse-e2e-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium', // new headless mode supports extensions
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  const h = url.hostname;
  if (h === 'www.youtube.com') {
    if (url.pathname.startsWith('/youtubei/v1/search')) return route.fulfill(json(fx('yt-search.json')));
    if (url.pathname === '/watch') {
      const vid = url.searchParams.get('v');
      const title = vid === 'gta' ? 'GTA 6 ending explained' : 'Sourdough for beginners';
      return route.fulfill(html(fx('pages/yt-watch.html').replace('__VID__', vid).replace('__TITLE__', title)));
    }
    return route.fulfill(html(fx('pages/yt-home.html').replace('__YT_HOME__', fx('yt-home.json'))));
  }
  if (h === 'www.google.com') return route.fulfill(html(fx('pages/google.html')));
  if (h === 'www.reddit.com') {
    if (/^\/r\/gta6/i.test(url.pathname)) return route.fulfill(html(fx('pages/reddit-sub.html')));
    return route.fulfill(html(fx('pages/reddit.html')));
  }
  if (h === 'x.com') return route.fulfill(html(fx('pages/x.html')));
  if (h === 'www.tiktok.com') return route.fulfill(html(fx(url.pathname.includes('/video/') ? 'pages/tiktok-video.html' : 'pages/tiktok.html')));
  if (h === 'www.instagram.com') return route.fulfill(html(fx('pages/instagram.html')));
  if (h === 'www.facebook.com') return route.fulfill(html(fx('pages/facebook.html')));
  if (h === 'www.twitch.tv') {
    if (url.pathname === '/somestreamer') return route.fulfill(html(fx('pages/twitch-stream.html')));
    return route.fulfill(html(fx('pages/twitch.html')));
  }
  if (h === 'raw.githubusercontent.com' && url.pathname.endsWith('/rules/rules.json')) {
    // A "newer blocklist" adding a name that isn't in the bundled rules.
    const r = JSON.parse(fs.readFileSync(path.join(root, '..', 'rules', 'rules.json'), 'utf8'));
    r.version = 999;
    r.unique.push('zebra cartel');
    return route.fulfill(json(JSON.stringify(r)));
  }
  return route.continue();
});

let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;
console.log(`Extension loaded: ${extId}`);

// Close the welcome tab opened on install.
await new Promise((r) => setTimeout(r, 500));
for (const p of context.pages()) if (p.url().includes('options.html')) await p.close();

const page = await context.newPage();
const attr = (sel) => page.$eval(sel, (e) => e.getAttribute('data-safehouse')).catch(() => null);
const visible = (sel) => page.isVisible(sel);

console.log('YouTube');
await page.goto('https://www.youtube.com/');
await page.waitForSelector('body[data-search-loaded="1"]');
await page.waitForTimeout(800);
const homeText = await page.$$eval('#raw-home .raw-item', (els) => els.map((e) => e.textContent));
const searchText = await page.$$eval('#raw-search .raw-item', (els) => els.map((e) => e.textContent));

await test('ytInitialData: GTA 6 items removed before render', async () => {
  for (const bad of ['GTA 6 Launch Trailer Breakdown', 'Lucia Caminos edit #gta6', 'Grand Theft Auto VI', 'GTA6 Leaks Channel'])
    assert.ok(!homeText.includes(bad), `"${bad}" was rendered`);
});
await test('ytInitialData: other items kept (incl. GTA 5)', async () => {
  for (const ok of ['Best pasta recipe', 'Cat jumps into a box', 'GTA 5 story mode 100%', 'Music'])
    assert.ok(homeText.includes(ok), `"${ok}" missing; got ${JSON.stringify(homeText)}`);
});
await test('fetch /youtubei/v1/search: GTA 6 results removed, others kept', async () => {
  for (const bad of ['Every Leonida location ranked', 'Jason Duval moments', 'GTA VI News Daily'])
    assert.ok(!searchText.includes(bad), `"${bad}" was rendered`);
  for (const ok of ['Minecraft speedrun world record', 'Dog learns to skate', 'GTA Vice City Definitive Edition review'])
    assert.ok(searchText.includes(ok), `"${ok}" missing`);
});
await test('DOM layer: GTA 6 comment thread hidden, normal comment visible', async () => {
  assert.equal(await attr('#thread-gta'), 'hide');
  assert.equal(await visible('#thread-gta'), false);
  assert.equal(await visible('#thread-ok'), true);
});
await test('DOM layer: card added later is hidden', async () => {
  await page.waitForSelector('#late-card', { state: 'attached' });
  await page.waitForTimeout(400);
  assert.equal(await attr('#late-card'), 'hide');
});

await test('watch page shield covers a GTA 6 video (title from player data)', async () => {
  await page.goto('https://www.youtube.com/watch?v=gta');
  await page.waitForSelector('safehouse-shield', { state: 'attached', timeout: 3000 });
});
await test('watch page shield NOT shown for other videos', async () => {
  await page.goto('https://www.youtube.com/watch?v=bread');
  await page.waitForTimeout(800);
  assert.equal(await page.$('safehouse-shield'), null);
});

console.log('Google');
await page.goto('https://www.google.com/search?q=gta');
await page.waitForTimeout(600);
await test('Google: GTA 6 results hidden, GTA 5 and others shown', async () => {
  assert.equal(await visible('#r1'), false, 'r1 visible');
  assert.equal(await visible('#r3'), false, 'r3 (Jason Duval) visible');
  assert.equal(await visible('#r2'), true, 'r2 (GTA 5) hidden');
  assert.equal(await visible('#r4'), true, 'r4 hidden');
  assert.equal(await visible('#r5'), true, 'r5 (not in bundled rules yet) hidden');
});

console.log('Reddit');
await page.goto('https://www.reddit.com/');
await page.waitForTimeout(600);
await test('Reddit: GTA 6 post hidden (whole article), other post shown', async () => {
  assert.equal(await visible('#a1'), false);
  assert.equal(await visible('#a2'), true);
});
await test('Reddit: only the GTA 6 reply is hidden, not its parent comment', async () => {
  assert.equal(await attr('#c2'), 'hide');
  assert.equal(await attr('#c1'), null);
});
await test('Reddit: r/GTA6 redirects to the Safehouse block page', async () => {
  await page.goto('https://www.reddit.com/r/GTA6/').catch(() => {});
  await page.waitForURL(/blocked\.html/, { timeout: 3000 });
  assert.ok(page.url().startsWith(`chrome-extension://${extId}/blocked.html#https://www.reddit.com/r/GTA6/`), page.url());
  assert.ok((await page.textContent('h1')).includes('Safehouse'));
});
await test('Block page: "Show anyway" lets that page through', async () => {
  await page.click('#show');
  await page.waitForURL('https://www.reddit.com/r/GTA6/', { timeout: 3000 });
  await page.waitForSelector('#sub');
});

console.log('X');
await page.goto('https://x.com/home');
await page.waitForTimeout(600);
await test('X: GTA 6 tweet hidden (whole cell) and #GTAVI trend hidden', async () => {
  assert.equal(await visible('#cell1'), false);
  assert.equal(await visible('#cell2'), true);
  assert.equal(await visible('#trend1'), false);
});

console.log('TikTok / Instagram / Facebook / Twitch (beta)');
await page.goto('https://www.tiktok.com/foryou');
await page.waitForTimeout(600);
await test('TikTok: GTA 6 feed item, profile tile and comment hidden; others shown', async () => {
  assert.equal(await visible('#t1'), false);
  assert.equal(await visible('#t3'), false, 'tile matched via image alt');
  assert.equal(await visible('#t4'), false);
  assert.equal(await visible('#t2'), true);
});
await test('TikTok: GTA 6 video page is covered', async () => {
  await page.goto('https://www.tiktok.com/@someone/video/123456');
  await page.waitForSelector('safehouse-shield', { state: 'attached', timeout: 3000 });
});
await page.goto('https://www.instagram.com/');
await page.waitForTimeout(600);
await test('Instagram: GTA 6 post and reel tile hidden; others shown', async () => {
  assert.equal(await visible('#i1'), false);
  assert.equal(await visible('#i3'), false);
  assert.equal(await visible('#i2'), true);
  assert.equal(await visible('#i4'), true);
});
await page.goto('https://www.facebook.com/');
await page.waitForTimeout(600);
await test('Facebook: GTA 6 post hidden; others shown', async () => {
  assert.equal(await visible('#f1'), false);
  assert.equal(await visible('#f2'), true);
});
await page.goto('https://www.twitch.tv/directory');
await page.waitForTimeout(600);
await test('Twitch: GTA VI streams hidden; GTA V RP and others shown', async () => {
  assert.equal(await visible('#w1'), false);
  assert.equal(await visible('#w2'), true);
  assert.equal(await visible('#w3'), true);
});
await test('Twitch: stream page covered once its category loads as GTA VI', async () => {
  await page.goto('https://www.twitch.tv/somestreamer');
  await page.waitForSelector('safehouse-shield', { state: 'attached', timeout: 4000 });
});
await test('Twitch: GTA VI category page redirects to the block page', async () => {
  await page.goto('https://www.twitch.tv/directory/category/grand-theft-auto-vi').catch(() => {});
  await page.waitForURL(/blocked\.html/, { timeout: 3000 });
});

console.log('Settings');
await test('Switching to "Blur" in settings blurs instead of hiding; clicking reveals', async () => {
  const opts = await context.newPage();
  await opts.goto(`chrome-extension://${extId}/options.html`);
  await opts.click('label:has(input[value="blur"])');
  await opts.waitForTimeout(300);
  await opts.close();
  await page.goto('https://www.google.com/search?q=gta');
  await page.waitForTimeout(600);
  assert.equal(await attr('#r1'), 'blur');
  await page.click('#r1');
  assert.equal(await attr('#r1'), null);
});
await test('Options tester reports matches', async () => {
  const opts = await context.newPage();
  await opts.goto(`chrome-extension://${extId}/options.html`);
  await opts.fill('#tester', 'GTA VI map leak compared');
  assert.match(await opts.textContent('#testResult'), /Hidden/);
  await opts.fill('#tester', 'GTA 5 heist guide');
  assert.match(await opts.textContent('#testResult'), /Shown/);
  await opts.close();
});
await test('Blocklist update: "Check now" downloads newer rules and pages use them', async () => {
  const opts = await context.newPage();
  await opts.goto(`chrome-extension://${extId}/options.html`);
  await opts.click('#checkRules');
  await opts.waitForFunction(() => document.getElementById('rulesInfo').textContent.includes('Version 999'), null, { timeout: 5000 });
  await opts.fill('#tester', 'zebra cartel ending');
  assert.match(await opts.textContent('#testResult'), /Hidden/);
  await opts.close();
  await page.goto('https://www.google.com/search?q=gta');
  await page.waitForTimeout(600);
  assert.notEqual(await attr('#r5'), null, 'r5 should now be hidden/blurred');
});
await test('Turning protection off shows everything again', async () => {
  const opts = await context.newPage();
  await opts.goto(`chrome-extension://${extId}/options.html`);
  await opts.click('label:has(#enabled)');
  await opts.waitForTimeout(300);
  await opts.close();
  await page.goto('https://x.com/home');
  await page.waitForTimeout(600);
  assert.equal(await visible('#cell1'), true);
});

await context.close();
fs.rmSync(userDataDir, { recursive: true, force: true });
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} e2e checks passed`);
process.exit(failed ? 1 : 0);
