import { svgWrapper } from './shared';

/**
 * Long Beach Waves — long, wavy, extends well past the shoulders. The
 * outer silhouette undulates (alternating in/out control points along each
 * side) to read as wavy rather than poker-straight.
 */
export const LONG_BEACH_WAVES_SVG = svgWrapper(`
  <path
    fill-rule="evenodd"
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
      C300,602 302,570 298,530
      C292,470 288,400 280,340
      C274,290 266,240 256,210
      C246,240 238,290 232,340
      C224,400 220,470 214,530
      C210,570 212,602 200,610
      C182,622 156,615 160,595
      C168,555 142,540 152,500
      C162,460 136,440 148,400
      C160,360 138,340 150,300
      C162,260 147,240 155,185
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
    opacity="0.55"
    d="M195,130 C215,95 238,80 256,79 C274,80 297,95 317,130 C298,112 277,102 256,102 C235,102 214,112 195,130 Z"
  />
  <path
    fill="url(#hairShadow)"
    opacity="0.4"
    d="M298,530 C292,470 288,400 280,340 C290,400 296,465 298,530 Z"
  />
  <path
    fill="url(#hairHighlight)"
    opacity="0.35"
    d="M214,530 C220,470 224,400 232,340 C222,400 216,465 214,530 Z"
  />
`);
