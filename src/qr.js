import { encode } from 'uqr';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * An SVG QR code drawn in `currentColor`, so it themes with the page.
 * Dark modules in each row are merged into runs to keep the path short.
 * @param {string} text
 */
export function qrSvg(text) {
  const { data, size } = encode(text, { ecc: 'M', border: 1 });
  let d = '';
  data.forEach((row, y) => {
    for (let x = 0; x < size; x++) {
      if (!row[x]) continue;
      let run = 1;
      while (row[x + run]) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `QR code for ${text}`);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}
