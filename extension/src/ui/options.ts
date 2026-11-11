import { createMatcher } from '../core/matcher';
import { BUNDLED_RULES } from '../core/rules';
import { SITE_IDS, SITE_LABELS, loadSettings, parseList, saveSettings, type Settings } from '../core/settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main(): Promise<void> {
  let settings: Settings = await loadSettings();
  if (new URLSearchParams(location.search).has('welcome')) $('welcome').hidden = false;

  const saved = $('saved');
  let savedTimer = 0;
  const save = async (next: Settings) => {
    settings = next;
    await saveSettings(settings);
    saved.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => saved.classList.remove('show'), 1200);
    runTest();
  };

  // Toggles
  for (const key of ['enabled', 'pageShield', 'blockSites', 'includeOlderGta'] as const) {
    const el = $<HTMLInputElement>(key);
    el.checked = settings[key];
    el.addEventListener('change', () => void save({ ...settings, [key]: el.checked }));
  }

  // Action
  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="action"]')) {
    radio.checked = radio.value === settings.action;
    radio.addEventListener('change', () => {
      if (radio.checked) void save({ ...settings, action: radio.value === 'blur' ? 'blur' : 'hide' });
    });
  }

  // Sites
  const sitesEl = $('sites');
  for (const id of SITE_IDS) {
    const label = document.createElement('label');
    label.className = 'switch';
    const span = document.createElement('span');
    span.className = 'label';
    span.textContent = SITE_LABELS[id];
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.checked = settings.sites[id];
    input.addEventListener('change', () => void save({ ...settings, sites: { ...settings.sites, [id]: input.checked } }));
    label.append(span, input);
    sitesEl.appendChild(label);
  }

  // Lists (saved after typing stops)
  for (const key of ['customKeywords', 'allowlist'] as const) {
    const ta = $<HTMLTextAreaElement>(key);
    ta.value = settings[key].join('\n');
    let t = 0;
    ta.addEventListener('input', () => {
      clearTimeout(t);
      t = window.setTimeout(() => void save({ ...settings, [key]: parseList(ta.value) }), 500);
    });
  }

  // Tester
  const tester = $<HTMLInputElement>('tester');
  const result = $('testResult');
  function runTest(): void {
    const v = tester.value.trim();
    if (!v) {
      result.textContent = '';
      result.className = 'result';
      return;
    }
    const match = createMatcher(BUNDLED_RULES, {
      customKeywords: settings.customKeywords,
      allowlist: settings.allowlist,
      includeOlderGta: settings.includeOlderGta,
    });
    const reason = match(v);
    result.className = `result ${reason ? 'block' : 'allow'}`;
    result.textContent = reason ? `Hidden (${reason.replace(':', ': ')})` : 'Shown';
  }
  tester.addEventListener('input', runTest);
}

void main();
