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

import { loadColors } from '../catalog';
import type { HairColor } from '../catalog/types';
import type { RecolorParams } from '../color/recolor';
import { recolorImageChunked } from '../color/recolorImage';
import { MockHairSegmenter } from '../segmentation/mock';
import { segmentWithFallback } from '../segmentation/selectSegmenter';
import { TfliteHairSegmenter } from '../segmentation/tflite';
import type { HairMask } from '../segmentation/types';
import { ColorSwatch } from './ColorSwatch';

/** Photos are downscaled to at most this many pixels on their long side. */
const MAX_PHOTO_DIMENSION = 768;

const INTENSITY_PRESETS: { label: string; value: number }[] = [
  { label: 'Subtle 0.5', value: 0.5 },
  { label: 'Natural 0.8', value: 0.8 },
  { label: 'Bold 1.0', value: 1.0 },
];

interface DecodedPhoto {
  skImage: SkImage;
  pixels: Uint8Array;
  width: number;
  height: number;
}

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

export default function PreviewScreen({
  selectedColor,
}: {
  selectedColor: HairColor | null;
}) {
  const allColors = useMemo(() => loadColors(), []);
  const tfliteSegmenter = useMemo(() => new TfliteHairSegmenter(), []);
  const mockSegmenter = useMemo(() => new MockHairSegmenter(), []);

  const [activeColor, setActiveColor] = useState<HairColor>(
    selectedColor ?? allColors[0]
  );
  const [intensity, setIntensity] = useState(0.8);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [photo, setPhoto] = useState<DecodedPhoto | null>(null);
  const [mask, setMask] = useState<HairMask | null>(null);
  const [recoloredImage, setRecoloredImage] = useState<SkImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dev toggle: force the mock segmenter even when TFLite is available, to
  // compare the two side by side. Also flips true automatically whenever
  // TFLite construction/inference actually fails (see the segmentation
  // effect below), so the "mock segmentation" badge reflects reality either
  // way.
  const [forceMock, setForceMock] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  const runIdRef = useRef(0);

  // Note: `activeColor` is deliberately only seeded from `selectedColor` via
  // the useState initializer above, not re-synced in an effect. App.tsx
  // renders exactly one of {SearchScreen, PreviewScreen} at a time, so this
  // component only (re)mounts - picking up whatever `selectedColor` App.tsx
  // is holding at that moment - when the user switches into the Preview
  // tab; there's no scenario where `selectedColor` changes while this
  // instance is already mounted.

  // Segment once per photo. Wrapped in an inner async function (the
  // React-recommended pattern for async effects) so the state updates
  // happen as part of the async data flow, not synchronously on every
  // effect run.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!photo) {
        setMask(null);
        setUsingMock(false);
        return;
      }
      if (forceMock) {
        const m = await mockSegmenter.segment(photo.width, photo.height, photo.pixels);
        if (!cancelled) {
          setMask(m);
          setUsingMock(true);
        }
        return;
      }
      const result = await segmentWithFallback(
        tfliteSegmenter,
        mockSegmenter,
        photo.width,
        photo.height,
        photo.pixels
      );
      if (!cancelled) {
        setMask(result.mask);
        setUsingMock(result.usedFallback);
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

  async function processPickedAsset(asset: ImagePicker.ImagePickerAsset) {
    try {
      setError(null);
      setPhoto(null);
      setRecoloredImage(null);
      setMask(null);

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Preview</Text>

        {!photo && (
          <Pressable
            style={styles.pickButton}
            onPress={() => setPickerVisible(true)}
          >
            <Text style={styles.pickButtonLabel}>Pick a photo</Text>
          </Pressable>
        )}

        {photo && (
          <>
            <View
              style={[
                styles.canvasWrapper,
                { aspectRatio: photo.width / photo.height },
              ]}
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
                    width={photo.width}
                    height={photo.height}
                    fit="contain"
                  />
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
                <Text style={styles.segmenterBadgeLabel}>
                  {usingMock ? 'mock segmentation' : 'tflite segmentation'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>
              Press and hold the photo to see the original. Long-press the
              badge in the corner to toggle mock ↔ tflite segmentation.
            </Text>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => setPickerVisible(true)}
            >
              <Text style={styles.secondaryButtonLabel}>
                Choose a different photo
              </Text>
            </Pressable>
          </>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.sectionLabel}>Color</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.swatchRow}
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
  hint: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
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
