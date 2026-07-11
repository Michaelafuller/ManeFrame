/**
 * Colorimetry: sRGB <-> CIELAB (D65 white point) conversions, plus a helper
 * to render a Lab color as a CSS hex string for UI swatches.
 *
 * Pure functions, no React imports.
 */

export interface Rgb {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

export interface Lab {
  l: number; // 0..100
  a: number; // roughly -128..127
  b: number; // roughly -128..127
}

// D65 reference white (2 degree observer), 0..100 scale.
const WHITE_X = 95.047;
const WHITE_Y = 100.0;
const WHITE_Z = 108.883;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** sRGB gamma decode: 0..1 gamma-encoded channel -> 0..1 linear channel. */
function srgbChannelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB gamma encode: 0..1 linear channel -> 0..1 gamma-encoded channel. */
function linearChannelToSrgb(c: number): number {
  const clamped = clamp(c, 0, 1);
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

/** CIELAB f(t) helper for XYZ -> Lab. */
function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29;
}

/** Inverse of labF, for Lab -> XYZ. */
function labFInv(t: number): number {
  const delta = 6 / 29;
  return t > delta ? t ** 3 : 3 * delta ** 2 * (t - 4 / 29);
}

/**
 * Converts an sRGB color (0..255 integer channels) to CIELAB (D65).
 */
export function srgbToLab(rgb: Rgb): Lab {
  const rLin = srgbChannelToLinear(rgb.r / 255);
  const gLin = srgbChannelToLinear(rgb.g / 255);
  const bLin = srgbChannelToLinear(rgb.b / 255);

  // Linear sRGB -> XYZ (D65), result scaled to 0..100.
  const x =
    (0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin) * 100;
  const y =
    (0.2126729 * rLin + 0.7151522 * gLin + 0.072175 * bLin) * 100;
  const z =
    (0.0193339 * rLin + 0.119192 * gLin + 0.9503041 * bLin) * 100;

  const fx = labF(x / WHITE_X);
  const fy = labF(y / WHITE_Y);
  const fz = labF(z / WHITE_Z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Converts a CIELAB (D65) color back to sRGB (0..255 integer channels),
 * clamping any out-of-gamut result into range.
 */
export function labToSrgb(lab: Lab): Rgb {
  const fy = (lab.l + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;

  const x = WHITE_X * labFInv(fx);
  const y = WHITE_Y * labFInv(fy);
  const z = WHITE_Z * labFInv(fz);

  // XYZ (0..100) -> linear sRGB (0..1).
  const xs = x / 100;
  const ys = y / 100;
  const zs = z / 100;

  const rLin = 3.2404542 * xs - 1.5371385 * ys - 0.4985314 * zs;
  const gLin = -0.969266 * xs + 1.8760108 * ys + 0.041556 * zs;
  const bLin = 0.0556434 * xs - 0.2040259 * ys + 1.0572252 * zs;

  const r = Math.round(clamp(linearChannelToSrgb(rLin), 0, 1) * 255);
  const g = Math.round(clamp(linearChannelToSrgb(gLin), 0, 1) * 255);
  const b = Math.round(clamp(linearChannelToSrgb(bLin), 0, 1) * 255);

  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
  };
}

function toHexByte(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

/**
 * Renders a CIELAB color as a `#rrggbb` CSS hex string, for UI swatches.
 */
export function labToCss(lab: Lab): string {
  const rgb = labToSrgb(lab);
  return `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}`;
}
