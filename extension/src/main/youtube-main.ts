/**
 * Runs in YouTube's MAIN world at document_start (no extension APIs available here).
 *
 * - Traps the `ytInitialData` global (first page load) and wraps `fetch` for /youtubei/v1/*
 *   (every later navigation, scroll, search and "Up next" list), removing GTA 6 items from the
 *   JSON before YouTube renders it.
 * - Settings come from the isolated content script: synchronously from a localStorage cache
 *   (so the very first data of the page is filtered with the user's last settings) and then
 *   live via window.postMessage.
 */
import { createMatcher, type Matcher } from '../core/matcher';
import { BUNDLED_RULES } from '../core/rules';
import { CFG_STORAGE_KEY, MSG_FROM_CONTENT, MSG_FROM_MAIN, type MainWorldConfig } from '../shared/bridge';
import { filterYouTubeData } from './yt-filter';

(() => {
  const w = window as unknown as Record<string, unknown> & Window;
  if (w.__safehouseMain) return;
  w.__safehouseMain = true;

  const DEFAULT_CFG: MainWorldConfig = {
    active: true,
    includeOlderGta: false,
    customKeywords: [],
    allowlist: [],
  };

  function readCachedCfg(): MainWorldConfig {
    try {
      const raw = localStorage.getItem(CFG_STORAGE_KEY);
      if (raw) return { ...DEFAULT_CFG, ...(JSON.parse(raw) as Partial<MainWorldConfig>) };
    } catch {
      /* storage blocked: fall back to defaults */
    }
    return DEFAULT_CFG;
  }

  let cfg = readCachedCfg();
  let match: Matcher = build(cfg);
  let pendingReport = 0;

  function build(c: MainWorldConfig): Matcher {
    return createMatcher(BUNDLED_RULES, {
      customKeywords: c.customKeywords,
      allowlist: c.allowlist,
      includeOlderGta: c.includeOlderGta,
    });
  }

  function report(n: number): void {
    pendingReport += n;
    // Batch reports; the content script may not be listening yet at document_start.
    setTimeout(() => {
      if (!pendingReport) return;
      window.postMessage({ source: MSG_FROM_MAIN, type: 'removed', count: pendingReport }, '*');
      pendingReport = 0;
    }, 500);
  }

  function process<T>(data: T): T {
    if (!cfg.active || !data || typeof data !== 'object') return data;
    try {
      const n = filterYouTubeData(data, (t) => match(t) !== null);
      if (n) report(n);
    } catch {
      /* never break YouTube */
    }
    return data;
  }

  function processMaybeString(v: unknown): unknown {
    // m.youtube.com assigns ytInitialData as a JSON *string* and parses it later.
    if (typeof v === 'string' && cfg.active) {
      try {
        const parsed = JSON.parse(v);
        process(parsed);
        return JSON.stringify(parsed);
      } catch {
        return v;
      }
    }
    return process(v);
  }

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as { source?: string; type?: string; cfg?: MainWorldConfig } | null;
    if (d && d.source === MSG_FROM_CONTENT && d.type === 'cfg' && d.cfg) {
      cfg = { ...DEFAULT_CFG, ...d.cfg };
      match = build(cfg);
    }
  });

  /** Tell the content script which video is about to play, so it can cover the page instantly. */
  function announceVideo(player: unknown): void {
    try {
      const p = (typeof player === 'string' ? JSON.parse(player) : player) as {
        videoDetails?: { videoId?: string; title?: string; author?: string; keywords?: string[] };
      } | null;
      const v = p?.videoDetails;
      if (!v?.videoId) return;
      const text = [v.title ?? '', v.author ?? '', ...(v.keywords ?? []).slice(0, 30)].join(' \n ');
      window.postMessage({ source: MSG_FROM_MAIN, type: 'video', videoId: v.videoId, text }, '*');
    } catch {
      /* ignore */
    }
  }

  function trap(name: string, onSet: (v: unknown) => unknown): void {
    let value: unknown = w[name] !== undefined ? onSet(w[name]) : undefined;
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: (v: unknown) => {
          value = onSet(v);
        },
      });
    } catch {
      /* already defined as non-configurable */
    }
  }

  // 1) First page load: `var ytInitialData = {...}` in an inline script hits these setters.
  trap('ytInitialData', processMaybeString);
  trap('ytInitialPlayerResponse', (v) => {
    announceVideo(v);
    return v;
  });

  // 2) Everything after that: YouTube's internal API.
  const ENDPOINT = /\/youtubei\/v1\/(browse|search|next|guide|reel\/reel_watch_sequence|notification\/get_notification_menu)\b/;
  const PLAYER = /\/youtubei\/v1\/player\b/;
  const originalFetch = window.fetch;

  const wrapped = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const res = await originalFetch.call(this ?? window, input, init);
    try {
      if (!cfg.active || !res.ok) return res;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (PLAYER.test(url)) {
        res.clone().json().then(announceVideo, () => {});
        return res;
      }
      if (!ENDPOINT.test(url)) return res;
      if (!(res.headers.get('content-type') ?? '').includes('json')) return res;

      const data = await res.clone().json();
      const n = filterYouTubeData(data, (t) => match(t) !== null);
      if (!n) return res;
      report(n);

      const headers = new Headers(res.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      const out = new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers });
      Object.defineProperty(out, 'url', { value: res.url });
      return out;
    } catch {
      return res;
    }
  };
  Object.defineProperty(wrapped, 'toString', { value: () => originalFetch.toString() });
  window.fetch = wrapped as typeof fetch;
})();
