import { createMatcher } from '../core/matcher';
import type { Rules } from '../core/rules';
import { REMOTE_META_KEY, getEffectiveRules, onRulesChanged, type RulesMeta } from '../core/rules-store';
import { SITE_IDS, SITE_LABELS, loadSettings, parseList, saveSettings, type Settings } from '../core/settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main(): Promise<void> {
  let settings: Settings = await loadSettings();
  let rules: Rules = await getEffectiveRules();
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
    const match = createMatcher(rules, {
      customKeywords: settings.customKeywords,
      allowlist: settings.allowlist,
      includeOlderGta: settings.includeOlderGta,
    });
    const reason = match(v);
    result.className = `result ${reason ? 'block' : 'allow'}`;
    result.textContent = reason ? `Hidden (${reason.replace(':', ': ')})` : 'Shown';
  }
  tester.addEventListener('input', runTest);

  // Blocklist version / updates
  const info = $('rulesInfo');
  const btn = $<HTMLButtonElement>('checkRules');
  const RESULT: Record<RulesMeta['lastResult'], string> = {
    updated: 'updated',
    'up-to-date': 'up to date',
    invalid: 'download was invalid, kept the current list',
    error: "couldn't reach the update server",
  };
  async function showRulesInfo(): Promise<void> {
    const meta = (await chrome.storage.local.get(REMOTE_META_KEY))[REMOTE_META_KEY] as RulesMeta | undefined;
    const when = meta ? ` · last check ${new Date(meta.lastChecked).toLocaleString()}: ${RESULT[meta.lastResult]}` : '';
    info.textContent = `Version ${rules.version}${when}`;
  }
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await chrome.runtime.sendMessage({ type: 'refreshRules' });
    rules = await getEffectiveRules();
    await showRulesInfo();
    runTest();
    btn.disabled = false;
  });
  onRulesChanged((r) => {
    rules = r;
    void showRulesInfo();
    runTest();
  });
  void showRulesInfo();
}

void main();
