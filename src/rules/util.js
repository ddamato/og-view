/**
 * @typedef {'error' | 'warning' | 'info'} Severity
 *
 * @typedef {object} Finding
 * @property {string} id
 * @property {Severity} severity
 * @property {string[]} platforms
 * @property {string} message
 * @property {string} [fix] What to change, often a tag to paste.
 * @property {string[]} sources Keys into SOURCES.
 *
 * @typedef {object} Measurement
 * @property {'loaded' | 'error' | 'pending'} status
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [bytes] Only when the browser exposes the transfer size.
 *
 * @typedef {object} Context
 * @property {import('../collect.js').Collected} c
 * @property {import('../resolve.js').Platforms} p
 * @property {(url: string | undefined) => Measurement | undefined} measure Measurement for an absolute URL.
 *
 * @typedef {Omit<Finding, 'id' | 'platforms' | 'sources'> & Partial<Pick<Finding, 'platforms' | 'sources'>>} Partial
 *
 * @typedef {object} Rule
 * @property {string} id
 * @property {string[]} platforms
 * @property {string[]} sources
 * @property {(ctx: Context) => Partial | Partial[] | null | undefined | false} check
 */

/**
 * @param {string} id
 * @param {string[]} platforms
 * @param {string[]} sources
 * @param {Rule['check']} check
 * @returns {Rule}
 */
export function rule(id, platforms, sources, check) {
  return { id, platforms, sources, check };
}

/**
 * A tag to paste, using `name=` for twitter:* and plain keys, `property=` otherwise.
 * @param {string} key
 * @param {string} [value]
 */
export function tag(key, value = '…') {
  const attr = /^(og|article|fb|book|profile|music|video):/.test(key) ? 'property' : 'name';
  return `<meta ${attr}="${key}" content="${String(value).replace(/"/g, '&quot;')}">`;
}

const encoder = new TextEncoder();

/** @param {string} value */
export function byteLength(value) {
  return encoder.encode(value).length;
}

/** @param {string} value */
export function charLength(value) {
  return [...value].length;
}

/** Image formats each platform documents. */
export const IMAGE_FORMATS = {
  x: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  facebook: ['jpg', 'jpeg', 'png', 'gif'],
  discord: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'],
};

/** @type {Record<string, string>} */
const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
};

/** @param {string | undefined | null} mime */
export function extFromMime(mime) {
  return mime ? MIME_TO_EXT[mime.toLowerCase().split(';')[0].trim()] : undefined;
}

/**
 * The file extension of a URL's path, normalized (`jpeg` → `jpg`, `svgz` → `svg`).
 * @param {string | undefined} url
 */
export function extFromUrl(url) {
  if (!url) return undefined;
  let path;
  try {
    path = new URL(url, 'https://example.invalid').pathname;
  } catch {
    return undefined;
  }
  const ext = path.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  if (ext === 'svgz') return 'svg';
  if (ext === 'tif') return 'tiff';
  return ext;
}

/** @param {string} [value] */
export function isAbsoluteHttp(value) {
  return typeof value === 'string' && /^https?:\/\/[^\s/]+/i.test(value);
}

/**
 * @param {string} key
 * @param {number} limit
 */
export function truncate(key, limit = 60) {
  return key.length > limit ? `${key.slice(0, limit - 1)}…` : key;
}
