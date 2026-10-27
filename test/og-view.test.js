import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/index.js';

const HEAD = `
  <title>Fallback title</title>
  <meta property="og:site_name" content="Example">
  <meta property="og:description" content="A description.">
  <meta property="og:url" content="https://example.com/post">
  <meta property="og:image" content="https://example.com/card.png">
  <meta name="author" content="Ada">
`;

/**
 * Mounts an element and waits for its first report.
 * @param {string} [attrs]
 */
async function mount(attrs = '') {
  document.body.innerHTML = `<og-view quiet ${attrs}></og-view>`;
  const el = /** @type {import('../src/og-view.js').OgView} */ (document.querySelector('og-view'));
  await new Promise((resolve) => el.addEventListener('og-view:report', resolve, { once: true }));
  return el;
}

describe('<og-view>', () => {
  beforeEach(() => {
    document.head.innerHTML = HEAD;
  });

  it('renders the resolved fields with real elements', async () => {
    const el = await mount();
    expect(el.querySelector('h2')?.textContent).toBe('Fallback title');
    expect(el.querySelector('p')?.textContent).toBe('A description.');
    expect(el.querySelector('.og-view__site-name')?.textContent).toBe('Example');
    expect(el.querySelector('.og-view__author')?.textContent).toBe('Ada');
    expect(el.querySelector('.og-view__url')?.getAttribute('href')).toBe('https://example.com/post');
    expect(el.querySelector('.og-view__url code')?.textContent).toBe('example.com/post');
    expect(el.querySelector('.og-view__qr svg path')?.getAttribute('d')).toMatch(/^M\d/);
  });

  it('exposes the report', async () => {
    const el = await mount();
    expect(el.report?.findings.some((f) => f.id === 'required')).toBe(true);
  });

  it('marks each value with data-og naming its source', async () => {
    const el = await mount();
    const sources = [...el.querySelectorAll('[data-og]')].map((e) => [e.className || e.tagName.toLowerCase(), e.getAttribute('data-og')]);
    expect(sources).toEqual([
      ['img', 'og:image'],
      ['og-view__favicon', '/favicon.ico'],
      ['og-view__site-name', 'og:site_name'],
      ['og-view__title', '<title>'],
      ['og-view__description', 'og:description'],
      ['og-view__qr', 'og:url'],
      ['og-view__author', 'meta[name=author]'],
      ['og-view__url', 'og:url'],
    ]);
  });

  it('honors no-qr and heading-level', async () => {
    const el = await mount('no-qr heading-level="4"');
    expect(el.querySelector('.og-view__qr')).toBeNull();
    expect(el.querySelector('h4')?.textContent).toBe('Fallback title');
  });

  it('shows the placeholder when there is no image', async () => {
    document.head.innerHTML = '<title>No image</title>';
    const el = await mount();
    expect(el.querySelector('.og-view__image img')).toBeNull();
    expect(el.querySelector('.og-view__placeholder')?.hasAttribute('hidden')).toBe(false);
  });

  it('logs to the console unless quiet', async () => {
    const group = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    document.body.innerHTML = '<og-view></og-view>';
    const el = /** @type {HTMLElement} */ (document.querySelector('og-view'));
    await new Promise((resolve) => el.addEventListener('og-view:report', resolve, { once: true }));
    expect(group.mock.calls[0][0]).toMatch(/^%cog-view%c · \d+ error/);
    vi.restoreAllMocks();
  });

  it('injects its stylesheet once, first in <head>', async () => {
    await mount();
    await mount();
    expect(document.querySelectorAll('#og-view-styles')).toHaveLength(1);
    expect(document.head.firstElementChild?.id).toBe('og-view-styles');
  });
});
