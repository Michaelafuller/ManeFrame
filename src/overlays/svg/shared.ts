/**
 * Shared SVG building blocks for the self-authored hairstyle overlay art
 * (Iteration 5 / M6). Every overlay is drawn on the same viewBox and shares
 * the same neutral-brown, mid-luminance gradient definitions so the six
 * styles read as one consistent art system (per docs/HANDOFF.md: "Consistent
 * art style across all 6 beats photo-real mismatch").
 *
 * The gradients are deliberately a *luminance ramp* (darker at the crown/
 * part line, lighter toward the ends/edges) with real L variation, not a
 * flat fill — the existing recolor engine (`recolorPixel`) blends toward a
 * target color while partially retaining original luminance
 * (`highlightRetention`), so overlay art with no luminance structure would
 * recolor into a flat, texture-less blob. Alpha (opacity) is the shape's
 * own soft-edge falloff, which becomes the recolor confidence input once
 * rasterized (see `src/overlays/recolorOverlay.ts`).
 */

/** Shared overlay canvas size (all six styles use the same viewBox). */
export const OVERLAY_WIDTH = 512;
export const OVERLAY_HEIGHT = 640;

/**
 * Anchor metadata (normalized 0..1, in overlay coordinates): where the
 * wearer's face-skin region should sit under this art. Identical across
 * all six styles because they're all drawn against the same reference face
 * oval on the same canvas (this is what makes the placement engine's
 * transform math work uniformly regardless of how far individual styles'
 * hair extends below/around that oval).
 */
export const OVERLAY_HEAD_BOX = { x: 0.29, y: 0.17, w: 0.42, h: 0.38 } as const;

/** Standard SVG defs block: every style's <defs> is this, verbatim. */
export const SHARED_DEFS = `
  <defs>
    <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4a3527" />
      <stop offset="45%" stop-color="#6b4a35" />
      <stop offset="100%" stop-color="#8a6a4a" />
    </linearGradient>
    <linearGradient id="hairShadow" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%" stop-color="#3a2a1e" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#3a2a1e" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="hairHighlight" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0%" stop-color="#c9a878" stop-opacity="0" />
      <stop offset="45%" stop-color="#c9a878" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#c9a878" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="hairEdgeFade" cx="50%" cy="35%" r="70%">
      <stop offset="80%" stop-color="#ffffff" stop-opacity="1" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
  </defs>
`;

export function svgWrapper(body: string): string {
  return `<svg viewBox="0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${SHARED_DEFS}${body}</svg>`;
}
