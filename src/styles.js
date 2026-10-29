/**
 * Layout only, rendered inside each card. Selectors are wrapped in :where()
 * so they have no specificity and any page CSS wins over them, except the
 * image, which page resets like img { height: auto } would otherwise pull out
 * of its box.
 */
export const STYLES = /* css */ `
:where(og-view) {
  display: block;
  margin: auto;
  width: fit-content;
  max-width: 100%;
}

:where(.og-view) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1ch;
}

:where(.og-view > *) {
  min-width: 0;
}

:where(.og-view__image) {
  flex-basis: 440px;
  align-self: stretch;
  aspect-ratio: 1.91;
  width: 100%;
  background: var(--_og-view-backdrop) center / cover;
}

.og-view__image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  backdrop-filter: blur(32px);
}

:where(.og-view__body) {
  width: 440px;
}

:where(.og-view__field) {
  max-width: 40ch;
}

:where(.og-view__site, .og-view__meta) {
  display: flex;
  align-items: center;
  gap: 1ch;
}

:where(.og-view__favicon) {
  aspect-ratio: 1;
  width: 1em;
  color-scheme: var(--_og-view-scheme, normal);
}

:where(.og-view__qr) {
  aspect-ratio: 1;
  width: 4em;
}

:where(og-view [hidden]) {
  display: none !important;
}

:where(og-view img) {
  max-width: 100%;
}
`;
