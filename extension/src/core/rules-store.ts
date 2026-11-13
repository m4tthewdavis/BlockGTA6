/**
 * Blocklist updates without a store release.
 *
 * The background worker periodically downloads rules/rules.json from the repo. It is DATA ONLY
 * (keywords, names, declarative regexes, domains): all logic ships in the extension package,
 * which is what the Chrome Web Store and AMO "remote configuration" policies allow.
 * An update is only accepted if it passes validation AND has a higher `version` than what we have.
 */
import { BUNDLED_RULES, type ContextualRule, type Rules } from './rules';

export const REMOTE_RULES_URL = 'https://raw.githubusercontent.com/m4tthewdavis/BlockGTA6/main/rules/rules.json';
export const REMOTE_KEY = 'remoteRules';
export const REMOTE_META_KEY = 'remoteRulesMeta';

export interface RulesMeta {
  lastChecked: number;
  lastResult: 'updated' | 'up-to-date' | 'invalid' | 'error';
  error?: string;
}

const MAX_LIST = 2000;
const MAX_STR = 200;
const MAX_PATTERN = 400;

const isStr = (v: unknown, max = MAX_STR): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const strList = (v: unknown, allowEmpty = true): string[] | null => {
  if (!Array.isArray(v) || v.length > MAX_LIST) return null;
  if (!v.every((x) => isStr(x))) return null;
  if (!allowEmpty && v.length === 0) return null;
  return v as string[];
};
const compiles = (p: string): boolean => {
  try {
    new RegExp(p);
    return true;
  } catch {
    return false;
  }
};
/** declarativeNetRequest uses RE2: no lookarounds or backreferences. */
const re2Safe = (p: string): boolean => !/\(\?[=!<]|\\[1-9]/.test(p);

/** Returns a clean Rules object, or null if anything is off. Never trust remote data blindly. */
export function validateRules(raw: unknown): Rules | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.version !== 'number' || !Number.isInteger(r.version) || r.version < 1) return null;

  if (!Array.isArray(r.regex) || r.regex.length > 200) return null;
  const regex: Rules['regex'] = [];
  for (const x of r.regex as unknown[]) {
    const e = x as { id?: unknown; pattern?: unknown };
    if (!isStr(e?.id) || !isStr(e?.pattern, MAX_PATTERN) || !compiles(e.pattern)) return null;
    regex.push({ id: e.id, pattern: e.pattern });
  }

  const unique = strList(r.unique);
  if (!unique) return null;

  if (!Array.isArray(r.contextual) || r.contextual.length > 500) return null;
  const contextual: ContextualRule[] = [];
  for (const x of r.contextual as unknown[]) {
    const c = x as Record<string, unknown>;
    const requiresAny = strList(c?.requiresAny, false);
    const unlessAny = strList(c?.unlessAny);
    if (!isStr(c?.term) || !requiresAny || !unlessAny) return null;
    contextual.push({ term: c.term as string, requiresAny, unlessAny });
  }

  const d = r.domains as Record<string, unknown> | undefined;
  const urlPrefixes = strList(d?.urlPrefixes);
  const hostRegex = d?.hostRegex;
  if (!urlPrefixes || urlPrefixes.length > 100) return null;
  if (hostRegex !== '' && !(isStr(hostRegex, MAX_PATTERN) && compiles(hostRegex) && re2Safe(hostRegex))) return null;

  const subreddits = strList((r.reddit as Record<string, unknown> | undefined)?.subreddits);
  const allowlist = strList(r.allowlist);
  if (!subreddits || !allowlist) return null;

  return {
    version: r.version,
    regex,
    unique,
    contextual,
    reddit: { subreddits },
    domains: { hostRegex: hostRegex as string, urlPrefixes },
    allowlist,
  };
}

/** The newest valid rules available: a downloaded update if newer than the bundled copy, else bundled. */
export function pickRules(stored: unknown): Rules {
  const remote = validateRules(stored);
  return remote && remote.version > BUNDLED_RULES.version ? remote : BUNDLED_RULES;
}

export async function getEffectiveRules(): Promise<Rules> {
  try {
    const r = await chrome.storage.local.get(REMOTE_KEY);
    return pickRules(r[REMOTE_KEY]);
  } catch {
    return BUNDLED_RULES;
  }
}

export function onRulesChanged(cb: (rules: Rules) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[REMOTE_KEY]) cb(pickRules(changes[REMOTE_KEY].newValue));
  });
}

/** Download, validate and store a newer blocklist. Used by the background worker. */
export async function refreshRules(fetchImpl: typeof fetch = fetch): Promise<RulesMeta> {
  const meta: RulesMeta = { lastChecked: Date.now(), lastResult: 'error' };
  try {
    const current = await getEffectiveRules();
    const res = await fetchImpl(REMOTE_RULES_URL, { cache: 'no-store', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > 512 * 1024) throw new Error('too large');
    const rules = validateRules(JSON.parse(text));
    if (!rules) meta.lastResult = 'invalid';
    else if (rules.version > current.version) {
      await chrome.storage.local.set({ [REMOTE_KEY]: rules });
      meta.lastResult = 'updated';
    } else meta.lastResult = 'up-to-date';
  } catch (e) {
    meta.error = String(e instanceof Error ? e.message : e);
  }
  await chrome.storage.local.set({ [REMOTE_META_KEY]: meta });
  return meta;
}
