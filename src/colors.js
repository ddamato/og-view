/**
 * Reads whether the background behind an element is light or dark, so an SVG
 * favicon that styles itself with prefers-color-scheme matches the page rather
 * than the OS. CSS can't read an ancestor's background, so this walks up the tree.
 */

/** @param {string} value */
function parse(value) {
  const parts = value.match(/[\d.]+/g)?.map(Number);
  if (!value.startsWith('rgb') || !parts || parts.length < 3) return undefined;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}

/** @param {{ r: number, g: number, b: number }} c */
function luminance({ r, g, b }) {
  const channel = (/** @type {number} */ v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * @param {Element} el
 * @returns {'light' | 'dark' | undefined}
 */
export function readScheme(el) {
  const view = el.ownerDocument.defaultView;
  if (!view) return undefined;
  /** @type {ReturnType<typeof parse>} */
  let surface;
  for (let node = /** @type {Element | null} */ (el); node && !surface; node = node.parentElement) {
    const parsed = parse(view.getComputedStyle(node).backgroundColor);
    if (parsed && parsed.a > 0) surface = parsed;
  }
  if (!surface) {
    // An unpainted page shows the canvas color, white unless the page opts into dark.
    const scheme = view.getComputedStyle(el.ownerDocument.documentElement).colorScheme ?? '';
    const prefersDark = view.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return scheme.includes('dark') && (prefersDark || !scheme.includes('light')) ? 'dark' : 'light';
  }
  // Below this, white text has more contrast than black.
  return luminance(surface) < 0.179 ? 'dark' : 'light';
}
