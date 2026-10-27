# og-view — Plan

A zero-install web component, `<og-view>`, that:

1. **Displays** the Open Graph data of the page it's placed on (read from `<head>`), in the two-column "anatomy" layout from the reference mock, styled to feel native to the host page.
2. **Debugs** that data in the browser console, with actionable suggestions similar to opengraph.xyz.

Distributed like [`code-anatomy`](https://github.com/ddamato/code-anatomy): one script tag from unpkg, no build step for consumers. The GitHub Pages site is the demo and is rendered from Markdown, with no hand-written HTML page.

```html
<script src="https://unpkg.com/og-view" defer></script>
<og-view></og-view>
```

---

## 1. Data collection (`src/collect.js`)

Read `document.head` once on connect, and again whenever `<head>` changes (`MutationObserver` on `<head>`, debounced, for SPAs and client-side routers).

Each field resolves through a fallback chain. The chain records **which source won**, because the debugger reports it ("og:title missing, fell back to `<title>`").

| Field | Primary | Fallbacks |
| --- | --- | --- |
| site name | `og:site_name` | `application-name` → `location.hostname` |
| favicon | `link[rel~=icon]` (largest `sizes`) | `apple-touch-icon` → `/favicon.ico` |
| title | `og:title` | `twitter:title` → `<title>` |
| description | `og:description` | `twitter:description` → `meta[name=description]` |
| image | `og:image` / `og:image:url` / `og:image:secure_url` | `twitter:image` |
| image alt | `og:image:alt` | `twitter:image:alt` |
| image size | `og:image:width` / `og:image:height` | measured by loading the image |
| url | `og:url` | `link[rel=canonical]` → `location.href` |
| author | `meta[name=author]` (display name) | `twitter:creator` → `article:author` |
| author link | `article:author` (a profile URL per ogp.me) | none |
| type | `og:type` | none (debug only, not displayed) |
| twitter:card | `twitter:card` | none (debug only) |

The table above lists only the fields the card displays. The collector also records the following, for the debugger only:
- All `og:*`, `twitter:*`, `article:*` and `fb:*` tags, kept in document order and including duplicates, empty values and tags with the wrong case
- `theme-color`
- `og:pubdate` / `pubdate` / `iso-8601-publish-date`
- The `<link type="application/json+oembed">` href
- Every `link[rel~=icon]` candidate

Both `property=` and `name=` attributes are accepted, since many sites incorrectly use `name="og:…"`. The debugger reports that as info (`property-attr`).

Relative URLs are resolved against `document.baseURI` for display. The debugger still flags them, because scrapers require absolute URLs.

## 2. Rendering (`src/og-view.js`)

- A custom element `og-view` that renders into the **light DOM** (no Shadow DOM), so the page's own CSS for `h2`, `p`, `a`, `code`, `hr` and `img` styles the content directly. No framework.
- Markup uses real semantic elements so host styles apply naturally:
  - `<figure>` and `<img>` for the image
  - `<h2>` for the title
  - `<p>` for the description
  - `<hr>` for the rule
  - `<a>` and `<code>` for the URL
  - `<code>` for the tag chips
- Layout follows the mock:
  - **Left:** `og:image` at a 1.91:1 aspect ratio (1200×630) with the chamfered frame. When the image is missing it shows the hatched placeholder labelled `og:image · 1200×630`.
    - When `twitter:image` is a different URL, **both are rendered as `<img>`** so both can be measured.
    - If both load, `twitter:image` gets the `hidden` attribute and `og:image` is shown.
    - If only one loads, that one is shown, and its tag chip names its source.
    - These loads are the only image requests og-view makes. See "Network behavior" in section 4.
  - **Right (stacked):**
    - `favicon + og:site_name`: icon box plus the letter-spaced site name.
    - `og:title`: large display type.
    - `og:description`
    - A rule.
    - A row with the QR code of `og:url` next to `article:author + og:url`: author name, then the URL in mono.
  - **Sources in the markup:** each rendered value has a `data-og` attribute naming its **actual** source, for example `og:title`, or `<title>` when a fallback was used. Inspecting the element shows where everything came from. *Changed during the build:* this replaced visible chips behind a `tags` attribute.
- Responsive without container queries. The content sets the card's size, and the image and text wrap onto separate rows when there isn't room.
- Stable class hooks on each region for consumers who want overrides, replacing `::part()` since there's no shadow root:
  - `og-view__image`, `og-view__site`, `og-view__title`, `og-view__description`
  - `og-view__author`, `og-view__url`, `og-view__qr`
- Re-renders replace the element's own children only. Any author-provided children are ignored and overwritten, which is documented.

### QR code
Generate an SVG QR of the resolved URL with `uqr`, bundled. That's 10 KB minified, more than the 4 kB estimate. The modules are drawn in the darker of the page's text and background colors, on the lighter one (see section 3).

## 3. Matching the host page's styles (`src/styles.js`)

Goal: the component looks like it belongs to whatever site it's dropped into, without per-site configuration.

Approach: **light DOM plus a minimal, low-priority component stylesheet.**

- **Typography and color come from the page.** Because content is real `h2`, `p`, `a`, `code` and `hr` in the light DOM, the site's existing rules apply with no sampling or configuration. Theme toggles and dark mode work for free.
- **The component stylesheet is injected once** into `document.head` as `<style id="og-view-styles">`, wrapped in `@layer og-view`. Unlayered page CSS beats layered CSS regardless of specificity, so the page always wins, and plain class selectors are enough.
  - It's **layout only**:
    - `og-view` is `width: fit-content`: the content dictates its size, capped at the space available. There are no container queries, which would be overkill here.
    - a wrapping flex row: the image and the text are each 520px and sit side by side, wrapping onto separate rows when there isn't room
      - The text uses `width`, not `flex-basis`, because the card's `fit-content` width counts `width` but not `flex-basis`.
      - A `fit-content` box can't shrink back to the width of wrapped rows, which is a CSS limit. So wrapped rows are centered (`justify-content: center`), which looks the same.
      - `max-width: 100%` on `og-view` and `min-width: 0` on both columns let the card shrink below 520px on phones.
    - the image's 1.91:1 aspect ratio
    - the favicon's and QR code's sizes
  - **No decoration and no public custom properties.** Authors restyle by targeting the `og-view__*` classes, which always wins. *Simplified during the build:*
    - removed: the chamfered frame, the hatched placeholder, the boxed favicon, the uppercase site name, inverted chips and about ten `--og-view-*` properties
    - Chips are plain `<code>`. The image's chip sits above the image rather than over it, so it doesn't need its own colors.
- **Page colors (`src/colors.js`, added during the build), for the QR code only.** CSS can't read an ancestor's background, so the element walks up to the nearest painted background. It sets private `--_og-view-qr-dark` and `--_og-view-qr-light` properties, so the code is always dark modules on a light background, the most reliable to scan. Colors are re-read when `<html>` or `<body>` changes `class`, `style`, `data-theme` or `data-mode`, and on `prefers-color-scheme` changes.
- **Known risks of light DOM:**
  - Aggressive page rules can distort the card, for example `h2 { margin-top: 4rem }`, `img { max-width: 50% }`, or `hr { display: none }`. That's accepted, since matching the page is the point.
  - The `<h2>` joins the document outline. A `heading-level` attribute (default `2`) lets authors pick `h3`–`h6`.

## 4. Console debugger (`src/debug.js`)

Runs after collection and on every head change. Output is a single collapsible `console.groupCollapsed('og-view · N issues')` with:

- `console.table` of the resolved fields: value, source and status.
- One line per finding, using `console.error`, `console.warn` or `console.info` by severity, each with a short "why" and "fix", including the exact `<meta>` tag to paste where possible.

### Sources

Every rule cites one of these. Platform docs and the spec are primary sources. A secondary source is used only when no primary one exists, and the console labels those findings `(secondary source)`.

| Key | Source | Retrieved |
| --- | --- | --- |
| `ogp` | [The Open Graph protocol](https://ogp.me/) | 2026-10-27 |
| `fb` | [Facebook: A Guide to Sharing for Webmasters](https://developers.facebook.com/docs/sharing/webmasters) | 2026-10-27 |
| `fb-bp` | [Facebook: Sharing Best Practices](https://developers.facebook.com/docs/sharing/best-practices) | 2026-10-27 |
| `x` | [X: Cards markup reference](https://developer.x.com/en/docs/twitter-for-websites/cards/overview/markup) | 2026-10-27 (the live page is paywalled, so it was read via the Web Archive) |
| `x-large` | [X: Summary Card with Large Image](https://developer.x.com/en/docs/twitter-for-websites/cards/overview/summary-card-with-large-image) | 2026-10-27 (the live page is paywalled, so it was read via a search summary) |
| `li` | [LinkedIn: Make your website shareable on LinkedIn](https://www.linkedin.com/help/linkedin/answer/a521928) | 2026-10-27 |
| `discord` | [Discord: Link Previews](https://docs.discord.com/developers/link-previews/overview) | 2026-10-27 |
| `google-favicon` | [Google Search Central: Define a favicon to show in search results](https://developers.google.com/search/docs/appearance/favicon-in-search). The card shows the favicon, but no OG platform documents favicon requirements, so Google's are used. | 2026-10-27 |
| `bsky` | Bluesky source code, which is the only "documentation" for its link cards:<br>• [link-meta.ts](https://github.com/bluesky-social/social-app/blob/main/src/lib/link-meta/link-meta.ts) (client)<br>• [resolve.ts](https://github.com/bluesky-social/social-app/blob/main/src/lib/api/resolve.ts) (thumbnail)<br>• [constants.ts](https://github.com/bluesky-social/social-app/blob/main/src/lib/constants.ts) (`IMAGE_SIZE_CONFIG_2K_1MB`)<br>• [`app.bsky.embed.external` schema](https://github.com/bluesky-social/atproto/blob/main/packages/api/lexicons/app/bsky/embed/external.json) | 2026-10-27 |

opengraph.xyz returned 403 and 429 to every request, so none of its checks are copied here. Its rule set could be compared later in a browser.

These vendor pages were reviewed and **not** used, because they're undated and cite nothing:
- ogfixer.com
- opengraphplus.com, which says Discord's title limit is about 256 characters, while Discord's docs say 70 bytes
- prerender.io

Discord's docs now cover what `prerender` was cited for.

### Severity

- **error:** a property ogp.me lists as required is missing or invalid, or a documented platform limit means the preview won't render at all.
- **warning:** a requirement or recommendation that a named platform documents is not met, so the preview will be degraded or cropped on that platform.
- **info:** optional or recommended metadata is missing, or a best practice is not followed.

Fallbacks don't count as present. A page with `<title>` but no `og:title` still gets the "missing `og:title`" error. The finding mentions which fallback was used.

### Rules

| ID | Severity | Platform | Check | Source |
| --- | --- | --- | --- | --- |
| `required` | error | spec | `og:title`, `og:type`, `og:image` or `og:url` missing ("The four required properties for every page"). Missing `og:type` notes that pages are treated as `website` by default. | `ogp` |
| `url-protocol` | error | spec | `og:url` or `og:image` isn't an absolute `http(s)` URL | `ogp` |
| `image-load` | error | all | `og:image` fails to load | (none; nothing renders) |
| `image-format` | error / warning | X, Facebook, Discord | The image format isn't supported on a platform. It's an error when no platform supports it (SVG, for example), and a warning naming each platform that doesn't (see the format table below). | `x`, `fb`, `discord` |
| `site-name-length` | error | Discord | `og:site_name` is over 256 characters, which means "No preview at all" | `discord` |
| `url-length` | error | Discord | `og:url`, an image URL or a video URL is over 2,048 characters, which means "No preview at all" | `discord` |
| `image-alt` | warning / error | spec, X, Discord | `og:image` without `og:image:alt` ("should also be specified"). It's a warning if the alt text is over 420 characters (X's maximum), and an error over 4,096 (Discord shows "No preview at all"). | `ogp`, `x`, `discord` |
| `duplicate` | warning | spec, Discord | A single-value property appears more than once. ogp.me: the first tag wins. Discord: the first wins for title, description and site name, but **the last wins** for layout, color and date tags (`og:type`, `twitter:card`, `theme-color`, pubdate). So duplicates of those tags are reported as a conflict between platforms. | `ogp`, `discord` |
| `image-dims-attach` | warning | Discord | Dimension, type or alt tags only follow `og:image:url`, `og:image:secure_url` or `twitter:image:src`. Discord reads them only after plain `og:image` or `twitter:image`. | `discord` |
| `theme-color-format` | warning | Discord | `theme-color` is set but isn't `#RRGGBB` or `#RRGGBBAA`. Browsers accept other CSS colors like `rgb()` or named colors, but Discord doesn't. | `discord` |
| `pubdate-format` | warning | Discord | `og:pubdate`, `pubdate` or `iso-8601-publish-date` isn't a full RFC 3339 timestamp with a time and offset | `discord` |
| `description-html` | warning | Discord | `og:description` contains HTML tags. They "appear literally" unless `og:type` is `rich`. | `discord` |
| `structure-order` | warning | spec | `og:image:*` appears before its `og:image` | `ogp` |
| `canonical` | warning | spec, Facebook | `og:url` ≠ `link[rel=canonical]` ("The canonical URL of your object") | `ogp`, `fb` |
| `description` | warning | LinkedIn | `og:description` is missing. It's optional in the spec, but LinkedIn lists it as one of four required tags. | `li` |
| `title-length` | warning | X, Discord | The title is over X's 70 characters (it uses `twitter:title`, falling back to `og:title`), or over Discord's **70 bytes** of UTF-8, which is shorter than 70 characters when the title has accents or emoji. Discord also cuts it at 3 lines. | `x`, `discord` |
| `description-length` | warning | X, Discord | The description is over X's 200 characters or Discord's 350 bytes (Discord also cuts it at 20 lines) | `x`, `discord` |
| `image-size-li` | warning | LinkedIn | The image is smaller than 1200×627. Under 401px wide, it "display[s] as a thumbnail". | `li` |
| `image-size-fb` | warning | Facebook | The image is under 600px wide (minimum). Under 1080px wide, it's an info finding ("at least 1080 pixels"). | `fb-bp` |
| `image-size-x` | warning | X | The image is outside 300×157 to 4096×4096 | `x-large` |
| `image-ratio` | warning | X, LinkedIn | The aspect ratio is more than 5% off both 1.91:1 (LinkedIn) and 2:1 (X). 1200×630 passes both. | `li`, `x-large` |
| `image-bytes` | warning | X, LinkedIn | The image is over 5 MB. The size is read from the browser's performance data (`PerformanceResourceTiming.encodedBodySize`) for the image that already loaded. That's available for same-origin images, or cross-origin ones served with `Timing-Allow-Origin`. Otherwise the check is skipped silently. | `x`, `li` |
| `image-dims-mismatch` | warning | Facebook | The declared `og:image:width/height` doesn't match the measured size | `fb` |
| `image-dims-declared` | info | Facebook, Discord | `og:image:width/height` are missing. Facebook uses them "to ensure that the image loads properly the first time it's shared". Without them Discord downloads the image to measure it, which counts against its 10-second fetch limit. | `fb`, `discord` |
| `image-count` | info | Discord | There are more than 4 `og:image` tags. Discord shows them as a gallery of at most 4. | `discord` |
| `twitter-card` | info / warning | X, Discord | `twitter:card` is missing. X "may" render a summary card from `og:type`, `og:title` and `og:description`, and Discord's default layout is text with a small image. When there's an image, it's a warning that suggests `summary_large_image`, which gives a large image on both platforms. | `x`, `discord` |
| `theme-color` | info | Discord | `theme-color` is missing. Discord uses it as the preview's accent color. | `discord` |
| `twitter-site` | info | X | `twitter:site` / `twitter:site:id` is missing (X marks it required) | `x` |
| `type-value` | info | spec | `og:type` isn't a listed type and isn't namespaced (`prefix:type`) | `ogp` |
| `article-details` | info | spec, Discord | `og:type` is `article` but `article:published_time` or `article:author` is missing. Both are optional, so this is a suggestion. Discord doesn't read `article:published_time`, only `og:pubdate`, `pubdate` or `iso-8601-publish-date`, so the message mentions those as well. | `ogp`, `discord` |
| `article-author` | info | spec | `article:author` is a plain name, but the spec types it as a profile array (a URL) | `ogp` |
| `title-branding` | info | Facebook | `og:title` contains `og:site_name` (use the title "without any branding") | `fb` |
| `url-decorated` | info | Facebook | `og:url` has tracking or session query params like `utm_*`, `fbclid` or `sid` ("undecorated URL") | `fb` |
| `property-attr` | info | spec | `name="og:*"` is used instead of `property="og:*"`. The spec's markup uses `property`, and it's still read. | `ogp` |
| `optional` | info | spec, Discord | `og:site_name` or `og:locale` is missing ("optional … generally recommended"). For `og:site_name`, it adds that Discord shows it above the title and Bluesky doesn't show it. | `ogp`, `discord`, `bsky` |
| **Tag hygiene** | | | | |
| `empty-content` | warning | Discord, all | A tag has empty or whitespace-only `content`. It counts as missing for every other rule. Discord skips it ("the first non-empty one wins"), but parsers that take the first tag as-is may show a blank. | `discord`, `ogp` |
| `key-case` | warning | Discord | A key has the wrong case, like `OG:Title` or `og:Image`. "Key names are case-sensitive." | `discord` |
| **Fallback behavior** | | | | |
| `fallback-pair` | warning | Discord | There's no `og:` or `twitter:` title or description, and only one of `<title>` and `meta[name=description]` exists. Discord uses those "only as a pair", so it shows neither. | `discord` |
| **Images** | | | | |
| `image-secure-url` | warning | Facebook | `og:image:secure_url` isn't `https://` ("must be an https:// URL") | `fb` |
| `image-type` | warning | Facebook, Discord | `og:image:type` isn't a format the platform supports (see the format table), or disagrees with the image URL's file extension | `fb`, `discord` |
| **X** | | | | |
| `twitter-card-value` | warning | X, Discord | `twitter:card` isn't `summary`, `summary_large_image`, `app` or `player`, the card types X lists. `photo` gets a specific message: Discord supports it as an image-only layout, but X doesn't. | `x`, `discord` |
| `twitter-handle` | warning | X | `twitter:site` or `twitter:creator` doesn't start with `@` ("@username of website", "@username of content creator") | `x` |
| **Locale & dates** | | | | |
| `locale-format` | warning | spec | `og:locale` or `og:locale:alternate` isn't `language_TERRITORY`, like `en_US` ("Of the format language_TERRITORY. Default is en_US"). A common mistake is `en-US`. | `ogp` |
| `datetime-format` | warning | spec | `article:published_time`, `article:modified_time`, `article:expiration_time` or another `*:release_date` isn't a valid ISO 8601 datetime | `ogp` |
| **Video** (only when `og:video` is present) | | | | |
| `video-dims` | warning | Facebook | `og:video:width` or `og:video:height` is missing ("required for videos"). Discord treats them as optional but drops the video if it can't measure the file. | `fb`, `discord` |
| `video-image` | error | Discord | `og:video` without `og:image`: "`og:image` is required to render the video" | `discord` |
| `video-https` | warning | Facebook, Discord | The video URL isn't `https`. Discord: "Serve the file over `https`". Facebook: use https "for in-line play in Feed". | `fb`, `discord` |
| `video-type` | warning | Facebook, Discord | `og:video:type` isn't `video/mp4`, `video/webm` or `video/quicktime` (Discord). Facebook supports `video/mp4`. | `fb`, `discord` |
| `video-layout` | info | Discord | `og:video` is present but neither `og:type` is `video` or `video.*` nor `twitter:card` is `player`, so Discord won't use the video layout | `discord` |
| **Favicon** (shown on the card and used by Bluesky's favicon proxy) | | | | |
| `favicon-missing` | info | Google | No `link[rel~=icon]` was found, and `/favicon.ico` doesn't load either | `google-favicon` |
| `favicon-square` | warning | Google | The favicon isn't 1:1 ("must be a square") | `google-favicon` |
| `favicon-size` | warning / info | Google | It's a warning under 8×8 ("at least 8x8px"), and info at 48×48 or smaller ("we recommend … larger than 48x48px") | `google-favicon` |
| `favicon-format` | info | Google | It's not BMP, GIF, ICO, PNG, JPEG, PPM or TIFF. SVG favicons work in browsers but aren't in Google's list. | `google-favicon` |
| **Other platform tags** | | | | |
| `fb-app-id` | info | Facebook | `fb:app_id` is missing, which Facebook needs for Insights | `fb` |
| `oembed-provider` | info | Discord | An oEmbed link is present. Its `provider_name` replaces `og:site_name` on Discord, and its `title` and `thumbnail_url` fill gaps. The JSON isn't fetched, so the message describes what *can* be overridden. | `discord` |
| `author-discord` | info | Discord | The page has an author, through `article:author`, `meta[name=author]` or `twitter:creator`, but no oEmbed link. "oEmbed is the only way to put an author on a preview" on Discord. | `discord` |

**Removed from the earlier draft** because no source backs them:
- The ~60 and ~160 character title and description limits. X's 70 and 200 replace them.
- The minimum title and description lengths.
- "Favicon isn't square." This was later restored as `favicon-square`, citing Google.

**Removed because they'd need a re-download of the page's HTML.** We assume metadata isn't added on the client (see Decisions), so there's no HTML re-download:
- `server-html`: tags added by JavaScript. Discord: "No code is executed, so tags added by a client-side script after load are never seen."
- `first-mb`: tags after the first 1 MB. [Facebook: The Facebook Crawler](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers)
- `fetch-response`: a non-2xx response, the wrong content type, or a file download

These could come back later as an opt-in `debug` mode if needed.

**Platform disagreements are reported per platform, not merged:**
- The image aspect ratio is 1.91:1 for LinkedIn and 2:1 for X.
- The minimum image width is 600 for Facebook and 1200 for LinkedIn.
- `og:description` is optional in the spec but required by LinkedIn.
- The title limit is 70 characters for X and 70 bytes for Discord. The description limit is 200 characters for X and 350 bytes for Discord.
- For duplicate tags, the spec says the first one wins. Discord agrees for text tags, but the last one wins for layout, color and date tags.

**Image format support:**

| Format | X | Facebook | Discord |
| --- | --- | --- | --- |
| JPG / PNG / GIF | yes | yes | yes |
| WEBP | yes | not listed | yes |
| AVIF | not listed | not listed | yes |
| SVG | no ("SVG is not supported") | not listed | not listed |

LinkedIn's sharing docs don't list formats, so LinkedIn isn't in the table.

### Bluesky

Bluesky doesn't document its link cards.
- **How it reads tags is closed.** The app sends the URL to a closed-source service, `cardyb.bsky.app/v1/extract`, which returns `title`, `description`, `image` and `icon`. Which tags it reads and how it falls back can't be confirmed, so **there are no Bluesky-specific rules**.
- **What the code shows** is used for notes, not rules:
  - **No site name.** The response has no site name field, so `og:site_name` isn't shown on Bluesky. The `optional` finding says so.
  - **Large images are fine.** The app downloads the image through cardyb's image proxy, so no CORS is needed. It then shrinks it to at most 2000px and 1,000,000 bytes, the limit for `thumb` in `app.bsky.embed.external`. Size and byte rules don't apply to Bluesky.
  - **Cards never update.** The title, description and thumbnail are saved into the post record when it's posted. Unlike Discord's 30-minute cache, fixing tags later never changes existing posts. The console footer says so next to the debugger links.
- **Possible follow-up:** once the Pages demo is live, call `cardyb.bsky.app/v1/extract` against demo pages with different tag combinations to observe its fallbacks. Anything learned would be documented as "observed", not as a source.

### Platform debuggers

The console group ends with links to each platform's debugger. Each link includes the page URL where the tool accepts one. The footer also says how long each platform caches previews where that's documented. For Discord it's about 30 minutes; sharing the link with an added query string like `?v=2` shows changes immediately.
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Discord Embed Debugger](https://discord.com/developers/embeds)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### Network behavior

**og-view makes no requests beyond the images the card renders:**
- `og:image`
- `twitter:image`, only when it's a different URL, and hidden when both load
- the favicon, including the `/favicon.ico` fallback

Every check reads either the tags in `<head>` or measurements from those `<img>` elements:
- `naturalWidth` / `naturalHeight`
- load or error state
- `PerformanceResourceTiming` for file size, where the browser exposes it

So leaving `<og-view>` on a live page costs nothing beyond the card itself, and the debugger needs no special handling for live pages.

**Not fetched:**
- the page's HTML (see "Removed" above)
- the oEmbed JSON
- a `HEAD` request for an image's `Content-Type`

### Per-platform resolution

Platforms resolve fields differently, so platform rules run on **the value that platform would actually use**, not on og-view's own resolved value:

| Platform | Title | Description | Image |
| --- | --- | --- | --- |
| X | `twitter:title` → `og:title` | `twitter:description` → `og:description` | `twitter:image` → `og:image` |
| Discord | the first non-empty `og:title` or `twitter:title` → oEmbed `title` → `<title>` (only with a description) | the first non-empty `og:description` or `twitter:description` → `meta[name=description]` (only with a title) | the `og:image` variants or `twitter:image` → oEmbed `thumbnail_url` |
| Facebook, LinkedIn | `og:title` | `og:description` | `og:image` |

So when `twitter:image` is a different file from `og:image`, the X size, ratio and format checks run on `twitter:image`. The Facebook and LinkedIn checks run on `og:image`. Both are measured from the `<img>` elements the card renders (see section 2), so each image is loaded once.

### Rule shape

Each rule is a small object, and its `source` URL is printed with every finding:

```js
{ id, severity, platforms: ['x'], source: 'https://…', test(fields, measured) → finding | null }
```

Console line format: `[warning] [X] Title is 76 chars; X truncates at 70. → <fix> (source: <url>)`

### Keeping rules current

Platform docs move and change. The X docs went behind a paywall at their old address. Each source has a "Retrieved" date, and the README asks for issues and PRs that cite a newer source.

The X large-image numbers (2:1 ratio, 300×157 to 4096×4096) came from a search summary of a paywalled page. They're the least verified figures in the plan. Re-check them if the page becomes readable.

## 5. Public API

```html
<og-view></og-view>                      <!-- display (with QR) + console debug -->
<og-view quiet></og-view>                <!-- display only, no console output -->
<og-view no-qr></og-view>                <!-- hide the QR code -->
<og-view heading-level="3"></og-view>    <!-- title rendered as <h3> -->
```

- Properties: `report` (read-only, `{ fields, findings }`) and `refresh()` to force re-collection.
- Events: `og-view:report`, so tests and CI scripts can consume the findings.

## 6. Build & distribution

- **Source:** plain ES modules in `src/`. JSDoc types, no TypeScript, which keeps the repo lightweight like `code-anatomy`.
- **Bundler:** esbuild, producing two outputs:
  - `dist/og-view.js`: ESM, for `import 'og-view'` and `<script type="module">`
  - `dist/og-view.iife.js`: minified IIFE, for the plain `<script>` tag
- **`package.json`:**
  - `"unpkg"` and `"jsdelivr"` point to the IIFE, so `https://unpkg.com/og-view` resolves with no path.
  - `"module"` / `"exports"` point to the ESM build.
  - `"files": ["dist"]`
- The npm name `og-view` is currently unclaimed.
- **Release:** manual, from a clean `main`:
  1. `npm version <patch|minor|major>`. Its `version` script runs `auto-changelog -p` and stages `CHANGELOG.md`, so the changelog lands in the version commit and tag.
  2. `npm publish`. `prepublishOnly` runs the tests and the build first.
  3. `git push --follow-tags`
  - The package starts at `0.0.0`, so the first `npm version minor` releases 0.1.0.
  - CI (`.github/workflows/test.yml`) only runs tests. *Changed during the build:* a tag-triggered publish workflow was removed, because it would try to publish the same version a second time after a manual `npm publish`.

## 7. Demo via GitHub Pages, from Markdown only

Use GitHub Pages' built-in Jekyll build on `main` / root, so **`README.md` becomes `index.html`** automatically:

- `_config.yml` sets `title`, `description`, `author`, `logo` and the default `image`. The default Pages theme includes `jekyll-seo-tag`, which **emits real `og:*` and `twitter:*` tags into `<head>`** from that config. The demo then shows real data with no hand-written meta tags.
- `README.md` contains, as raw HTML (kramdown passes it through):
  ```html
  <og-view></og-view>
  <script src="https://unpkg.com/og-view" defer></script>
  ```
  On github.com the README renders the same text with those tags stripped. On Pages they're live.
- The `og:image` is `https://placehold.co/1200x630/png?text=og-view`, set as `image:` in `_config.yml`.
  - It must be `/png`, because placehold.co serves SVG by default and Facebook, X and LinkedIn reject SVG for `og:image`.
  - The file-size check only runs if placehold.co sends `Timing-Allow-Origin`. If it doesn't, the demo's console simply won't include `image-bytes`.
- No `index.html`, no custom layout, and no image in the repo. The only addition is `_config.yml`.

**Why Jekyll:** it's what GitHub Pages runs on a branch by default, and its built-in plugins turn `README.md` into `index.html` and emit the `og:*` tags. The alternatives each add something:
- A different static site generator needs a GitHub Action.
- Rendering Markdown in the browser needs an `index.html` shell, and the OG tags would have to be written by hand.

**Decision: load the demo script from unpkg.** The README snippet and the demo stay identical. The trade-off is that the demo only reflects a release, not `main`. Local development uses a small dev page served by esbuild (`npm run dev`). It's dev-only and not part of Pages.

The demo README tells visitors to open the console for the debugger output, and to inspect the element to see each value's `data-og` source.

## 8. Testing

- Unit tests (Vitest + happy-dom) for `collect.js` fallback chains and every `debug.js` rule, using fixture `<head>` snippets.
- A render smoke test asserting that parts and tag chips reflect sources.
- Manual check: drop the IIFE onto a few real pages, including the mise-en-mode site from the mock.

## 9. Milestones

**Status (2026-10-27):** milestones 1–6 are built and tested. In milestone 7, the README, Pages config and CI workflows are done. Enabling Pages and the first npm publish are still to do.

1. Scaffold the package, esbuild, Vitest and `_config.yml`.
2. `collect.js` with tests.
3. `debug.js` core:
   - the rule runner and console output
   - per-platform resolution
   - spec and tag-hygiene rules, with tests
4. Platform rules (X, Facebook, LinkedIn, Discord), image, video and favicon rules, with tests.
5. Element and layout matching the mock (including the dual-image load and hide), plus the QR code.
6. Layered light-DOM stylesheet, custom properties, and a test against a few real sites' CSS.
7. README docs, Pages demo and first npm publish.

---

## Decisions

| Topic | Decision |
| --- | --- |
| Styling | Light DOM. Page CSS styles the content, and a layered `:where()` stylesheet handles layout only. |
| Demo script | Loaded from unpkg (same snippet as the README). |
| Demo site | GitHub Pages' default Jekyll build of `README.md`. |
| Demo image | `https://placehold.co/1200x630/png?text=og-view` |
| Scope | Current page's `<head>` only. There's no `src=` attribute and no previewing of other pages. |
| Network | No requests beyond the images the card renders: `og:image`, `twitter:image` when it's different (hidden if both load), and the favicon. |
| Assumption | Metadata in `<head>` is in the server-rendered HTML, not added on the client. So the live DOM is treated as what crawlers see. |
| Defaults | QR code **on** (`no-qr` to hide). Console debugger **on** (`quiet` to silence). Sources are always in the markup as `data-og`, with no visible chips. |
| Name | `og-view` on npm (available) and the `<og-view>` element. |

