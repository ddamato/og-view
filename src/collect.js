/**
 * Reads Open Graph and related metadata from a document's <head>.
 *
 * Tags are kept in document order, including empty values, duplicates and
 * mis-cased keys, so the debugger can report on them. Lookups are exact and
 * skip empty values, matching how the spec and Discord read tags.
 */

/** Keys whose prefix marks them as metadata we care about. */
const PREFIXED = /^(og|twitter|article|fb|book|profile|music|video):/i;

/** Unprefixed keys we also collect. */
const PLAIN = new Set([
  'theme-color',
  'pubdate',
  'iso-8601-publish-date',
  'author',
  'description',
  'application-name',
]);

/**
 * @typedef {object} Tag
 * @property {string} key Key exactly as written.
 * @property {string} value Raw value, untrimmed.
 * @property {'property' | 'name'} attr Which attribute held the key.
 * @property {number} index Position among collected tags.
 * @property {string | null} media The `media` attribute, used by theme-color.
 */

/**
 * @typedef {object} MediaGroup
 * @property {string} rootKey The tag that started the group, like `og:image:url`.
 * @property {string} url
 * @property {Record<string, string>} props Structured properties keyed by suffix, like `width`.
 * @property {string[]} attached Every structured property key that followed the root.
 * @property {number} index
 */

/**
 * @typedef {object} Field
 * @property {string} [value]
 * @property {string} [source] Where the value came from, like `og:title` or `<title>`.
 */

/**
 * @param {Document} doc
 * @param {{ url?: string }} [options] Page URL, used to resolve relative URLs.
 */
export function collect(doc, options = {}) {
  const pageUrl = options.url ?? doc.location?.href ?? doc.baseURI;
  // An explicit page URL wins over the document's base, which is meaningless
  // for parsed documents. A <base href> still applies relative to it.
  const baseHref = doc.querySelector('base[href]')?.getAttribute('href');
  const base = options.url ? new URL(baseHref ?? '', options.url).href : doc.baseURI;
  /** @param {string | undefined} value */
  const resolve = (value) => {
    if (!value) return undefined;
    try {
      return new URL(value, base).href;
    } catch {
      return value;
    }
  };

  /** @type {Tag[]} */
  const tags = [];
  for (const el of doc.head?.querySelectorAll('meta') ?? []) {
    const property = el.getAttribute('property');
    const name = el.getAttribute('name');
    const key = property ?? name;
    if (!key || !(PREFIXED.test(key) || PLAIN.has(key.toLowerCase()))) continue;
    tags.push({
      key,
      value: el.getAttribute('content') ?? el.getAttribute('value') ?? '',
      attr: property !== null ? 'property' : 'name',
      index: tags.length,
      media: el.getAttribute('media'),
    });
  }

  /** @param {string} key */
  const getAll = (key) => tags.filter((t) => t.key === key && t.value.trim()).map((t) => t.value.trim());
  /** @param {string} key */
  const get = (key) => getAll(key)[0];
  /** @param {string} key */
  const has = (key) => getAll(key).length > 0;

  const images = groupMedia(tags, {
    roots: ['og:image', 'og:image:url', 'og:image:secure_url'],
    props: ['og:image:url', 'og:image:secure_url', 'og:image:type', 'og:image:width', 'og:image:height', 'og:image:alt'],
  });
  const twitterImages = groupMedia(tags, {
    roots: ['twitter:image', 'twitter:image:src'],
    props: ['twitter:image:alt', 'twitter:image:width', 'twitter:image:height'],
  });
  const videos = groupMedia(tags, {
    roots: ['og:video', 'og:video:url', 'og:video:secure_url'],
    props: ['og:video:url', 'og:video:secure_url', 'og:video:type', 'og:video:width', 'og:video:height'],
  });

  const links = [...(doc.head?.querySelectorAll('link[rel]') ?? [])];
  const icons = links
    .filter((l) => /(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/i.test(l.getAttribute('rel') ?? ''))
    .filter((l) => l.getAttribute('href'))
    .map((l) => ({
      href: /** @type {string} */ (resolve(l.getAttribute('href') ?? '')),
      rel: (l.getAttribute('rel') ?? '').toLowerCase(),
      sizes: l.getAttribute('sizes'),
      type: l.getAttribute('type'),
    }));
  const canonical = links.find((l) => /(^|\s)canonical(\s|$)/i.test(l.getAttribute('rel') ?? ''))?.getAttribute('href') ?? undefined;
  const oembed = doc.head?.querySelector('link[type="application/json+oembed"]')?.getAttribute('href') ?? undefined;

  const title = doc.querySelector('title')?.textContent?.trim() || undefined;
  const metaDescription = tags.find((t) => t.key === 'description' && t.attr === 'name' && t.value.trim())?.value.trim();
  const metaAuthor = tags.find((t) => t.key === 'author' && t.attr === 'name' && t.value.trim())?.value.trim();
  const applicationName = tags.find((t) => t.key === 'application-name' && t.value.trim())?.value.trim();

  /**
   * First candidate with a value wins.
   * @param {Array<[string | undefined, string]>} candidates [value, source] pairs.
   * @returns {Field}
   */
  const first = (candidates) => {
    for (const [value, source] of candidates) if (value) return { value, source };
    return {};
  };

  const ogImage = images[0];
  const twitterImage = twitterImages[0];
  const icon = pickIcon(icons);
  const origin = safeOrigin(pageUrl);

  const fields = {
    siteName: first([
      [get('og:site_name'), 'og:site_name'],
      [applicationName, 'application-name'],
      [safeHostname(pageUrl), 'location.hostname'],
    ]),
    favicon: icon
      ? { value: icon.href, source: icon.rel.includes('apple') ? 'apple-touch-icon' : 'link[rel=icon]' }
      : { value: origin ? `${origin}/favicon.ico` : undefined, source: '/favicon.ico' },
    title: first([
      [get('og:title'), 'og:title'],
      [get('twitter:title'), 'twitter:title'],
      [title, '<title>'],
    ]),
    description: first([
      [get('og:description'), 'og:description'],
      [get('twitter:description'), 'twitter:description'],
      [metaDescription, 'meta[name=description]'],
    ]),
    image: ogImage
      ? { value: resolve(ogImage.url), source: ogImage.rootKey }
      : twitterImage
        ? { value: resolve(twitterImage.url), source: twitterImage.rootKey }
        : {},
    twitterImage: twitterImage ? { value: resolve(twitterImage.url), source: twitterImage.rootKey } : {},
    imageAlt: first([
      [ogImage?.props.alt, 'og:image:alt'],
      [twitterImage?.props.alt, 'twitter:image:alt'],
    ]),
    url: first([
      [resolve(get('og:url')), 'og:url'],
      [resolve(canonical), 'link[rel=canonical]'],
      [pageUrl, 'location.href'],
    ]),
    author: first([
      [metaAuthor, 'meta[name=author]'],
      [get('twitter:creator'), 'twitter:creator'],
      [get('article:author'), 'article:author'],
    ]),
    authorUrl: isHttpUrl(get('article:author')) ? { value: get('article:author'), source: 'article:author' } : {},
    type: first([[get('og:type'), 'og:type']]),
    twitterCard: first([[get('twitter:card'), 'twitter:card']]),
  };

  return {
    pageUrl,
    tags,
    get,
    getAll,
    has,
    images,
    twitterImages,
    videos,
    icons,
    canonical,
    oembed,
    title,
    metaDescription,
    metaAuthor,
    fields,
    resolve,
  };
}

/** @typedef {ReturnType<typeof collect>} Collected */

/**
 * Groups structured properties (`og:image:width` and friends) under the root
 * tag they follow. A property with no preceding root is kept in an orphan
 * group with an empty `rootKey`.
 *
 * @param {Tag[]} tags
 * @param {{ roots: string[], props: string[] }} keys
 * @returns {MediaGroup[] & { orphans: string[] }}
 */
function groupMedia(tags, { roots, props }) {
  /** @type {MediaGroup[]} */
  const groups = [];
  /** @type {string[]} */
  const orphans = [];
  /** @type {MediaGroup | undefined} */
  let current;
  for (const tag of tags) {
    const value = tag.value.trim();
    if (!value) continue;
    const suffix = tag.key.split(':').slice(2).join(':');
    // `og:image:url` and `og:image:secure_url` are properties when they follow a
    // plain root, and roots of their own otherwise.
    const isAliasProp = current && current.rootKey === roots[0] && props.includes(tag.key) && roots.includes(tag.key) && !(suffix in current.props);
    if (roots.includes(tag.key) && !isAliasProp) {
      current = { rootKey: tag.key, url: value, props: {}, attached: [], index: tag.index };
      groups.push(current);
    } else if (props.includes(tag.key)) {
      if (current) {
        current.props[suffix] ??= value;
        current.attached.push(tag.key);
      } else {
        orphans.push(tag.key);
      }
    }
  }
  return Object.assign(groups, { orphans });
}

/**
 * Picks a `rel=icon`, falling back to an apple-touch-icon. SVG icons come
 * first, or last with `svg: false`, then the largest.
 * @param {Array<{ href: string, rel: string, sizes: string | null, type: string | null }>} icons
 * @param {{ svg?: boolean }} [options]
 */
export function pickIcon(icons, { svg = true } = {}) {
  const isSvg = (/** @type {typeof icons[number]} */ i) =>
    i.type?.toLowerCase() === 'image/svg+xml' || /\.svg([?#]|$)/i.test(i.href);
  const size = (/** @type {string | null} */ sizes) =>
    sizes === 'any' ? Infinity : Math.max(0, ...(sizes ?? '').split(/\s+/).map((s) => parseInt(s, 10) || 0));
  const byRel = (/** @type {(rel: string) => boolean} */ test) =>
    icons
      .filter((i) => test(i.rel))
      .sort((a, b) => Number(isSvg(b) === svg) - Number(isSvg(a) === svg) || size(b.sizes) - size(a.sizes))[0];
  return byRel((rel) => /(^|\s)icon(\s|$)/.test(rel)) ?? byRel((rel) => rel.includes('apple-touch-icon'));
}

/** @param {string | undefined} value */
export function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\/[^\s/]+/i.test(value);
}

/** @param {string | undefined} url */
function safeHostname(url) {
  try {
    return url ? new URL(url).hostname || undefined : undefined;
  } catch {
    return undefined;
  }
}

/** @param {string | undefined} url */
function safeOrigin(url) {
  try {
    const origin = url ? new URL(url).origin : undefined;
    return origin && origin !== 'null' ? origin : undefined;
  } catch {
    return undefined;
  }
}
