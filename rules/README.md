# Shared rules

`rules.json` is the one blocklist every Safehouse client uses: the browser extension
(TypeScript), the Android app (Kotlin) and the iOS app (Swift). It is **data only**, so it can be
updated remotely without breaking Chrome Web Store or App Store rules.

**Default scope:** all GTA 6 / GTA VI content (trailers, news, leaks, memes, gameplay, spoilers).
Older games (GTA 5, GTA Online, GTA Vice City from 2002) are **not** blocked.

## Matching algorithm (every client must do exactly this)

1. **Normalise** the text (title, caption, channel name, hashtags, alt text…):
   1. Unicode NFKC (turns `Ⅵ` into `VI`, full-width letters into normal ones)
   2. lowercase
   3. strip accents (NFD, then drop combining marks `\p{M}`)
   4. remove zero-width characters (U+200B–U+200D, U+2060, U+FEFF)
   5. replace every character that isn't `a–z` or `0–9` with a space
   6. collapse runs of spaces into one, then trim

   Example: `"G.T.A. Ⅵ — Trailer #3!"` → `"g t a vi trailer 3"`;
   `"Dre'Quan"` → `"dre quan"`; `"#GTA6Trailer"` → `"gta6trailer"`.

2. **Term match** = token-boundary match: `" " + text + " "` contains `" " + term + " "`.
   All terms in `rules.json` are already normalised.

3. **Verdict:**
   - If any `allowlist` term matches → **allow** (user override).
   - If any `regex` matches → **block**.
   - If any `unique` term matches → **block**.
   - For each `contextual` rule: if `term` matches **and** at least one `requiresAny` term matches
     **and** no `unlessAny` term matches → **block**.
   - Otherwise → **allow**.

4. **Regex dialect:** stick to features that behave the same in JavaScript, Java/Kotlin and
   ICU/Swift: `\b`, `(?!…)` negative lookahead, `?`, groups, alternation. No lookbehind, no
   named groups, no Unicode classes. Patterns run on the *normalised* text, so they only need to
   handle `a–z`, `0–9` and single spaces.

## Test vectors

`test-vectors.json` lists inputs and their expected verdicts. Every client's matcher must pass
all of them in CI. When you change `rules.json`, add test cases for the change, especially
**allow** cases, so older GTA content stays visible.
