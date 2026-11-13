import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUNDLED_RULES } from '../src/core/rules';
import { REMOTE_KEY, REMOTE_META_KEY, pickRules, refreshRules, validateRules } from '../src/core/rules-store';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const newer = (patch: (r: Record<string, any>) => void = () => {}) => {
  const r = clone(BUNDLED_RULES) as Record<string, any>;
  r.version = BUNDLED_RULES.version + 1;
  patch(r);
  return r;
};

describe('validateRules', () => {
  it('accepts the bundled rules file', () => {
    expect(validateRules(clone(BUNDLED_RULES))).not.toBeNull();
  });

  it.each([
    ['missing version', (r: any) => delete r.version],
    ['non-integer version', (r: any) => (r.version = 2.5)],
    ['regex that does not compile', (r: any) => r.regex.push({ id: 'x', pattern: '(' })],
    ['huge pattern', (r: any) => r.regex.push({ id: 'x', pattern: 'a'.repeat(1000) })],
    ['non-string name', (r: any) => r.unique.push(42)],
    ['contextual rule without requirements', (r: any) => r.contextual.push({ term: 'x', requiresAny: [], unlessAny: [] })],
    ['host regex with lookahead (not RE2)', (r: any) => (r.domains.hostRegex = '^https?://(?=x)')],
    ['missing domains', (r: any) => delete r.domains],
    ['not an object', () => {}],
  ])('rejects %s', (name, patch) => {
    const r = name === 'not an object' ? 'nope' : newer(patch as any);
    expect(validateRules(r)).toBeNull();
  });

  it('drops unknown extra fields', () => {
    const v = validateRules(newer((r) => (r.evil = 'x')));
    expect(v).not.toBeNull();
    expect((v as any).evil).toBeUndefined();
  });
});

describe('pickRules', () => {
  it('uses a valid newer download', () => {
    expect(pickRules(newer()).version).toBe(BUNDLED_RULES.version + 1);
  });
  it('ignores older or equal versions, invalid data and nothing', () => {
    expect(pickRules(clone(BUNDLED_RULES))).toBe(BUNDLED_RULES);
    expect(pickRules(newer((r) => (r.version = 1)))).toBe(BUNDLED_RULES);
    expect(pickRules(newer((r) => (r.regex = 'x')))).toBe(BUNDLED_RULES);
    expect(pickRules(undefined)).toBe(BUNDLED_RULES);
  });
});

describe('refreshRules', () => {
  let store: Record<string, unknown>;
  beforeEach(() => {
    store = {};
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn(async (k: string) => ({ [k]: store[k] })),
          set: vi.fn(async (o: Record<string, unknown>) => Object.assign(store, o)),
        },
      },
    };
  });
  const respond = (body: unknown, status = 200) =>
    vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('stores a valid newer list', async () => {
    const meta = await refreshRules(respond(newer((r) => r.unique.push('zebra cartel'))));
    expect(meta.lastResult).toBe('updated');
    expect((store[REMOTE_KEY] as any).unique).toContain('zebra cartel');
    expect(store[REMOTE_META_KEY]).toEqual(meta);
  });
  it('keeps the current list when the download is the same version', async () => {
    expect((await refreshRules(respond(clone(BUNDLED_RULES)))).lastResult).toBe('up-to-date');
    expect(store[REMOTE_KEY]).toBeUndefined();
  });
  it('rejects invalid downloads', async () => {
    expect((await refreshRules(respond(newer((r) => (r.regex = [{ id: 'x', pattern: '(' }]))))).lastResult).toBe('invalid');
    expect(store[REMOTE_KEY]).toBeUndefined();
  });
  it('reports network/HTTP errors without throwing', async () => {
    expect((await refreshRules(respond('not found', 404))).lastResult).toBe('error');
    expect((await refreshRules(respond('{not json'))).lastResult).toBe('error');
  });
});
