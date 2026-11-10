# BlockGTA6 — Project Plan

Goal: one product that hides GTA 6 content (trailers, leaks, spoilers, news, memes) across
YouTube, social media and the web, on **desktop (Windows / macOS / Linux / ChromeOS)**,
**Android** and **iPhone / iPad**.

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
    "contextual": [        // block only if a GTA/Rockstar term is also present
      "leonida", "jason and lucia", "lucia", "vice city 2026", "rockstar trailer"
    ]
  },
  "regex": [
    "\\bg\\.?\\s*t\\.?\\s*a\\.?\\s*(6|vi|six)\\b",          // "G.T.A. VI", "gta  six"
    "\\bgrand\\s*theft\\s*auto\\s*(6|vi|six)\\b"
  ],
  "channels": { "youtube": ["<Rockstar Games channel id>"] },
  "subreddits": ["GTA6", "GTAVI", "GTA6_Leaks"],
  "domains": { "block": [], "pathBlock": ["rockstargames.com/VI"] },
  "allowlist": []           // user overrides, e.g. "gta 5"
}
```

### 2.2 Matching rules
- Normalise text first: lowercase, Unicode NFKC, strip accents/zero-width characters,
  convert lookalike digits and letters (`6`/`VI`/`six`, `Ⅵ`), collapse whitespace and punctuation.
- **Strong** terms block straight away. **Contextual** terms (character names, "Vice City",
  "Leonida") block only next to a GTA/Rockstar term, because "Vice City" on its own is also the
  2002 game and "Lucia" is a common name.
- Modes the user can choose:
  - **Spoiler-safe** (default): GTA 6 only.
  - **All GTA**: also GTA 5/Online.
  - **Custom**: their own keywords.
- Actions: **hide** the item, **blur with a "click to reveal" shield**, or **block the page**
  (for direct links to a GTA 6 video or trailer).

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
1. **Data interception, before anything renders (YouTube).** The approach open-source
   [BlockTube](https://github.com/amitbl/blocktube) uses: inject a main-world script that wraps
   `fetch`/`XMLHttpRequest` and the `ytInitialData` / `ytInitialPlayerResponse` objects, then
   removes matching video items from the JSON before YouTube renders them. Nothing flashes on
   screen, and it's resistant to CSS class changes.
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

### 4.4 Play Store risk ⚠️
Google Play needs an **Accessibility API declaration** and a prominent in-app disclosure, and
reviews these apps closely. Mitigations:
- Process everything on the device, collect no data, and say exactly that in the disclosure
  and privacy policy.
- Frame it as a user-chosen content filter (similar to existing digital-wellbeing blockers).
- **Backup plan:** distribute the APK through GitHub Releases / F-Droid if Play rejects it.

---

## 5. Client 3: iOS / iPadOS app

iOS is the most locked-down platform. **No third-party app can read or change what's shown
inside the YouTube, TikTok or Instagram apps.** The plan combines four layers:

1. **Safari Web Extension (main filter).** The same extension code as §3, bundled in the iOS
   app. Filters YouTube, Reddit, X and so on in Safari. The onboarding steers people to use
   these sites in Safari.
2. **Screen Time API (FamilyControls + ManagedSettings + DeviceActivity).**
   - Request `.individual` authorization (self-use, iOS 16+) or `.child` (parental use).
   - `ManagedSettingsStore.webContent.blockedByFilter` blocks whole domains/URLs
     (GTA 6 fan/leak sites) in **all** browsers and web views.
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
   - TikTok: Settings → Content preferences → Filter video keywords
   - Instagram / Threads: Hidden words
   - YouTube: "Don't recommend channel" for GTA 6 channels, plus clearing watch/search history
   - Reddit: Mute communities
   (Check each path in-app before release; menu names change.)
4. **Optional content-filter Network Extension (`NEFilterDataProvider`).** Only on supervised
   devices / Screen Time setups (Apple TN3134). It only sees hostnames and URLs, so it's a
   later-phase extra.

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

| Phase | Deliverable | Platforms covered | Est. effort* |
|---|---|---|---|
| **0. Foundation** | `rules.json`, normaliser + matcher spec, test vectors, repo + CI | – | 2–3 days |
| **1. MVP extension** | YouTube (interception + DOM), Google search, Reddit, X; popup/options; blur/hide | Chrome/Edge/Brave/Firefox desktop | 1–2 weeks |
| **2. Extension everywhere** | TikTok, Instagram, Facebook, Twitch, generic adapter; remote rules/selectors update; Firefox Android; Safari macOS + iOS builds | + Firefox Android, Safari Mac/iPhone | 1–2 weeks |
| **3. Android app** | Accessibility Service for YouTube/TikTok/Instagram/X/Reddit/Chrome; overlay shield; onboarding + disclosure; optional DNS VPN | Android native apps | 2–3 weeks |
| **4. iOS app** | Host app for Safari ext; Screen Time domain blocking + app shields + schedules; muted-words checklist | iPhone/iPad native layer | 2–3 weeks (+ entitlement wait) |
| **5. Polish** | Thumbnail image classifier, commitment/lock mode, desktop Tauri companion, localisation | All | ongoing |

\*One experienced developer. Store reviews (Chrome ~1–3 days, Apple ~1–2 days + Family
Controls entitlement approval, Google Play Accessibility review) come on top.

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

## 12. Immediate next steps
1. Decide the default mode (spoiler-safe GTA 6 only vs. all GTA) and the default action (hide vs. blur).
2. Create `rules/rules.json` + `rules/test-vectors.json` and the TypeScript matcher (Phase 0).
3. Scaffold the MV3 extension with a YouTube adapter and get it working in Chrome and Firefox (Phase 1).
4. Apply for the Apple Developer Program + Family Controls entitlement and a Google Play developer
   account now, since approvals take time.

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
