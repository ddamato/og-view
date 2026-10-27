import { rule, tag, byteLength, charLength } from './util.js';

const CARD_TYPES = ['summary', 'summary_large_image', 'app', 'player'];

export default [
  rule('title-length', ['x', 'discord'], ['x', 'discord'], ({ p }) => {
    /** @type {import('./util.js').Partial[]} */
    const findings = [];
    const { x, discord } = p;
    if (x.title && charLength(x.title) > 70) {
      findings.push({
        severity: 'warning',
        platforms: ['x'],
        sources: ['x'],
        message: `The title X uses (${x.titleSource}) is ${charLength(x.title)} characters. X allows at most 70.`,
      });
    }
    if (discord.title && byteLength(discord.title) > 70) {
      findings.push({
        severity: 'warning',
        platforms: ['discord'],
        sources: ['discord'],
        message: `The title Discord uses (${discord.titleSource}) is ${byteLength(discord.title)} bytes. Discord trims titles at 70 bytes and 3 lines. Accents and emoji take more than one byte.`,
      });
    }
    return findings;
  }),

  rule('description-length', ['x', 'discord'], ['x', 'discord'], ({ p }) => {
    /** @type {import('./util.js').Partial[]} */
    const findings = [];
    const { x, discord } = p;
    if (x.description && charLength(x.description) > 200) {
      findings.push({
        severity: 'warning',
        platforms: ['x'],
        sources: ['x'],
        message: `The description X uses (${x.descriptionSource}) is ${charLength(x.description)} characters. X allows at most 200.`,
      });
    }
    if (discord.description && byteLength(discord.description) > 350) {
      findings.push({
        severity: 'warning',
        platforms: ['discord'],
        sources: ['discord'],
        message: `The description Discord uses (${discord.descriptionSource}) is ${byteLength(discord.description)} bytes. Discord trims descriptions at 350 bytes and 20 lines.`,
      });
    }
    return findings;
  }),

  rule('twitter-card', ['x', 'discord'], ['x', 'discord'], ({ c }) => {
    if (c.has('twitter:card')) return null;
    const hasImage = c.images.length > 0 || c.twitterImages.length > 0;
    return {
      severity: hasImage ? 'warning' : 'info',
      message: hasImage
        ? 'twitter:card is missing. X "may" render a small summary card, and Discord defaults to a small thumbnail. summary_large_image shows the image large on both.'
        : 'twitter:card is missing. X "may" still render a summary card from og:type, og:title and og:description.',
      fix: tag('twitter:card', hasImage ? 'summary_large_image' : 'summary'),
    };
  }),

  rule('twitter-card-value', ['x', 'discord'], ['x', 'discord'], ({ c }) => {
    const card = c.get('twitter:card');
    if (!card || CARD_TYPES.includes(card)) return null;
    if (card === 'photo') {
      return {
        severity: 'warning',
        platforms: ['x'],
        message: 'twitter:card is "photo". Discord supports it as an image-only layout, but X doesn\'t list it as a card type.',
      };
    }
    return {
      severity: 'warning',
      message: `twitter:card is "${card}", which isn't one of X's card types: ${CARD_TYPES.join(', ')}.`,
      fix: tag('twitter:card', 'summary_large_image'),
    };
  }),

  rule('twitter-site', ['x'], ['x'], ({ c }) => {
    if (c.has('twitter:site') || c.has('twitter:site:id')) return null;
    return {
      severity: 'info',
      message: 'twitter:site is missing. X\'s markup reference marks it as required: the @username of the website.',
      fix: tag('twitter:site', '@username'),
    };
  }),

  rule('twitter-handle', ['x'], ['x'], ({ c }) =>
    ['twitter:site', 'twitter:creator'].flatMap((key) =>
      c.getAll(key)
        .filter((v) => !v.startsWith('@'))
        .map((v) => ({
          severity: /** @type {const} */ ('warning'),
          message: `${key} is "${v}", but X expects an @username.`,
          fix: tag(key, `@${v.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, '').replace(/\/.*$/, '')}`),
        })))),
];
