import { rule, tag } from './util.js';

const DISCORD_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export default [
  rule('video-dims', ['facebook', 'discord'], ['fb', 'discord'], ({ c }) => {
    const video = c.videos[0];
    if (!video || (video.props.width && video.props.height)) return null;
    return {
      severity: 'warning',
      message: 'og:video:width and og:video:height are missing. Facebook says they\'re "required for videos". Discord treats them as optional, but drops the video if it can\'t measure the file.',
      fix: `${tag('og:video:width', '1280')}\n${tag('og:video:height', '720')}`,
    };
  }),

  rule('video-image', ['discord'], ['discord'], ({ c }) => {
    if (!c.videos.length || c.images.length) return null;
    return {
      severity: 'error',
      message: 'og:video has no og:image. Discord: "og:image is required to render the video", and it becomes the preview frame.',
      fix: tag('og:image', 'https://example.com/video-still.png'),
    };
  }),

  rule('video-https', ['facebook', 'discord'], ['fb', 'discord'], ({ c }) =>
    c.videos
      .filter((g) => !/^https:\/\//i.test(g.props.secure_url ?? g.url))
      .map((g) => ({
        severity: /** @type {const} */ ('warning'),
        message: `${g.rootKey} isn't https. Discord: "Serve the file over https". Facebook needs https for in-line play in Feed.`,
      }))),

  rule('video-type', ['facebook', 'discord'], ['fb', 'discord'], ({ c }) =>
    c.videos
      .filter((g) => g.props.type && !DISCORD_VIDEO_TYPES.includes(g.props.type.toLowerCase()))
      .map((g) => ({
        severity: /** @type {const} */ ('warning'),
        message: `og:video:type is "${g.props.type}". Discord supports ${DISCORD_VIDEO_TYPES.join(', ')}, and Facebook supports video/mp4.`,
        fix: tag('og:video:type', 'video/mp4'),
      }))),

  rule('video-layout', ['discord'], ['discord'], ({ c }) => {
    if (!c.videos.length) return null;
    const type = c.get('og:type') ?? '';
    if (type === 'video' || type.startsWith('video.') || c.get('twitter:card') === 'player') return null;
    return {
      severity: 'info',
      message: 'og:video is present, but Discord only uses its video layout when og:type is "video" or "video.*", or twitter:card is "player".',
      fix: tag('og:type', 'video.other'),
    };
  }),
];
