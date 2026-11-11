export const SITE_IDS = ['youtube', 'google', 'bing', 'duckduckgo', 'reddit', 'x'] as const;
export type SiteId = (typeof SITE_IDS)[number];

export const SITE_LABELS: Record<SiteId, string> = {
  youtube: 'YouTube',
  google: 'Google Search',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  reddit: 'Reddit',
  x: 'X (Twitter)',
};

export type Action = 'hide' | 'blur';

export interface Settings {
  /** Master switch. */
  enabled: boolean;
  /** What to do with a matching item in a feed or list. */
  action: Action;
  /** Cover the whole page when you open a GTA 6 video/post directly. */
  pageShield: boolean;
  /** Redirect/block websites that are entirely about GTA 6. */
  blockSites: boolean;
  /** "All GTA" mode: also hide older GTA games. Off by default. */
  includeOlderGta: boolean;
  sites: Record<SiteId, boolean>;
  customKeywords: string[];
  allowlist: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  action: 'hide',
  pageShield: true,
  blockSites: true,
  includeOlderGta: false,
  sites: { youtube: true, google: true, bing: true, duckduckgo: true, reddit: true, x: true },
  customKeywords: [],
  allowlist: [],
};

function stringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).slice(0, 500);
}

/** Merge whatever is in storage with the defaults, dropping anything malformed. */
export function mergeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const rawSites = (r.sites && typeof r.sites === 'object' ? r.sites : {}) as Record<string, unknown>;
  const sites = { ...DEFAULT_SETTINGS.sites };
  for (const id of SITE_IDS) sites[id] = bool(rawSites[id], DEFAULT_SETTINGS.sites[id]);
  return {
    enabled: bool(r.enabled, DEFAULT_SETTINGS.enabled),
    action: r.action === 'blur' ? 'blur' : 'hide',
    pageShield: bool(r.pageShield, DEFAULT_SETTINGS.pageShield),
    blockSites: bool(r.blockSites, DEFAULT_SETTINGS.blockSites),
    includeOlderGta: bool(r.includeOlderGta, DEFAULT_SETTINGS.includeOlderGta),
    sites,
    customKeywords: stringList(r.customKeywords),
    allowlist: stringList(r.allowlist),
  };
}

/** Split a textarea into a clean, de-duplicated list (one entry per line or comma). */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\n,]/)) {
    const v = part.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export async function loadSettings(): Promise<Settings> {
  const r = await chrome.storage.sync.get('settings');
  return mergeSettings(r.settings);
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings: s });
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) cb(mergeSettings(changes.settings.newValue));
  });
}
