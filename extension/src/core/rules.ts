import rulesJson from '../../../rules/rules.json';

export interface ContextualRule {
  term: string;
  requiresAny: string[];
  unlessAny: string[];
}

export interface Rules {
  version: number;
  regex: { id: string; pattern: string }[];
  unique: string[];
  contextual: ContextualRule[];
  reddit: { subreddits: string[] };
  domains: { hostRegex: string; urlPrefixes: string[] };
  allowlist: string[];
}

/** The rules bundled with this build (rules/rules.json at the repo root). */
export const BUNDLED_RULES: Rules = rulesJson as unknown as Rules;
