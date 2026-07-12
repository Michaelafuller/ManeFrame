/**
 * Decodes a bundled raster hairstyle-overlay asset (Iteration 5R / M6
 * remediation: real donor-hair cutout PNGs, see `src/overlays/registry.ts`)
 * into an RGBA pixel buffer via Skia, the same way `PreviewScreen.tsx`'s
 * `decodePhoto` decodes a picked photo. Skia-backed — not exercised for
 * real in Jest (no native Skia/expo-asset runtime there); `decodeOverlayAsset`
 * is defensive (try/catch, returns `null` on any failure) so a test
 * environment that stubs Skia/expo-asset out never throws. Verified for
 * real on-device instead (dev diagnostic + Maestro flow, see docs/E2E.md).
 *
 * The self-authored SVG rasterization path from Iteration 5
 * (`rasterizeOverlaySvg`) is retired along with the SVG art it rendered —
 * see docs/PROGRESS.md's Iteration 5 planner review.
 */

import { Asset } from 'expo-asset';
import {
  AlphaType,
  ColorType,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';

export interface RasterizedOverlay {
  /** The decoded image, ready to draw as a Skia layer. */
  image: SkImage;
  /** Raw RGBA_8888 pixels of the same image, for the recolor pipeline. */
  pixels: Uint8Array;
  width: number;
  height: number;
}

/**
 * Resolves and decodes a bundled overlay raster asset (a `require()`
 * module id, as stored in `OverlayAsset.module`) into pixels. Returns
 * `null` on any failure (asset resolution, decode, or pixel readback) —
 * callers should treat that the same as "no overlay art available" rather
 * than crash, matching `rasterizeOverlaySvg`'s old contract.
 */
export async function decodeOverlayAsset(moduleId: number): Promise<RasterizedOverlay | null> {
  try {
    const asset = Asset.fromModule(moduleId);
    if (!asset.localUri) {
      await asset.downloadAsync();
    }
    if (!asset.localUri) return null;

    const data = await Skia.Data.fromURI(asset.localUri);
    const skImage = Skia.Image.MakeImageFromEncoded(data);
    if (!skImage) return null;

    const width = skImage.width();
    const height = skImage.height();
    const raw = skImage.readPixels(0, 0, {
      width,
      height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    if (!raw || !(raw instanceof Uint8Array)) return null;

    return { image: skImage, pixels: raw, width, height };
  } catch {
    return null;
  }
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
