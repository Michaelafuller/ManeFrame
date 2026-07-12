import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchScreen from './src/ui/SearchScreen';
import PreviewScreen from './src/ui/PreviewScreen';
import { type Theme, useTheme } from './src/ui/theme';
import type { HairColor, Hairstyle } from './src/catalog/types';

type Tab = 'search' | 'preview';

function AppContent() {
  const [tab, setTab] = useState<Tab>('search');
  const [selectedColor, setSelectedColor] = useState<HairColor | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<Hairstyle | null>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  function handleSelectColor(color: HairColor) {
    setSelectedColor(color);
    setTab('preview');
  }

  function handleSelectStyle(style: Hairstyle) {
    setSelectedStyle(style);
    setTab('preview');
  }

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {tab === 'search' ? (
          <SearchScreen onSelectColor={handleSelectColor} onSelectStyle={handleSelectStyle} />
        ) : (
          <PreviewScreen selectedColor={selectedColor} selectedStyle={selectedStyle} />
        )}
      </View>
      <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
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

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.muted,
      backgroundColor: theme.surface,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
    },
    tabLabel: {
      fontSize: 14,
      color: theme.muted,
      fontWeight: '500',
    },
    tabLabelActive: {
      color: theme.primary,
      fontWeight: '700',
    },
  });
}
