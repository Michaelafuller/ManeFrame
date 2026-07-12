/**
 * Rasterizes a self-authored SVG hairstyle overlay (see
 * `src/overlays/registry.ts`) to an RGBA pixel buffer via Skia, the same
 * way `PreviewScreen.tsx`'s `decodePhoto` rasterizes a photo. Skia-backed
 * — not unit-testable in Jest (no native Skia runtime there; see
 * `src/ui/__tests__/App.test.tsx`'s Skia mock, which deliberately omits
 * `Skia.SVG`/`Skia.Surface` because this path is never exercised in
 * tests). Verified on-device instead (dev diagnostic + Maestro flow, see
 * docs/E2E.md).
 */

import {
  AlphaType,
  ColorType,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';

export interface RasterizedOverlay {
  /** The rasterized image, ready to draw as a Skia layer. */
  image: SkImage;
  /** Raw RGBA_8888 pixels of the same image, for the recolor pipeline. */
  pixels: Uint8Array;
  width: number;
  height: number;
}

/**
 * Renders `svgString` (a self-contained `<svg>...</svg>` document, as
 * produced by `src/overlays/svg/*.ts`) into a `width x height` raster and
 * reads back its RGBA pixels. Returns `null` on any failure (malformed
 * SVG, surface allocation failure, unreadable pixels) — callers should
 * treat that the same as "no overlay art available" rather than crash.
 */
export function rasterizeOverlaySvg(
  svgString: string,
  width: number,
  height: number
): RasterizedOverlay | null {
  const svg = Skia.SVG.MakeFromString(svgString);
  if (!svg) return null;

  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('rgba(0, 0, 0, 0)'));
  canvas.drawSvg(svg, width, height);
  surface.flush();

  const image = surface.makeImageSnapshot();
  const raw = image.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!raw || !(raw instanceof Uint8Array)) return null;

  return { image, pixels: raw, width, height };
}

/** Wraps a recolored RGBA_8888 pixel buffer back into a drawable SkImage. */
export function overlayPixelsToSkImage(
  pixels: Uint8Array,
  width: number,
  height: number
): SkImage | null {
  const data = Skia.Data.fromBytes(pixels);
  return Skia.Image.MakeImage(
    { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    data,
    width * 4
  );
}
