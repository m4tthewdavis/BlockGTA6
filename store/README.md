# Store submission checklist

Target: listed **before 19 Nov 2026**. Reviews can take a few days, so submit as early as possible.

## 0. One-time decisions (owner)
- [ ] **License.** AMO asks for one (e.g. MIT if you want it open source, or "All Rights
      Reserved"). Add a `LICENSE` file to match.
- [ ] **Make the GitHub repo public, or host `rules/rules.json` and `store/privacy-policy.md`
      elsewhere.** Blocklist updates download
      `https://raw.githubusercontent.com/m4tthewdavis/BlockGTA6/main/rules/rules.json`. That only
      works once this work is merged to `main` and the repo is public. (If it can't be reached,
      the extension quietly keeps its bundled list.)
- [ ] A public **privacy policy URL**: e.g. the GitHub link to `store/privacy-policy.md` on `main`,
      or GitHub Pages.
- [ ] Support contact: GitHub Issues URL or an email address.

## 1. Test on the real sites (about 15 min)
Load `extension/dist/chrome` via `chrome://extensions` → Developer mode → Load unpacked. Then check:

1. **YouTube:** Home, search "gta 6", a GTA 6 video (should be covered), Shorts, comments.
2. **Google:** search "gta 6".
3. **Reddit:** home, a GTA 6 post, r/GTA6 (should show the block page).
4. **X:** home, search "GTA 6". **TikTok, Instagram, Facebook, Twitch** (beta).

Note anything that slips through (site + what it was) so the selectors in
`extension/src/content/adapters.ts` can be fixed.

## 2. Build the packages
```bash
cd extension
npm ci
npm test && npm run package && npm run source
# -> dist/safehouse-chrome-<v>.zip, dist/safehouse-firefox-<v>.zip, dist/safehouse-source-<v>.zip
```

## 3. Chrome Web Store
1. https://chrome.google.com/webstore/devconsole (one-time $5 developer fee).
2. *New item* → upload `safehouse-chrome-<v>.zip`.
3. Fill in the listing from `listing.md`, the images from `images/`, and the privacy tab from `listing.md`.
4. Submit for review.

## 4. Firefox Add-ons
1. https://addons.mozilla.org/developers/ → *Submit a New Add-on* → *On this site*.
2. Upload `safehouse-firefox-<v>.zip` and tick **Firefox for Android** too.
3. Upload `safehouse-source-<v>.zip` with the reviewer notes from `listing.md`.
4. Fill in the listing and choose the license.

## 5. Microsoft Edge Add-ons
1. https://partner.microsoft.com/dashboard/microsoftedge → upload the **Chrome** zip.
2. Same listing text and images.

## 6. Launch week
- New GTA 6 names will appear after 19 Nov. Add them to `rules/rules.json` with test cases in
  `rules/test-vectors.json`, **increase `version`**, and merge to `main`. Installed extensions pick
  up the update within about 3 hours, with no store review.
