import { rule, tag } from './util.js';

export default [
  rule('description', ['linkedin'], ['li'], ({ c }) => {
    if (c.has('og:description')) return null;
    return {
      severity: 'warning',
      message: `og:description is missing. It's optional in the spec, but LinkedIn lists it as one of four required tags.${c.fields.description.value ? ` og-view fell back to ${c.fields.description.source}.` : ''}`,
      fix: tag('og:description', c.fields.description.value),
    };
  }),

  rule('image-size-li', ['linkedin'], ['li'], ({ p, c, measure }) => {
    const m = measure(c.resolve(p.linkedin.image?.url));
    if (m?.status !== 'loaded' || !m.width || !m.height) return null;
    if (m.width >= 1200 && m.height >= 627) return null;
    return {
      severity: 'warning',
      message: `og:image is ${m.width}×${m.height}. LinkedIn's minimum is 1200×627.${m.width < 401 ? ' Under 401px wide, it displays as a thumbnail.' : ''}`,
    };
  }),
];
