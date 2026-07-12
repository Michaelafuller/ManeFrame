import { svgWrapper } from './shared';

/**
 * Classic Lob — shoulder-length, straight, no fringe. Same cap silhouette
 * as Classic Bob through the jawline, extended straight down to the
 * shoulders. Single closed path (outer silhouette + inner hairline
 * boundary) — see pixieCrop.ts for why there is deliberately no face-oval
 * cutout subpath.
 */
export const CLASSIC_LOB_SVG = svgWrapper(`
  <path
    fill="url(#hairGrad)"
    d="
      M160,190
      C165,120 205,75 256,75
      C307,75 347,120 352,190
      C358,260 358,340 356,420
      C355,470 352,520 345,555
      C340,570 325,575 315,565
      C308,555 306,500 306,420
      C306,300 300,220 256,180
      C212,220 206,300 206,420
      C206,500 204,555 197,565
      C187,575 172,570 167,555
      C160,520 157,470 156,420
      C154,340 154,260 160,190
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
    opacity="0.4"
    d="M306,420 C306,300 300,220 256,180 C296,225 306,320 306,420 Z"
  />
`);
