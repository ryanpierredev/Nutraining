import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SessionProvider } from '../lib/session';
export default function Layout() {
  return <SafeAreaProvider><SessionProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#f5f7f0' }} edges={['top', 'left', 'right']}>
    <StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} />
  </SafeAreaView></SessionProvider></SafeAreaProvider>;
}
