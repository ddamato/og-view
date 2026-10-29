import { rule, extFromMime, extFromUrl } from './util.js';
import { pickIcon } from '../collect.js';

const GOOGLE_FORMATS = ['bmp', 'gif', 'ico', 'png', 'jpg', 'ppm', 'tiff'];

/**
 * The icon Google would use: a raster one when there is one, even though the
 * card shows the SVG. It's only measured when it's the one the card shows.
 * @param {import('./util.js').Context} ctx
 */
function favicon({ c, measure }) {
  const icon = pickIcon(c.icons, { svg: false });
  const url = icon?.href ?? c.fields.favicon.value;
  return { url, icon, m: measure(url) };
}

export default [
  rule('favicon-missing', ['google'], ['google-favicon'], (ctx) => {
    const { m } = favicon(ctx);
    if (ctx.c.icons.length || m?.status !== 'error') return null;
    return {
      severity: 'info',
      message: 'No link[rel=icon] was found, and /favicon.ico doesn\'t load either.',
      fix: '<link rel="icon" href="/favicon.png" sizes="96x96">',
    };
  }),

  rule('favicon-square', ['google'], ['google-favicon'], (ctx) => {
    const { m } = favicon(ctx);
    if (m?.status !== 'loaded' || !m.width || !m.height || m.width === m.height) return null;
    return {
      severity: 'warning',
      message: `The favicon is ${m.width}×${m.height}. Google: it "must be a square (1:1 aspect ratio)".`,
    };
  }),

  rule('favicon-size', ['google'], ['google-favicon'], (ctx) => {
    const { m } = favicon(ctx);
    if (m?.status !== 'loaded' || !m.width || !m.height) return null;
    const size = Math.min(m.width, m.height);
    if (size < 8) {
      return { severity: 'warning', message: `The favicon is ${m.width}×${m.height}. Google requires at least 8×8.` };
    }
    if (size <= 48) {
      return { severity: 'info', message: `The favicon is ${m.width}×${m.height}. Google recommends larger than 48×48.` };
    }
    return null;
  }),

  rule('favicon-format', ['google'], ['google-favicon'], (ctx) => {
    const { url, icon } = favicon(ctx);
    const format = extFromMime(icon?.type) ?? extFromUrl(url);
    if (!format || GOOGLE_FORMATS.includes(format)) return null;
    return {
      severity: 'info',
      message: `The favicon is ${format.toUpperCase()}, which isn't in Google's supported list (${GOOGLE_FORMATS.join(', ').toUpperCase()}).${format === 'svg' ? ' SVG favicons work in browsers; add a PNG alongside it for search results.' : ''}`,
    };
  }),
];
