/**
 * Reads the text and background colors around an element, so the QR code can
 * be dark on light whatever the theme. CSS can't read an ancestor's
 * background, so this walks up the tree.
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
 * @returns {{ dark: string, light: string } | undefined}
 */
export function readColors(el) {
  const view = el.ownerDocument.defaultView;
  if (!view) return undefined;
  const text = view.getComputedStyle(el).color;
  /** @type {string | undefined} */
  let surface;
  for (let node = /** @type {Element | null} */ (el); node; node = node.parentElement) {
    const background = view.getComputedStyle(node).backgroundColor;
    const parsed = parse(background);
    if (parsed && parsed.a > 0) {
      surface = background;
      break;
    }
  }
  // An unpainted page shows the canvas color, white unless the page opts into dark.
  surface ??= view.matchMedia?.('(prefers-color-scheme: dark)').matches &&
    view.getComputedStyle(el.ownerDocument.documentElement).colorScheme.includes('dark')
    ? 'rgb(18, 18, 18)'
    : 'rgb(255, 255, 255)';
  const textRgb = parse(text);
  const surfaceRgb = parse(surface);
  if (!textRgb || !surfaceRgb) return undefined;
  const textIsDarker = luminance(textRgb) < luminance(surfaceRgb);
  return {
    dark: textIsDarker ? text : surface,
    light: textIsDarker ? surface : text,
  };
}
