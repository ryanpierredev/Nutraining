import { useCallback } from 'react';
import { Link, Redirect } from 'expo-router';
import { useSession } from '../lib/session';
import AdminPanel from '../components/AdminPanel';
import { Loading, Page, useUI } from '../components/ui';
import { type RequestOptions } from '../lib/api';
export default function Admin() {
  const {s}=useUI();
  const { user, token, call, loading } = useSession();
  const request = useCallback((path: string, options: RequestOptions) => call(`admin/${path}`, options), [call]);
  if (loading) return <Loading />;
  if (user?.role !== 'admin') return <Redirect href="/home" />;
  return <Page title="Administração." subtitle="Gerencie o acesso dos usuários ao Nutraining.">
    <Link href="/profile" style={s.chipText}>← Voltar para sua conta</Link>
    <AdminPanel token={token} request={request} />
  </Page>;
}
