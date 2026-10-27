import { OgView } from './og-view.js';

export { OgView };
export { collect } from './collect.js';
export { analyze } from './debug.js';

if (!customElements.get('og-view')) customElements.define('og-view', OgView);
