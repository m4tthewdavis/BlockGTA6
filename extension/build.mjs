// Builds dist/chrome and dist/firefox. `node build.mjs --zip` also creates store-ready zips.
import * as esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const zip = process.argv.includes('--zip');

const YOUTUBE = ['*://www.youtube.com/*', '*://m.youtube.com/*'];
const GOOGLE_TLDS = [
  'com', 'co.uk', 'ca', 'com.au', 'co.in', 'de', 'fr', 'es', 'it', 'nl', 'com.br', 'com.mx', 'ie', 'co.nz',
  'pl', 'se', 'no', 'dk', 'fi', 'be', 'at', 'ch', 'pt', 'co.jp', 'co.za', 'com.ar', 'com.sg', 'com.ph', 'com.tr',
];
const SITES = [
  ...YOUTUBE,
  ...GOOGLE_TLDS.map((t) => `*://www.google.${t}/*`),
  '*://www.bing.com/*',
  '*://*.duckduckgo.com/*',
  '*://*.reddit.com/*',
  '*://*.x.com/*',
  '*://*.twitter.com/*',
  '*://www.tiktok.com/*',
  '*://www.instagram.com/*',
  '*://www.facebook.com/*',
  '*://m.facebook.com/*',
  '*://web.facebook.com/*',
  '*://www.twitch.tv/*',
  '*://m.twitch.tv/*',
];
// Pages we redirect to the block page need host access for declarativeNetRequest redirects.
const REDIRECT_HOSTS = ['*://*.rockstargames.com/*', '*://*.reddit.com/*', '*://*.twitch.tv/*', '*://*.tiktok.com/*', '*://*.instagram.com/*'];

const DESCRIPTION =
  'Your safehouse from spoilers. Hides GTA 6 / GTA VI videos, posts and search results. Unofficial, not affiliated with Rockstar Games.';
if (DESCRIPTION.length > 132) throw new Error(`description too long (${DESCRIPTION.length})`);

function manifest(browser) {
  const m = {
    manifest_version: 3,
    name: 'Safehouse – Spoiler Blocker',
    short_name: 'Safehouse',
    version: VERSION,
    description: DESCRIPTION,
    icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
    action: {
      default_title: 'Safehouse',
      default_popup: 'popup.html',
      default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' },
    },
    options_ui: { page: 'options.html', open_in_tab: true },
    permissions: ['storage', 'declarativeNetRequest', 'alarms'],
    host_permissions: [...new Set([...SITES, ...REDIRECT_HOSTS])],
    content_scripts: [
      { matches: YOUTUBE, js: ['youtube-main.js'], run_at: 'document_start', world: 'MAIN' },
      { matches: SITES, js: ['content.js'], run_at: 'document_start' },
    ],
    web_accessible_resources: [
      { resources: ['blocked.html', 'blocked.js', 'ui.css', 'icons/*'], matches: REDIRECT_HOSTS },
    ],
  };
  if (browser === 'chrome') {
    m.background = { service_worker: 'background.js' };
    m.minimum_chrome_version = '111';
  } else {
    m.background = { scripts: ['background.js'] };
    m.browser_specific_settings = {
      gecko: {
        id: 'safehouse-spoiler-blocker@blockgta6',
        strict_min_version: '128.0',
        data_collection_permissions: { required: ['none'] },
      },
      gecko_android: { strict_min_version: '128.0' },
    };
  }
  return m;
}

/** Tiny Markdown -> HTML for docs/mute-guide.md (headings, lists, code, bold, italics, links, quotes, rules). */
function markdownToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, href) =>
        /^https?:/.test(href) ? `<a href="${href}" target="_blank" rel="noopener">${t}</a>` : t);
  const out = [];
  let list = null;
  let code = null;
  let para = []; // soft-wrapped lines of the current paragraph
  let quote = []; // lines of the current blockquote
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    if (quote.length) { out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`); quote = []; }
  };
  const closeList = () => { flush(); if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of md.split('\n')) {
    if (code !== null) {
      if (line.startsWith('```')) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; }
      else code.push(line);
      continue;
    }
    if (line.startsWith('```')) { closeList(); code = []; continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { closeList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if (/^---+\s*$/.test(line)) { closeList(); out.push('<hr>'); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { if (para.length || list) closeList(); quote.push(m[1]); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { flush(); if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) { flush(); if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if (/^\s+\S/.test(line) && list) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`); continue; }
    if (!line.trim()) { closeList(); continue; }
    if (list) closeList();
    if (quote.length) flush();
    para.push(line.trim());
  }
  closeList();
  return out.join('\n');
}

function phonePage() {
  const md = fs.readFileSync(path.join(root, '..', 'docs', 'mute-guide.md'), 'utf8');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Safehouse phone guide</title><link rel="stylesheet" href="ui.css">
<style>
 body{padding:24px 16px 64px} main{max-width:720px;margin:0 auto} h1{font-size:26px;margin-bottom:8px} h2{font-size:19px;margin:28px 0 8px}
 h3{font-size:16px;margin:20px 0 6px} pre{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;overflow:auto;user-select:all}
 code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px} blockquote{margin:12px 0;padding:8px 12px;border-left:4px solid var(--accent);background:var(--surface);border-radius:6px}
 hr{border:0;border-top:1px solid var(--border);margin:24px 0} li{margin:4px 0}
</style></head><body><main>
${markdownToHtml(md)}
</main></body></html>`;
}

async function build(browser) {
  const out = path.join(root, 'dist', browser);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  await esbuild.build({
    entryPoints: {
      background: 'src/background/background.ts',
      content: 'src/content/content.ts',
      'youtube-main': 'src/main/youtube-main.ts',
      popup: 'src/ui/popup.ts',
      options: 'src/ui/options.ts',
      blocked: 'src/ui/blocked.ts',
    },
    absWorkingDir: root,
    outdir: out,
    bundle: true,
    format: 'iife',
    target: browser === 'chrome' ? ['chrome111'] : ['firefox128'],
    minify: false, // keep readable for store reviewers
    legalComments: 'none',
    logLevel: 'warning',
  });

  for (const f of ['popup.html', 'options.html', 'blocked.html', 'ui.css']) {
    fs.copyFileSync(path.join(root, 'src', 'ui', f), path.join(out, f));
  }
  fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(out, 'phone.html'), phonePage());
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest(browser), null, 2));

  if (zip) {
    const file = path.join(root, 'dist', `safehouse-${browser}-${VERSION}.zip`);
    fs.rmSync(file, { force: true });
    execFileSync('zip', ['-qr', file, '.'], { cwd: out });
    console.log('packaged', path.relative(root, file));
  }
  console.log('built', path.relative(root, out));
}

await build('chrome');
await build('firefox');
