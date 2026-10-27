import { rule, IMAGE_FORMATS, extFromMime, extFromUrl } from './util.js';
import { PLATFORMS } from '../sources.js';

const FIVE_MB = 5 * 1024 * 1024;

/** @typedef {'x' | 'facebook' | 'discord' | 'linkedin'} Platform */

/**
 * Distinct images and the platforms that use each one.
 * @param {import('./util.js').Context} ctx
 * @param {Platform[]} platforms
 */
function imagesByUrl({ c, p }, platforms) {
  /** @type {Map<string, { group: import('../collect.js').MediaGroup, platforms: Platform[] }>} */
  const byUrl = new Map();
  for (const platform of platforms) {
    const group = p[platform].image;
    const url = group && c.resolve(group.url);
    if (!group || !url) continue;
    const entry = byUrl.get(url) ?? { group, platforms: [] };
    entry.platforms.push(platform);
    byUrl.set(url, entry);
  }
  return byUrl;
}

/** @param {string[]} platforms */
const names = (platforms) => platforms.map((pl) => PLATFORMS[/** @type {keyof typeof PLATFORMS} */ (pl)] ?? pl).join(', ');

export default [
  rule('image-load', ['all'], [], ({ c, measure }) => {
    const urls = [...new Set([c.fields.image.value, c.fields.twitterImage.value].filter(Boolean))];
    return urls
      .filter((url) => measure(url)?.status === 'error')
      .map((url) => ({
        severity: /** @type {const} */ ('error'),
        message: `The image at ${url} failed to load, so no platform can show it.`,
      }));
  }),

  rule('image-format', ['x', 'facebook', 'discord'], ['x', 'fb', 'discord'], (ctx) =>
    [...imagesByUrl(ctx, ['x', 'facebook', 'discord'])].flatMap(([url, { group, platforms }]) => {
      const format = extFromUrl(url) ?? extFromMime(group.props.type);
      if (!format) return [];
      const unsupported = platforms.filter((pl) => !IMAGE_FORMATS[/** @type {keyof typeof IMAGE_FORMATS} */ (pl)].includes(format));
      if (!unsupported.length) return [];
      const none = unsupported.length === platforms.length;
      return [{
        severity: none ? /** @type {const} */ ('error') : /** @type {const} */ ('warning'),
        platforms: unsupported,
        message: `${group.rootKey} is ${format.toUpperCase()}, which ${names(unsupported)} ${unsupported.length > 1 ? "don't" : "doesn't"} support.${format === 'svg' ? ' X: "SVG is not supported".' : ''} Use PNG or JPG for the widest support.`,
      }];
    })),

  rule('image-size-x', ['x'], ['x-large'], ({ p, c, measure }) => {
    const m = measure(c.resolve(p.x.image?.url));
    if (m?.status !== 'loaded' || !m.width || !m.height) return null;
    const tooSmall = m.width < 300 || m.height < 157;
    const tooLarge = m.width > 4096 || m.height > 4096;
    if (!tooSmall && !tooLarge) return null;
    return {
      severity: 'warning',
      message: `The image X uses (${p.x.image?.rootKey}) is ${m.width}×${m.height}. summary_large_image needs at least 300×157 and at most 4096×4096.`,
    };
  }),

  rule('image-ratio', ['x', 'linkedin'], ['li', 'x-large'], ({ p, c, measure }) =>
    /** @type {Array<[Platform, number, string, string]>} */ ([
      ['linkedin', 1.91, '1.91:1', 'li'],
      ['x', 2, '2:1', 'x-large'],
    ]).flatMap(([platform, target, label, source]) => {
      const m = measure(c.resolve(p[platform].image?.url));
      if (m?.status !== 'loaded' || !m.width || !m.height) return [];
      const ratio = m.width / m.height;
      if (Math.abs(ratio - target) / target <= 0.05) return [];
      return [{
        severity: /** @type {const} */ ('warning'),
        platforms: [platform],
        sources: [source],
        message: `The image ${PLATFORMS[platform]} uses is ${m.width}×${m.height} (${ratio.toFixed(2)}:1). ${PLATFORMS[platform]} expects ${label}, so it will be cropped. 1200×630 works for both X and LinkedIn.`,
      }];
    })),

  rule('image-bytes', ['x', 'linkedin'], ['x', 'li'], (ctx) =>
    [...imagesByUrl(ctx, ['x', 'linkedin'])].flatMap(([url, { group, platforms }]) => {
      const bytes = ctx.measure(url)?.bytes;
      if (!bytes || bytes <= FIVE_MB) return [];
      return [{
        severity: /** @type {const} */ ('warning'),
        platforms,
        message: `${group.rootKey} is ${(bytes / 1024 / 1024).toFixed(1)} MB. ${names(platforms)} ${platforms.length > 1 ? 'require' : 'requires'} images under 5 MB.`,
      }];
    })),

  rule('image-type', ['facebook', 'discord'], ['fb', 'discord'], ({ c }) =>
    c.images.filter((g) => g.props.type).flatMap((g) => {
      const declared = /** @type {string} */ (g.props.type);
      const format = extFromMime(declared);
      const fromUrl = extFromUrl(g.url);
      /** @type {import('./util.js').Partial[]} */
      const findings = [];
      const unsupported = /** @type {const} */ (['facebook', 'discord']).filter(
        (pl) => !format || !IMAGE_FORMATS[pl].includes(format),
      );
      if (unsupported.length) {
        findings.push({
          severity: 'warning',
          platforms: [...unsupported],
          sources: unsupported.map((pl) => (pl === 'facebook' ? 'fb' : 'discord')),
          message: `og:image:type is "${declared}", which ${names([...unsupported])} ${unsupported.length > 1 ? "don't" : "doesn't"} list as supported.`,
        });
      }
      if (format && fromUrl && format !== fromUrl) {
        findings.push({
          severity: 'warning',
          message: `og:image:type is "${declared}", but the image URL ends in .${fromUrl}.`,
        });
      }
      return findings;
    })),
];
