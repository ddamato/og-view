/**
 * Resolves the title, description and image each platform would use. Platform
 * rules check these values rather than og-view's own display fields.
 * See "Per-platform resolution" in PLAN.md.
 */

/**
 * @typedef {object} Resolved
 * @property {string} [title]
 * @property {string} [titleSource]
 * @property {string} [description]
 * @property {string} [descriptionSource]
 * @property {import('./collect.js').MediaGroup} [image]
 */

/** @param {import('./collect.js').Collected} c */
export function resolvePlatforms(c) {
  /** @type {Resolved} */
  const og = {
    title: c.get('og:title'),
    titleSource: 'og:title',
    description: c.get('og:description'),
    descriptionSource: 'og:description',
    image: c.images[0],
  };

  /** @type {Resolved} */
  const x = {
    title: c.get('twitter:title') ?? c.get('og:title'),
    titleSource: c.has('twitter:title') ? 'twitter:title' : 'og:title',
    description: c.get('twitter:description') ?? c.get('og:description'),
    descriptionSource: c.has('twitter:description') ? 'twitter:description' : 'og:description',
    image: c.twitterImages[0] ?? c.images[0],
  };

  // Discord takes the first non-empty og: or twitter: tag in document order,
  // then falls back to <title> and meta description only as a pair.
  const firstOf = (/** @type {string[]} */ keys) =>
    c.tags.find((t) => keys.includes(t.key) && t.value.trim());
  const discordTitle = firstOf(['og:title', 'twitter:title']);
  const discordDescription = firstOf(['og:description', 'twitter:description']);
  const usePair = !discordTitle && !discordDescription && c.title && c.metaDescription;
  const discordImages = [...c.images, ...c.twitterImages].sort((a, b) => a.index - b.index);

  /** @type {Resolved} */
  const discord = {
    title: discordTitle?.value.trim() ?? (usePair ? c.title : undefined),
    titleSource: discordTitle?.key ?? (usePair ? '<title>' : undefined),
    description: discordDescription?.value.trim() ?? (usePair ? c.metaDescription : undefined),
    descriptionSource: discordDescription?.key ?? (usePair ? 'meta[name=description]' : undefined),
    image: discordImages[0],
  };

  return { facebook: og, linkedin: og, x, discord };
}

/** @typedef {ReturnType<typeof resolvePlatforms>} Platforms */
