import { svgWrapper } from './shared';

/**
 * Curly Shag — medium length, layered, curly/wavy texture. Built from a
 * base shag silhouette (same evenodd cap-minus-face-oval technique as the
 * other five) plus a ring of overlapping "curl puff" circles around its
 * perimeter for a bumpy, voluminous curl outline. Every curl circle is
 * placed outside the shared face-oval rectangle (x in [148,364], y in
 * [109,352]) so none of them need their own cutout.
 */
export const CURLY_SHAG_SVG = svgWrapper(`
  <path
    fill-rule="evenodd"
    fill="url(#hairGrad)"
    d="
      M165,190
      C170,120 210,78 256,78
      C302,78 342,120 347,190
      C352,240 350,300 344,360
      C338,410 328,450 312,478
      C302,494 288,480 290,455
      C293,420 296,380 296,340
      C296,280 288,220 256,190
      C224,220 216,280 216,340
      C216,380 219,420 222,455
      C224,480 210,494 200,478
      C184,450 174,410 168,360
      C162,300 160,240 165,190
      Z
      M368,230
      C368,299.04 317.86,355 256,355
      C194.14,355 144,299.04 144,230
      C144,160.96 194.14,105 256,105
      C317.86,105 368,160.96 368,230
      Z
    "
  />
  <!-- Curl puffs: crown -->
  <circle cx="190" cy="95" r="24" fill="url(#hairGrad)" opacity="0.95" />
  <circle cx="230" cy="80" r="26" fill="url(#hairGrad)" opacity="0.95" />
  <circle cx="256" cy="72" r="28" fill="url(#hairGrad)" />
  <circle cx="282" cy="80" r="26" fill="url(#hairGrad)" opacity="0.95" />
  <circle cx="322" cy="95" r="24" fill="url(#hairGrad)" opacity="0.95" />
  <!-- Curl puffs: upper sides -->
  <circle cx="130" cy="140" r="22" fill="url(#hairGrad)" opacity="0.9" />
  <circle cx="382" cy="140" r="22" fill="url(#hairGrad)" opacity="0.9" />
  <!-- Curl puffs: mid sides -->
  <circle cx="128" cy="210" r="20" fill="url(#hairGrad)" opacity="0.9" />
  <circle cx="384" cy="210" r="20" fill="url(#hairGrad)" opacity="0.9" />
  <circle cx="126" cy="260" r="20" fill="url(#hairGrad)" opacity="0.85" />
  <circle cx="386" cy="260" r="20" fill="url(#hairGrad)" opacity="0.85" />
  <!-- Curl puffs: lower / shoulder -->
  <circle cx="160" cy="400" r="24" fill="url(#hairGrad)" opacity="0.9" />
  <circle cx="352" cy="400" r="24" fill="url(#hairGrad)" opacity="0.9" />
  <circle cx="180" cy="450" r="22" fill="url(#hairGrad)" opacity="0.85" />
  <circle cx="332" cy="450" r="22" fill="url(#hairGrad)" opacity="0.85" />
  <circle cx="220" cy="475" r="20" fill="url(#hairGrad)" opacity="0.85" />
  <circle cx="292" cy="475" r="20" fill="url(#hairGrad)" opacity="0.85" />
  <!-- Highlight/shadow glints on a few curls for texture -->
  <circle cx="250" cy="66" r="12" fill="url(#hairHighlight)" opacity="0.6" />
  <circle cx="185" cy="90" r="8" fill="url(#hairHighlight)" opacity="0.5" />
  <circle cx="325" cy="90" r="8" fill="url(#hairShadow)" opacity="0.5" />
  <circle cx="345" cy="405" r="10" fill="url(#hairShadow)" opacity="0.5" />
`);
