import { rule, tag, truncate } from './util.js';

const HEX_COLOR = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;
const RFC_3339 = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

export default [
  rule('site-name-length', ['discord'], ['discord'], ({ c }) => {
    const site = c.get('og:site_name');
    if (!site || [...site].length <= 256) return null;
    return {
      severity: 'error',
      message: `og:site_name is ${[...site].length} characters. Over 256, Discord shows no preview at all.`,
    };
  }),

  rule('url-length', ['discord'], ['discord'], ({ c }) => {
    const urls = [
      ...c.getAll('og:url').map((v) => ['og:url', v]),
      ...c.images.map((g) => [g.rootKey, g.url]),
      ...c.twitterImages.map((g) => [g.rootKey, g.url]),
      ...c.videos.map((g) => [g.rootKey, g.url]),
    ];
    return urls
      .filter(([, v]) => v.length > 2048)
      .map(([key, v]) => ({
        severity: /** @type {const} */ ('error'),
        message: `${key} is ${v.length} characters long. Over 2,048, Discord shows no preview at all.`,
      }));
  }),

  rule('image-dims-attach', ['discord'], ['discord'], ({ c }) =>
    [...c.images, ...c.twitterImages]
      .filter((g) => ['og:image:url', 'og:image:secure_url', 'twitter:image:src'].includes(g.rootKey))
      .filter((g) => g.attached.some((k) => /:(width|height|type|alt)$/.test(k)))
      .map((g) => ({
        severity: /** @type {const} */ ('warning'),
        message: `Dimension, type or alt tags follow ${g.rootKey}. Discord only reads them after a plain ${g.rootKey.startsWith('twitter') ? 'twitter:image' : 'og:image'}.`,
        fix: tag(g.rootKey.startsWith('twitter') ? 'twitter:image' : 'og:image', g.url),
      }))),

  rule('theme-color-format', ['discord'], ['discord'], ({ c }) =>
    c.tags
      .filter((t) => t.key === 'theme-color' && t.value.trim() && !HEX_COLOR.test(t.value.trim()))
      .map((t) => ({
        severity: /** @type {const} */ ('warning'),
        message: `theme-color is "${t.value.trim()}". Browsers accept any CSS color, but Discord only reads #RRGGBB or #RRGGBBAA.`,
        fix: '<meta name="theme-color" content="#RRGGBB">',
      }))),

  rule('pubdate-format', ['discord'], ['discord'], ({ c }) =>
    c.tags
      .filter((t) => ['og:pubdate', 'pubdate', 'iso-8601-publish-date'].includes(t.key) && t.value.trim())
      .filter((t) => !RFC_3339.test(t.value.trim()))
      .map((t) => ({
        severity: /** @type {const} */ ('warning'),
        message: `${t.key} is "${truncate(t.value.trim(), 40)}". Discord needs a full RFC 3339 timestamp with a time and offset.`,
        fix: tag(t.key, '2026-01-31T09:00:00Z'),
      }))),

  rule('description-html', ['discord'], ['discord'], ({ c, p }) => {
    const description = p.discord.description;
    if (!description || c.get('og:type') === 'rich' || !/<\/?[a-z][^>]*>/i.test(description)) return null;
    return {
      severity: 'warning',
      message: `${p.discord.descriptionSource} contains HTML tags. Discord shows them literally unless og:type is "rich".`,
    };
  }),

  rule('image-count', ['discord'], ['discord'], ({ c }) => {
    if (c.images.length <= 4) return null;
    return {
      severity: 'info',
      message: `There are ${c.images.length} og:image tags. Discord shows them as a gallery of at most 4.`,
    };
  }),

  rule('theme-color', ['discord'], ['discord'], ({ c }) => {
    if (c.has('theme-color')) return null;
    return {
      severity: 'info',
      message: 'theme-color is missing. Discord uses it as the preview\'s accent color.',
      fix: '<meta name="theme-color" content="#RRGGBB">',
    };
  }),

  rule('fallback-pair', ['discord'], ['discord'], ({ c }) => {
    const hasMeta = ['og:title', 'twitter:title', 'og:description', 'twitter:description'].some((k) => c.has(k));
    if (hasMeta || Boolean(c.title) === Boolean(c.metaDescription)) return null;
    return {
      severity: 'warning',
      message: `There's no og: or twitter: title or description, and only ${c.title ? '<title>' : 'meta[name=description]'} exists. Discord uses <title> and meta description "only as a pair", so it shows neither.`,
      fix: `${tag('og:title', c.title)}\n${tag('og:description', c.metaDescription)}`,
    };
  }),

  rule('oembed-provider', ['discord'], ['discord'], ({ c }) => {
    if (!c.oembed) return null;
    return {
      severity: 'info',
      message: 'An oEmbed link is present. On Discord, its provider_name replaces og:site_name, and its title and thumbnail_url fill in when og: tags are missing.',
    };
  }),

  rule('author-discord', ['discord'], ['discord'], ({ c }) => {
    if (!c.fields.author.value || c.oembed) return null;
    return {
      severity: 'info',
      message: `The page has an author (${c.fields.author.source}), but Discord only shows an author line from oEmbed: "oEmbed is the only way to put an author on a preview".`,
    };
  }),
];
