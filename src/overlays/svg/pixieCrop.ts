import { svgWrapper } from './shared';

/**
 * Pixie Crop — short, cropped close to the scalp, with a side-swept fringe
 * dipping diagonally across the forehead. Drawn as a single compound path
 * (`fill-rule="evenodd"`): the outer cap silhouette plus an inner
 * face-oval cutout (same ellipse geometry on all six styles) so the
 * wearer's actual face shows through once this overlay is placed via the
 * shared `OVERLAY_HEAD_BOX` anchor.
 */
export const PIXIE_CROP_SVG = svgWrapper(`
  <path
    fill-rule="evenodd"
    fill="url(#hairGrad)"
    d="
      M170,150
      C175,100 220,70 256,70
      C292,70 337,100 342,150
      C346,180 344,210 334,238
      C330,248 322,252 312,246
      C300,238 296,215 284,190
      C270,160 262,145 245,150
      C220,158 205,190 196,225
      C190,242 184,248 176,240
      C166,225 166,180 170,150
      Z
      M368,230
      C368,299.04 317.86,355 256,355
      C194.14,355 144,299.04 144,230
      C144,160.96 194.14,105 256,105
      C317.86,105 368,160.96 368,230
      Z
    "
  />
  <path
    fill="url(#hairHighlight)"
    opacity="0.7"
    d="M190,110 C210,85 240,75 256,74 C272,75 296,82 314,105 C300,95 278,88 256,88 C232,88 208,95 190,110 Z"
  />
  <path
    fill="url(#hairShadow)"
    opacity="0.5"
    d="M300,238 C296,215 284,190 270,160 C280,185 292,212 300,238 Z"
  />
`);
