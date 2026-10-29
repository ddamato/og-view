# og-view

[![npm version](https://img.shields.io/npm/v/og-view.svg)](https://www.npmjs.com/package/og-view)

A web component that displays the Open Graph metadata of the page it's on, and reports in the browser console how that metadata could be improved for X, Facebook, LinkedIn, Discord and Bluesky.

**[This page is the demo](https://ddamato.github.io/og-view/).** The card below is built from this page's own `<head>`. Open the browser console to see the report, and inspect the card to see where each value came from.

<og-view heading-level="3"></og-view>
<script src="https://unpkg.com/og-view" defer></script>

## Install

Add the script from [unpkg](https://unpkg.com/). There's nothing to build or install.

```html
<script src="https://unpkg.com/og-view" defer></script>
```

Or install the package and import it, which defines the element:

```sh
npm install og-view
```

```js
import 'og-view';
```

## Usage

Place the element anywhere on the page:

```html
<og-view></og-view>
```

It reads `<head>` and shows the site name and favicon, title, description, image, author and URL, with a QR code of the URL. It updates when `<head>` changes.

| Attribute | Effect |
| --- | --- |
| `quiet` | Turns off the console report. |
| `no-qr` | Hides the QR code. |
| `heading-level="3"` | Renders the title as `<h3>`. The default is `<h2>`. |

## Styling

`<og-view>` renders into the page itself, not a shadow root. The title is a real `<h2>`, the description a `<p>`, and the URL an `<a>` and `<code>`, so your site's own styles apply to them.

The component's stylesheet only handles layout. The image and text sit side by side and wrap onto separate rows when there isn't room, and the favicon and QR code get a size.

The stylesheet's selectors are wrapped in `:where()`, so any of your CSS wins over them. The exceptions are `.og-view__image img` and `.og-view__body hr`, which keep their class so resets like `img { height: auto }` and `hr { margin: 0 }` don't undo them. To change anything, target these classes:
- `og-view` (the layout), `og-view__image`, `og-view__site`, `og-view__favicon`
- `og-view__title`, `og-view__description`, `og-view__author`, `og-view__url`, `og-view__qr`

```css
.og-view__qr { width: 5rem; }
```

### Where each value came from

Every rendered value has a `data-og` attribute naming the tag it came from. When a tag is missing, the attribute shows the fallback og-view used. Inspect the element to see it:

```html
<h2 class="og-view__title" data-og="&lt;title&gt;">…</h2>
<p class="og-view__description" data-og="og:description">…</p>
```

You can also style by source, for example to highlight fallbacks while working on a page:

```css
og-view [data-og^="<"], og-view [data-og*="location"] { outline: 2px dashed red; }
```

## The console report

The report is one collapsed console group. It has a table of the values shown and where each came from, then one line per finding. Errors, warnings and info use `console.error`, `console.warn` and `console.info`, so the console's level filters work:

```
[X, Discord] twitter:card is missing. X "may" render a small summary card, and Discord defaults to a small thumbnail. summary_large_image shows the image large on both.
→ <meta name="twitter:card" content="summary_large_image">
Source: https://developer.x.com/… · https://docs.discord.com/…
```

There are about 55 checks. Each one cites the spec or a platform's documentation, and the source link is printed with every finding. They cover:
- the Open Graph spec
- X, Facebook, LinkedIn and Discord's documented limits
- images, video and the favicon

When platforms disagree, each platform's result is reported separately. For example, X wants a 2:1 image and LinkedIn wants 1.91:1. Each rule, with the sources it cites, is in [src/rules](https://github.com/ddamato/og-view/tree/main/src/rules).

The report ends with links to each platform's own preview debugger, and notes on how long each platform caches previews.

### Limits

- **No extra requests.** og-view only loads the images it displays: `og:image`, `twitter:image` when it's a different file, and the favicon. It doesn't download the page's HTML again, so leaving it on a live page costs nothing beyond the card.
- **It assumes your metadata is in the HTML your server sends.** Link-preview crawlers don't run JavaScript, so tags added by client-side scripts won't appear in previews. og-view can't tell the difference, because it reads the live page.
- **The image file-size check needs the browser to expose the size.** That works for images on the same site, or on servers that send `Timing-Allow-Origin`. Otherwise the check is skipped.
- **Bluesky** doesn't document how it reads tags, so there are no Bluesky-specific checks.

## JavaScript API

```js
const el = document.querySelector('og-view');

el.addEventListener('og-view:report', (event) => {
  const { fields, findings } = event.detail;
});

el.report;    // The latest { fields, findings }
el.refresh(); // Re-read <head>
```

The ESM build also exports `collect(document)` and `analyze(collected)` for running the checks without the element, such as in tests.

## Keeping the checks current

Platforms change their documentation and their behavior. If a check is wrong or out of date, please open an issue or pull request that links the newer source.

## Development

```sh
npm install
npm run dev    # serves dev/index.html at http://localhost:8000
npm test
npm run build  # dist/og-view.js (ESM) and dist/og-view.iife.js
```

### Releasing

From a clean working tree on `main`:

```sh
npm version minor      # or patch / major: bumps the version, updates CHANGELOG.md, commits and tags
npm publish            # runs the tests and builds first (prepublishOnly)
git push --follow-tags
```
