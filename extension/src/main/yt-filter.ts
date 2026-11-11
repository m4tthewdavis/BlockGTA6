/**
 * Removes matching items from YouTube's internal JSON (ytInitialData and /youtubei/v1/* responses)
 * before YouTube renders them, so nothing flashes on screen.
 *
 * Written from scratch. The list of item types worth checking was informed by studying how
 * existing filters work, but no third-party code is used.
 */

/** Array elements whose single top-level key is one of these are individual "items" we can drop. */
export const ITEM_KEYS = new Set([
  // Feed / home / related / search
  'richItemRenderer',
  'lockupViewModel',
  'videoRenderer',
  'compactVideoRenderer',
  'gridVideoRenderer',
  'videoWithContextRenderer',
  'playlistRenderer',
  'compactPlaylistRenderer',
  'gridPlaylistRenderer',
  'radioRenderer',
  'compactRadioRenderer',
  'movieRenderer',
  'compactMovieRenderer',
  'channelRenderer',
  'gridChannelRenderer',
  'universalWatchCardRenderer',
  'searchRefinementCardRenderer',
  // Shorts
  'reelItemRenderer',
  'shortsLockupViewModel',
  // Community posts
  'postRenderer',
  'backstagePostThreadRenderer',
  'backstagePostRenderer',
  'sharedPostRenderer',
  // Watch page side panels / end screens
  'playlistPanelVideoRenderer',
  'endScreenVideoRenderer',
  'endScreenPlaylistRenderer',
  // Topic chips ("GTA 6" chip at the top of Home)
  'chipCloudChipRenderer',
  // Notifications
  'notificationRenderer',
]);

/** Object properties that hold a single item (not inside an array). */
const DROP_OBJECT_KEYS = new Set(['playerOverlayAutoplayRenderer']);

/** Only strings under these keys count as "visible text" of an item. */
const TEXT_KEYS = new Set([
  'text',
  'simpleText',
  'content',
  'title',
  'label',
  'accessibilityText',
  'videoTitle',
  'headline',
  'descriptionSnippet',
]);

const MAX_TEXT = 4000;

function collectText(node: unknown, out: string[], budget: { left: number }, depth = 0): void {
  if (budget.left <= 0 || depth > 25 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const v of node) collectText(v, out, budget, depth + 1);
    return;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (typeof v === 'string') {
      if (TEXT_KEYS.has(k) && v.length) {
        out.push(v);
        budget.left -= v.length;
      }
    } else if (v && typeof v === 'object') {
      collectText(v, out, budget, depth + 1);
    }
  }
}

export function itemText(item: unknown): string {
  const out: string[] = [];
  collectText(item, out, { left: MAX_TEXT });
  return out.join(' \n ');
}

function itemKey(el: unknown): string | null {
  if (!el || typeof el !== 'object' || Array.isArray(el)) return null;
  for (const k of Object.keys(el)) if (ITEM_KEYS.has(k)) return k;
  return null;
}

/**
 * Mutates `data` in place. Returns the number of items removed.
 * `isBlocked` receives the visible text of one item.
 */
export function filterYouTubeData(data: unknown, isBlocked: (text: string) => boolean): number {
  let removed = 0;

  const walk = (node: unknown, depth: number): void => {
    if (depth > 80 || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        const el = node[i];
        const key = itemKey(el);
        if (key && isBlocked(itemText((el as Record<string, unknown>)[key]))) {
          node.splice(i, 1);
          removed++;
        } else {
          walk(el, depth + 1);
        }
      }
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (DROP_OBJECT_KEYS.has(k) && v && typeof v === 'object' && isBlocked(itemText(v))) {
        delete obj[k];
        removed++;
      } else {
        walk(v, depth + 1);
      }
    }
  };

  walk(data, 0);
  return removed;
}
