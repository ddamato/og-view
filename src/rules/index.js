import spec from './spec.js';
import hygiene from './hygiene.js';
import x from './x.js';
import facebook from './facebook.js';
import linkedin from './linkedin.js';
import discord from './discord.js';
import images from './images.js';
import video from './video.js';
import favicon from './favicon.js';

/** @type {import('./util.js').Rule[]} */
export const RULES = [...spec, ...hygiene, ...x, ...facebook, ...linkedin, ...discord, ...images, ...video, ...favicon];
