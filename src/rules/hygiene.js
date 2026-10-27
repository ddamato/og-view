import { rule, tag } from './util.js';

export default [
  rule('empty-content', ['discord', 'all'], ['discord', 'ogp'], ({ c }) => {
    const keys = [...new Set(c.tags.filter((t) => !t.value.trim() && t.key.includes(':')).map((t) => t.key))];
    if (!keys.length) return null;
    return {
      severity: 'warning',
      message: `${keys.join(', ')} ${keys.length > 1 ? 'have' : 'has'} an empty value, so ${keys.length > 1 ? 'they count' : 'it counts'} as missing. Discord skips empty tags, but parsers that take the first tag as-is may show a blank.`,
      fix: `Fill in or remove: ${tag(keys[0], '')}`,
    };
  }),

  rule('key-case', ['discord'], ['discord'], ({ c }) => {
    const keys = [...new Set(c.tags.map((t) => t.key).filter((k) => k !== k.toLowerCase()))];
    if (!keys.length) return null;
    return {
      severity: 'warning',
      message: `${keys.join(', ')} ${keys.length > 1 ? 'are' : 'is'} not lowercase. Key names are case-sensitive, so ${keys.length > 1 ? 'these are' : 'this is'} ignored.`,
      fix: tag(keys[0].toLowerCase()),
    };
  }),
];
