import { SITE_LABELS, loadSettings, saveSettings, type SiteId } from '../core/settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main(): Promise<void> {
  let settings = await loadSettings();
  const enabled = $<HTMLInputElement>('enabled');
  const stateHint = $('stateHint');
  const siteLine = $('siteLine');
  const count = $('count');
  const siteSwitch = $('siteSwitch');
  const siteEnabled = $<HTMLInputElement>('siteEnabled');
  const siteLabel = $('siteLabel');

  const render = () => {
    enabled.checked = settings.enabled;
    stateHint.textContent = settings.enabled ? 'On for all supported sites' : 'Off: nothing is being hidden';
    document.body.classList.toggle('off', !settings.enabled);
  };
  render();

  enabled.addEventListener('change', async () => {
    settings = { ...settings, enabled: enabled.checked };
    render();
    await saveSettings(settings);
  });

  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return;
  try {
    const res = (await chrome.tabs.sendMessage(tab.id, { type: 'getCount' })) as { count: number; site: SiteId } | undefined;
    if (!res) throw new Error('no response');
    const site = res.site;
    siteLabel.textContent = `Protect ${SITE_LABELS[site]}`;
    siteEnabled.checked = settings.sites[site];
    siteSwitch.hidden = false;
    count.hidden = false;
    count.textContent = String(res.count);
    siteLine.textContent = res.count === 1 ? 'item hidden on this page' : 'items hidden on this page';
    siteLine.before(count);
    siteEnabled.addEventListener('change', async () => {
      settings = { ...settings, sites: { ...settings.sites, [site]: siteEnabled.checked } };
      await saveSettings(settings);
    });
  } catch {
    siteLine.textContent = "Safehouse doesn't filter this page. It works on YouTube, Google, Bing, DuckDuckGo, Reddit, X, TikTok, Instagram, Facebook and Twitch.";
  }
}

void main();
