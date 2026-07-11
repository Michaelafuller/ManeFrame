import { useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { loadColors, loadHairstyles } from '../catalog';
import type { Hairstyle, HairColor } from '../catalog/types';
import { parseQuery } from '../search/parser';
import { searchHairstyles, searchColors } from '../search/scorer';
import { ColorSwatch } from './ColorSwatch';

function matchedTags(style: Hairstyle): string[] {
  return [...style.lengths, ...style.fringe, ...style.textures];
}

function HairstyleResult({
  style,
  colors,
  onSelectColor,
}: {
  style: Hairstyle;
  colors: HairColor[];
  onSelectColor?: (color: HairColor) => void;
}) {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultName}>{style.name}</Text>
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
}: {
  onSelectColor?: (color: HairColor) => void;
} = {}) {
  const [query, setQuery] = useState('');
  const allColors = useMemo(() => loadColors(), []);
  const allHairstyles = useMemo(() => loadHairstyles(), []);

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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>ManeFrame</Text>
        <TextInput
          style={styles.searchBox}
          placeholder="Try 'shoulder length with bangs'"
          placeholderTextColor="#888"
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
  },
  searchBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fafafa',
  },
  resultCount: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    color: '#666',
  },
  resultCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fdfdfd',
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  resultTags: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  swatchRow: {
    marginTop: 8,
  },
  emptyText: {
    marginTop: 24,
    textAlign: 'center',
    color: '#888',
  },
});
