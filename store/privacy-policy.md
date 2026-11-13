# Safehouse – Privacy Policy

*Last updated: 13 November 2026*

Safehouse ("the extension") hides GTA 6 / GTA VI content in your browser. It is built to work
entirely on your device.

## What Safehouse does NOT do
- It does **not** collect, store or send your browsing history, the pages you visit, what you
  search for, or anything shown on those pages.
- It has **no** accounts, analytics, tracking, advertising or third-party SDKs.
- It does **not** sell or share any data, because it doesn't collect any.

## What stays on your device
- **Your settings** (on/off, hide or blur, which sites, your own keywords and "never hide" list)
  are saved in your browser's extension storage. If you're signed in to your browser with sync
  turned on, your browser may sync these settings between your own devices. That sync is run by
  your browser (Google, Mozilla, Microsoft), not by Safehouse.
- **Counts** of hidden items are kept only in memory, to show the number on the toolbar icon.

## The one network request Safehouse makes
Every few hours, Safehouse downloads its public blocklist (a list of GTA 6 keywords and names)
from `raw.githubusercontent.com` (GitHub). The request contains nothing about you: no cookies, no
identifiers, no browsing data. As with any web request, GitHub can see your IP address. See
GitHub's privacy statement.

## Permissions and why they're needed
| Permission | Why |
|---|---|
| Access to YouTube, Google, Bing, DuckDuckGo, Reddit, X, TikTok, Instagram, Facebook, Twitch | To find and hide GTA 6 items on those pages. Page content is checked on your device and never leaves it. |
| Access to rockstargames.com | To redirect Rockstar's GTA VI page to the Safehouse block page. |
| `declarativeNetRequest` | To block websites that are entirely about GTA 6. |
| `storage` | To save your settings and the latest blocklist. |
| `alarms` | To check for a newer blocklist every few hours. |

## Children
Safehouse doesn't collect personal information from anyone, including children.

## Changes
If this policy changes, the new version will be published at this address with a new date.

## Contact
Open an issue on the project's GitHub repository.

---
Safehouse is an independent project, not affiliated with, endorsed by or connected to Rockstar
Games or Take-Two Interactive. "GTA" and "Grand Theft Auto" are trademarks of Take-Two Interactive.
