/**
 * Isolated-world content script for every supported site.
 * - Hides/blurs matching cards (Scanner + site adapter).
 * - Covers single-item pages (watch/post/tweet) that match (PageShield).
 * - On YouTube, forwards settings to the MAIN-world JSON filter and collects its counts.
 */
import { createMatcher, type Matcher } from '../core/matcher';
import type { Rules } from '../core/rules';
import { getEffectiveRules, onRulesChanged } from '../core/rules-store';
import { loadSettings, onSettingsChanged, type Settings } from '../core/settings';
import { CFG_STORAGE_KEY, MSG_FROM_CONTENT, MSG_FROM_MAIN, type MainWorldConfig, type RuntimeMessage } from '../shared/bridge';
import { adapterFor, type Adapter } from './adapters';
import { Scanner } from './scanner';
import { PageShield } from './shield';

(async () => {
  const found = adapterFor(location.hostname);
  if (!found) return;
  const adapter: Adapter = found;

  // Listen to the MAIN world *before* awaiting storage: it announces the first video at document_start.
  let ready = false;
  let removedByMain = 0;
  /** YouTube videoId -> title/channel/keywords, announced by the MAIN world as soon as a video loads. */
  const videoText = new Map<string, string>();
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as { source?: string; type?: string; count?: number; videoId?: string; text?: string } | null;
    if (d?.source !== MSG_FROM_MAIN) return;
    if (d.type === 'removed' && typeof d.count === 'number') {
      removedByMain += d.count;
      if (ready) reportCount();
    } else if (d.type === 'video' && typeof d.videoId === 'string' && typeof d.text === 'string') {
      videoText.set(d.videoId, d.text);
      if (ready) checkPage(adapter);
    }
  });

  let [settings, rules]: [Settings, Rules] = await Promise.all([loadSettings(), getEffectiveRules()]);
  let match: Matcher = buildMatcher(settings);
  let scanner: Scanner | null = null;
  const shield = new PageShield();
  let domCount = 0;

  function buildMatcher(s: Settings): Matcher {
    return createMatcher(rules, {
      customKeywords: s.customKeywords,
      allowlist: s.allowlist,
      includeOlderGta: s.includeOlderGta,
    });
  }

  const active = () => settings.enabled && settings.sites[adapter.id];

  function reportCount(): void {
    const count = domCount + removedByMain;
    chrome.runtime.sendMessage({ type: 'count', count } satisfies RuntimeMessage).catch(() => {});
  }

  // ---- YouTube MAIN-world bridge ----
  function syncMainWorld(): void {
    if (adapter.id !== 'youtube') return;
    const cfg: MainWorldConfig = {
      active: active(),
      includeOlderGta: settings.includeOlderGta,
      customKeywords: settings.customKeywords,
      allowlist: settings.allowlist,
      rules,
    };
    try {
      localStorage.setItem(CFG_STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
    window.postMessage({ source: MSG_FROM_CONTENT, type: 'cfg', cfg }, '*');
  }

  // ---- Page shield ----
  function checkPage(a: Adapter): void {
    if (!active() || !settings.pageShield || !a.pageGuard) {
      shield.hide();
      return;
    }
    const url = new URL(location.href);
    if (!a.pageGuard(url)) {
      shield.hide();
      return;
    }
    const key = url.pathname + url.search;
    if (shield.isAllowed(key)) {
      shield.hide();
      return;
    }
    const vid = youtubeVideoId(url);
    const text = [(a.pageText ?? (() => document.title))(), (vid && videoText.get(vid)) || ''].join(' \n ');
    if (match(text)) shield.show(key);
    else shield.hide();
  }

  function youtubeVideoId(u: URL): string | null {
    if (adapter.id !== 'youtube') return null;
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:shorts|live)\/([\w-]{6,})/);
    return m ? m[1] : null;
  }

  let lastHref = '';
  let lastTitle = '';
  function watchNavigation(): void {
    const tick = () => {
      if (location.href !== lastHref || document.title !== lastTitle) {
        lastHref = location.href;
        lastTitle = document.title;
        checkPage(adapter);
      }
    };
    setInterval(tick, 300);
    document.addEventListener('yt-navigate-finish', () => checkPage(adapter));
    window.addEventListener('popstate', tick);
  }

  // ---- Start / apply settings ----
  function apply(): void {
    syncMainWorld();
    if (!active()) {
      scanner?.stop();
      scanner = null;
      shield.hide();
      return;
    }
    if (!scanner) {
      scanner = new Scanner(adapter, match, settings.action, (n) => {
        domCount = n;
        reportCount();
      });
      scanner.start();
    } else {
      scanner.update(match, settings.action);
    }
    checkPage(adapter);
  }

  onSettingsChanged((s) => {
    settings = s;
    match = buildMatcher(s);
    apply();
  });

  onRulesChanged((r) => {
    rules = r;
    match = buildMatcher(settings);
    apply();
  });

  chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
    if (msg.type === 'getCount') {
      sendResponse({ count: domCount + removedByMain, site: adapter.id, active: active() });
    }
    return false;
  });

  const begin = () => {
    ready = true;
    apply();
    watchNavigation();
    if (removedByMain) reportCount();
  };
  if (document.documentElement) begin();
  else document.addEventListener('readystatechange', begin, { once: true });
})();
