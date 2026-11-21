import { Redirect, Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { type ComponentProps } from 'react';
import { useSession } from '../../lib/session';
import { Loading, colors } from '../../components/ui';
const icon = (name: ComponentProps<typeof Feather>['name']) => function TabIcon({ focused }: { focused: boolean }) { return <Feather name={name} color={focused ? colors.green : colors.muted} size={22} />; };
export default function AppLayout() {
  const { user, loading } = useSession();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.green,
    tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: '#fff', height: 72, paddingTop: 6, paddingBottom: 10 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
    <Tabs.Screen name="home" options={{ title: 'Início', tabBarIcon: icon('home') }} />
    <Tabs.Screen name="training" options={{ title: 'Treinos', tabBarIcon: icon('activity') }} />
    <Tabs.Screen name="nutrition" options={{ title: 'Alimentação', tabBarIcon: icon('coffee') }} />
    <Tabs.Screen name="progress" options={{ title: 'Evolução', tabBarIcon: icon('trending-up') }} />
    <Tabs.Screen name="profile" options={{ title: 'Conta', tabBarIcon: icon('user') }} />
  </Tabs>;
}
