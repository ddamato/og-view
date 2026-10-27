import { collect } from './collect.js';
import { analyze, log } from './debug.js';
import { qrSvg } from './qr.js';
import { injectStyles } from './styles.js';
import { readColors } from './colors.js';

/** How long to wait for an image before reporting without it. */
const IMAGE_TIMEOUT = 10_000;

/**
 * @param {string} tag
 * @param {Record<string, string | boolean | null | undefined>} [attrs]
 * @param {Array<Node | string | null | undefined | false>} children
 */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : value);
  }
  el.append(.../** @type {Array<Node | string>} */ (children.flat().filter((c) => c !== null && c !== undefined && c !== false)));
  return el;
}

/**
 * Waits for an image to load or fail, and measures it.
 * @param {HTMLImageElement} img
 * @returns {Promise<import('./rules/util.js').Measurement>}
 */
function measure(img) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      if (!img.naturalWidth) return resolve({ status: 'error' });
      const entry = /** @type {PerformanceResourceTiming | undefined} */ (
        performance.getEntriesByName(img.currentSrc || img.src, 'resource').at(-1)
      );
      resolve({
        status: 'loaded',
        width: img.naturalWidth,
        height: img.naturalHeight,
        // Zero when the image is cross-origin without Timing-Allow-Origin.
        bytes: entry?.encodedBodySize || undefined,
      });
    };
    const timer = setTimeout(() => resolve({ status: 'pending' }), IMAGE_TIMEOUT);
    if (img.complete) return done();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
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
  #themeObserver = new MutationObserver(() => this.#applyColors());
  #onSchemeChange = () => this.#applyColors();
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
    injectStyles(this.ownerDocument);
    this.#observer = new MutationObserver((records) => {
      // Ignore our own stylesheet.
      if (records.every((r) => [...r.addedNodes, ...r.removedNodes].every((n) => /** @type {Element} */ (n).id === 'og-view-styles'))) return;
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

  /** Exposes the page's colors to the stylesheet so the QR code is dark on light. */
  #applyColors() {
    const colors = readColors(this);
    if (!colors) return;
    this.style.setProperty('--_og-view-qr-dark', colors.dark);
    this.style.setProperty('--_og-view-qr-light', colors.light);
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
    this.#applyColors();

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
    const level = Math.min(6, Math.max(1, parseInt(this.getAttribute('heading-level') ?? '2', 10) || 2));
    const twitterImage = fields.twitterImage.value !== fields.image.value ? fields.twitterImage.value : undefined;

    const image = h(
      'div',
      { class: 'og-view__field' },
      h(
        'figure',
        { class: 'og-view__image' },
        fields.image.value &&
          h('img', {
            src: fields.image.value,
            alt: fields.imageAlt.value ?? '',
            'data-og': fields.image.source,
            'data-measure': fields.image.value,
            'data-role': 'image',
          }),
        twitterImage &&
          h('img', {
            src: twitterImage,
            alt: fields.imageAlt.value ?? '',
            'data-og': fields.twitterImage.source,
            'data-measure': twitterImage,
            'data-role': 'twitter',
            hidden: true,
          }),
        h('div', { class: 'og-view__placeholder', hidden: Boolean(fields.image.value) }, h('code', {}, 'og:image · 1200×630')),
      ),
    );

    const favicon = fields.favicon.value;
    const site = h(
      'div',
      { class: 'og-view__field' },
      h(
        'div',
        { class: 'og-view__site' },
        favicon &&
          h('img', {
            class: 'og-view__favicon',
            src: favicon,
            alt: '',
            'data-og': fields.favicon.source,
            'data-measure': favicon,
            'data-role': 'favicon',
          }),
        h('div', { class: 'og-view__site-name', 'data-og': fields.siteName.source }, fields.siteName.value),
      ),
    );

    const title = fields.title.value &&
      h('div', { class: 'og-view__field' }, h(`h${level}`, { class: 'og-view__title', 'data-og': fields.title.source }, fields.title.value));

    const description = fields.description.value &&
      h('div', { class: 'og-view__field' }, h('p', { class: 'og-view__description', 'data-og': fields.description.source }, fields.description.value));

    const url = fields.url.value;
    const author = fields.author.value &&
      h(
        'div',
        { class: 'og-view__author', 'data-og': fields.author.source },
        fields.authorUrl.value ? h('a', { href: fields.authorUrl.value, 'data-og': fields.authorUrl.source }, fields.author.value) : fields.author.value,
      );
    const meta = h(
      'div',
      { class: 'og-view__meta' },
      !this.hasAttribute('no-qr') && url && h('div', { class: 'og-view__qr', 'data-og': fields.url.source }, qrSvg(url)),
      h(
        'div',
        { class: 'og-view__field og-view__byline' },
        author,
        url && h('a', { class: 'og-view__url', href: url, 'data-og': fields.url.source }, h('code', {}, displayUrl(url))),
      ),
    );

    this.replaceChildren(h('div', { class: 'og-view' }, image, h('div', { class: 'og-view__body' }, site, title, description, h('hr'), meta)));
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

    const favicon = /** @type {HTMLImageElement | null} */ (this.querySelector('img[data-role="favicon"]'));
    if (favicon) favicon.hidden = !ok(favicon);
  }
}
