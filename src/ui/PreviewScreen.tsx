import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  AlphaType,
  Canvas,
  ColorType,
  Image as SkiaImage,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';

import { loadColors, loadHairstyles } from '../catalog';
import type { HairColor, Hairstyle } from '../catalog/types';
import type { RecolorParams } from '../color/recolor';
import { recolorImageChunked } from '../color/recolorImage';
import {
  computeHeadBox,
  computeMaskBoundingBox,
  computeUniformPlacementFromFaceMask,
} from '../placement/headBox';
import type { AffineTransform } from '../placement/types';
import { getOverlayAsset, hasOverlayArt } from '../overlays/registry';
import { decodeOverlayAsset, overlayPixelsToSkImage } from '../overlays/rasterize';
import { recolorOverlayImage } from '../overlays/recolorOverlay';
import { MockHairSegmenter } from '../segmentation/mock';
import { segmentBothWithFallback } from '../segmentation/selectSegmenter';
import { TfliteHairSegmenter } from '../segmentation/tflite';
import type { FaceMask, HairMask } from '../segmentation/types';
import { ColorSwatch } from './ColorSwatch';

/** Photos are downscaled to at most this many pixels on their long side. */
const MAX_PHOTO_DIMENSION = 768;

/**
 * Dev/E2E-only diagnostic asset: a real, licensed portrait with clearly
 * visible hair (see docs/E2E.md for source + CC0 license), bundled at
 * build time - never fetched over the network. Automated flows (and the
 * standing privacy rule against browsing the device photo library) have
 * no other way to exercise real hair segmentation on an actual head of
 * hair, since automated camera captures just photograph whatever the
 * device happens to be pointed at (a desk, in practice). Long-pressing
 * the photo-picker entry points loads this asset through the exact same
 * `processPickedAsset` path as a real picked/captured photo.
 */
const bundledTestPortrait = require('../../assets/test/portrait.jpg');

/**
 * Dev/E2E-only diagnostic asset with deliberately NO face in frame (a
 * generated app icon, not a photo of anyone) - lets automation exercise
 * the "No face detected" hint deterministically without ever touching the
 * device camera or photo library (Iteration 5 / M6; see docs/E2E.md).
 */
const bundledNoFaceTestImage = require('../../assets/splash-icon.png');

const INTENSITY_PRESETS: { label: string; value: number }[] = [
  { label: 'Subtle 0.5', value: 0.5 },
  { label: 'Natural 0.8', value: 0.8 },
  { label: 'Bold 1.0', value: 1.0 },
];

/** Manual nudge-control step sizes (Iteration 5 / M6 placement correction). */
const NUDGE_MOVE_FRACTION = 0.02; // fraction of photo width/height per press
const NUDGE_SCALE_STEP = 0.05;
const NUDGE_SCALE_MIN = 0.5;
const NUDGE_SCALE_MAX = 2;

/** Below this hair-pixel fraction, "no hair detected" is treated as the normal case, not an error. */
const NO_HAIR_FRACTION_THRESHOLD = 0.005;

/**
 * If the detected hair region's height (as a fraction of photo height)
 * exceeds the placed head box's height by more than this multiplier, the
 * selected style is meaningfully shorter than the wearer's real hair -
 * some real hair will show past the overlay's edges (known limitation,
 * see docs/HANDOFF.md / docs/SUMMARY.md).
 */
const HAIR_LONGER_THAN_STYLE_RATIO = 1.3;

interface DecodedPhoto {
  skImage: SkImage;
  pixels: Uint8Array;
  width: number;
  height: number;
}

interface NudgeState {
  dx: number; // photo-pixel offset
  dy: number; // photo-pixel offset
  scale: number; // multiplier, applied around the placed rect's center
}

const DEFAULT_NUDGE: NudgeState = { dx: 0, dy: 0, scale: 1 };

/** Decodes an image file into an SkImage plus its raw RGBA_8888 pixel bytes. */
async function decodePhoto(uri: string): Promise<DecodedPhoto> {
  const data = await Skia.Data.fromURI(uri);
  const skImage = Skia.Image.MakeImageFromEncoded(data);
  if (!skImage) {
    throw new Error('Could not decode the selected photo.');
  }

  const width = skImage.width();
  const height = skImage.height();
  const raw = skImage.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });

  if (!raw || !(raw instanceof Uint8Array)) {
    throw new Error('Could not read pixel data from the selected photo.');
  }

  return { skImage, pixels: raw, width, height };
}

/** Wraps a recolored RGBA_8888 pixel buffer back into a drawable SkImage. */
function pixelsToSkImage(
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

/** A style overlay's placed rectangle, in photo-pixel space (before display scaling). */
interface PlacedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectFromTransform(
  transform: AffineTransform,
  overlayWidth: number,
  overlayHeight: number
): PlacedRect {
  return {
    x: transform.translateX,
    y: transform.translateY,
    w: overlayWidth * transform.scaleX,
    h: overlayHeight * transform.scaleY,
  };
}

/** Applies a manual nudge (move + scale-around-center) to a placed rect. */
function applyNudge(rect: PlacedRect, nudge: NudgeState): PlacedRect {
  return {
    x: rect.x + nudge.dx - (rect.w * (nudge.scale - 1)) / 2,
    y: rect.y + nudge.dy - (rect.h * (nudge.scale - 1)) / 2,
    w: rect.w * nudge.scale,
    h: rect.h * nudge.scale,
  };
}

export default function PreviewScreen({
  selectedColor,
  selectedStyle,
}: {
  selectedColor: HairColor | null;
  selectedStyle?: Hairstyle | null;
}) {
  const allColors = useMemo(() => loadColors(), []);
  const allStyles = useMemo(() => loadHairstyles(), []);
  const artBearingStyles = useMemo(
    () => allStyles.filter((s) => hasOverlayArt(s.id)),
    [allStyles]
  );
  const tfliteSegmenter = useMemo(() => new TfliteHairSegmenter(), []);
  const mockSegmenter = useMemo(() => new MockHairSegmenter(), []);

  const [activeColor, setActiveColor] = useState<HairColor>(
    selectedColor ?? allColors[0]
  );
  // Seeded once from selectedStyle, same pattern/rationale as activeColor
  // below (App.tsx only ever mounts one screen at a time - see the note
  // further down).
  const [activeStyleId, setActiveStyleId] = useState<string | null>(
    selectedStyle && hasOverlayArt(selectedStyle.id) ? selectedStyle.id : null
  );
  const [intensity, setIntensity] = useState(0.8);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [photo, setPhoto] = useState<DecodedPhoto | null>(null);
  const [mask, setMask] = useState<HairMask | null>(null);
  const [faceMask, setFaceMask] = useState<FaceMask | null>(null);
  const [recoloredImage, setRecoloredImage] = useState<SkImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState<NudgeState>(DEFAULT_NUDGE);
  // Dev toggle: force the mock segmenter even when TFLite is available, to
  // compare the two side by side. Also flips true automatically whenever
  // TFLite construction/inference actually fails (see the segmentation
  // effect below), so the "mock segmentation" badge reflects reality either
  // way.
  const [forceMock, setForceMock] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  // Set only when the tflite segmenter actually failed and the mock
  // engaged as a fallback (see the "Stop hiding segmentation failures"
  // fix, docs/REMEDIATION.md Iteration 4R-4) - never set for a plain
  // user-toggled mock, so the badge only shows a failure reason when
  // there was an actual failure.
  const [segmentationError, setSegmentationError] = useState<string | null>(null);
  // Layout size (dp) of the canvas view, measured via onLayout. The
  // decoded photo's own pixel dimensions (often >768px) are not the same
  // as the on-screen view size, so the SkiaImage draw rect must use this
  // measured size - not photo.width/height - or the image renders zoomed
  // in/cropped instead of fully visible and centered.
  const [canvasLayout, setCanvasLayout] = useState({ width: 0, height: 0 });
  const swatchScrollRef = useRef<ScrollView | null>(null);

  const runIdRef = useRef(0);

  // Note: `activeColor`/`activeStyleId` are deliberately only seeded from
  // `selectedColor`/`selectedStyle` via the useState initializer above, not
  // re-synced in an effect. App.tsx renders exactly one of {SearchScreen,
  // PreviewScreen} at a time, so this component only (re)mounts - picking
  // up whatever App.tsx is holding at that moment - when the user switches
  // into the Preview tab; there's no scenario where those props change
  // while this instance is already mounted.

  // Reset manual placement nudges whenever the photo or the active style
  // changes - a nudge tuned for one photo/style pairing rarely makes sense
  // for another. Deliberately NOT a `useEffect` (which would call setState
  // synchronously in the effect body and trigger an extra cascading
  // render, flagged by `react-hooks/set-state-in-effect`): this is React's
  // documented "adjusting state when a prop changes" pattern - detecting
  // the change and calling setState directly during render, which React
  // handles by re-rendering immediately before committing/painting.
  const [nudgeResetKey, setNudgeResetKey] = useState<{
    photo: DecodedPhoto | null;
    styleId: string | null;
  }>({ photo: null, styleId: null });
  if (nudgeResetKey.photo !== photo || nudgeResetKey.styleId !== activeStyleId) {
    setNudgeResetKey({ photo, styleId: activeStyleId });
    setNudge(DEFAULT_NUDGE);
  }

  // Segment once per photo: both the hair mask (existing recolor pipeline)
  // and the face-skin mask (Iteration 5 / M6 placement engine input), from
  // a single underlying inference pass (`segmentBoth`/`segmentBothWithFallback`).
  // Wrapped in an inner async function (the React-recommended pattern for
  // async effects) so the state updates happen as part of the async data
  // flow, not synchronously on every effect run.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!photo) {
        setMask(null);
        setFaceMask(null);
        setUsingMock(false);
        setSegmentationError(null);
        return;
      }
      if (forceMock) {
        const { hair, face } = await mockSegmenter.segmentBoth(
          photo.width,
          photo.height,
          photo.pixels
        );
        if (!cancelled) {
          setMask(hair);
          setFaceMask(face);
          setUsingMock(true);
          setSegmentationError(null);
        }
        return;
      }
      const result = await segmentBothWithFallback(
        tfliteSegmenter,
        mockSegmenter,
        photo.width,
        photo.height,
        photo.pixels
      );
      if (!cancelled) {
        setMask(result.hair);
        setFaceMask(result.face);
        setUsingMock(result.usedFallback);
        if (result.usedFallback && result.error) {
          // Always log the full chain (message + cause) so logcat has it
          // even though the UI only shows a truncated one-liner.
          const cause =
            result.rawError instanceof Error ? (result.rawError as { cause?: unknown }).cause : undefined;
          console.warn(
            '[PreviewScreen] tflite segmentation failed, falling back to mock:',
            result.error,
            cause !== undefined ? `\ncause: ${String(cause)}` : ''
          );
          setSegmentationError(result.error);
        } else {
          setSegmentationError(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photo, forceMock, tfliteSegmenter, mockSegmenter]);

  // Recolor whenever the photo, mask, color, or intensity changes. Stale
  // runs (superseded by a newer color/intensity/photo change) are ignored.
  useEffect(() => {
    if (!photo || !mask) {
      return;
    }
    const runId = ++runIdRef.current;
    const params: RecolorParams = { color: activeColor, intensity };

    (async () => {
      setIsProcessing(true);
      setError(null);
      try {
        const result = await recolorImageChunked(
          photo.pixels,
          photo.width,
          photo.height,
          mask,
          params,
          { isStale: () => runIdRef.current !== runId }
        );
        if (runIdRef.current !== runId || !result) return;
        const built = pixelsToSkImage(result, photo.width, photo.height);
        if (!built) {
          setError('Could not build the recolored image.');
          return;
        }
        setRecoloredImage(built);
      } catch (e) {
        if (runIdRef.current === runId) {
          setError(e instanceof Error ? e.message : 'Recolor failed.');
        }
      } finally {
        if (runIdRef.current === runId) {
          setIsProcessing(false);
        }
      }
    })();
  }, [photo, mask, activeColor, intensity]);

  const activeStyle = useMemo(
    () => allStyles.find((s) => s.id === activeStyleId) ?? null,
    [allStyles, activeStyleId]
  );
  const overlayAsset = useMemo(
    () => (activeStyle ? getOverlayAsset(activeStyle.id) : null),
    [activeStyle]
  );

  // Decode the selected style's bundled raster cutout once per style change
  // (Iteration 5R: real donor-hair PNGs, not the retired self-authored SVG
  // art - independent of color/intensity, which only recolor the same
  // raster). Genuinely async (asset resolution + Skia decode), so this is
  // state+effect, not a plain useMemo.
  const [overlayRaster, setOverlayRaster] = useState<{
    pixels: Uint8Array;
    width: number;
    height: number;
  } | null>(null);
  const overlayRasterRunIdRef = useRef(0);

  useEffect(() => {
    const runId = ++overlayRasterRunIdRef.current;
    (async () => {
      if (!overlayAsset) {
        if (overlayRasterRunIdRef.current === runId) setOverlayRaster(null);
        return;
      }
      const decoded = await decodeOverlayAsset(overlayAsset.module);
      if (overlayRasterRunIdRef.current !== runId) return;
      setOverlayRaster(
        decoded ? { pixels: decoded.pixels, width: decoded.width, height: decoded.height } : null
      );
    })();
  }, [overlayAsset]);

  // Recolor the rasterized overlay through the exact same Lab pipeline as
  // hair recolor, using the overlay's own alpha as the confidence input.
  // Genuinely async (recolorOverlayImage yields to the event loop), so
  // this stays state+effect - every setState call lives inside the async
  // IIFE (same convention as the segmentation/recolor effects above),
  // never synchronously in the effect body itself.
  const [overlayImage, setOverlayImage] = useState<SkImage | null>(null);
  const overlayRunIdRef = useRef(0);

  useEffect(() => {
    const runId = ++overlayRunIdRef.current;
    (async () => {
      if (!overlayRaster) {
        if (overlayRunIdRef.current === runId) setOverlayImage(null);
        return;
      }
      const params: RecolorParams = { color: activeColor, intensity };
      const recolored = await recolorOverlayImage(
        overlayRaster.pixels,
        overlayRaster.width,
        overlayRaster.height,
        params,
        { isStale: () => overlayRunIdRef.current !== runId }
      );
      if (overlayRunIdRef.current !== runId || !recolored) return;
      const built = overlayPixelsToSkImage(recolored, overlayRaster.width, overlayRaster.height);
      if (overlayRunIdRef.current === runId) setOverlayImage(built);
    })();
  }, [overlayRaster, activeColor, intensity]);

  // Placement engine (Iteration 5R contract): face mask -> face box ->
  // UNIFORM overlay transform (scale = target face width / donor face
  // width, top-centers aligned - no non-uniform stretch, which visibly
  // distorted the rejected Iteration 5 SVG art). `overlayAsset.headBox` is
  // the donor's own detected face box for raster cutout assets, not a
  // generic head box - see docs/ART.md. `null` distinctly means "no face
  // detected" only when a style is actually selected and a face mask
  // exists to test against - otherwise there's simply nothing to place yet.
  const placement = useMemo(() => {
    if (!photo || !faceMask || !overlayAsset) return null;
    return computeUniformPlacementFromFaceMask(
      faceMask,
      overlayAsset.headBox,
      overlayAsset.width,
      overlayAsset.height,
      photo.width,
      photo.height
    );
  }, [photo, faceMask, overlayAsset]);

  const noFaceDetected = activeStyleId !== null && overlayAsset !== null && faceMask !== null && placement === null;

  const placedRect = useMemo(() => {
    if (!placement || !overlayAsset) return null;
    return applyNudge(rectFromTransform(placement, overlayAsset.width, overlayAsset.height), nudge);
  }, [placement, overlayAsset, nudge]);

  // Known limitation (docs/HANDOFF.md): a style much shorter than the
  // wearer's actual detected hair will leave real hair visible past the
  // overlay's edges. Compares the detected hair region's height against
  // the placed head box's height (both as fractions of photo height).
  const styleShorterThanHairHint = useMemo(() => {
    if (!activeStyleId || !mask || !faceMask) return false;
    const hairBox = computeMaskBoundingBox(mask);
    const faceBox = computeMaskBoundingBox(faceMask);
    if (!hairBox || !faceBox) return false;
    const headBox = computeHeadBox(faceBox);
    return hairBox.h > headBox.h * HAIR_LONGER_THAN_STYLE_RATIO;
  }, [activeStyleId, mask, faceMask]);

  function nudgeMove(dxSign: number, dySign: number) {
    if (!photo) return;
    setNudge((n) => ({
      ...n,
      dx: n.dx + dxSign * photo.width * NUDGE_MOVE_FRACTION,
      dy: n.dy + dySign * photo.height * NUDGE_MOVE_FRACTION,
    }));
  }

  function nudgeScaleBy(sign: number) {
    setNudge((n) => ({
      ...n,
      scale: Math.min(NUDGE_SCALE_MAX, Math.max(NUDGE_SCALE_MIN, n.scale + sign * NUDGE_SCALE_STEP)),
    }));
  }

  function resetNudge() {
    setNudge(DEFAULT_NUDGE);
  }

  async function processPickedAsset(asset: ImagePicker.ImagePickerAsset) {
    try {
      setError(null);
      setPhoto(null);
      setRecoloredImage(null);
      setMask(null);
      setFaceMask(null);

      const isLandscape = asset.width >= asset.height;
      const context = isLandscape
        ? ImageManipulator.manipulate(asset.uri).resize({
            width: Math.min(asset.width, MAX_PHOTO_DIMENSION),
          })
        : ImageManipulator.manipulate(asset.uri).resize({
            height: Math.min(asset.height, MAX_PHOTO_DIMENSION),
          });

      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.9,
      });

      const decoded = await decodePhoto(saved.uri);
      setPhoto(decoded);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not process the selected photo.'
      );
    }
  }

  /**
   * Dev/E2E-only: loads a bundled asset through the exact same
   * `processPickedAsset` path a real picked/captured photo takes - the
   * only way automation (or a developer) can exercise real segmentation
   * without ever browsing the device photo library - see the standing
   * privacy rule in docs/PROGRESS.md. Never reachable in a release build.
   */
  async function loadBundledAsset(moduleRef: number, label: string) {
    if (!__DEV__) return;
    setPickerVisible(false);
    try {
      const asset = Asset.fromModule(moduleRef);
      if (!asset.localUri) {
        await asset.downloadAsync();
      }
      if (!asset.localUri || !asset.width || !asset.height) {
        setError(`Could not resolve the bundled ${label} asset.`);
        return;
      }
      await processPickedAsset({
        uri: asset.localUri,
        width: asset.width,
        height: asset.height,
      } as ImagePicker.ImagePickerAsset);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not load the bundled ${label}.`);
    }
  }

  const loadBundledTestPortrait = () => loadBundledAsset(bundledTestPortrait, 'test portrait');
  const loadBundledNoFaceImage = () => loadBundledAsset(bundledNoFaceTestImage, 'no-face test image');

  async function pickFromLibrary() {
    setPickerVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission was not granted.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || result.assets.length === 0) return;
    await processPickedAsset(result.assets[0]);
  }

  async function pickFromCamera() {
    setPickerVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission was not granted.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (result.canceled || result.assets.length === 0) return;
    await processPickedAsset(result.assets[0]);
  }

  const displayImage = showOriginal || !recoloredImage
    ? (photo?.skImage ?? null)
    : recoloredImage;

  const badgeLabel = segmentationError
    ? 'tflite failed → mock'
    : usingMock
      ? 'mock segmentation'
      : 'tflite segmentation';
  const truncatedSegmentationError =
    segmentationError && segmentationError.length > 60
      ? `${segmentationError.slice(0, 60)}…`
      : segmentationError;

  // Fraction of mask pixels with confidence > 0.5. Drives the release-
  // visible "no hair detected" hint (Iteration 5 / M6), so this now
  // computes unconditionally (previously __DEV__-only, back when it was
  // purely a diagnostic - see docs/SUMMARY.md Iteration 4R-6). Cost is
  // negligible: the mask is capped at 256px on its long side either way.
  const hairPixelFraction = useMemo(() => {
    if (!mask) return null;
    let above = 0;
    for (let i = 0; i < mask.data.length; i++) {
      if (mask.data[i] > 0.5) above++;
    }
    return above / mask.data.length;
  }, [mask]);

  const showNoHairHint =
    activeStyleId === null &&
    hairPixelFraction !== null &&
    hairPixelFraction < NO_HAIR_FRACTION_THRESHOLD;

  // Display-space scale: the canvas wrapper's `aspectRatio` style locks
  // its box to exactly the photo's own aspect ratio, so once measured
  // there's no letterboxing - a single uniform scale factor maps
  // photo-pixel coordinates to on-screen dp coordinates for both the base
  // photo layer and the overlay layer, keeping them pixel-aligned.
  const displayScale =
    photo && canvasLayout.width > 0 ? canvasLayout.width / photo.width : 0;

  const selectedColorIndex = allColors.findIndex((c) => c.id === activeColor.id);
  // Estimated per-swatch width (see ColorSwatch's `swatchContainer` style:
  // 64dp width + 10dp marginRight) - close enough for an initial
  // best-effort scroll-into-view; exact centering isn't required.
  const SWATCH_ESTIMATED_WIDTH = 74;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Preview</Text>

        {!photo && (
          <Pressable
            style={styles.pickButton}
            onPress={() => setPickerVisible(true)}
            testID="pick-photo-button"
          >
            <Text style={styles.pickButtonLabel}>Pick a photo</Text>
          </Pressable>
        )}

        {/*
          Dev/E2E-only diagnostic entry points (docs/HANDOFF.md Iteration
          4R-6, extended Iteration 5): plain taps, not long-presses on the
          "Pick a photo" button - React Native's Pressable fires `onPress`
          on release regardless of whether `onLongPress` already fired, so
          sharing the picker button's gesture recognizer with a second
          action silently races (verified empirically in 4R-6: the
          long-press variant always ended up just opening the picker
          modal). Dedicated buttons sidestep that entirely. Never rendered
          in a release build.
        */}
        {__DEV__ && !photo && (
          <>
            <Pressable
              style={styles.devTestPortraitButton}
              onPress={loadBundledTestPortrait}
              testID="load-test-portrait-button"
            >
              <Text style={styles.devTestPortraitButtonLabel}>
                [dev] Load bundled test portrait
              </Text>
            </Pressable>
            <Pressable
              style={styles.devTestPortraitButton}
              onPress={loadBundledNoFaceImage}
              testID="load-no-face-test-image-button"
            >
              <Text style={styles.devTestPortraitButtonLabel}>
                [dev] Load bundled no-face test image
              </Text>
            </Pressable>
          </>
        )}

        {photo && (
          <>
            <View
              style={[
                styles.canvasWrapper,
                { aspectRatio: photo.width / photo.height },
              ]}
              onLayout={(e) =>
                setCanvasLayout({
                  width: e.nativeEvent.layout.width,
                  height: e.nativeEvent.layout.height,
                })
              }
            >
              <Pressable
                onPressIn={() => setShowOriginal(true)}
                onPressOut={() => setShowOriginal(false)}
                style={styles.canvasPressable}
              >
                <Canvas style={styles.canvas}>
                  <SkiaImage
                    image={displayImage}
                    x={0}
                    y={0}
                    width={canvasLayout.width || photo.width}
                    height={canvasLayout.height || photo.height}
                    fit="contain"
                  />
                  {!showOriginal && overlayImage && placedRect && displayScale > 0 && (
                    <SkiaImage
                      image={overlayImage}
                      x={placedRect.x * displayScale}
                      y={placedRect.y * displayScale}
                      width={placedRect.w * displayScale}
                      height={placedRect.h * displayScale}
                      fit="fill"
                    />
                  )}
                </Canvas>
                {isProcessing && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.processingLabel}>Processing…</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={styles.segmenterBadge}
                onLongPress={() => setForceMock((f) => !f)}
                testID="segmenter-badge"
              >
                <Text style={styles.segmenterBadgeLabel}>{badgeLabel}</Text>
              </Pressable>
            </View>
            {truncatedSegmentationError && (
              <Text style={styles.segmentationErrorHint}>
                tflite failed: {truncatedSegmentationError}
              </Text>
            )}
            {__DEV__ && hairPixelFraction !== null && (
              <Text style={styles.hairStatText} testID="hair-pixel-stat">
                {`hair px: ${(hairPixelFraction * 100).toFixed(1)}%`}
              </Text>
            )}
            {__DEV__ && activeStyle && placedRect && (
              <Text style={styles.hairStatText} testID="overlay-box-stat">
                {`style: ${activeStyle.id} @ ${Math.round(placedRect.x)},${Math.round(
                  placedRect.y
                )},${Math.round(placedRect.w)},${Math.round(placedRect.h)}`}
              </Text>
            )}
            {showNoHairHint && (
              <Text style={styles.infoHint} testID="no-hair-hint">
                No hair detected in this photo — pick a style to try one on.
              </Text>
            )}
            {noFaceDetected && (
              <Text style={styles.infoHint} testID="no-face-hint">
                No face detected — try a front-facing photo.
              </Text>
            )}
            {styleShorterThanHairHint && (
              <Text style={styles.infoHint} testID="style-shorter-than-hair-hint">
                Your hair looks longer than this style — some of your real
                hair may show at the edges.
              </Text>
            )}
            <Text style={styles.hint}>
              Press and hold the photo to see the original. Long-press the
              badge in the corner to toggle mock ↔ tflite segmentation.
            </Text>

            {activeStyleId !== null && placedRect && (
              <View style={styles.nudgeRow}>
                <Pressable
                  style={styles.nudgeButton}
                  onPress={() => nudgeMove(-1, 0)}
                  testID="nudge-left"
                >
                  <Text style={styles.nudgeButtonLabel}>◀</Text>
                </Pressable>
                <Pressable
                  style={styles.nudgeButton}
                  onPress={() => nudgeMove(1, 0)}
                  testID="nudge-right"
                >
                  <Text style={styles.nudgeButtonLabel}>▶</Text>
                </Pressable>
                <Pressable
                  style={styles.nudgeButton}
                  onPress={() => nudgeMove(0, -1)}
                  testID="nudge-up"
                >
                  <Text style={styles.nudgeButtonLabel}>▲</Text>
                </Pressable>
                <Pressable
                  style={styles.nudgeButton}
                  onPress={() => nudgeMove(0, 1)}
                  testID="nudge-down"
                >
                  <Text style={styles.nudgeButtonLabel}>▼</Text>
                </Pressable>
                <Pressable
                  style={styles.nudgeButton}
                  onPress={() => nudgeScaleBy(1)}
                  testID="nudge-scale-up"
                >
                  <Text style={styles.nudgeButtonLabel}>+</Text>
                </Pressable>
                <Pressable
                  style={styles.nudgeButton}
                  onPress={() => nudgeScaleBy(-1)}
                  testID="nudge-scale-down"
                >
                  <Text style={styles.nudgeButtonLabel}>−</Text>
                </Pressable>
                <Pressable style={styles.nudgeButton} onPress={resetNudge} testID="nudge-reset">
                  <Text style={styles.nudgeButtonLabel}>Reset</Text>
                </Pressable>
              </View>
            )}

            <Pressable
              style={styles.secondaryButton}
              onPress={() => setPickerVisible(true)}
              testID="choose-different-photo-button"
            >
              <Text style={styles.secondaryButtonLabel}>
                Choose a different photo
              </Text>
            </Pressable>

            {/* See the dev-only buttons above "Pick a photo" for why these
                are plain taps, not long-presses on an existing button. */}
            {__DEV__ && (
              <>
                <Pressable
                  style={styles.devTestPortraitButton}
                  onPress={loadBundledTestPortrait}
                  testID="load-test-portrait-button"
                >
                  <Text style={styles.devTestPortraitButtonLabel}>
                    [dev] Load bundled test portrait
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.devTestPortraitButton}
                  onPress={loadBundledNoFaceImage}
                  testID="load-no-face-test-image-button"
                >
                  <Text style={styles.devTestPortraitButtonLabel}>
                    [dev] Load bundled no-face test image
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.sectionLabel}>Style</Text>
        {/* A wrapping chip group, NOT a horizontal ScrollView: with 7 chips
            the later ones would sit off-screen - unreachable both for
            deterministic Maestro automation and awkward for one-handed
            use. Wrapped rows keep every style visible at once. */}
        <View style={styles.styleRow}>
          <Pressable
            style={[styles.styleChip, activeStyleId === null && styles.styleChipActive]}
            onPress={() => setActiveStyleId(null)}
            testID="style-chip-none"
            accessibilityState={{ selected: activeStyleId === null }}
          >
            <Text
              style={[
                styles.styleChipLabel,
                activeStyleId === null && styles.styleChipLabelActive,
              ]}
            >
              None
            </Text>
          </Pressable>
          {artBearingStyles.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.styleChip, activeStyleId === s.id && styles.styleChipActive]}
              onPress={() => setActiveStyleId(s.id)}
              testID={`style-chip-${s.id}`}
              accessibilityState={{ selected: activeStyleId === s.id }}
            >
              <Text
                style={[
                  styles.styleChipLabel,
                  activeStyleId === s.id && styles.styleChipLabelActive,
                ]}
              >
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Color — {activeColor.displayName}</Text>
        <ScrollView
          ref={swatchScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.swatchRow}
          onContentSizeChange={() => {
            if (selectedColorIndex > 0) {
              swatchScrollRef.current?.scrollTo({
                x: selectedColorIndex * SWATCH_ESTIMATED_WIDTH,
                animated: false,
              });
            }
          }}
        >
          {allColors.map((c) => (
            <ColorSwatch
              key={c.id}
              color={c}
              selected={c.id === activeColor.id}
              onPress={setActiveColor}
            />
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Intensity</Text>
        <View style={styles.intensityRow}>
          {INTENSITY_PRESETS.map((preset) => (
            <Pressable
              key={preset.label}
              style={[
                styles.intensityButton,
                intensity === preset.value && styles.intensityButtonActive,
              ]}
              onPress={() => setIntensity(preset.value)}
            >
              <Text
                style={[
                  styles.intensityLabel,
                  intensity === preset.value && styles.intensityLabelActive,
                ]}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.modalSheet}>
            <Pressable style={styles.modalOption} onPress={pickFromLibrary}>
              <Text style={styles.modalOptionLabel}>Choose from Library</Text>
            </Pressable>
            <Pressable style={styles.modalOption} onPress={pickFromCamera}>
              <Text style={styles.modalOptionLabel}>Take a Photo</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
  },
  pickButton: {
    backgroundColor: '#222',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  pickButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  canvasWrapper: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 8,
    position: 'relative',
  },
  canvasPressable: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingLabel: {
    color: '#fff',
    marginTop: 8,
    fontSize: 13,
  },
  segmenterBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  segmenterBadgeLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  segmentationErrorHint: {
    fontSize: 11,
    color: '#b00020',
    textAlign: 'center',
    marginBottom: 4,
  },
  hairStatText: {
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    marginBottom: 4,
  },
  infoHint: {
    fontSize: 12,
    color: '#8a6d00',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  hint: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
  nudgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  nudgeButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 6,
    marginBottom: 6,
  },
  nudgeButtonLabel: {
    fontSize: 14,
    color: '#333',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButtonLabel: {
    color: '#333',
    fontSize: 14,
  },
  devTestPortraitButton: {
    borderWidth: 1,
    borderColor: '#8a6d00',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff8e1',
  },
  devTestPortraitButtonLabel: {
    color: '#8a6d00',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#b00020',
    fontSize: 13,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 4,
  },
  styleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  styleChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 6,
  },
  styleChipActive: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  styleChipLabel: {
    fontSize: 13,
    color: '#333',
  },
  styleChipLabelActive: {
    color: '#fff',
  },
  swatchRow: {
    marginBottom: 16,
  },
  intensityRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  intensityButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  intensityButtonActive: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  intensityLabel: {
    fontSize: 13,
    color: '#333',
  },
  intensityLabelActive: {
    color: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  modalOptionLabel: {
    fontSize: 16,
    color: '#222',
  },
});
