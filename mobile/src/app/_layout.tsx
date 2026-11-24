import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { useTheme } from '../components/ui';

function Navigation() {
  const { colors, mode } = useTheme();
  const { trackActivity } = useSession();
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.style.colorScheme = mode;
    else Appearance.setColorScheme(mode);
  }, [mode]);
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return <ThemeProvider value={{ ...base, colors: { ...base.colors, background: colors.paper, card: colors.surface, text: colors.ink, border: colors.line, primary: colors.green } }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top', 'left', 'right']}
      onTouchStart={trackActivity} onTouchMove={trackActivity}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
    </SafeAreaView>
  </ThemeProvider>;
}
export default function Layout() {
  return <SafeAreaProvider><SessionProvider><Navigation /></SessionProvider></SafeAreaProvider>;
}
