/**
 * Layout only, injected once. Being in a layer means any page CSS wins over
 * it regardless of specificity, so typography and color come from the page.
 */
export const STYLES = /* css */ `
@layer og-view {
  og-view {
    display: block;
    margin: auto;
    width: fit-content;
    max-width: 100%;
  }

  .og-view {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1ch;

    & > .og-view__field {
      flex-basis: 520px;
      aspect-ratio: 1.91;
      width: 100%;
    }

    & > .og-view__body {
      width: 520px;
    }

    & > * {
      min-width: 0;
    }

    & .og-view__image {
      margin: 0;
    }

    & :where(.og-view__site, .og-view__meta) {
      display: flex;
      align-items: center;
      gap: 1ch;
    }

    & .og-view__favicon {
      aspect-ratio: 1;
      width: 1em;
    }

    & .og-view__qr {
      aspect-ratio: 1;
      width: 4em;
    }
  }

  og-view [hidden] {
    display: none !important;
  }

  og-view img {
    max-width: 100%;
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
