import { describe, expect, it } from 'vitest';
import { BUNDLED_RULES } from '../src/core/rules';
import { allowOnceRule, buildDnrRules, prefixToRegex } from '../src/background/dnr';

// RE2 (used by declarativeNetRequest) has no lookarounds or backreferences; make sure we never emit them.
const RE2_UNSAFE = /\(\?[=!<]|\\[1-9]/;

describe('site blocking rules', () => {
  const host = new RegExp(BUNDLED_RULES.domains.hostRegex, 'i');

  it.each([
    ['https://gta6library.com/', true],
    ['https://www.gta-vi.net/news', true],
    ['https://gta6.com/', true],
    ['http://news.grandtheftautovi.org/x', true],
    ['https://gta-vicecity.com/', false],
    ['https://gtavice.city/', false],
    ['https://www.youtube.com/results?search_query=gta6', false],
    ['https://example.com/gta6/page', false],
    ['https://gta60fps.com/', false],
  ])('hostRegex %s -> %s', (url, expected) => {
    expect(host.test(url)).toBe(expected);
  });

  it('url prefixes match subdomains and the exact path segment only', () => {
    const re = new RegExp(prefixToRegex('reddit.com/r/GTA6'), 'i');
    expect(re.test('https://www.reddit.com/r/GTA6/')).toBe(true);
    expect(re.test('https://old.reddit.com/r/gta6/comments/abc/x')).toBe(true);
    expect(re.test('https://reddit.com/r/GTA6')).toBe(true);
    expect(re.test('https://www.reddit.com/r/GTA6memes/')).toBe(false);
    expect(re.test('https://www.reddit.com/r/gaming/')).toBe(false);
    const rs = new RegExp(prefixToRegex('rockstargames.com/VI'), 'i');
    expect(rs.test('https://www.rockstargames.com/VI')).toBe(true);
    expect(rs.test('https://www.rockstargames.com/VI/characters')).toBe(true);
    expect(rs.test('https://www.rockstargames.com/videos')).toBe(false);
    expect(rs.test('https://www.rockstargames.com/gta-online')).toBe(false);
  });

  it('builds RE2-safe rules with unique ids', () => {
    const rules = buildDnrRules(BUNDLED_RULES, 'chrome-extension://abc/blocked.html');
    expect(rules.length).toBe(BUNDLED_RULES.domains.urlPrefixes.length + 1);
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
    for (const r of rules) expect(r.condition.regexFilter).not.toMatch(RE2_UNSAFE);
    expect(rules[0].action.redirect?.regexSubstitution).toBe('chrome-extension://abc/blocked.html#\\0');
  });

  it('allow-once rule matches only that exact URL', () => {
    const r = allowOnceRule(10000, 'https://www.reddit.com/r/GTA6/?a=1');
    const re = new RegExp(r.condition.regexFilter!);
    expect(re.test('https://www.reddit.com/r/GTA6/?a=1')).toBe(true);
    expect(re.test('https://www.reddit.com/r/GTA6/?a=2')).toBe(false);
    expect(r.priority).toBeGreaterThan(1);
  });
});
