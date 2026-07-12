import { svgWrapper } from './shared';

/**
 * Long Beach Waves — long, wavy, extends well past the shoulders. The
 * outer silhouette undulates (alternating in/out control points along each
 * side) to read as wavy rather than poker-straight. Single closed path
 * (outer silhouette + inner hairline boundary) — see pixieCrop.ts for why
 * there is deliberately no face-oval cutout subpath.
 */
export const LONG_BEACH_WAVES_SVG = svgWrapper(`
  <path
    fill="url(#hairGrad)"
    d="
      M155,185
      C160,115 202,72 256,72
      C310,72 352,115 357,185
      C365,240 350,260 362,300
      C374,340 352,360 364,400
      C376,440 350,460 360,500
      C370,540 344,555 352,595
      C356,615 330,622 312,610
      C302,603 305,570 305,530
      C304,470 306,400 304,340
      C302,270 298,205 288,183
      C278,162 267,155 256,155
      C245,155 234,162 224,183
      C214,205 210,270 208,340
      C206,400 208,470 207,530
      C207,570 210,603 200,610
      C182,622 156,615 160,595
      C168,555 142,540 152,500
      C162,460 136,440 148,400
      C160,360 138,340 150,300
      C162,260 147,240 155,185
      Z
    "
  />
  <path
    fill="url(#hairHighlight)"
    opacity="0.55"
    d="M195,130 C215,95 238,80 256,79 C274,80 297,95 317,130 C298,112 277,102 256,102 C235,102 214,112 195,130 Z"
  />
  <path
    fill="url(#hairShadow)"
    opacity="0.4"
    d="M322,530 C318,470 316,400 314,340 C320,400 322,465 322,530 Z"
  />
  <path
    fill="url(#hairHighlight)"
    opacity="0.35"
    d="M190,530 C194,470 196,400 198,340 C192,400 189,465 190,530 Z"
  />
`);
