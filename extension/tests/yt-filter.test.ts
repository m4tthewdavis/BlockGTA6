import { describe, expect, it } from 'vitest';
import home from './fixtures/yt-home.json';
import search from './fixtures/yt-search.json';
import next from './fixtures/yt-next.json';
import { createMatcher } from '../src/core/matcher';
import { BUNDLED_RULES } from '../src/core/rules';
import { filterYouTubeData, itemText } from '../src/main/yt-filter';

const match = createMatcher(BUNDLED_RULES);
const isBlocked = (t: string) => match(t) !== null;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const ids = (data: unknown): string[] =>
  [...JSON.stringify(data).matchAll(/"(?:videoId|contentId|entityId|channelId)":"([^"]+)"/g)].map((m) => m[1]);

describe('filterYouTubeData', () => {
  it('home feed: removes GTA 6 videos, Shorts, channel matches and topic chips; keeps the rest', () => {
    const d = clone(home);
    const removed = filterYouTubeData(d, isBlocked);
    expect(ids(d)).toEqual(['home2', 'short2', 'home3']);
    expect(removed).toBe(4); // home1, short1, home4 (matched via channel name), the topic chip
    expect(JSON.stringify(d)).not.toContain('Grand Theft Auto VI');
    expect(JSON.stringify(d)).toContain('Music');
    expect(JSON.stringify(d)).toContain('continuationItemRenderer');
  });

  it('search: removes videos, shorts and channels; keeps GTA 5 / Vice City 2002 content', () => {
    const d = clone(search);
    filterYouTubeData(d, isBlocked);
    expect(ids(d)).toEqual(['s2', 's4', 's6']);
  });

  it('watch page: removes related videos, the autoplay card and end-screen items', () => {
    const d = clone(next);
    filterYouTubeData(d, isBlocked);
    expect(ids(d)).toEqual(['n2', 'e2']);
    expect(JSON.stringify(d)).not.toContain('playerOverlayAutoplayRenderer');
  });

  it('does nothing when nothing matches', () => {
    const d = { contents: [{ videoRenderer: { title: { simpleText: 'Cooking 101' } } }] };
    expect(filterYouTubeData(d, isBlocked)).toBe(0);
    expect(d.contents).toHaveLength(1);
  });

  it('itemText only collects visible-text keys', () => {
    const t = itemText({ title: { runs: [{ text: 'Hello' }] }, navigationEndpoint: { url: '/watch?v=gta6' } });
    expect(t).toBe('Hello');
  });
});
