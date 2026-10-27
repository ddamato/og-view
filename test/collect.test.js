import { describe, it, expect } from 'vitest';
import { collect } from '../src/collect.js';
import { parse, PAGE, IMAGE } from './helpers.js';

const get = (/** @type {string} */ head) => collect(parse(head), { url: PAGE });

describe('collect', () => {
  it('keeps tags in document order, including empty and mis-cased ones', () => {
    const c = get(`
      <meta property="og:title" content="">
      <meta property="OG:Title" content="Upper">
      <meta property="og:title" content="Real">
    `);
    expect(c.tags.map((t) => t.key)).toEqual(['og:title', 'OG:Title', 'og:title']);
    expect(c.get('og:title')).toBe('Real');
  });

  it('accepts name= and value= as fallbacks', () => {
    const c = get('<meta name="og:title" value="From value">');
    expect(c.get('og:title')).toBe('From value');
    expect(c.tags[0].attr).toBe('name');
  });

  it('ignores unrelated meta tags', () => {
    const c = get('<meta name="viewport" content="width=device-width"><meta charset="utf-8">');
    expect(c.tags).toEqual([]);
  });

  describe('fields', () => {
    it('falls back from og:title to twitter:title to <title>', () => {
      expect(get('<title>T</title>').fields.title).toEqual({ value: 'T', source: '<title>' });
      expect(get('<title>T</title><meta name="twitter:title" content="X">').fields.title.source).toBe('twitter:title');
      expect(get('<title>T</title><meta property="og:title" content="O">').fields.title.source).toBe('og:title');
    });

    it('falls back for description', () => {
      expect(get('<meta name="description" content="D">').fields.description).toEqual({
        value: 'D',
        source: 'meta[name=description]',
      });
    });

    it('falls back from og:site_name to the hostname', () => {
      expect(get('').fields.siteName).toEqual({ value: 'example.com', source: 'location.hostname' });
      expect(get('<meta name="application-name" content="App">').fields.siteName.source).toBe('application-name');
    });

    it('falls back from og:url to canonical to the page URL', () => {
      expect(get('').fields.url).toEqual({ value: PAGE, source: 'location.href' });
      expect(get('<link rel="canonical" href="/canon">').fields.url).toEqual({
        value: 'https://example.com/canon',
        source: 'link[rel=canonical]',
      });
    });

    it('resolves relative image URLs for display', () => {
      expect(get('<meta property="og:image" content="/card.png">').fields.image).toEqual({
        value: IMAGE,
        source: 'og:image',
      });
    });

    it('uses twitter:image when there is no og:image', () => {
      expect(get(`<meta name="twitter:image" content="${IMAGE}">`).fields.image.source).toBe('twitter:image');
    });

    it('prefers meta author for the name and links article:author when it is a URL', () => {
      const c = get(`
        <meta name="author" content="Ada">
        <meta property="article:author" content="https://example.com/ada">
      `);
      expect(c.fields.author).toEqual({ value: 'Ada', source: 'meta[name=author]' });
      expect(c.fields.authorUrl.value).toBe('https://example.com/ada');
    });

    it('picks the largest icon, then apple-touch-icon, then /favicon.ico', () => {
      expect(
        get(`
          <link rel="icon" href="/16.png" sizes="16x16">
          <link rel="icon" href="/64.png" sizes="64x64">
        `).fields.favicon.value,
      ).toBe('https://example.com/64.png');
      expect(get('<link rel="apple-touch-icon" href="/apple.png">').fields.favicon.source).toBe('apple-touch-icon');
      expect(get('').fields.favicon).toEqual({ value: 'https://example.com/favicon.ico', source: '/favicon.ico' });
    });
  });

  describe('media groups', () => {
    it('attaches structured properties to the preceding root', () => {
      const c = get(`
        <meta property="og:image" content="/a.png">
        <meta property="og:image:width" content="100">
        <meta property="og:image" content="/b.png">
        <meta property="og:image:alt" content="B">
      `);
      expect(c.images.map((g) => [g.url, g.props])).toEqual([
        ['/a.png', { width: '100' }],
        ['/b.png', { alt: 'B' }],
      ]);
    });

    it('treats og:image:url after og:image as a property, and alone as a root', () => {
      expect(
        get(`
          <meta property="og:image" content="/a.png">
          <meta property="og:image:url" content="/a.png">
        `).images,
      ).toHaveLength(1);
      expect(get('<meta property="og:image:url" content="/a.png">').images[0].rootKey).toBe('og:image:url');
    });

    it('records properties that come before any root as orphans', () => {
      const c = get('<meta property="og:image:width" content="1"><meta property="og:image" content="/a.png">');
      expect(c.images.orphans).toEqual(['og:image:width']);
    });
  });
});
