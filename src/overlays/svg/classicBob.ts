import { svgWrapper } from './shared';

/**
 * Classic Bob — chin-length, blunt ends, straight, symmetric coverage down
 * to the jawline. Single closed path: outer cap-and-sides silhouette,
 * inner boundary tracing the hairline across the forehead and down past
 * the cheeks (the enclosed region is exactly the hair). See pixieCrop.ts
 * for why there is deliberately no face-oval cutout subpath.
 */
export const CLASSIC_BOB_SVG = svgWrapper(`
  <path
    fill="url(#hairGrad)"
    d="
      M160,190
      C165,120 205,75 256,75
      C307,75 347,120 352,190
      C356,230 354,280 350,330
      C348,345 340,352 328,352
      C320,352 316,340 316,325
      C316,270 310,220 296,190
      C284,165 270,155 256,155
      C242,155 228,165 216,190
      C202,220 196,270 196,325
      C196,340 192,352 184,352
      C172,352 164,345 162,330
      C158,280 156,230 160,190
      Z
    "
  />
  <path
    fill="url(#hairHighlight)"
    opacity="0.6"
    d="M195,130 C215,95 238,80 256,79 C274,80 297,95 317,130 C298,112 277,102 256,102 C235,102 214,112 195,130 Z"
  />
  <path
    fill="url(#hairShadow)"
    opacity="0.45"
    d="M316,325 C316,270 310,220 296,190 C306,225 312,275 316,325 Z"
  />
`);
