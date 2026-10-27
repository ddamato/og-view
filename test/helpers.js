import { collect } from '../src/collect.js';
import { analyze } from '../src/debug.js';

export const PAGE = 'https://example.com/post';
export const IMAGE = 'https://example.com/card.png';
export const ICON = 'https://example.com/icon.png';

/** A head that satisfies every rule. */
export const COMPLETE = `
  <title>A post</title>
  <link rel="canonical" href="${PAGE}">
  <link rel="icon" href="/icon.png" sizes="96x96" type="image/png">
  <meta name="description" content="A description of the post.">
  <meta name="theme-color" content="#224433">
  <meta property="og:title" content="A post">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${PAGE}">
  <meta property="og:description" content="A description of the post.">
  <meta property="og:site_name" content="Example">
  <meta property="og:locale" content="en_US">
  <meta property="og:image" content="${IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="A card">
  <meta property="fb:app_id" content="123">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@example">
`;

/** Measurements matching COMPLETE. */
export const MEASURED = {
  [IMAGE]: { status: 'loaded', width: 1200, height: 630, bytes: 120_000 },
  [ICON]: { status: 'loaded', width: 96, height: 96 },
};

/** @param {string} head */
export function parse(head) {
  return new DOMParser().parseFromString(`<!doctype html><html><head>${head}</head><body></body></html>`, 'text/html');
}

/**
 * Collects and analyzes a head snippet.
 * @param {string} head
 * @param {{ measured?: Record<string, object>, url?: string }} [options]
 */
export function run(head, { measured = {}, url = PAGE } = {}) {
  const c = collect(parse(head), { url });
  const report = analyze(c, (u) => (u ? measured[u] : undefined));
  return {
    c,
    report,
    ids: report.findings.map((f) => f.id),
    find: (/** @type {string} */ id) => report.findings.filter((f) => f.id === id),
  };
}

/**
 * COMPLETE with lines removed and extra markup appended.
 * A line is removed when it contains `"key"` (an attribute value) or `<key` (an element).
 * @param {{ without?: string[], add?: string }} [changes]
 */
export function complete({ without = [], add = '' } = {}) {
  const lines = COMPLETE.split('\n').filter(
    (line) => !without.some((key) => line.includes(`"${key}"`) || line.includes(`<${key}`)),
  );
  return lines.join('\n') + add;
}
