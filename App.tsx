import { StatusBar } from 'expo-status-bar';

import SearchScreen from './src/ui/SearchScreen';

export default function App() {
  return (
    <>
      <SearchScreen />
      <StatusBar style="auto" />
    </>
  );
}
