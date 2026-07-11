import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HairColor } from '../catalog/types';
import { labToCss } from '../color/lab';

/**
 * A single color swatch (circle + label), shared between SearchScreen's
 * result rows and PreviewScreen's color picker row. Optionally pressable
 * and/or shown as selected.
 */
export function ColorSwatch({
  color,
  selected = false,
  onPress,
}: {
  color: HairColor;
  selected?: boolean;
  onPress?: (color: HairColor) => void;
}) {
  const content = (
    <View style={styles.swatchContainer}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: labToCss(color.targetLab) },
          selected && styles.swatchSelected,
        ]}
      />
      <Text style={styles.swatchLabel} numberOfLines={1}>
        {color.displayName}
      </Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={() => onPress(color)} hitSlop={4}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  swatchContainer: {
    alignItems: 'center',
    marginRight: 10,
    width: 64,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#333',
  },
  swatchLabel: {
    fontSize: 10,
    color: '#555',
    marginTop: 4,
    textAlign: 'center',
  },
});
