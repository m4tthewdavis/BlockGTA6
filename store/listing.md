# Store listing: Safehouse – Spoiler Blocker

Copy and paste into each store. Keep **"GTA" out of the name and title fields** (trademark
rules; see `PLAN.md` §0c). It's fine to mention it in the description as a description of what
the extension blocks.

## Name
`Safehouse – Spoiler Blocker`

## Short description / summary
(Chrome: max 132 characters, already in the manifest. Firefox summary: max 250.)

> Your safehouse from spoilers. Hides GTA 6 / GTA VI videos, posts and search results. Unofficial, not affiliated with Rockstar Games.

## Full description

> **Stay spoiler-free until you play.**
>
> Safehouse hides GTA 6 / GTA VI content across the web: trailers, leaks, news, memes, gameplay and spoilers. Older GTA games (GTA 5, GTA Online, the original Vice City) stay visible, so you can still enjoy them.
>
> **Where it works**
> • YouTube: videos, Shorts, channels, comments, "Up next", end screens. Items are removed before the page draws, so nothing flashes on screen.
> • Google, Bing and DuckDuckGo search results
> • Reddit posts and comments
> • X (Twitter) posts and trends
> • TikTok, Instagram, Facebook and Twitch (beta)
>
> **What it does**
> • Hides matching items, or blurs them so you can click to reveal
> • Covers the page if you open a GTA 6 video, post or stream directly, and pauses the video. Then you choose: go back or show anyway
> • Blocks GTA 6 communities and fan sites
> • Catches tricky spellings: GTA VI, G.T.A. 6, #GTA6Trailer, character and place names
> • Lets you add your own keywords and phrases that are never hidden
> • Updates its keyword list automatically as new names appear
>
> **Private by design**
> Everything runs on your device. Safehouse collects no data, has no accounts and no tracking. The only thing it downloads is its public keyword list.
>
> **On your phone?** Safehouse includes a 5-minute guide to muting GTA 6 in the TikTok, X, Threads, Instagram, YouTube and Reddit apps.
>
> Safehouse is an independent project, not affiliated with, endorsed by or connected to Rockstar Games or Take-Two Interactive. "GTA" and "Grand Theft Auto" are trademarks of Take-Two Interactive.

## Category
- Chrome Web Store: **Productivity → Tools** (or **Lifestyle → Entertainment**)
- Firefox Add-ons: **Social & Communication** (optionally also **Feeds, News & Blogging**)
- Edge Add-ons: **Productivity**

## Images (in `store/images/`)
| File | Use |
|---|---|
| `1-feed.png`, `2-cover.png`, `3-settings.png`, `4-blocked.png` | Screenshots (1280×800) for all stores |
| `promo-440x280.png` | Chrome "small promo tile" |
| `extension/icons/icon-128.png` | Store icon |

Screenshots show illustrative mock pages, not real site content or game art. Regenerate with
`cd extension && npm run build && node tools/store-assets.mjs`.

## Chrome Web Store: privacy tab
- **Single purpose:** "Hide GTA 6 / GTA VI content and spoilers on websites the user visits."
- **Permission justifications**
  - `storage`: Saves the user's settings and the latest keyword list.
  - `declarativeNetRequest`: Blocks or redirects websites that are entirely about GTA 6 (e.g. r/GTA6) to a local block page.
  - `alarms`: Checks for an updated keyword list every few hours.
  - Host permissions: Needed to hide GTA 6 items on the supported sites (YouTube, Google, Bing, DuckDuckGo, Reddit, X, TikTok, Instagram, Facebook, Twitch) and to redirect Rockstar's GTA VI page. Page content is processed locally and never transmitted.
- **Remote code:** **No.** The extension downloads a JSON keyword list (data only); all logic ships in the package.
- **Data usage:** collects **none** of the listed data types. Tick all three certifications.
- **Privacy policy URL:** a public link to `store/privacy-policy.md` (see the checklist).

## Firefox Add-ons (AMO)
- **Source code:** required, because the code is bundled by esbuild. Upload
  `extension/dist/safehouse-source-<version>.zip` (`npm run source`), with these reviewer notes:
  > Build: Node 22. `cd extension && npm ci && npm run build`. Output: `extension/dist/firefox`. The bundle is not minified. `rules/rules.json` is data only; it's bundled and may be updated from raw.githubusercontent.com (validated, data-only).
- **Data collection:** none (the manifest declares `data_collection_permissions: none`).
- **License:** choose one (see the checklist).
