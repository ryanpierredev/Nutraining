import { Redirect, router } from 'expo-router';
import { useSession } from '../lib/session';
import AdminPanel from '../components/AdminPanel';
import { Button, Loading, Page } from '../components/ui';
export default function Admin() {
  const { user, loading } = useSession();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/" />;
  if (user.role !== 'admin') return <Redirect href="/settings" />;
  return <Page title="Administração"><Button title="Voltar aos ajustes" icon="arrow-left" secondary onPress={() => router.dismissTo('/settings')} /><AdminPanel /></Page>;
}
