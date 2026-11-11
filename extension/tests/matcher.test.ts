import { describe, expect, it } from 'vitest';
import vectors from '../../rules/test-vectors.json';
import { createMatcher, normalize } from '../src/core/matcher';
import { BUNDLED_RULES } from '../src/core/rules';

const match = createMatcher(BUNDLED_RULES);

describe('shared test vectors (rules/test-vectors.json)', () => {
  for (const c of vectors.cases) {
    it(`${c.expect}: ${c.text}`, () => {
      const verdict = match(c.text) ? 'block' : 'allow';
      expect(verdict, `normalised: "${normalize(c.text)}" (${c.why})`).toBe(c.expect);
    });
  }
});

describe('normalize', () => {
  it('follows the spec examples', () => {
    expect(normalize('G.T.A. Ⅵ — Trailer #3!')).toBe('g t a vi trailer 3');
    expect(normalize("Dre'Quan")).toBe('dre quan');
    expect(normalize('#GTA6Trailer')).toBe('gta6trailer');
  });
});

describe('matcher options', () => {
  it('custom keywords block on their own', () => {
    const m = createMatcher(BUNDLED_RULES, { customKeywords: ['Heist Finale'] });
    expect(m('the heist finale was wild')).toMatch(/^keyword:/);
    expect(m('a normal video')).toBeNull();
  });

  it('allowlist overrides everything', () => {
    const m = createMatcher(BUNDLED_RULES, { allowlist: ['GTA 6 release date'] });
    expect(m('GTA 6 release date confirmed')).toBeNull();
    expect(m('GTA 6 ending explained')).not.toBeNull();
  });

  it('"All GTA" mode also blocks older games', () => {
    expect(match('GTA 5 Online new update')).toBeNull();
    const m = createMatcher(BUNDLED_RULES, { includeOlderGta: true });
    expect(m('GTA 5 Online new update')).not.toBeNull();
    expect(m('Grand Theft Auto V story')).not.toBeNull();
    expect(m('Megatron 6 figure')).toBeNull();
  });
});
