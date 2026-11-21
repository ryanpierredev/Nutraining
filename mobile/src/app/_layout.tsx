import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../lib/theme';
import { SessionProvider } from '../lib/session';
function Navigation() {
  const {colors,dark}=useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top','left','right']}>
    <StatusBar style={dark?'light':'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle:{backgroundColor:colors.paper} }} />
  </SafeAreaView>;
}
export default function Layout() {
  return <SafeAreaProvider><ThemeProvider><SessionProvider><Navigation /></SessionProvider></ThemeProvider></SafeAreaProvider>;
}
