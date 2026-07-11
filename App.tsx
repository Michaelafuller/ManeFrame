import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { loadColors, loadHairstyles } from './src/catalog';

export default function App() {
  const colors = loadColors();
  const hairstyles = loadHairstyles();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ManeFrame</Text>
      <Text style={styles.subtitle}>
        {colors.length} colors · {hairstyles.length} hairstyles loaded
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#555',
  },
});
