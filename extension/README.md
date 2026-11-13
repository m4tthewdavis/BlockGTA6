# Safehouse – Spoiler Blocker (browser extension)

Hides GTA 6 / GTA VI videos, posts and search results on **YouTube, Google, Bing, DuckDuckGo,
Reddit and X**, plus **TikTok, Instagram, Facebook and Twitch** (beta). One Manifest V3 codebase builds for **Chrome / Edge / Brave / Opera** and
**Firefox (desktop + Android)**.

## How it works

| Layer | File | What it does |
|---|---|---|
| YouTube data filter | `src/main/youtube-main.ts`, `src/main/yt-filter.ts` | Runs in YouTube's page (MAIN world) at `document_start`. Removes GTA 6 items from `ytInitialData` and every `/youtubei/v1/{browse,search,next,guide,…}` response **before YouTube renders them**, so nothing flashes on screen. Also reads the player data to know instantly whether the video you opened is about GTA 6. |
| Page scanner | `src/content/scanner.ts`, `src/content/adapters.ts` | Catches everything else: on-page cards (comments, Shorts, Reddit posts, tweets, search results). Re-checks recycled elements. Hides or blurs. No `innerHTML` (YouTube enforces Trusted Types). |
| Page shield | `src/content/shield.ts` | If you open a GTA 6 video, post or tweet directly, it covers the page, pauses media and offers *Go back* / *Show anyway*. |
| Website blocking | `src/background/dnr.ts` | `declarativeNetRequest` rules: r/GTA6, r/GTAVI and Rockstar's `/VI` page redirect to the Safehouse block page. Hosts like `gta6….com` are blocked. |
| Blocklist updates | `src/core/rules-store.ts` | Every 3 h the background downloads `rules/rules.json` from the repo's `main` branch, validates it strictly (data only) and uses it if its `version` is newer. Options page: version + *Check now*. |
| Matcher | `src/core/matcher.ts` | Implements the shared algorithm in [`../rules/README.md`](../rules/README.md) using [`../rules/rules.json`](../rules/rules.json). |

Settings (popup + options page) are kept in `chrome.storage.sync`. **Nothing leaves the device.**

## Develop

```bash
npm install
npm run typecheck
npm test             # unit tests: shared test vectors, YouTube JSON filter, site-blocking rules
npm run build        # -> dist/chrome and dist/firefox
npm run e2e          # loads dist/chrome in Chromium against offline copies of YouTube/Google/Reddit/X
npm run package      # build + dist/safehouse-{chrome,firefox}-<version>.zip
npm run source       # dist/safehouse-source-<version>.zip for Firefox review (committed files)
node tools/store-assets.mjs   # regenerate ../store/images (needs a build first)
```

`npm run e2e` and `node tools/make-icons.mjs` use a globally installed Playwright with Chromium.

### Try it in your browser
- **Chrome/Edge/Brave:** open `chrome://extensions` → turn on *Developer mode* → *Load unpacked* →
  pick `extension/dist/chrome`.
- **Firefox:** open `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → pick
  `extension/dist/firefox/manifest.json`.

## Before submitting to the stores
See **[`../store/README.md`](../store/README.md)** for the full checklist, listing text and privacy policy.

1. **Check against the live sites.** The automated tests use offline copies of each page (the
   build machine couldn't reach YouTube/Google/Reddit/X). Load the extension and check:
   - YouTube home, search, a watch page, Shorts and comments
   - a Google search for "gta 6"
   - Reddit home and a post
   - X home and a tweet

   Fix any selectors in `src/content/adapters.ts`.
2. `npm run package`.
3. **Chrome Web Store:** upload `safehouse-chrome-<v>.zip`.
   - Single purpose: "Hide GTA 6 content and spoilers."
   - Permissions: `storage` saves settings; `declarativeNetRequest` blocks GTA 6 websites; host
     access is needed to hide content on the supported sites.
   - Data usage: none collected.
4. **Firefox Add-ons:** upload `safehouse-firefox-<v>.zip`. Because the code is bundled, also
   upload a source zip of the repo (with `rules/` and `docs/`) and the build steps above.
5. **Edge Add-ons:** the Chrome zip works as-is.
6. **Store name** "Safehouse – Spoiler Blocker". Keep "GTA" out of the name and short description
   title, and include the no-affiliation line (see `PLAN.md` §0c).

## Not done yet
- Live-site verification of all selectors (especially the beta sites).
- Safari (macOS/iOS) build through Xcode's `safari-web-extension-converter`. On Safari the MAIN-world
  script must be registered with `scripting.registerContentScripts`.
- Thumbnail image recognition.
