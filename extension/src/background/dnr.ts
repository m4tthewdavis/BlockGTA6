import type { Rules } from '../core/rules';

type Rule = chrome.declarativeNetRequest.Rule;

export const FIRST_DYNAMIC_ID = 1;
export const FIRST_SESSION_ID = 10_000;

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** "reddit.com/r/GTA6" -> RE2 regex matching any subdomain, http(s), and only that path segment. */
export function prefixToRegex(prefix: string): string {
  const clean = prefix.replace(/^https?:\/\//i, '').replace(/^(www|old|new|m)\./i, '');
  const slash = clean.indexOf('/');
  const host = slash === -1 ? clean : clean.slice(0, slash);
  const path = slash === -1 ? '' : clean.slice(slash);
  return `^https?://([a-z0-9-]+\\.)*${escapeRegex(host)}${escapeRegex(path)}([/?#].*)?$`;
}

/**
 * Dynamic declarativeNetRequest rules for whole websites about GTA 6.
 * - urlPrefixes redirect to our block page (which offers "Show anyway").
 * - hostRegex is blocked outright (redirecting arbitrary hosts would need <all_urls> access).
 */
export function buildDnrRules(rules: Rules, blockedPageUrl: string): Rule[] {
  const out: Rule[] = [];
  let id = FIRST_DYNAMIC_ID;
  for (const prefix of rules.domains.urlPrefixes) {
    out.push({
      id: id++,
      priority: 1,
      action: {
        type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
        redirect: { regexSubstitution: `${blockedPageUrl}#\\0` },
      },
      condition: {
        regexFilter: prefixToRegex(prefix),
        isUrlFilterCaseSensitive: false,
        resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
      },
    });
  }
  if (rules.domains.hostRegex) {
    out.push({
      id: id++,
      priority: 1,
      action: { type: 'block' as chrome.declarativeNetRequest.RuleActionType },
      condition: {
        regexFilter: rules.domains.hostRegex,
        isUrlFilterCaseSensitive: false,
        resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
      },
    });
  }
  return out;
}

/** Session rule that lets one exact URL through after the user clicks "Show anyway". */
export function allowOnceRule(id: number, url: string): Rule {
  return {
    id,
    priority: 100,
    action: { type: 'allow' as chrome.declarativeNetRequest.RuleActionType },
    condition: {
      regexFilter: `^${escapeRegex(url)}$`,
      resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
    },
  };
}
