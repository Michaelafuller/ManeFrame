import { svgWrapper } from './shared';

/**
 * Curly Shag — medium length, layered, curly/wavy texture. Built from a
 * base shag silhouette (single closed path: outer silhouette + inner
 * hairline boundary, same construction as the other five — see
 * pixieCrop.ts for why there is deliberately no face-oval cutout subpath)
 * plus a ring of overlapping "curl puff" circles around its perimeter for
 * a bumpy, voluminous curl outline. Every curl circle sits outside the
 * face region so none of them cover the wearer's face.
 */
export const CURLY_SHAG_SVG = svgWrapper(`
  <path
    fill="url(#hairGrad)"
    d="
      M165,190
      C170,120 210,78 256,78
      C302,78 342,120 347,190
      C352,240 350,300 344,360
      C338,410 328,450 312,478
      C302,494 288,480 290,455
      C295,420 300,380 302,340
      C304,275 292,212 256,195
      C220,212 208,275 210,340
      C212,380 217,420 222,455
      C224,480 210,494 200,478
      C184,450 174,410 168,360
      C162,300 160,240 165,190
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
