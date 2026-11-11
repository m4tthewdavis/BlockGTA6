import type { Rules } from './rules';

/**
 * Normalisation exactly as specified in rules/README.md.
 * Every Safehouse client (extension, Android, iOS) must produce identical output.
 */
export function normalize(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[​-‍⁠﻿]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Token-boundary containment on already-normalised text. */
function has(paddedText: string, term: string): boolean {
  return term.length > 0 && paddedText.includes(` ${term} `);
}

export interface MatcherOptions {
  /** Extra user keywords (blocked on their own). */
  customKeywords?: string[];
  /** User overrides: anything containing one of these is never blocked. */
  allowlist?: string[];
  /** "All GTA" mode: also block older GTA games (GTA 5, GTA Online, …). */
  includeOlderGta?: boolean;
}

/** Returns a short reason string when the text should be blocked, otherwise null. */
export type Matcher = (text: string) => string | null;

const OLDER_GTA_TERMS = [
  'gta', 'grand theft auto', 'gtav', 'gta5', 'gtao', 'gtaiv', 'gta4', 'gtasa', 'rockstar games',
];

export function createMatcher(rules: Rules, options: MatcherOptions = {}): Matcher {
  const regexes = rules.regex.map((r) => ({ id: r.id, re: new RegExp(r.pattern) }));
  const unique = rules.unique.map(normalize).filter(Boolean);
  const contextual = rules.contextual.map((c) => ({
    term: normalize(c.term),
    requiresAny: c.requiresAny.map(normalize).filter(Boolean),
    unlessAny: c.unlessAny.map(normalize).filter(Boolean),
  }));
  const allow = [...rules.allowlist, ...(options.allowlist ?? [])].map(normalize).filter(Boolean);
  const custom = (options.customKeywords ?? []).map(normalize).filter(Boolean);
  const older = options.includeOlderGta ? OLDER_GTA_TERMS : [];

  return (text: string): string | null => {
    if (!text) return null;
    const t = normalize(text);
    if (!t) return null;
    const p = ` ${t} `;

    for (const a of allow) if (has(p, a)) return null;
    for (const c of custom) if (has(p, c)) return `keyword:${c}`;
    for (const { id, re } of regexes) if (re.test(t)) return `regex:${id}`;
    for (const u of unique) if (has(p, u)) return `name:${u}`;
    for (const c of contextual) {
      if (has(p, c.term) && c.requiresAny.some((x) => has(p, x)) && !c.unlessAny.some((x) => has(p, x))) {
        return `context:${c.term}`;
      }
    }
    for (const o of older) if (has(p, o)) return `older-gta:${o}`;
    return null;
  };
}
