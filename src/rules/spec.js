import { rule, tag, isAbsoluteHttp, truncate } from './util.js';

/** Types listed on ogp.me. */
const OG_TYPES = new Set([
  'music.song',
  'music.album',
  'music.playlist',
  'music.radio_station',
  'video.movie',
  'video.episode',
  'video.tv_show',
  'video.other',
  'article',
  'book',
  'profile',
  'website',
  'payment.link',
]);

/** Properties with a single value. Duplicates of these are reported. */
const SINGLE_VALUE = [
  'og:title',
  'og:type',
  'og:url',
  'og:description',
  'og:site_name',
  'og:locale',
  'og:determiner',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:site',
  'twitter:creator',
  'fb:app_id',
  'article:published_time',
  'article:modified_time',
  'theme-color',
  'og:pubdate',
  'pubdate',
  'iso-8601-publish-date',
];

/** Discord takes the last of these instead of the first. */
const LAST_WINS_ON_DISCORD = new Set(['og:type', 'twitter:card', 'theme-color', 'og:pubdate', 'pubdate', 'iso-8601-publish-date']);

const ISO_8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const LOCALE = /^[a-z]{2,3}_([A-Z]{2}|\d{3})$/;

export default [
  rule('required', ['spec'], ['ogp'], ({ c }) => {
    const { fields } = c;
    /** @type {Array<[string, boolean, string | undefined, string | undefined]>} */
    const required = [
      ['og:title', c.has('og:title'), fields.title.value, fields.title.source],
      ['og:type', c.has('og:type'), undefined, undefined],
      ['og:image', c.images.length > 0, fields.image.value, fields.image.source],
      ['og:url', c.has('og:url'), fields.url.value, fields.url.source],
    ];
    return required
      .filter(([, present]) => !present)
      .map(([key, , fallback, source]) => ({
        severity: /** @type {const} */ ('error'),
        message:
          key === 'og:type'
            ? 'Missing og:type, one of the four required properties. Pages without it are treated as "website".'
            : `Missing ${key}, one of the four required properties.${fallback ? ` og-view fell back to ${source}.` : ''}`,
        fix: tag(key, key === 'og:type' ? 'website' : fallback),
      }));
  }),

  rule('url-protocol', ['spec'], ['ogp'], ({ c }) => {
    const checks = [
      ...c.getAll('og:url').map((v) => ['og:url', v]),
      ...c.images.map((g) => [g.rootKey, g.url]),
    ];
    return checks
      .filter(([, value]) => !isAbsoluteHttp(value))
      .map(([key, value]) => ({
        severity: /** @type {const} */ ('error'),
        message: `${key} must be an absolute http(s) URL, but is "${truncate(value)}".`,
        fix: tag(key, c.resolve(value)),
      }));
  }),

  rule('image-alt', ['spec', 'x', 'discord'], ['ogp', 'x', 'discord'], ({ c }) =>
    c.images.flatMap((g, i) => {
      const label = c.images.length > 1 ? `og:image #${i + 1}` : 'og:image';
      const alt = g.props.alt;
      if (!alt) {
        return [{
          severity: /** @type {const} */ ('warning'),
          platforms: ['spec'],
          sources: ['ogp'],
          message: `${label} has no og:image:alt. The spec says it "should also be specified".`,
          fix: tag('og:image:alt', 'A description of the image'),
        }];
      }
      if (alt.length > 4096) {
        return [{
          severity: /** @type {const} */ ('error'),
          platforms: ['discord'],
          sources: ['discord'],
          message: `${label} alt text is ${alt.length} characters. Over 4,096, Discord shows no preview at all.`,
        }];
      }
      if (alt.length > 420) {
        return [{
          severity: /** @type {const} */ ('warning'),
          platforms: ['x'],
          sources: ['x'],
          message: `${label} alt text is ${alt.length} characters. X allows at most 420.`,
        }];
      }
      return [];
    })),

  rule('duplicate', ['spec', 'discord'], ['ogp', 'discord'], ({ c }) =>
    SINGLE_VALUE.flatMap((key) => {
      // theme-color tags with different `media` are intentional variants.
      const values = c.tags.filter((t) => t.key === key && t.value.trim() && !(key === 'theme-color' && t.media));
      if (values.length < 2) return [];
      const distinct = new Set(values.map((t) => t.value.trim()));
      const first = values[0].value.trim();
      const last = values[values.length - 1].value.trim();
      if (distinct.size === 1) {
        return [{
          severity: /** @type {const} */ ('info'),
          platforms: ['spec'],
          sources: ['ogp'],
          message: `${key} appears ${values.length} times with the same value. Remove the extras.`,
        }];
      }
      if (LAST_WINS_ON_DISCORD.has(key) && first !== last) {
        return [{
          severity: /** @type {const} */ ('warning'),
          message: `${key} appears ${values.length} times with different values. Platforms disagree on which wins: ogp.me uses the first ("${truncate(first, 40)}"), Discord uses the last ("${truncate(last, 40)}").`,
          fix: `Keep a single ${tag(key, first)}`,
        }];
      }
      return [{
        severity: /** @type {const} */ ('warning'),
        platforms: ['spec'],
        sources: ['ogp'],
        message: `${key} appears ${values.length} times with different values. The first ("${truncate(first, 40)}") takes precedence, so the rest are ignored.`,
        fix: `Keep a single ${tag(key, first)}`,
      }];
    })),

  rule('structure-order', ['spec'], ['ogp'], ({ c }) =>
    [...new Set([...c.images.orphans, ...c.videos.orphans])].map((key) => ({
      severity: /** @type {const} */ ('warning'),
      message: `${key} appears before any ${key.split(':').slice(0, 2).join(':')}, so it isn't attached to anything. Structured properties must follow their root tag.`,
    }))),

  rule('canonical', ['spec', 'facebook'], ['ogp', 'fb'], ({ c }) => {
    const ogUrl = c.get('og:url');
    if (!ogUrl || !c.canonical) return null;
    const a = c.resolve(ogUrl);
    const b = c.resolve(c.canonical);
    if (a === b) return null;
    return {
      severity: 'warning',
      message: `og:url (${a}) doesn't match link[rel=canonical] (${b}). og:url should be the canonical URL.`,
      fix: tag('og:url', b),
    };
  }),

  rule('type-value', ['spec'], ['ogp'], ({ c }) => {
    const type = c.get('og:type');
    if (!type || OG_TYPES.has(type) || /^[a-z0-9_-]+:[a-z0-9_.-]+$/i.test(type)) return null;
    return {
      severity: 'info',
      message: `og:type "${type}" isn't a type listed on ogp.me and isn't namespaced (prefix:type).${type === 'rich' ? ' Discord does read "rich" to render the description as markdown.' : ''}`,
    };
  }),

  rule('article-details', ['spec', 'discord'], ['ogp', 'discord'], ({ c }) => {
    if (c.get('og:type') !== 'article') return null;
    const missing = ['article:published_time', 'article:author'].filter((k) => !c.has(k));
    if (!missing.length) return null;
    return {
      severity: 'info',
      message: `og:type is "article" but ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing. Both are optional.${missing.includes('article:published_time') ? ' Discord reads dates from og:pubdate, not article:published_time.' : ''}`,
      fix: missing.map((k) => tag(k)).join('\n'),
    };
  }),

  rule('article-author', ['spec'], ['ogp'], ({ c }) =>
    c.getAll('article:author')
      .filter((v) => !isAbsoluteHttp(v))
      .map((v) => ({
        severity: /** @type {const} */ ('info'),
        message: `article:author is "${truncate(v, 40)}", but the spec types it as a profile (a URL to the author's page).`,
        fix: `${tag('article:author', 'https://example.com/about')}\n<meta name="author" content="${v}">`,
      }))),

  rule('property-attr', ['spec'], ['ogp'], ({ c }) => {
    const keys = [...new Set(c.tags.filter((t) => t.attr === 'name' && /^(og|article|fb):/i.test(t.key)).map((t) => t.key))];
    if (!keys.length) return null;
    return {
      severity: 'info',
      message: `${keys.join(', ')} ${keys.length > 1 ? 'use' : 'uses'} name= instead of property=. Most parsers still read it, but the spec's markup uses property.`,
      fix: tag(keys[0]),
    };
  }),

  rule('optional', ['spec', 'discord'], ['ogp', 'discord', 'bsky'], ({ c }) => {
    /** @type {import('./util.js').Partial[]} */
    const findings = [];
    if (!c.has('og:site_name')) {
      findings.push({
        severity: 'info',
        platforms: ['spec', 'discord', 'bluesky'],
        message: 'og:site_name is missing. It\'s optional, but Discord shows it above the title. (Bluesky doesn\'t show it either way.)',
        fix: tag('og:site_name', c.fields.siteName.value),
      });
    }
    if (!c.has('og:locale')) {
      findings.push({
        severity: 'info',
        platforms: ['spec'],
        sources: ['ogp'],
        message: 'og:locale is missing. It\'s optional and defaults to en_US.',
        fix: tag('og:locale', 'en_US'),
      });
    }
    return findings;
  }),

  rule('locale-format', ['spec'], ['ogp'], ({ c }) =>
    [...c.getAll('og:locale').map((v) => ['og:locale', v]), ...c.getAll('og:locale:alternate').map((v) => ['og:locale:alternate', v])]
      .filter(([, v]) => !LOCALE.test(v))
      .map(([key, v]) => ({
        severity: /** @type {const} */ ('warning'),
        message: `${key} is "${v}", but must be language_TERRITORY, like en_US.`,
        fix: tag(key, /^[a-z]{2,3}-[a-z]{2}$/i.test(v) ? `${v.slice(0, v.indexOf('-')).toLowerCase()}_${v.slice(v.indexOf('-') + 1).toUpperCase()}` : 'en_US'),
      }))),

  rule('datetime-format', ['spec'], ['ogp'], ({ c }) =>
    c.tags
      .filter((t) => /^(article:(published|modified|expiration)_time|[a-z]+:release_date)$/.test(t.key) && t.value.trim())
      .filter((t) => !ISO_8601.test(t.value.trim()) || Number.isNaN(Date.parse(t.value.trim())))
      .map((t) => ({
        severity: /** @type {const} */ ('warning'),
        message: `${t.key} is "${truncate(t.value.trim(), 40)}", which isn't a valid ISO 8601 datetime.`,
        fix: tag(t.key, '2026-01-31T09:00:00Z'),
      }))),
];
