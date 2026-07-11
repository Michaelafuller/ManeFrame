import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import SearchScreen from './src/ui/SearchScreen';
import PreviewScreen from './src/ui/PreviewScreen';
import type { HairColor } from './src/catalog/types';

type Tab = 'search' | 'preview';

export default function App() {
  const [tab, setTab] = useState<Tab>('search');
  const [selectedColor, setSelectedColor] = useState<HairColor | null>(null);

  function handleSelectColor(color: HairColor) {
    setSelectedColor(color);
    setTab('preview');
  }

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {tab === 'search' ? (
          <SearchScreen onSelectColor={handleSelectColor} />
        ) : (
          <PreviewScreen selectedColor={selectedColor} />
        )}
      </View>
      <View style={styles.tabBar}>
        <Pressable
          style={styles.tabButton}
          onPress={() => setTab('search')}
        >
          <Text style={[styles.tabLabel, tab === 'search' && styles.tabLabelActive]}>
            Search
          </Text>
        </Pressable>
        <Pressable
          style={styles.tabButton}
          onPress={() => setTab('preview')}
        >
          <Text style={[styles.tabLabel, tab === 'preview' && styles.tabLabelActive]}>
            Preview
          </Text>
        </Pressable>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#222',
    fontWeight: '700',
  },
});
