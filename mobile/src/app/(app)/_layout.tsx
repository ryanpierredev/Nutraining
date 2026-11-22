import { Redirect, Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../lib/session';
import { Loading, useTheme, type IconName } from '../../components/ui';

const icon = (name: IconName) => function TabIcon({ focused }: { focused: boolean }) {
  const { colors } = useTheme();
  return <Feather name={name} color={focused ? colors.green : colors.muted} size={20} />;
};
export default function AppLayout() {
  const { user, loading } = useSession();
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 59 + bottom, paddingTop: 5, paddingBottom: Math.max(5, bottom) },
    tabBarLabelPosition: 'below-icon', tabBarLabelStyle: { fontSize: 10, fontWeight: '600' } }}>
    <Tabs.Screen name="home" options={{ title: 'Início', tabBarIcon: icon('home') }} />
    <Tabs.Screen name="training" options={{ title: 'Treino', tabBarIcon: icon('activity') }} />
    <Tabs.Screen name="nutrition" options={{ title: 'Dieta', tabBarIcon: icon('coffee') }} />
    <Tabs.Screen name="progress" options={{ title: 'Evolução', tabBarIcon: icon('trending-up') }} />
    <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('user') }} />
    <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarAccessibilityLabel: 'Configurações', tabBarIcon: icon('settings') }} />
  </Tabs>;
}
