import { svgWrapper } from './shared';

/**
 * Buzz Cut — extremely short, a thin dome hugging the very top of the
 * scalp: a narrow band between the outer dome silhouette and an inner
 * boundary tracing the hairline, exactly the silhouette a genuine buzz
 * cut has (barely proud of the head, no side/back volume). Single closed
 * path — see pixieCrop.ts for why there is deliberately no face-oval
 * cutout subpath.
 */
export const BUZZ_CUT_SVG = svgWrapper(`
  <path
    fill="url(#hairGrad)"
    d="
      M178,155
      C182,110 215,80 256,80
      C297,80 330,110 334,155
      C336,175 332,192 322,200
      C310,178 292,168 256,168
      C220,168 202,178 190,200
      C180,192 176,175 178,155
      Z
    "
  />
  <path
    fill="url(#hairHighlight)"
    opacity="0.5"
    d="M200,120 C215,98 234,88 256,87 C278,88 297,98 312,120 C296,108 276,102 256,102 C236,102 216,108 200,120 Z"
  />
`);
