import { svgWrapper } from './shared';

/**
 * Pixie Crop — short, cropped close to the scalp, with a side-swept fringe
 * dipping diagonally across the forehead. A single closed path whose OUTER
 * boundary is the cap silhouette and whose INNER boundary traces the
 * hairline/fringe — the enclosed region is exactly the hair, so the
 * wearer's actual face shows through below the fringe once this overlay
 * is placed via the shared `OVERLAY_HEAD_BOX` anchor.
 *
 * NOTE (Iteration 5 on-device finding): do NOT add a face-oval "cutout"
 * subpath. With `fill-rule="evenodd"` a second subpath only subtracts
 * where it overlaps the first — everywhere else it ADDS fill, which
 * painted a solid blob over the wearer's face in the first evidence
 * capture (docs/evidence). Each style's own inner hairline boundary is
 * the correct construction.
 */
export const PIXIE_CROP_SVG = svgWrapper(`
  <path
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
