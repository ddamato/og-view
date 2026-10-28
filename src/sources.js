/**
 * Every rule cites one of these.
 * @type {Record<string, { title: string, url: string }>}
 */
export const SOURCES = {
  ogp: { title: 'The Open Graph protocol', url: 'https://ogp.me/' },
  fb: { title: 'Facebook: A Guide to Sharing for Webmasters', url: 'https://developers.facebook.com/docs/sharing/webmasters' },
  'fb-bp': { title: 'Facebook: Sharing Best Practices', url: 'https://developers.facebook.com/docs/sharing/best-practices' },
  x: { title: 'X: Cards markup reference', url: 'https://developer.x.com/en/docs/twitter-for-websites/cards/overview/markup' },
  'x-large': {
    title: 'X: Summary Card with Large Image',
    url: 'https://developer.x.com/en/docs/twitter-for-websites/cards/overview/summary-card-with-large-image',
  },
  li: { title: 'LinkedIn: Make your website shareable', url: 'https://www.linkedin.com/help/linkedin/answer/a521928' },
  discord: { title: 'Discord: Link Previews', url: 'https://docs.discord.com/developers/link-previews/overview' },
  'google-favicon': {
    title: 'Google Search Central: Favicon guidelines',
    url: 'https://developers.google.com/search/docs/appearance/favicon-in-search',
  },
  bsky: {
    title: 'Bluesky source: link-meta.ts',
    url: 'https://github.com/bluesky-social/social-app/blob/main/src/lib/link-meta/link-meta.ts',
  },
};

/** Display names for platform keys. */
export const PLATFORMS = {
  spec: 'Spec',
  x: 'X',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  discord: 'Discord',
  bluesky: 'Bluesky',
  google: 'Google',
  all: 'All',
};

/** @param {string} pageUrl */
export function debuggers(pageUrl) {
  const encoded = encodeURIComponent(pageUrl);
  return [
    {
      name: 'Facebook Sharing Debugger',
      url: `https://developers.facebook.com/tools/debug/?q=${encoded}`,
      note: 'Re-scrapes on demand.',
    },
    {
      name: 'Discord Embed Debugger',
      url: 'https://discord.com/developers/embeds',
      note: 'Discord caches previews for about 30 minutes; share the link with a new query string like ?v=2 to see changes immediately.',
    },
    {
      name: 'LinkedIn Post Inspector',
      url: `https://www.linkedin.com/post-inspector/inspect/${encoded}`,
      note: 'Re-scrapes on demand.',
    },
    {
      name: 'Bluesky',
      url: SOURCES.bsky.url,
      note: 'Link cards are saved into the post when it is posted, so fixing tags never updates existing posts.',
    },
  ];
}
