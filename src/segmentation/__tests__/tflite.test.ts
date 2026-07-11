import { resolveModelSource, TfliteSegmentationError, type ModuleAssetLike } from '../tflite';

/**
 * Only `resolveModelSource` is exercised here, against a stubbed
 * `ModuleAssetLike` - never the real `expo-asset` module (which needs a
 * native runtime) and never real `loadTensorflowModel` inference (see
 * `__mocks__/react-native-fast-tflite.js`). This covers the Iteration
 * 4R-4 fix: releasing builds need a `{ url: localUri }` source, not the
 * raw Metro asset number, because `Image.resolveAssetSource` produces an
 * Android resource reference the native `AssetLoader` can't open outside
 * DEV. See docs/REMEDIATION.md.
 */
describe('resolveModelSource', () => {
  it('returns the existing localUri without downloading when already present', async () => {
    const downloadAsync = jest.fn(() => Promise.resolve());
    const asset: ModuleAssetLike = {
      localUri: 'file:///cache/hair_segmenter.tflite',
      downloadAsync,
    };

    const result = await resolveModelSource(asset);

    expect(result).toEqual({ url: 'file:///cache/hair_segmenter.tflite' });
    expect(downloadAsync).not.toHaveBeenCalled();
  });

  it('calls downloadAsync() and uses the resulting localUri when not yet resolved', async () => {
    const asset: ModuleAssetLike = {
      localUri: null,
      downloadAsync: jest.fn(() => {
        (asset as { localUri: string | null }).localUri = 'file:///cache/downloaded.tflite';
        return Promise.resolve();
      }),
    };

    const result = await resolveModelSource(asset);

    expect(asset.downloadAsync).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ url: 'file:///cache/downloaded.tflite' });
  });

  it('throws a TfliteSegmentationError if localUri is still null after downloadAsync()', async () => {
    const asset: ModuleAssetLike = {
      localUri: null,
      downloadAsync: jest.fn(() => Promise.resolve()),
    };

    await expect(resolveModelSource(asset)).rejects.toThrow(TfliteSegmentationError);
    await expect(resolveModelSource(asset)).rejects.toThrow(/localUri was null/);
  });
});
