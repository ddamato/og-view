import { describe, it, expect } from 'vitest';
import { RULES } from '../src/rules/index.js';
import { run, complete, COMPLETE, MEASURED, IMAGE, ICON, PAGE } from './helpers.js';
import { SOURCES } from '../src/sources.js';

const long = (/** @type {number} */ n, char = 'a') => char.repeat(n);
const image = (/** @type {object} */ m) => ({ ...MEASURED, [IMAGE]: { status: 'loaded', ...m } });

describe('rules', () => {
  it('finds nothing wrong with a complete head', () => {
    expect(run(COMPLETE, { measured: MEASURED }).report.findings).toEqual([]);
  });

  it('every rule has a unique id and known sources', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) for (const s of r.sources) expect(SOURCES).toHaveProperty(s);
  });

  it('sorts findings by severity', () => {
    const order = run('').report.findings.map((f) => f.severity);
    expect(order).toEqual([...order].sort((a, b) => ['error', 'warning', 'info'].indexOf(a) - ['error', 'warning', 'info'].indexOf(b)));
  });

  /**
   * [rule id, head, expected severity, measured?, extra assertion?]
   * @type {Array<[string, string, string, object?]>}
   */
  const cases = [
    // spec
    ['required', complete({ without: ['og:title'] }), 'error'],
    ['required', complete({ without: ['og:type'] }), 'error'],
    ['required', complete({ without: ['og:image', 'og:image:width', 'og:image:height', 'og:image:alt'] }), 'error'],
    ['required', complete({ without: ['og:url'] }), 'error'],
    ['url-protocol', complete({ without: ['og:url'], add: '<meta property="og:url" content="/post">' }), 'error'],
    ['image-alt', complete({ without: ['og:image:alt'] }), 'warning'],
    ['image-alt', complete({ without: ['og:image:alt'], add: `<meta property="og:image:alt" content="${long(500)}">` }), 'warning'],
    ['duplicate', complete({ add: '<meta property="og:title" content="Other">' }), 'warning'],
    ['duplicate', complete({ add: '<meta property="og:title" content="A post">' }), 'info'],
    ['duplicate', complete({ add: '<meta property="og:type" content="article">' }), 'warning'],
    ['structure-order', `<meta property="og:image:width" content="1">${COMPLETE}`, 'warning'],
    ['canonical', complete({ without: ['canonical'], add: '<link rel="canonical" href="/other">' }), 'warning'],
    ['type-value', complete({ without: ['og:type'], add: '<meta property="og:type" content="blogpost">' }), 'info'],
    ['article-details', complete({ without: ['og:type'], add: '<meta property="og:type" content="article">' }), 'info'],
    ['article-author', complete({ add: '<meta property="article:author" content="Ada">' }), 'info'],
    ['property-attr', complete({ without: ['og:site_name'], add: '<meta name="og:site_name" content="Example">' }), 'info'],
    ['optional', complete({ without: ['og:site_name'] }), 'info'],
    ['optional', complete({ without: ['og:locale'] }), 'info'],
    ['locale-format', complete({ without: ['og:locale'], add: '<meta property="og:locale" content="en-US">' }), 'warning'],
    ['datetime-format', complete({ add: '<meta property="article:published_time" content="March 3rd">' }), 'warning'],
    // hygiene
    ['empty-content', complete({ add: '<meta property="og:audio" content="">' }), 'warning'],
    ['key-case', complete({ add: '<meta property="OG:Title" content="A post">' }), 'warning'],
    // x
    ['title-length', complete({ without: ['og:title'], add: `<meta property="og:title" content="${long(71)}">` }), 'warning'],
    ['description-length', complete({ without: ['og:description'], add: `<meta property="og:description" content="${long(201)}">` }), 'warning'],
    ['twitter-card', complete({ without: ['twitter:card'] }), 'warning'],
    ['twitter-card-value', complete({ without: ['twitter:card'], add: '<meta name="twitter:card" content="large">' }), 'warning'],
    ['twitter-card-value', complete({ without: ['twitter:card'], add: '<meta name="twitter:card" content="photo">' }), 'warning'],
    ['twitter-site', complete({ without: ['twitter:site'] }), 'info'],
    ['twitter-handle', complete({ without: ['twitter:site'], add: '<meta name="twitter:site" content="example">' }), 'warning'],
    // facebook
    ['title-branding', complete({ without: ['og:title'], add: '<meta property="og:title" content="A post | Example">' }), 'info'],
    ['url-decorated', complete({ without: ['og:url', 'canonical'], add: `<meta property="og:url" content="${PAGE}?utm_source=x">` }), 'info'],
    ['fb-app-id', complete({ without: ['fb:app_id'] }), 'info'],
    ['image-secure-url', complete({ add: '<meta property="og:image" content="https://example.com/b.png"><meta property="og:image:secure_url" content="http://example.com/b.png">' }), 'warning'],
    ['image-dims-declared', complete({ without: ['og:image:width'] }), 'info'],
    ['image-dims-mismatch', COMPLETE, 'warning', image({ width: 1000, height: 525 })],
    ['image-size-fb', COMPLETE, 'warning', image({ width: 500, height: 262 })],
    ['image-size-fb', COMPLETE, 'info', image({ width: 1000, height: 524 })],
    // linkedin
    ['description', complete({ without: ['og:description'] }), 'warning'],
    ['image-size-li', COMPLETE, 'warning', image({ width: 1000, height: 524 })],
    // discord
    ['site-name-length', complete({ without: ['og:site_name'], add: `<meta property="og:site_name" content="${long(257)}">` }), 'error'],
    ['url-length', complete({ add: `<meta property="og:image" content="https://example.com/${long(2100)}.png">` }), 'error'],
    ['image-dims-attach', complete({ add: '<meta property="og:image:url" content="https://example.com/b.png"><meta property="og:image:url" content="https://example.com/c.png"><meta property="og:image:width" content="10">' }), 'warning'],
    ['theme-color-format', complete({ without: ['theme-color'], add: '<meta name="theme-color" content="rgb(0 0 0)">' }), 'warning'],
    ['pubdate-format', complete({ add: '<meta property="og:pubdate" content="2026-01-31">' }), 'warning'],
    ['description-html', complete({ without: ['og:description'], add: '<meta property="og:description" content="Hello <b>world</b>">' }), 'warning'],
    ['image-count', complete({ add: [2, 3, 4, 5].map((n) => `<meta property="og:image" content="https://example.com/${n}.png">`).join('') }), 'info'],
    ['theme-color', complete({ without: ['theme-color'] }), 'info'],
    ['fallback-pair', '<title>Only a title</title>', 'warning'],
    ['oembed-provider', complete({ add: '<link rel="alternate" type="application/json+oembed" href="/oembed">' }), 'info'],
    ['author-discord', complete({ add: '<meta name="author" content="Ada">' }), 'info'],
    // images
    ['image-load', COMPLETE, 'error', { ...MEASURED, [IMAGE]: { status: 'error' } }],
    ['image-format', complete({ without: ['og:image', 'og:image:width', 'og:image:height', 'og:image:alt'], add: '<meta property="og:image" content="https://example.com/card.svg">' }), 'error'],
    ['image-format', complete({ without: ['og:image', 'og:image:width', 'og:image:height', 'og:image:alt'], add: '<meta property="og:image" content="https://example.com/card.webp">' }), 'warning'],
    ['image-size-x', COMPLETE, 'warning', image({ width: 5000, height: 2500 })],
    ['image-ratio', COMPLETE, 'warning', image({ width: 1200, height: 1200 })],
    ['image-bytes', COMPLETE, 'warning', image({ width: 1200, height: 630, bytes: 6_000_000 })],
    ['image-type', complete({ add: '<meta property="og:image:type" content="image/avif">' }), 'warning'],
    ['image-type', complete({ add: '<meta property="og:image:type" content="image/jpeg">' }), 'warning'],
    // video
    ['video-dims', complete({ add: '<meta property="og:video" content="https://example.com/v.mp4">' }), 'warning'],
    ['video-image', '<meta property="og:video" content="https://example.com/v.mp4">', 'error'],
    ['video-https', complete({ add: '<meta property="og:video" content="http://example.com/v.mp4">' }), 'warning'],
    ['video-type', complete({ add: '<meta property="og:video" content="https://example.com/v.ogv"><meta property="og:video:type" content="video/ogg">' }), 'warning'],
    ['video-layout', complete({ add: '<meta property="og:video" content="https://example.com/v.mp4">' }), 'info'],
    // favicon
    ['favicon-missing', complete({ without: ['icon'] }), 'info', { ...MEASURED, 'https://example.com/favicon.ico': { status: 'error' } }],
    ['favicon-square', COMPLETE, 'warning', { ...MEASURED, [ICON]: { status: 'loaded', width: 96, height: 64 } }],
    ['favicon-size', COMPLETE, 'warning', { ...MEASURED, [ICON]: { status: 'loaded', width: 4, height: 4 } }],
    ['favicon-size', COMPLETE, 'info', { ...MEASURED, [ICON]: { status: 'loaded', width: 32, height: 32 } }],
    ['favicon-format', complete({ without: ['icon'], add: '<link rel="icon" href="/icon.svg" type="image/svg+xml">' }), 'info'],
  ];

  it.each(cases)('%s (%#) reports %s', (id, head, severity, measured = MEASURED) => {
    const { find } = run(head, { measured });
    const findings = find(id);
    expect(findings.map((f) => f.severity)).toContain(severity);
  });

  it('covers every rule with at least one case', () => {
    const covered = new Set(cases.map(([id]) => id));
    expect(RULES.map((r) => r.id).filter((id) => !covered.has(id))).toEqual([]);
  });

  describe('details', () => {
    it('counts Discord title length in bytes, not characters', () => {
      const title = long(30, 'é'); // 30 characters, 60 bytes
      const { find } = run(complete({ without: ['og:title'], add: `<meta property="og:title" content="${title}">` }), { measured: MEASURED });
      expect(find('title-length')).toEqual([]);
      const { find: find2 } = run(complete({ without: ['og:title'], add: `<meta property="og:title" content="${long(40, 'é')}">` }), { measured: MEASURED });
      expect(find2('title-length').map((f) => f.platforms)).toEqual([['discord']]);
    });

    it('runs X image checks on twitter:image when it differs', () => {
      const other = 'https://example.com/x.png';
      const { find } = run(complete({ add: `<meta name="twitter:image" content="${other}">` }), {
        measured: { ...MEASURED, [other]: { status: 'loaded', width: 1000, height: 1000 } },
      });
      expect(find('image-ratio').map((f) => f.platforms)).toEqual([['x']]);
    });

    it('treats empty values as missing', () => {
      const { find } = run(complete({ without: ['og:title'], add: '<meta property="og:title" content=" ">' }));
      expect(find('required').map((f) => f.message).join()).toContain('og:title');
    });

    it('ignores theme-color variants with a media attribute', () => {
      const { find } = run(complete({ add: '<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">' }), { measured: MEASURED });
      expect(find('duplicate')).toEqual([]);
    });

    it('accepts 1200×630 for both X and LinkedIn ratios', () => {
      expect(run(COMPLETE, { measured: MEASURED }).find('image-ratio')).toEqual([]);
    });

    it('checks the PNG favicon for Google when the card shows an SVG', () => {
      const { c, find } = run(complete({ add: '<link rel="icon" href="/icon.svg" type="image/svg+xml">' }), {
        measured: { ...MEASURED, [ICON]: { status: 'loaded', width: 32, height: 32 } },
      });
      expect(c.fields.favicon.value).toBe('https://example.com/icon.svg');
      expect(find('favicon-format')).toEqual([]);
      expect(find('favicon-size').map((f) => f.severity)).toEqual(['info']);
    });

    it('suggests summary for twitter:card when there is no image', () => {
      const { find } = run('<meta property="og:title" content="T">');
      expect(find('twitter-card')[0]).toMatchObject({ severity: 'info', fix: '<meta name="twitter:card" content="summary">' });
    });
  });
});
