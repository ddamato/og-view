import { rule, tag } from './util.js';

const TRACKING_PARAM = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|sid|sessionid|session_id|phpsessid|jsessionid)$/i;

export default [
  rule('title-branding', ['facebook'], ['fb'], ({ c }) => {
    const title = c.get('og:title');
    const site = c.get('og:site_name');
    if (!title || !site || title.toLowerCase() === site.toLowerCase()) return null;
    if (!title.toLowerCase().includes(site.toLowerCase())) return null;
    return {
      severity: 'info',
      message: `og:title includes the site name "${site}". Facebook recommends the title "without any branding"; og:site_name carries it instead.`,
    };
  }),

  rule('url-decorated', ['facebook'], ['fb'], ({ c }) => {
    const url = c.get('og:url');
    if (!url) return null;
    let params;
    try {
      params = [...new URL(url, c.pageUrl).searchParams.keys()].filter((k) => TRACKING_PARAM.test(k));
    } catch {
      return null;
    }
    if (!params.length) return null;
    return {
      severity: 'info',
      message: `og:url has tracking or session parameters (${params.join(', ')}). Facebook asks for the "undecorated URL".`,
    };
  }),

  rule('fb-app-id', ['facebook'], ['fb'], ({ c }) => {
    if (c.has('fb:app_id')) return null;
    return {
      severity: 'info',
      message: 'fb:app_id is missing. Facebook needs it for Insights; it doesn\'t affect the preview.',
      fix: tag('fb:app_id', 'your-app-id'),
    };
  }),

  rule('image-secure-url', ['facebook'], ['fb'], ({ c }) =>
    c.images
      .filter((g) => g.props.secure_url && !/^https:\/\//i.test(g.props.secure_url))
      .map((g) => ({
        severity: /** @type {const} */ ('warning'),
        message: `og:image:secure_url "${g.props.secure_url}" isn't https. Facebook: it "must be an https:// URL".`,
      }))),

  rule('image-dims-declared', ['facebook', 'discord'], ['fb', 'discord'], ({ c }) => {
    const image = c.images[0];
    if (!image || (image.props.width && image.props.height)) return null;
    return {
      severity: 'info',
      message: 'og:image:width and og:image:height are missing. Facebook uses them so the image "loads properly the first time it\'s shared", and Discord has to download the image to measure it otherwise.',
      fix: `${tag('og:image:width', '1200')}\n${tag('og:image:height', '630')}`,
    };
  }),

  rule('image-dims-mismatch', ['facebook'], ['fb'], ({ c, measure }) =>
    c.images.flatMap((g) => {
      const m = measure(c.resolve(g.url));
      const w = Number(g.props.width);
      const h = Number(g.props.height);
      if (m?.status !== 'loaded' || !w || !h) return [];
      if (w === m.width && h === m.height) return [];
      return [{
        severity: /** @type {const} */ ('warning'),
        message: `og:image declares ${w}×${h}, but the image is ${m.width}×${m.height}.`,
        fix: `${tag('og:image:width', String(m.width))}\n${tag('og:image:height', String(m.height))}`,
      }];
    })),

  rule('image-size-fb', ['facebook'], ['fb-bp'], ({ p, c, measure }) => {
    const m = measure(c.resolve(p.facebook.image?.url));
    if (m?.status !== 'loaded' || !m.width) return null;
    if (m.width < 600) {
      return { severity: 'warning', message: `og:image is ${m.width}px wide. Facebook's minimum is 600px.` };
    }
    if (m.width < 1080) {
      return { severity: 'info', message: `og:image is ${m.width}px wide. Facebook recommends "at least 1080 pixels".` };
    }
    return null;
  }),
];
