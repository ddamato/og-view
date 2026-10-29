import { collect } from './collect.js';
import { analyze, log } from './debug.js';
import { qrSvg } from './qr.js';
import { STYLES } from './styles.js';
import { readScheme } from './colors.js';

/** How long to wait for an image before reporting without it. */
const IMAGE_TIMEOUT = 10_000;

/**
 * The card and its stylesheet. Parts without a value are removed on render,
 * and the heading is swapped for the `heading-level` tag.
 */
const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `<style>${STYLES}</style>` + `
  <div class="og-view">
    <div class="og-view__image">
      <img data-role="image">
      <img data-role="twitter" hidden>
      <div class="og-view__placeholder"><code>og:image · 1200×630</code></div>
    </div>
    <div class="og-view__body">
      <div class="og-view__field">
        <div class="og-view__site">
          <img class="og-view__favicon" data-role="favicon" alt="">
          <div class="og-view__site-name"></div>
        </div>
      </div>
      <div class="og-view__field"><h2 class="og-view__title"></h2></div>
      <div class="og-view__field"><p class="og-view__description"></p></div>
      <hr>
      <div class="og-view__meta">
        <div class="og-view__qr"></div>
        <div class="og-view__field og-view__byline">
          <div class="og-view__author"></div>
          <a class="og-view__url"><code></code></a>
        </div>
      </div>
    </div>
  </div>
`.replace(/>\s+</g, '><').trim();

/**
 * Writes a field's value as text and marks its source, or removes `remove`
 * when there's no value.
 * @param {Element} el
 * @param {import('./collect.js').Field} field
 * @param {Element} [remove]
 */
function fill(el, field, remove = el) {
  if (!field.value) {
    remove.remove();
    return false;
  }
  el.textContent = field.value;
  el.setAttribute('data-og', field.source ?? '');
  return true;
}

/**
 * Points an image at a URL to be measured, or removes it when there's none.
 * @param {HTMLImageElement} img
 * @param {string | undefined} url
 * @param {import('./collect.js').Field} field
 */
function fillImage(img, url, field) {
  if (!url) return img.remove();
  img.src = url;
  img.setAttribute('data-og', field.source ?? '');
  img.setAttribute('data-measure', url);
}

/**
 * Waits for an image to load or fail, and measures it.
 * @param {HTMLImageElement} img
 * @returns {Promise<import('./rules/util.js').Measurement>}
 */
function measure(img) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ status: 'pending' }), IMAGE_TIMEOUT);
    // decode() settles for images that already loaded too, and unlike a zero
    // naturalWidth, it doesn't mistake an SVG with only a viewBox for a broken image.
    img
      .decode()
      .then(
        () => {
          const entry = /** @type {PerformanceResourceTiming | undefined} */ (
            performance.getEntriesByName(img.currentSrc || img.src, 'resource').at(-1)
          );
          resolve({
            status: 'loaded',
            // Zero for an SVG without width and height.
            width: img.naturalWidth || undefined,
            height: img.naturalHeight || undefined,
            // Zero when the image is cross-origin without Timing-Allow-Origin.
            bytes: entry?.encodedBodySize || undefined,
          });
        },
        () => resolve({ status: 'error' }),
      )
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Sets the image behind the blurred backdrop, or clears it.
 * @param {HTMLElement} el
 * @param {string | undefined} url
 */
function setBackdrop(el, url) {
  if (url) el.style.setProperty('--_og-view-backdrop', `url(${JSON.stringify(url)})`);
  else el.style.removeProperty('--_og-view-backdrop');
}

/** @param {string} url */
function displayUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export class OgView extends HTMLElement {
  static observedAttributes = ['no-qr', 'heading-level'];

  /** @type {import('./debug.js').Report | undefined} */
  #report;
  /** @type {MutationObserver | undefined} */
  #observer;
  /** Watches for theme changes on <html> and <body>. */
  #themeObserver = new MutationObserver(() => this.#applyScheme());
  #onSchemeChange = () => this.#applyScheme();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #debounce;
  #generation = 0;
  /** The metadata last rendered, so unrelated <head> changes are skipped. */
  #signature = '';
  /** The last report logged, so re-renders don't repeat identical output. */
  #logged = '';

  /** The latest `{ fields, findings }`, or undefined until images settle. */
  get report() {
    return this.#report;
  }

  connectedCallback() {
    this.#observer = new MutationObserver(() => {
      clearTimeout(this.#debounce);
      this.#debounce = setTimeout(() => this.refresh({ ifChanged: true }), 100);
    });
    this.#observer.observe(this.ownerDocument.head, { childList: true, subtree: true, attributes: true, characterData: true });
    const { documentElement, body } = this.ownerDocument;
    for (const el of [documentElement, body]) {
      if (el) this.#themeObserver.observe(el, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-mode'] });
    }
    this.ownerDocument.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', this.#onSchemeChange);
    this.refresh();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#themeObserver.disconnect();
    this.ownerDocument.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').removeEventListener('change', this.#onSchemeChange);
    clearTimeout(this.#debounce);
    this.#signature = '';
  }

  /** Tells the stylesheet whether the page behind the card is light or dark, for an SVG favicon. */
  #applyScheme() {
    const scheme = readScheme(this);
    if (scheme) this.style.setProperty('--_og-view-scheme', scheme);
  }

  attributeChangedCallback() {
    if (this.isConnected) this.refresh();
  }

  /**
   * Re-reads <head>, re-renders and re-runs the debugger.
   * @param {{ ifChanged?: boolean }} [options] Skip when the metadata hasn't changed.
   */
  async refresh({ ifChanged = false } = {}) {
    const c = collect(this.ownerDocument);
    const signature = JSON.stringify([c.tags, c.icons, c.title, c.canonical, c.oembed, c.pageUrl]);
    if (ifChanged && signature === this.#signature) return;
    this.#signature = signature;
    const generation = ++this.#generation;
    this.#render(c);
    this.#applyScheme();

    const imgs = /** @type {HTMLImageElement[]} */ ([...this.querySelectorAll('img[data-measure]')]);
    const results = await Promise.all(imgs.map(measure));
    if (generation !== this.#generation) return;

    /** @type {Map<string, import('./rules/util.js').Measurement>} */
    const measurements = new Map();
    imgs.forEach((img, i) => measurements.set(/** @type {string} */ (img.dataset.measure), results[i]));
    this.#showImages(measurements);

    const report = analyze(c, (url) => (url ? measurements.get(url) : undefined));
    this.#report = report;
    this.dispatchEvent(new CustomEvent('og-view:report', { detail: report, bubbles: true }));

    const serialized = JSON.stringify(report);
    if (!this.hasAttribute('quiet') && serialized !== this.#logged) {
      this.#logged = serialized;
      // Debugger links use the URL people would share, not necessarily this page's address.
      log(report, c.fields.url.value ?? c.pageUrl);
    }
  }

  /**
   * Each rendered value carries `data-og` naming where it came from, like
   * `og:title`, or `<title>` when og-view fell back.
   * @param {import('./collect.js').Collected} c
   */
  #render(c) {
    const { fields } = c;
    const card = /** @type {DocumentFragment} */ (TEMPLATE.content.cloneNode(true));
    const $ = (/** @type {string} */ selector) => /** @type {HTMLElement} */ (card.querySelector(selector));

    const image = /** @type {HTMLImageElement} */ ($('[data-role="image"]'));
    const twitter = /** @type {HTMLImageElement} */ ($('[data-role="twitter"]'));
    image.alt = twitter.alt = fields.imageAlt.value ?? '';
    fillImage(image, fields.image.value, fields.image);
    fillImage(twitter, fields.twitterImage.value !== fields.image.value ? fields.twitterImage.value : undefined, fields.twitterImage);
    $('.og-view__placeholder').hidden = Boolean(fields.image.value);
    setBackdrop($('.og-view__image'), fields.image.value);

    fillImage(/** @type {HTMLImageElement} */ ($('.og-view__favicon')), fields.favicon.value, fields.favicon);
    fill($('.og-view__site-name'), fields.siteName);

    const level = Math.min(6, Math.max(1, parseInt(this.getAttribute('heading-level') ?? '2', 10) || 2));
    let title = $('.og-view__title');
    if (level !== 2) {
      const heading = document.createElement(`h${level}`);
      heading.className = title.className;
      title.replaceWith(heading);
      title = heading;
    }
    fill(title, fields.title, title.parentElement ?? title);
    const description = $('.og-view__description');
    fill(description, fields.description, description.parentElement ?? description);

    const author = $('.og-view__author');
    if (fill(author, fields.author) && fields.authorUrl.value) {
      const authorLink = document.createElement('a');
      authorLink.href = fields.authorUrl.value;
      authorLink.setAttribute('data-og', fields.authorUrl.source ?? '');
      authorLink.append(...author.childNodes);
      author.append(authorLink);
    }

    const url = fields.url.value;
    const qr = $('.og-view__qr');
    if (url && !this.hasAttribute('no-qr')) {
      qr.setAttribute('data-og', fields.url.source ?? '');
      qr.append(qrSvg(url));
    } else qr.remove();
    const urlLink = /** @type {HTMLAnchorElement} */ ($('.og-view__url'));
    if (url) {
      urlLink.href = url;
      urlLink.setAttribute('data-og', fields.url.source ?? '');
      /** @type {HTMLElement} */ (urlLink.firstElementChild).textContent = displayUrl(url);
    } else urlLink.remove();

    this.replaceChildren(card);
  }

  /**
   * Shows og:image, falling back to twitter:image, then the placeholder.
   * @param {Map<string, import('./rules/util.js').Measurement>} measurements
   */
  #showImages(measurements) {
    const og = /** @type {HTMLImageElement | null} */ (this.querySelector('img[data-role="image"]'));
    const twitter = /** @type {HTMLImageElement | null} */ (this.querySelector('img[data-role="twitter"]'));
    const ok = (/** @type {HTMLImageElement | null} */ img) => img && measurements.get(img.dataset.measure ?? '')?.status === 'loaded';
    const shown = ok(og) ? og : ok(twitter) ? twitter : null;
    if (og) og.hidden = og !== shown;
    if (twitter) twitter.hidden = twitter !== shown;
    this.querySelector('.og-view__placeholder')?.toggleAttribute('hidden', Boolean(shown));
    const backdrop = /** @type {HTMLElement | null} */ (this.querySelector('.og-view__image'));
    if (backdrop) setBackdrop(backdrop, shown?.dataset.measure);

    const favicon = /** @type {HTMLImageElement | null} */ (this.querySelector('img[data-role="favicon"]'));
    if (favicon) favicon.hidden = !ok(favicon);
  }
}
