/**
 * Full-page cover shown when the user opens a GTA 6 video/post directly.
 * Built with DOM APIs only (no innerHTML: YouTube enforces Trusted Types) inside a closed
 * shadow root, so the page's CSS can't affect it.
 */
const CSS = `
:host { all: initial; }
.wrap {
  position: fixed; inset: 0; z-index: 2147483647;
  display: flex; align-items: center; justify-content: center;
  background: #0f1720; color: #f2efe8;
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.card { max-width: 440px; padding: 32px 24px; text-align: center; }
.icon { width: 72px; height: 72px; margin: 0 auto 16px; }
h1 { font-size: 24px; margin: 0 0 8px; font-weight: 700; }
p { margin: 0 0 24px; color: #b9c2cc; }
.row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
button {
  font: inherit; border-radius: 10px; padding: 10px 18px; cursor: pointer; border: 1px solid #3a4756;
  background: transparent; color: #f2efe8;
}
button.primary { background: #f5c451; border-color: #f5c451; color: #1b1405; font-weight: 600; }
button:focus-visible { outline: 3px solid #8ab4f8; outline-offset: 2px; }
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** The Safehouse mark: a house with a lit window and closed shutters. */
export function houseIcon(size = 72): SVGElement {
  const root = svg('svg', { viewBox: '0 0 64 64', width: String(size), height: String(size), 'aria-hidden': 'true' });
  root.appendChild(svg('path', { d: 'M32 8 6 30h7v24h38V30h7L32 8z', fill: '#f2efe8' }));
  root.appendChild(svg('rect', { x: '25', y: '32', width: '14', height: '12', rx: '1.5', fill: '#f5c451' }));
  root.appendChild(svg('rect', { x: '18', y: '32', width: '6', height: '12', rx: '1', fill: '#3a4756' }));
  root.appendChild(svg('rect', { x: '40', y: '32', width: '6', height: '12', rx: '1', fill: '#3a4756' }));
  return root;
}

export class PageShield {
  private host: HTMLElement | null = null;
  private pauseTimer: number | null = null;
  private allowed = new Set<string>();
  shownFor: string | null = null;

  isAllowed(key: string): boolean {
    return this.allowed.has(key);
  }

  show(key: string): void {
    if (this.shownFor === key && this.host?.isConnected) return;
    this.hide();
    this.shownFor = key;

    const host = document.createElement('safehouse-shield');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'sh-title');

    const card = document.createElement('div');
    card.className = 'card';
    const icon = houseIcon();
    icon.setAttribute('class', 'icon');
    const h1 = document.createElement('h1');
    h1.id = 'sh-title';
    h1.textContent = "You're in the Safehouse";
    const p = document.createElement('p');
    p.textContent = 'This page looks like GTA 6 content, so Safehouse covered it before you could see anything.';

    const row = document.createElement('div');
    row.className = 'row';
    const back = document.createElement('button');
    back.className = 'primary';
    back.textContent = 'Go back';
    back.addEventListener('click', () => {
      if (history.length > 1) history.back();
      else location.href = location.origin;
    });
    const show = document.createElement('button');
    show.textContent = 'Show anyway';
    show.addEventListener('click', () => {
      this.allowed.add(key);
      this.hide();
    });
    row.append(back, show);
    card.append(icon, h1, p, row);
    wrap.appendChild(card);
    root.appendChild(wrap);

    document.documentElement.appendChild(host);
    this.host = host;
    back.focus({ preventScroll: true });

    document.addEventListener('play', this.onPlay, true);
    this.pauseAll();
    this.pauseTimer = window.setInterval(() => this.pauseAll(), 400);
  }

  hide(): void {
    this.shownFor = null;
    this.host?.remove();
    this.host = null;
    document.removeEventListener('play', this.onPlay, true);
    if (this.pauseTimer !== null) clearInterval(this.pauseTimer);
    this.pauseTimer = null;
  }

  private onPlay = (e: Event): void => {
    if (e.target instanceof HTMLMediaElement) e.target.pause();
  };

  private pauseAll(): void {
    document.querySelectorAll('video, audio').forEach((m) => {
      const media = m as HTMLMediaElement;
      if (!media.paused) media.pause();
    });
  }
}
