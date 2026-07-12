import { svgWrapper } from './shared';

/**
 * Buzz Cut — extremely short, a thin dome hugging the very top of the
 * scalp. Most of the drawn dome overlaps the shared face-oval cutout
 * (evenodd), leaving only a narrow rim tracing the hairline — exactly the
 * silhouette a genuine buzz cut has (barely proud of the head, no
 * meaningful side/back volume).
 */
export const BUZZ_CUT_SVG = svgWrapper(`
  <path
    fill-rule="evenodd"
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
    opacity="0.5"
    d="M200,120 C215,98 234,88 256,87 C278,88 297,98 312,120 C296,108 276,102 256,102 C236,102 216,108 200,120 Z"
  />
`);
