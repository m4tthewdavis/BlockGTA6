import type { Matcher } from '../core/matcher';
import type { Action } from '../core/settings';
import type { Adapter, CardRule } from './adapters';

const ATTR = 'data-safehouse';
const MAX_TEXT = 5000;

/**
 * NOTE: YouTube enforces Trusted Types, and in Safari that applies even to extension scripts.
 * Never use innerHTML/outerHTML/insertAdjacentHTML anywhere in content scripts.
 */
export const SCANNER_CSS = `
[${ATTR}="hide"] { display: none !important; }
[${ATTR}="blur"] {
  position: relative !important;
  cursor: pointer !important;
  user-select: none !important;
  color: transparent !important;
  text-shadow: 0 0 12px rgba(127, 127, 127, .9) !important;
}
[${ATTR}="blur"] > * { filter: blur(14px) grayscale(1) !important; pointer-events: none !important; }
[${ATTR}="blur"]::after {
  content: "Hidden by Safehouse";
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  max-width: 92%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 6px 12px; border-radius: 999px; z-index: 1; pointer-events: none;
  background: rgba(15, 23, 32, .88); color: #f2efe8; text-shadow: none;
  font: 600 12px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
`;

function cardText(el: Element, rule: CardRule): string {
  const parts: string[] = [];
  if (rule.text) {
    el.querySelectorAll(rule.text).forEach((n) => parts.push(n.textContent ?? ''));
  } else {
    parts.push(el.textContent ?? '');
  }
  for (const a of ['aria-label', 'title', 'post-title']) {
    const v = el.getAttribute(a);
    if (v) parts.push(v);
  }
  if (!rule.text) {
    // Titles often live in attributes of descendants (thumbnail links, images).
    let n = 0;
    el.querySelectorAll('[aria-label], [title], img[alt]').forEach((d) => {
      if (n++ > 20) return;
      const v = d.getAttribute('aria-label') ?? d.getAttribute('title') ?? d.getAttribute('alt');
      if (v) parts.push(v);
    });
  }
  return parts.join(' \n ').slice(0, MAX_TEXT);
}

/**
 * Finds cards on the page, checks their text and hides/blurs the matching ones.
 * Re-checks cards whose text changed (YouTube recycles elements when you navigate).
 */
export class Scanner {
  private lastText = new WeakMap<Element, string>();
  /** target element -> the card that caused it to be hidden */
  private hiddenBy = new WeakMap<Element, Element>();
  private hidden = new Set<Element>();
  private revealed = new WeakSet<Element>();
  private observer: MutationObserver | null = null;
  private scheduled = false;

  constructor(
    private adapter: Adapter,
    private match: Matcher,
    private action: Action,
    private onCountChange: (count: number) => void,
  ) {}

  get count(): number {
    return this.hidden.size;
  }

  start(): void {
    this.injectStyle();
    document.addEventListener('click', this.onClick, true);
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    this.scan();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener('click', this.onClick, true);
    for (const el of this.hidden) el.removeAttribute(ATTR);
    this.hidden.clear();
    this.lastText = new WeakMap();
    this.onCountChange(0);
  }

  /** Apply new settings: unhide everything and check again. */
  update(match: Matcher, action: Action): void {
    this.match = match;
    this.action = action;
    for (const el of this.hidden) el.removeAttribute(ATTR);
    this.hidden.clear();
    this.lastText = new WeakMap();
    this.scan();
  }

  private injectStyle(): void {
    if (document.getElementById('safehouse-style')) return;
    const style = document.createElement('style');
    style.id = 'safehouse-style';
    style.textContent = SCANNER_CSS;
    (document.head ?? document.documentElement).appendChild(style);
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    setTimeout(() => {
      this.scheduled = false;
      this.scan();
    }, 120);
  }

  scan(): void {
    const before = this.hidden.size;
    for (const rule of this.adapter.cards) {
      let nodes: NodeListOf<Element>;
      try {
        nodes = document.querySelectorAll(rule.sel);
      } catch {
        continue; // invalid selector in this browser
      }
      nodes.forEach((el) => this.check(el, rule));
    }
    // Forget elements that were removed from the page.
    for (const el of this.hidden) if (!el.isConnected) this.hidden.delete(el);
    if (this.hidden.size !== before) this.onCountChange(this.hidden.size);
  }

  private check(el: Element, rule: CardRule): void {
    const t = cardText(el, rule);
    if (this.lastText.get(el) === t) return;
    this.lastText.set(el, t);

    const target = (rule.hide ? el.closest(rule.hide) : null) ?? el;
    const reason = this.match(t);
    if (reason) {
      if (this.revealed.has(target)) return;
      target.setAttribute(ATTR, this.action);
      target.setAttribute(`${ATTR}-reason`, reason);
      if (this.action === 'blur') target.setAttribute('title', 'Hidden by Safehouse. Click to show.');
      this.hiddenBy.set(target, el);
      this.hidden.add(target);
    } else if (this.hiddenBy.get(target) === el) {
      // This card was recycled with different content: show it again.
      target.removeAttribute(ATTR);
      target.removeAttribute(`${ATTR}-reason`);
      this.hiddenBy.delete(target);
      this.hidden.delete(target);
    }
  }

  private onClick = (e: MouseEvent): void => {
    const t = e.target instanceof Element ? e.target.closest(`[${ATTR}="blur"]`) : null;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    t.removeAttribute(ATTR);
    t.removeAttribute('title');
    this.revealed.add(t);
    this.hidden.delete(t);
    this.onCountChange(this.hidden.size);
  };
}
