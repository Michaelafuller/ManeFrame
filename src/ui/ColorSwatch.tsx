import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HairColor } from '../catalog/types';
import { labToCss } from '../color/lab';
import { type Theme, useTheme } from './theme';

/**
 * A single color swatch (circle + label), shared between SearchScreen's
 * result rows and PreviewScreen's color picker row. Optionally pressable
 * and/or shown as selected.
 *
 * The swatch fill itself (`labToCss(color.targetLab)`) is CONTENT, not
 * chrome — it represents a real hair-dye color and is intentionally never
 * themed (docs/HANDOFF.md Iteration 6).
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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
      borderColor: theme.muted,
    },
    swatchSelected: {
      borderWidth: 3,
      borderColor: theme.accent,
    },
    swatchLabel: {
      fontSize: 10,
      color: theme.muted,
      marginTop: 4,
      textAlign: 'center',
    },
  });
}
