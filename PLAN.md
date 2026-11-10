# BlockGTA6 — Project Plan

Goal: one product that hides GTA 6 content (trailers, leaks, spoilers, news, memes) across
YouTube, social media and the web, on **desktop (Windows / macOS / Linux / ChromeOS)**,
**Android** and **iPhone / iPad**.

---

## 0. Research update (10 Nov 2026): what changed the plan

### ⏰ Timing: launch is 9 days away
- Rockstar's confirmed release date is **Thursday 19 Nov 2026** (PS5 / Xbox Series X|S), after
  delays from fall 2025 and then 26 May 2026. Pre-loading reportedly starts around **12 Nov**.
  No PC date has been announced; one outlet says 2027.
- So the spoiler flood starts in about a week and peaks over launch week and the following weeks.
  It will come back when the **PC version** launches (PC players will want to avoid spoilers for
  months), so there's long-term demand as well as an urgent launch window.
- **Effect on the plan:** see the revised roadmap in §8. Ship something useful *this week*
  (a mute-words setup guide + a desktop extension MVP), then build the mobile apps.

### 🏁 Competitors already exist (desktop only)
| Extension | Store | What it does |
|---|---|---|
| GTA 6 Spoiler Blocker | Chrome | Hides spoilers on YouTube, Reddit, Google (very few users/reviews) |
| Spoiler Shield for GTA 6 | Firefox | Blurs text, sentences and thumbnails; 38 built-in keywords you can extend |
| GTA6 Flamingo Away Spoilers | Chrome | YouTube, Reddit, X, Google "& beyond" |
| BlockTube (general) | Chrome/Firefox | Powerful keyword/channel filter for YouTube; the user writes their own rules |

**What sets BlockGTA6 apart:** (1) real **mobile** coverage (Android native apps, iOS Safari
+ Screen Time + guided mute words), (2) YouTube filtering *before the page renders*, so nothing
flashes on screen, (3) a carefully tuned keyword list with fewer false positives, and (4) one
setting that applies on every device.

### ⚖️ Licensing: don't copy BlockTube code
BlockTube is **GPL-3.0**. Copying its code would make our extension GPL too. GPL is widely considered incompatible with App Store terms (VLC was pulled from the
App Store in 2011 over exactly this), which is a problem for the iOS/macOS Safari build. **Use it only as a reference** (which
endpoints and JSON object names matter, §3.1) and write our own implementation from scratch.

### 🤖 Android: platform changes
- **Android 17 Advanced Protection Mode** (opt-in) **revokes Accessibility access** from any
  app that isn't flagged `isAccessibilityTool="true"`. Our blocker isn't an accessibility tool, so
  it **won't work for users who turn on Advanced Protection**. Detect this and explain it in the app.
- **Android 16** added `accessibilityDataSensitive` views, hidden from non-tool services.
  Feed content in YouTube/TikTok isn't normally marked this way, but test on each OS version.
- **Developer verification for sideloading:** from **30 Sep 2026**, certified devices in Brazil,
  Indonesia, Singapore and Thailand only install apps from *verified* developers, and this goes
  **global in 2027**. Unregistered APKs still install through ADB or a slow "advanced flow"
  (restart + 24 h wait). → **Register as a verified developer** even for the GitHub/F-Droid
  fallback build.
- **Browser extensions on Android:** Firefox for Android supports full extensions.
  **Edge for Android** now supports extensions, but only a **curated list (~20)**, so we can't
  count on being listed. Chrome for Android still has no extensions.

### 🍎 iOS: platform limits (stricter than first assumed)
- **`NEFilterDataProvider` (content filter network extension) is effectively unavailable** for a
  normal App Store app on an unmanaged iPhone. Apple DTS says it only works on supervised
  devices, per-app on managed devices, or Screen Time **child** devices. → Moved to
  "parental mode only" (§5).
- **Screen Time web blocking has small limits:**
  - `webContent.blockedByFilter = .specific(...)`: developers report 33 domains worked but
    101 blocked nothing (iOS 18), and one report says `.specific` didn't apply in Safari on iOS 26
    (it did in Chrome/Firefox).
  - It also **turns off Safari Private Browsing**.
  - `shield.webDomains` allows up to **50** domain tokens and gets a customisable shield screen.
  → Keep the domain list **short (≤ 30 high-value domains)** and test on real devices with each
  iOS version.
- **Family Controls (Distribution) entitlement:** request it at
  `developer.apple.com/contact/request/family-controls-distribution`. Reviewers judge whether the
  app is a *self-control tool* or surveillance, so frame it clearly as self-use spoiler protection.
  `requestAuthorization(for: .individual)` (iOS 16+) uses Face ID/Touch ID and **doesn't work
  in the Simulator**, so test on a device.
- **Orion browser (Kagi)** has *beta* support for Chrome/Firefox extensions on iPhone. This is a
  second iOS browser where our extension might work. Test it, but treat it as a bonus.

### 📱 Built-in mute features, checked
| App | Path (may vary by version/region) | Notes |
|---|---|---|
| **TikTok** | Settings and privacy → Content preferences → **Filter video keywords** | Up to ~200 keywords; "Smart Keyword Filters" also catch similar wording; per-feed (For You / Following). TikTok says it *reduces* rather than removes |
| **X** | Settings and privacy → Privacy and safety → Mute and block → **Muted words** | Home timeline and/or notifications; 24 h → forever. **May not cover search** |
| **Threads** | Settings → (Privacy or Content preferences) → **Hidden Words** | Now separate from Instagram; bulk add; 30-day timers; covers feed, search, profiles, replies |
| **Instagram** | Settings → Hidden Words | Mainly comments/DMs; limited effect on feed |
| **Reddit** | **No native keyword mute found**; only "mute community" | The extension has to do keyword filtering on Reddit |
| **YouTube** | "Not interested" / "Don't recommend channel"; pause watch/search history | No keyword mute |
| **Phone notifications** | iOS: Settings → Notifications → Show Previews → *Never*; Android: lock-screen "hide sensitive content" | A notification title can spoil the story without opening the app |

### 🔧 Technical findings
- **Chrome Web Store** policy explicitly allows "fetching a remote configuration file … for
  determining enabled features" as long as **all logic ships in the package**. Our
  `rules.json`/`selectors.json` must stay *declarative* (keywords, CSS selectors, JSON paths),
  never expressions that get evaluated.
- **YouTube endpoints and objects worth filtering** (from studying BlockTube): `fetch` calls to
  `/youtubei/v1/{browse,search,next,player,guide}`, plus the initial `ytInitialData` /
  `ytInitialPlayerResponse` page globals. Item types: `lockupViewModel` (the current
  home/related card), `shortsLockupViewModel`, `reelItemRenderer`, `videoRenderer`,
  `compactVideoRenderer`, `gridVideoRenderer`, `richItemRenderer` (container to drop when empty),
  `richShelfRenderer`/`shelfRenderer`, `postRenderer`/`backstagePostRenderer`,
  `commentViewModel`/`commentEntityPayload`, `endScreenVideoRenderer`, `playlistPanelVideoRenderer`,
  `liveChatTextMessageRenderer`, `chipCloudChipRenderer`.
- **Thumbnail detection (Phase 5)** can start with *zero-shot* CLIP/MobileCLIP through
  **Transformers.js v3**, no training needed. Prompts would be something like
  "a screenshot of Grand Theft Auto VI" vs. other labels. It runs in an MV3 **offscreen document**
  with `device: "webgpu"` (service workers can't use WebGPU) and falls back to WASM where WebGPU
  is behind a flag (Firefox/Safari).
- **Android in-app detection:** YouTube's view resource IDs change between app versions.
  Use `uiautomator dump` / Accessibility Scanner to map them, keep them in remote
  `selectors.json`, and prefer matching on *text* over IDs. Open-source reference:
  `atick-faisal/Shorts-Blocker` (accessibility service + auto "back").
- **Android notifications:** a `NotificationListenerService` can read incoming notifications and
  `cancelNotification(key)` the matching ones (e.g. "New video: GTA 6 ending explained"). It
  needs a separate user grant and should be checked against Play policy.

---

## 1. The core problem: every platform allows a different kind of blocking

No single technology works everywhere. The blocking you can do depends on the platform:

| Platform | Inside the browser | Inside native apps (YouTube app, TikTok, Instagram…) | How it works |
|---|---|---|---|
| Desktop (Chrome, Edge, Brave, Opera, Firefox, Safari) | ✅ Full keyword filtering | ⚠️ Very limited (most "apps" are websites anyway) | Browser extension |
| Android | ✅ Firefox for Android supports extensions | ✅ Possible, with limits | Accessibility Service app + extension |
| iOS / iPadOS | ✅ Safari Web Extension | ❌ Third-party apps cannot read or change another app's content | Safari extension + Screen Time "shields" + each app's built-in muted words |

HTTPS also rules out a simple "network filter that reads page text" approach. A VPN or DNS
filter only sees domain names (`youtube.com`), not which video you're watching. So the
**keyword filtering has to run where the content is shown**: in the browser page (extension)
or on the screen (Android accessibility).

So the product is **several small clients that share one rule set**:

```
                 ┌───────────────────────────────┐
                 │  Shared Rules (rules.json)     │  keywords, regexes, channel IDs,
                 │  + shared test vectors         │  domains, subreddits, hashtags
                 └──────────────┬────────────────┘
        ┌───────────────┬───────┴────────┬──────────────────┐
        ▼               ▼                ▼                  ▼
  Browser extension  Android app     iOS app            (later) Desktop
  (MV3, TypeScript)  (Kotlin)        (Swift)            companion (Tauri)
  Chrome/Edge/Brave  Accessibility   Safari Web Ext +   hosts/DNS block,
  Firefox (+Android) Service + VPN   Screen Time +      native messaging
  Safari (mac/iOS)   DNS blocker     mute-word setup    to extensions
```

---

## 2. Shared filter engine (the "brain")

### 2.1 Rules file (`rules/rules.json`)
Versioned JSON, bundled in every client and optionally refreshed from a hosted copy (e.g. the
GitHub raw URL or GitHub Pages). This is **data only, not code**, so it's allowed by the Chrome
Web Store's no-remote-code rule and by App Store review.

```jsonc
{
  "version": 1,
  "keywords": {
    "strong": [            // always block
      "gta 6", "gta6", "gta vi", "gtavi", "grand theft auto 6", "grand theft auto vi",
      "#gta6", "#gtavi", "gta 6 trailer", "gta6 leak"
    ],
    "unique": [            // GTA 6-specific names, safe to block on their own
      "jason duval", "lucia caminos", "port gellhorn", "grassrivers", "mount kalaga",
      "leonida keys", "leonida", "boobie ike", "dre'quan priest", "real dimez",
      "raul bautista", "brian heder", "cal hampton"
    ],
    "contextual": [        // block only if a GTA/Rockstar term is also present
      "vice city", "ambrosia", "jason and lucia", "lucia", "jason", "rockstar trailer",
      "trailer 3", "ending", "final mission", "leak"
    ]
  },
  "regex": [
    "\\bg\\.?\\s*t\\.?\\s*a\\.?\\s*(6|vi|six)\\b",          // "G.T.A. VI", "gta  six"
    "\\bgrand\\s*theft\\s*auto\\s*(6|vi|six)\\b"
  ],
  "channels": { "youtube": ["<Rockstar Games channel id>"] },
  "subreddits": ["GTA6", "GTAVI"],
  "domains": { "block": [], "pathBlock": ["rockstargames.com/VI"] },
  "allowlist": []           // user overrides, e.g. "gta 5"
}
```

### 2.2 Matching rules
- Normalise text first: lowercase, Unicode NFKC, strip accents/zero-width characters,
  convert lookalike digits and letters (`6`/`VI`/`six`, `Ⅵ`), collapse whitespace and punctuation.
- **Strong** and **unique** terms (e.g. "Jason Duval", "Port Gellhorn", "Grassrivers") block
  straight away. **Contextual** terms block only next to a GTA/Rockstar term, because
  "Vice City" on its own is also the 2002 game, "Ambrosia" is a common word and "Lucia" a common
  name. Names come from Rockstar's May 2025 character/location reveal. Refresh the list
  after launch, when many more names appear (shipping it as remote data makes that easy).
- **Decided (10 Nov):** the default scope is **all GTA 6 / GTA VI content**: trailers, news,
  leaks, memes, gameplay and spoilers alike. Older GTA games (GTA 5, GTA Online, the 2002 Vice
  City) are **not** blocked. Optional extras: "All GTA" (adds GTA 5/Online) and "Custom".
- Default action: **hide** the item completely. Options: **blur with a "click to reveal" shield**,
  or **block the page** (for direct links to a GTA 6 video or trailer).
- The Rockstar Games channel/accounts are **not** blocked wholesale, because they also post
  GTA Online/RDR content. Their GTA 6 posts are caught by the keyword match.

### 2.3 One spec, three implementations
The extension (TypeScript), Android (Kotlin) and iOS (Swift) each need a matcher. Keep it
small (about 150 lines). All three must pass the same `rules/test-vectors.json` (input text →
expected verdict), checked in CI, so the platforms never drift apart.
(Alternative: Kotlin Multiplatform or a Rust core shared over FFI. Probably not worth the
build complexity for a matcher this small.)

### 2.4 Later: thumbnails and images
Many leaks and memes show GTA 6 only in the thumbnail. Phase 5 adds an optional **on-device**
image classifier (a small model trained on GTA 6 key art, logos and screenshots):
TensorFlow.js/ONNX Runtime Web in the extension, Core ML on iOS, TFLite on Android.
Images never leave the device.

---

## 3. Client 1: Browser extension (desktop + Firefox Android + Safari)

**This is the MVP and covers most real-world use.** One Manifest V3 codebase built for:
- Chrome, Edge, Brave, Opera, Vivaldi (Chrome Web Store / Edge Add-ons)
- Firefox desktop **and Firefox for Android** (addons.mozilla.org)
- Safari on macOS **and iOS/iPadOS**, converted with Apple's `safari-web-extension-converter`
  and shipped inside the Mac/iOS app (Safari 17+ supports MV3)

Tech: TypeScript + Vite (or WXT/Plasmo, which handle multi-browser builds), with a
Preact/Svelte options page.

### 3.1 How blocking works on a page
1. **Data interception, before anything renders (YouTube).** The same idea as open-source
   [BlockTube](https://github.com/amitbl/blocktube) (GPL-3.0, used as a reference only; see §0):
   a main-world script (`"world": "MAIN"`, `run_at: document_start`) wraps `window.fetch` for
   `/youtubei/v1/{browse,search,next,player,guide}` and traps the `ytInitialData` /
   `ytInitialPlayerResponse` globals with property setters. It walks the JSON and removes
   matching items (`lockupViewModel`, `videoRenderer`, `reelItemRenderer`, … full list in §0),
   then drops `richItemRenderer`/shelf containers left empty. Nothing flashes on screen, and it's
   resistant to CSS class changes.
2. **DOM filtering (every site).** A `MutationObserver` scans new nodes (video cards, posts,
   tweets, search results, comments), pulls out the title, channel, hashtags and `alt`/`aria-label`
   text, runs the matcher, then hides or blurs the card.
   Per-site "adapters" say what counts as a card on each site.
3. **Network rules (`declarativeNetRequest`).** Redirect whole pages (e.g. `reddit.com/r/GTA6`,
   `rockstargames.com/VI`) to a friendly "Blocked by BlockGTA6" page.
4. **Watch-page guard.** If the user opens a YouTube/TikTok/X link straight to a GTA 6 video,
   pause the player and show the full-page shield.

### 3.2 Site adapters (priority order)
| Site | Cards to filter | Notes |
|---|---|---|
| YouTube (incl. Shorts, search, comments, end screens, Community posts) | JSON interception + DOM | Highest priority |
| Google / Bing / DuckDuckGo search, Google News, Discover-style feeds | Result blocks, Top stories, video carousels | |
| Reddit (new + old) | Posts, comments, subreddit pages | Subreddit block via DNR |
| X / Twitter | Tweets, trends, "What's happening" | Also offers to add X muted words |
| TikTok web | Feed items, captions, hashtags | |
| Instagram web, Facebook, Threads | Posts, Reels, captions | |
| Twitch | Stream cards with GTA 6 category/title | Category ID blocking |
| Generic (any site) | Headlines `h1–h3`, `article`, `og:title` | Opt-in, so it doesn't slow down every page |

**Selector resilience:** keep each adapter's CSS selectors in `rules/selectors.json`, which
updates the same way as `rules.json` (data, not code). When a site redesigns, a selector fix can
ship in hours instead of waiting for store review.

### 3.3 Extension UI
- Popup: on/off, "items hidden today" counter, quick "block this channel/account".
- Options: mode, custom keywords, allowlist, hide-vs-blur, per-site toggles, import/export.
- Optional **lock / commitment mode**: settings protected by a PIN, or a 24 h delay before you
  can turn it off. Useful if someone wants to stay spoiler-free until they play.
- `chrome.storage.sync` for settings, so they follow the user's browser account.

---

## 4. Client 2: Android app

Language: **Kotlin + Jetpack Compose**. Min SDK 26.

### 4.1 Accessibility Service (in-app filtering)
- An `AccessibilityService` set up for the target apps' package names
  (`com.google.android.youtube`, `com.zhiliaoapp.musically`/TikTok, `com.instagram.android`,
  `com.twitter.android`, `com.reddit.frontpage`, `com.facebook.katana`, Chrome, etc.).
- On `TYPE_WINDOW_CONTENT_CHANGED` / `TYPE_VIEW_SCROLLED`, walk the node tree, read titles and
  captions (`text`, `contentDescription`) and run the Kotlin matcher.
- On a match:
  - **Feed item** → draw an overlay (`TYPE_ACCESSIBILITY_OVERLAY`) over the item's on-screen bounds:
    "GTA 6 content hidden".
  - **Video/Short actually playing** → cover the screen and/or `performGlobalAction(GLOBAL_ACTION_BACK)`.
- Same approach that existing apps like AppBlock use to block YouTube Shorts and Instagram Reels.
- Performance: throttle events, cache verdicts per node text, process only the visible window.

### 4.2 Local DNS/VPN blocker (optional)
A `VpnService` that only answers DNS (no traffic inspection), blocking domains that are
*entirely* about GTA 6 (fan sites, leak sites). It can't see which YouTube video you're on,
so it's only a supplement.

### 4.3 Browsers on Android
- Firefox for Android → install the BlockGTA6 extension (best experience).
- Chrome Android has no extensions → the Accessibility Service covers Chrome as well
  (it reads the page through its accessibility tree).

### 4.4 Spoiler notifications
`NotificationListenerService`: read each new notification's title and text, run the matcher,
and `cancelNotification(key)` matching ones (YouTube "new upload", X/Reddit pushes, news apps).
Keep a "hidden notifications" log in the app so the user can review them later.

### 4.5 Compatibility checks
- Detect **Advanced Protection Mode** (Android 17+). Accessibility will be revoked, so offer
  the fallbacks instead: Firefox + extension, notification filter, and the mute-words checklist.
- Keep YouTube/TikTok/Instagram view IDs in remote `selectors.json` (data only). Prefer text
  matching, and re-map IDs with `uiautomator dump` whenever those apps update.

### 4.6 Play Store risk ⚠️
Google Play needs an **Accessibility API declaration** and a prominent in-app disclosure, and
reviews these apps closely. Mitigations:
- Process everything on the device, collect no data, and say exactly that in the disclosure
  and privacy policy.
- Frame it as a user-chosen content filter (similar to existing digital-wellbeing blockers).
- **Backup plan:** distribute the APK through GitHub Releases / F-Droid if Play rejects it.
  **Register as a verified Android developer** anyway. From 2027, certified phones worldwide
  block APKs from unverified developers (already enforced in BR/ID/SG/TH since 30 Sep 2026).

---

## 5. Client 3: iOS / iPadOS app

iOS is the most locked-down platform. **No third-party app can read or change what's shown
inside the YouTube, TikTok or Instagram apps.** The plan combines four layers:

1. **Safari Web Extension (main filter).** The same extension code as §3, bundled in the iOS
   app. Filters YouTube, Reddit, X and so on in Safari. The onboarding steers people to use
   these sites in Safari.
2. **Screen Time API (FamilyControls + ManagedSettings + DeviceActivity).**
   - Request `.individual` authorization (self-use, iOS 16+) or `.child` (parental use).
   - `ManagedSettingsStore.shield.webDomains` (≤ 50 domains, customisable shield screen) and/or
     `webContent.blockedByFilter` block whole GTA 6 fan/leak domains in browsers and web views.
     Known problems (§0): small domain limits, a report that `.specific` didn't apply in Safari on
     iOS 26, and Private Browsing gets turned off. Test both APIs on real devices and keep the list ≤ 30.
   - Optional **app shields**: the user can shield the YouTube/TikTok/X apps during
     "high-risk windows" (e.g. trailer drops, launch week) via `DeviceActivity` schedules, so
     they open those sites in filtered Safari instead.
   - Needs Apple's **Family Controls (Distribution) entitlement** to ship on TestFlight/App Store.
     Apply early. Developers also report problems applying very large domain lists, so keep the
     list short and focused.
3. **Guided "muted words" setup for native apps.** Most big apps have built-in keyword filters
   that *do* work inside their own app. The app gives a checklist with one-tap "copy keywords"
   and deep links:
   - X: Muted words (with "from anyone", "forever")
   - TikTok: Settings and privacy → Content preferences → Filter video keywords (with Smart Keyword Filters on)
   - Threads: Hidden Words (now separate from Instagram; 30-day timer option)
   - Instagram: Hidden Words
   - YouTube: "Don't recommend channel" for GTA 6 channels, plus clearing watch/search history
   - Reddit: Mute communities (r/GTA6 etc.); there's no native keyword mute
   - iOS notifications: Show Previews → Never for YouTube/X/Reddit until you've finished the game
   (See the table in §0. Check each path in-app before release; menu names change.)
4. **Orion browser (bonus).** Its beta support for Chrome/Firefox extensions on iOS may let the
   Chrome build of our extension run there too. Test it, and mention it if it works.
5. **Parental mode only: content-filter Network Extension (`NEFilterDataProvider`).** Apple
   only allows it on supervised devices, managed per-app setups, or Screen Time *child*
   devices (TN3134 / Apple DTS). That's not possible for a normal self-use install, so it's
   limited to a later "parent sets it up for a child" mode.

Language: **Swift + SwiftUI**. One Xcode project builds the iOS app, the iOS Safari extension
and the macOS app + macOS Safari extension.

---

## 6. (Later) Desktop companion app

The extension alone covers most desktop use. A small **Tauri** app (Rust + web UI, about 10 MB)
could add:
- One place to manage settings, pushed to every installed browser through **native messaging**.
- A check that the extension is installed in *every* browser on the machine, with prompts to add it.
- Optional hosts-file/DNS blocking of dedicated GTA 6 domains (system-wide).
- A PIN-protected "commitment mode" that's harder to bypass.

Native desktop apps like the Discord or Steam clients can't be keyword-filtered safely, so that's
out of scope (link to their own keyword/mute settings instead).

---

## 7. Repository layout

```
BlockGTA6/
├── rules/
│   ├── rules.json            # shared blocklist (data)
│   ├── selectors.json        # per-site CSS selectors for the extension (data)
│   └── test-vectors.json     # shared matcher test cases
├── extension/                # MV3 TypeScript (Chrome, Firefox, Safari builds)
│   ├── src/core/matcher.ts
│   ├── src/adapters/{youtube,reddit,x,tiktok,instagram,google,twitch,generic}.ts
│   ├── src/inject/yt-intercept.ts
│   ├── src/ui/{popup,options,blocked-page}
│   └── tests/ (Vitest unit + Playwright against saved HTML fixtures)
├── android/                  # Kotlin app: AccessibilityService, VPN DNS, Compose UI
├── apple/                    # Xcode: iOS app, macOS app, Safari extension targets
├── desktop/                  # (later) Tauri companion
├── docs/                     # privacy policy, store listings, setup guides
└── .github/workflows/        # CI: test vectors on all 3 matchers, builds, selector health check
```

---

## 8. Roadmap

**Revised for the 19 Nov launch (see §0).**

| Phase | Deliverable | Platforms covered | Est. effort* |
|---|---|---|---|
| **⚡ Launch sprint (10–19 Nov)** | (a) Publish a **"Spoiler-proof your phone in 5 minutes"** guide (GitHub Pages) with the copy-paste keyword list and the mute paths from §0. It works on iOS/Android **today** with zero code. (b) Ship a lean extension: matcher + YouTube JSON interception + Google/Reddit/X DOM adapters. Submit to Chrome and Firefox (AMO) by ~13 Nov to clear review before launch day. | Every phone (guide), desktop Chrome/Firefox, Firefox Android | ~1 week |
| **0. Foundation** (done inside the sprint) | `rules.json`, normaliser + matcher spec, test vectors, repo + CI | – | 2–3 days |
| **1. MVP extension** (hardening after launch) | Full YouTube coverage (Shorts, comments, end screens), blur-with-reveal, options page, remote rules updates | Chrome/Edge/Brave/Firefox desktop | 1–2 weeks |
| **2. Extension everywhere** | TikTok, Instagram, Facebook, Twitch, generic adapter; remote rules/selectors update; Firefox Android; Safari macOS + iOS builds | + Firefox Android, Safari Mac/iPhone | 1–2 weeks |
| **3. Android app** | Accessibility Service for YouTube/TikTok/Instagram/X/Reddit/Chrome; overlay shield; onboarding + disclosure; optional DNS VPN | Android native apps | 2–3 weeks |
| **4. iOS app** | Host app for Safari ext; Screen Time domain blocking + app shields + schedules; muted-words checklist | iPhone/iPad native layer | 2–3 weeks (+ entitlement wait) |
| **5. Polish** | Thumbnail image classifier, commitment/lock mode, desktop Tauri companion, localisation | All | ongoing |

\*One experienced developer. Store reviews (Chrome ~1–3 days, Apple ~1–2 days + Family
Controls entitlement approval, Google Play Accessibility review) come on top.

The Android and iOS apps can't realistically be approved before 19 Nov, but they're still
worthwhile: the spoiler period lasts weeks after launch, and comes back for the **PC release**
(not yet dated; one outlet says 2027).

---

## 9. Testing and maintenance
- **Matcher:** shared `test-vectors.json` runs in Vitest, JUnit and XCTest in CI. Include
  false-positive cases ("GTA 5 mods", "Vice City Stories", "Lucia Bosè").
- **Adapters:** Playwright tests against **saved HTML snapshots** of each site (stable). Plus a
  nightly **live "selector health check"** job that opens real pages and alerts when an adapter
  stops finding cards. Sites redesign often, and this is the main maintenance cost.
- **Android:** instrumented tests with recorded accessibility-tree dumps of each target app.
- **Manual device matrix:** latest iOS + previous, Android 10–16, Chrome/Firefox/Safari/Edge.

## 10. Privacy and store compliance
- **Everything runs on the device.** No browsing history, screen content or keywords are sent anywhere.
  The only network request is an optional download of the public `rules.json`.
- Use as few permissions as possible: host permissions only for supported sites (generic adapter opt-in).
- Clear privacy policy (required by all stores, especially for Accessibility and Screen Time).
- Rules/selectors updates are **JSON data only**. No remotely loaded scripts (Chrome MV3 and
  App Store rules).
- Don't use Rockstar/GTA logos or trademarked art in the app icon or store listing. Describe it
  as a "spoiler/content blocker for GTA 6" (descriptive use only).

## 11. Known limitations (to state honestly in the app)
- iOS native apps (YouTube, TikTok, Instagram) **can't** be keyword-filtered by any third-party
  app. Coverage there relies on Safari + app shields + each app's own muted-words feature.
- Images/videos with no GTA text (e.g. a re-uploaded clip called "insane trailer 🔥") get through
  until the Phase 5 image classifier.
- Site redesigns can break adapters for a while. Remote selector updates keep that window short.
- A determined user can uninstall the blocker; commitment mode only adds friction.

## 12. Immediate next steps (in order, starting 10 Nov)
1. ~~Decide the default mode and action~~ → **all GTA 6 content, hide** (decided 10 Nov).
2. **Today:** write `docs/mute-guide.md` (keyword list + per-app mute paths) and publish it with
   GitHub Pages. This is the fastest real protection for phones.
3. Create `rules/rules.json` + `rules/test-vectors.json` and the TypeScript matcher.
4. Build the MV3 extension: YouTube interception, then Google/Reddit/X adapters. Submit to the
   Chrome Web Store and AMO by ~13 Nov.
5. Start the developer accounts now, since approvals take time:
   - Apple Developer Program + Family Controls (Distribution) entitlement request
   - Google Play developer account + Android developer verification

---

### References
- BlockTube: open-source YouTube filter using JSON interception — https://github.com/amitbl/blocktube
- Apple Screen Time API (FamilyControls / ManagedSettings / DeviceActivity) — https://developer.apple.com/documentation/screentimeapidocumentation
- WWDC21 "Meet the Screen Time API" — https://developer.apple.com/wwdc21/10123
- Developer report on large domain lists with `webContent.blockedByFilter` — https://developer.apple.com/forums/thread/804684
- WWDC23 "What's new in Safari extensions" (MV3 on Safari 17) — https://developer.apple.com/videos/play/wwdc2023/10119
- Meet Safari Web Extensions on iOS (WWDC21 notes) — https://wwdcnotes.com/notes/wwdc21/10104
- Google Play Accessibility API policy — https://support.google.com/googleplay/android-developer/answer/10964491
- What AppBlock can block on Android (example of the Accessibility approach) — https://appblock.app/what-appblock-can-and-cannot-block-on-android/

**Added in the 10 Nov 2026 research pass**
- GTA 6 release date (19 Nov 2026) — https://www.thestatesman.com/entertainment/gta-6-release-date-when-is-grand-theft-auto-vi-coming-out-latest-updates-price-platforms-and-more-1503660757.html , https://www.gamepro.de/artikel/gta-6-release-live-ticker,3461296.html
- GTA 6 characters & locations — https://www.gematsu.com/2025/05/grand-theft-auto-vi-second-trailer-characters-and-places-detailed , https://insider-gaming.com/?p=115287
- Competitors — https://chromewebstore.google.com/detail/gta-6-spoiler-blocker/jeiicdjopelafmfokikmaimcfhdgamem , https://firefox.marketplace.browsertotal.com/en-CA/firefox/addon/spoiler-shield-for-gta-6/ , https://chromewebstore.google.com/detail/fjlphfamanblaepnmikmpmkcplnckipm
- Spoiler-avoidance tips (notifications etc.) — https://www.itechguides.com/how-to-avoid-gta-6-spoilers-on-youtube-x-reddit-and-google/
- Android 17 Advanced Protection vs. Accessibility — https://thehackernews.com/2026/03/android-17-blocks-non-accessibility.html , https://www.androidauthority.com/android-17-beta-2-advanced-protection-mode-accessibility-apps-3648860
- Android developer verification — https://android-developers.googleblog.com/2026/06/android-developer-verification.html , https://www.helpnetsecurity.com/2026/06/19/android-developer-verification-rollout-markets/ , https://www.androidauthority.com/how-to-bypass-android-developer-verification-sideloading-rules-3718002/
- Edge for Android extensions — https://www.androidauthority.com/microsoft-edge-extensions-android-3535402
- Apple TN3134 / NEFilterDataProvider on consumer devices — https://developer.apple.com/documentation/technotes/tn3134-network-extension-provider-deployment.md , https://developer.apple.com/forums/thread/827228 , https://developer.apple.com/documentation/networkextension/nefiltermanager.md
- Screen Time web-domain limits — https://developer.apple.com/forums/thread/730444 , https://developer.apple.com/forums/thread/805209 , https://developer.apple.com/forums/thread/729808 , https://developer.apple.com/documentation/managedsettings/shieldsettings/webdomains-swift.property.md
- Family Controls authorization/entitlement — https://developer.apple.com/documentation/familycontrols/authorizationcenter/requestauthorization(for:).md , https://developer.apple.com/forums/thread/734199 , https://drobinin.com/consulting/screen-time-family-controls/building-with-screen-time-and-family-controls/
- Orion iOS extensions — https://help.kagi.com/orion/browser-extensions/ios-ipados-extensions.html
- TikTok keyword filters — https://newsroom.tiktok.com/more-ways-to-discover-new-content-and-creators-you-love , https://unil.ink/blog/how-to-block-hashtag-tiktok
- Threads Hidden Words — https://9to5mac.com/2025/06/27/you-can-now-mute-words-just-on-threads-and-even-set-a-30-day-timer/
- X muted words — https://www.blockpartyapp.com/blog/how-and-when-to-mute-keywords-on-x-formerly-twitter
- Chrome Web Store remote-code / remote-config policy — https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Transformers.js WebGPU + CLIP in extensions — https://huggingface.co/docs/transformers.js/guides/webgpu , https://blog.mozilla.org/en/firefox/firefox-ai/running-inference-in-web-extensions/ , https://medium.com/@GenerationAI/transformers-js-onnx-runtime-webgpu-in-chrome-extension-13b563933ca9
- Android Shorts blocker reference (Accessibility) — https://github.com/atick-faisal/Shorts-Blocker
- NotificationListenerService — https://developer.android.com/reference/android/service/notification/NotificationListenerService
