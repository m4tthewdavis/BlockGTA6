import type { RuntimeMessage } from '../shared/bridge';

// The block rule appends the original URL verbatim after '#'.
const raw = location.hash.slice(1);
const target = /^https?:\/\//.test(raw) ? raw : '';

const site = document.getElementById('site')!;
if (target) {
  try {
    site.textContent = `(${new URL(target).hostname})`;
  } catch {
    /* ignore */
  }
}

document.getElementById('back')!.addEventListener('click', () => {
  if (history.length > 1) history.back();
  else window.close();
});

const show = document.getElementById('show') as HTMLButtonElement;
if (!target) show.hidden = true;
show.addEventListener('click', async () => {
  show.disabled = true;
  const res = (await chrome.runtime.sendMessage({ type: 'allowOnce', url: target } satisfies RuntimeMessage)) as { ok: boolean } | undefined;
  if (res?.ok) location.replace(target);
  else show.disabled = false;
});
