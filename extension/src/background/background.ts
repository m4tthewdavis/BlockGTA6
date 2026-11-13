import { getEffectiveRules, onRulesChanged, refreshRules } from '../core/rules-store';
import { DEFAULT_SETTINGS, loadSettings, mergeSettings, onSettingsChanged, saveSettings, type Settings } from '../core/settings';
import type { RuntimeMessage } from '../shared/bridge';
import { FIRST_SESSION_ID, allowOnceRule, buildDnrRules } from './dnr';

const BADGE_COLOR = '#3a4756';

async function applySiteBlocking(s: Settings): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  const rules = await getEffectiveRules();
  const addRules = s.enabled && s.blockSites ? buildDnrRules(rules, chrome.runtime.getURL('blocked.html')) : [];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function init(): Promise<void> {
  const s = await loadSettings();
  await applySiteBlocking(s).catch((e) => console.error('Safehouse: could not apply site rules', e));
}

// ---- Blocklist updates (data only; see core/rules-store.ts) ----
const RULES_ALARM = 'safehouse-rules-refresh';
chrome.alarms.create(RULES_ALARM, { delayInMinutes: 1, periodInMinutes: 180 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === RULES_ALARM) void refreshRules();
});
onRulesChanged(() => void loadSettings().then(applySiteBlocking));

chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.sync.get('settings');
  if (!stored.settings) await saveSettings(DEFAULT_SETTINGS);
  else await saveSettings(mergeSettings(stored.settings));
  await init();
  if (details.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('options.html?welcome=1') }).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => void init());
onSettingsChanged((s) => void applySiteBlocking(s));

let nextSessionId = FIRST_SESSION_ID;

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, sender, sendResponse) => {
  if (msg.type === 'count' && sender.tab?.id !== undefined) {
    const tabId = sender.tab.id;
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR }).catch(() => {});
    chrome.action.setBadgeText({ tabId, text: msg.count > 0 ? String(Math.min(msg.count, 999)) : '' }).catch(() => {});
    return false;
  }
  if (msg.type === 'refreshRules') {
    refreshRules().then(sendResponse, (e) => sendResponse({ lastResult: 'error', error: String(e) }));
    return true;
  }
  if (msg.type === 'allowOnce' && typeof msg.url === 'string' && /^https?:\/\//.test(msg.url)) {
    const rule = allowOnceRule(nextSessionId++, msg.url);
    chrome.declarativeNetRequest
      .updateSessionRules({ addRules: [rule] })
      .then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async response
  }
  return false;
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
});

void init();
