import type { SiteId } from '../core/settings';

/**
 * A "card" is one item in a feed or list (a video, a post, a search result, a comment).
 * Selectors are deliberately simple and based on semantic tags / data-testid attributes rather
 * than obfuscated class names. Sites redesign often: keep this file the single place to fix them.
 */
export interface CardRule {
  /** Elements to check. */
  sel: string;
  /** Optional: only read text from these descendants (relative to the card; `:scope >` allowed). */
  text?: string;
  /** Optional: hide the closest ancestor matching this instead of the card itself. */
  hide?: string;
}

export interface Adapter {
  id: SiteId;
  /** Matched against location.hostname. */
  host: RegExp;
  cards: CardRule[];
  /** True for URLs that show a single item full-screen (watch page, post page, tweet page). */
  pageGuard?: (url: URL) => boolean;
  /** Text describing the single item on a guarded page (defaults to document.title). */
  pageText?: () => string;
}

const text = (sel: string): string =>
  Array.from(document.querySelectorAll(sel))
    .map((e) => e.textContent ?? '')
    .join(' ');

export const ADAPTERS: Adapter[] = [
  {
    id: 'youtube',
    host: /(^|\.)youtube\.com$/,
    cards: [
      // Desktop (www.youtube.com)
      { sel: 'ytd-rich-item-renderer' },
      { sel: 'yt-lockup-view-model', hide: 'ytd-rich-item-renderer' },
      { sel: 'ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2', hide: 'ytd-rich-item-renderer' },
      { sel: 'ytd-video-renderer' },
      { sel: 'ytd-compact-video-renderer' },
      { sel: 'ytd-grid-video-renderer' },
      { sel: 'ytd-reel-item-renderer' },
      { sel: 'ytd-playlist-renderer, ytd-compact-playlist-renderer' },
      { sel: 'ytd-radio-renderer, ytd-compact-radio-renderer' },
      { sel: 'ytd-channel-renderer' },
      { sel: 'ytd-movie-renderer' },
      { sel: 'ytd-universal-watch-card-renderer' },
      { sel: 'ytd-post-renderer, ytd-backstage-post-thread-renderer' },
      { sel: 'ytd-playlist-panel-video-renderer' },
      { sel: 'ytd-notification-renderer' },
      { sel: 'yt-chip-cloud-chip-renderer' },
      { sel: 'ytd-comment-view-model, ytd-comment-renderer', text: '#content-text', hide: 'ytd-comment-thread-renderer' },
      // Player end screen + end cards
      { sel: '.ytp-videowall-still', text: '.ytp-videowall-still-info-title, .ytp-videowall-still-info-author' },
      { sel: '.ytp-ce-element' },
      // Mobile (m.youtube.com)
      { sel: 'ytm-rich-item-renderer' },
      { sel: 'ytm-video-with-context-renderer' },
      { sel: 'ytm-compact-video-renderer' },
      { sel: 'ytm-video-card-renderer' },
      { sel: 'ytm-reel-item-renderer' },
      { sel: 'ytm-compact-playlist-renderer' },
      { sel: 'ytm-media-item' },
      { sel: 'ytm-post-renderer, ytm-backstage-post-thread-renderer' },
      { sel: 'ytm-comment-thread-renderer', text: '.comment-text, .user-text' },
    ],
    pageGuard: (u) => u.pathname === '/watch' || u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/live/'),
    pageText: () =>
      [
        text('ytd-watch-metadata #title h1, ytd-watch-metadata h1'),
        text('ytm-slim-video-metadata-section-renderer h2, .slim-video-information-title'),
        document.title,
      ].join(' \n '),
  },
  {
    id: 'google',
    host: /(^|\.)google\.[a-z.]+$/,
    cards: [
      { sel: '#search a h3', hide: '#rso [data-hveid], #rso div.g' },
      { sel: '#rso div.g' },
      { sel: 'g-inner-card' },
      { sel: '.related-question-pair' },
      { sel: '#search div[role="listitem"]' },
      { sel: '#rhs', text: 'h2, [data-attrid="title"]' },
      { sel: '#botstuff a[href*="/search?"]' },
    ],
  },
  {
    id: 'bing',
    host: /(^|\.)bing\.com$/,
    cards: [
      { sel: 'li.b_algo' },
      { sel: 'li.b_ans' },
      { sel: '.news-card' },
      { sel: '.b_rich .slide' },
    ],
  },
  {
    id: 'duckduckgo',
    host: /(^|\.)duckduckgo\.com$/,
    cards: [
      { sel: 'article[data-testid="result"]', hide: 'li' },
      { sel: 'li[data-layout="organic"]' },
      { sel: '.module--carousel__item' },
    ],
  },
  {
    id: 'reddit',
    host: /(^|\.)reddit\.com$/,
    cards: [
      // New Reddit ("shreddit")
      { sel: 'shreddit-post', hide: 'article' },
      { sel: 'shreddit-comment', text: ':scope > [slot="comment"]' },
      { sel: 'a[data-testid="post-title"], a[data-testid="post-title-text"]', hide: 'search-telemetry-tracker, [data-testid="search-post-unit"], faceplate-tracker' },
      // Old Reddit
      { sel: 'div.thing.link', text: 'a.title, .linkflairlabel' },
      { sel: 'div.thing.comment', text: ':scope > .entry .usertext-body' },
    ],
    pageGuard: (u) => /\/comments\//.test(u.pathname),
    pageText: () => [text('shreddit-post [slot="title"], h1'), document.title].join(' \n '),
  },
  {
    id: 'x',
    host: /(^|\.)(x|twitter)\.com$/,
    cards: [
      { sel: 'article[data-testid="tweet"]', hide: '[data-testid="cellInnerDiv"]' },
      { sel: '[data-testid="trend"]' },
      { sel: '[data-testid="UserCell"]' },
    ],
    pageGuard: (u) => /\/status\/\d+/.test(u.pathname),
    pageText: () => document.title,
  },
];

export function adapterFor(hostname: string): Adapter | null {
  return ADAPTERS.find((a) => a.host.test(hostname)) ?? null;
}
