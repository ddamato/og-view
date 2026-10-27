/**
 * Layout-only styles, injected once. Everything is in `@layer og-view` with
 * zero-specificity `:where()` selectors, so any page CSS wins. Typography and
 * color come from the page's own h2, p, a, code and hr rules.
 */
export const STYLES = /* css */ `
@layer og-view {
  :where(og-view) {
    display: block;
    container-type: inline-size;
  }

  :where(.og-view [hidden]) {
    display: none !important;
  }

  :where(.og-view) {
    display: grid;
    grid-template-columns: minmax(0, var(--og-view-image-width, 45%)) minmax(0, 1fr);
    gap: var(--og-view-gap, clamp(1.5rem, 5cqi, 4rem));
    align-items: center;
  }

  @container (max-width: 40rem) {
    :where(.og-view) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  :where(.og-view h1, .og-view h2, .og-view h3, .og-view h4, .og-view h5, .og-view h6, .og-view p, .og-view figure, .og-view hr) {
    margin: 0;
  }

  /* Image */

  :where(.og-view__image) {
    --_c: var(--og-view-chamfer, 0.75rem);
    position: relative;
    aspect-ratio: 1200 / 630;
    clip-path: polygon(
      var(--_c) 0, calc(100% - var(--_c)) 0, 100% var(--_c), 100% calc(100% - var(--_c)),
      calc(100% - var(--_c)) 100%, var(--_c) 100%, 0 calc(100% - var(--_c)), 0 var(--_c)
    );
    background: color-mix(in srgb, currentColor 6%, transparent);
  }

  :where(.og-view__image)::after {
    content: '';
    position: absolute;
    inset: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--og-view-accent, currentColor) 30%, transparent);
    pointer-events: none;
  }

  :where(.og-view__image img) {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    max-inline-size: none;
    object-fit: cover;
  }

  :where(.og-view__placeholder) {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, currentColor 10%, transparent) 0 1px,
      transparent 1px 1.5rem
    );
  }

  :where(.og-view__image > .og-view__tag) {
    position: absolute;
    inset-block-start: 1.25rem;
    inset-inline-start: 1.25rem;
    z-index: 1;
  }

  /* Text column */

  :where(.og-view__body) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-inline-size: 0;
  }

  :where(.og-view__field) {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-inline-size: 0;
  }

  :where(.og-view__site) {
    display: flex;
    align-items: center;
    gap: 0.75em;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--og-view-accent, inherit);
  }

  :where(.og-view__favicon) {
    flex: none;
    display: grid;
    place-items: center;
    inline-size: 2em;
    block-size: 2em;
    border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
  }

  :where(.og-view__favicon img) {
    inline-size: 1.25em;
    block-size: 1.25em;
    object-fit: contain;
  }

  :where(.og-view__favicon-fallback)::before {
    content: '◆';
    font-size: 0.6em;
  }

  :where(.og-view__title, .og-view__description) {
    overflow-wrap: break-word;
  }

  :where(.og-view hr) {
    border: 0;
    border-block-start: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    inline-size: 100%;
  }

  :where(.og-view__meta) {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    min-inline-size: 0;
  }

  :where(.og-view__qr) {
    flex: none;
    inline-size: var(--og-view-qr-size, 7rem);
    padding: 0.5rem;
    /* Dark modules on a light background whatever the theme, for reliable scanning. */
    color: var(--og-view-qr-color, var(--_og-view-qr-dark, currentColor));
    background: var(--og-view-qr-background, var(--_og-view-qr-light, transparent));
  }

  :where(.og-view__qr svg) {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }

  :where(.og-view__url) {
    overflow-wrap: anywhere;
  }

  /* Property chips */

  :where(.og-view__tag) {
    inline-size: fit-content;
    padding: 0.1em 0.5em;
    font-size: 0.75em;
    line-height: 1.5;
    letter-spacing: normal;
    text-transform: none;
    /* Inverted: the page's text color behind the page's background color. */
    color: var(--og-view-tag-color, var(--_og-view-surface, inherit));
    background: var(--og-view-tag-background, var(--_og-view-ink, color-mix(in srgb, currentColor 18%, transparent)));
  }
}
`;

/** @param {Document} doc */
export function injectStyles(doc) {
  if (doc.getElementById('og-view-styles')) return;
  const style = doc.createElement('style');
  style.id = 'og-view-styles';
  style.textContent = STYLES;
  // First in <head>, so page stylesheets and their layers come later.
  doc.head.prepend(style);
}
