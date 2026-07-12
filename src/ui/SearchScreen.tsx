import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadColors, loadHairstyles } from '../catalog';
import type { Hairstyle, HairColor } from '../catalog/types';
import { hasOverlayArt } from '../overlays/registry';
import { parseQuery } from '../search/parser';
import { searchHairstyles, searchColors } from '../search/scorer';
import { ColorSwatch } from './ColorSwatch';
import { type Theme, useTheme } from './theme';

function matchedTags(style: Hairstyle): string[] {
  return [...style.lengths, ...style.fringe, ...style.textures];
}

function HairstyleResult({
  style,
  colors,
  onSelectColor,
  onSelectStyle,
  styles,
}: {
  style: Hairstyle;
  colors: HairColor[];
  onSelectColor?: (color: HairColor) => void;
  onSelectStyle?: (style: Hairstyle) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const artBearing = hasOverlayArt(style.id);
  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeaderRow}>
        <Text style={styles.resultName}>{style.name}</Text>
        {artBearing ? (
          <Pressable
            style={styles.tryOnButton}
            onPress={() => onSelectStyle?.(style)}
            testID={`try-on-${style.id}`}
          >
            <Text style={styles.tryOnButtonLabel}>Try on</Text>
          </Pressable>
        ) : (
          <Text style={styles.comingSoonBadge}>Art coming soon</Text>
        )}
      </View>
      <Text style={styles.resultTags}>{matchedTags(style).join(' · ')}</Text>
      {colors.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.swatchRow}
        >
          {colors.map((c) => (
            <ColorSwatch key={c.id} color={c} onPress={onSelectColor} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function SearchScreen({
  onSelectColor,
  onSelectStyle,
}: {
  onSelectColor?: (color: HairColor) => void;
  onSelectStyle?: (style: Hairstyle) => void;
} = {}) {
  const [query, setQuery] = useState('');
  const allColors = useMemo(() => loadColors(), []);
  const allHairstyles = useMemo(() => loadHairstyles(), []);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const parsed = useMemo(() => parseQuery(query), [query]);
  const styleResults = useMemo(
    () => searchHairstyles(parsed, allHairstyles),
    [parsed, allHairstyles]
  );
  const colorResults = useMemo(
    () => searchColors(parsed, allColors),
    [parsed, allColors]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={styles.title}>ManeFrame</Text>
        <TextInput
          testID="search-input"
          style={styles.searchBox}
          placeholder="Try 'shoulder length with bangs'"
          placeholderTextColor={theme.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.resultCount}>
          {styleResults.length} hairstyle
          {styleResults.length === 1 ? '' : 's'} · {colorResults.length} color
          {colorResults.length === 1 ? '' : 's'}
        </Text>
        <FlatList
          data={styleResults}
          keyExtractor={(item) => item.style.id}
          renderItem={({ item }) => (
            <HairstyleResult
              style={item.style}
              colors={colorResults}
              onSelectColor={onSelectColor}
              onSelectStyle={onSelectStyle}
              styles={styles}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No matching hairstyles.</Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.primary,
      marginBottom: 12,
    },
    searchBox: {
      borderWidth: 1,
      borderColor: theme.muted,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.surface,
    },
    resultCount: {
      marginTop: 8,
      marginBottom: 8,
      fontSize: 13,
      color: theme.muted,
    },
    resultCard: {
      borderWidth: 1,
      borderColor: theme.muted,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      backgroundColor: theme.surface,
    },
    resultHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    resultName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    tryOnButton: {
      backgroundColor: theme.primary,
      borderRadius: 6,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    tryOnButtonLabel: {
      color: theme.onPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    comingSoonBadge: {
      fontSize: 11,
      color: theme.hint,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.hint,
      borderRadius: 6,
      paddingVertical: 3,
      paddingHorizontal: 8,
      overflow: 'hidden',
    },
    resultTags: {
      fontSize: 12,
      color: theme.muted,
      marginTop: 2,
    },
    swatchRow: {
      marginTop: 8,
    },
    emptyText: {
      marginTop: 24,
      textAlign: 'center',
      color: theme.muted,
    },
  });
}
