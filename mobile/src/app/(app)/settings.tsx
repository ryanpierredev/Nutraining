import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/resource';
import { message, timestamp, type ThemeMode } from '../../lib/api';
import { ActionRow, Button, Card, Choice, Copy, Heading, Loading, Notice, Page, confirmAction, useTheme } from '../../components/ui';

import CreateAccountForm from '../../components/CreateAccountForm';

type DeviceSession = { id: string; deviceLabel: string | null; current: boolean; createdAt: string; lastSeenAt: string | null; expiresAt: string };

function Sessions() {
  const { call } = useSession();
  const { s, colors } = useTheme();
  const resource = useResource<{ sessions: DeviceSession[] }>('auth/sessions');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function revoke(id: string) {
    setBusy(true); setNotice('');
    try {
      await call(`auth/sessions/${id}`, { method: 'DELETE' }); setNotice('Acesso encerrado.');
    } catch (failure) { setNotice(message(failure)); }
    finally { await resource.reload(); setBusy(false); }
  }
  const sessions = resource.data?.sessions;
  return <Card><View style={s.spread}><Heading>Sessões logadas</Heading>
    {sessions && <View style={s.chip}><Text style={s.chipText}>{sessions.length} {sessions.length === 1 ? 'ativa' : 'ativas'}</Text></View>}</View>
    <Copy>Cada entrada na conta abre uma sessão. Sessões sem atividade por 15 minutos são encerradas.</Copy>
    {resource.loading && <Loading />}<Notice>{resource.error || notice}</Notice>
    {sessions?.map(session => <View key={session.id} style={s.divider}>
      <View style={s.row}><Feather name="monitor" size={18} color={colors.green} /><Text style={s.label}>{session.deviceLabel || 'Dispositivo não identificado'}</Text>
        {session.current && <Text style={s.chipText}>Esta sessão</Text>}</View>
      <Copy>Início: {timestamp(session.createdAt)}{session.lastSeenAt ? `\nÚltima atividade: ${timestamp(session.lastSeenAt)}` : ''}{`\nExpira se ficar inativa até: ${timestamp(session.expiresAt)}`}</Copy>
      {!session.current && <Button title="Encerrar sessão" secondary disabled={busy} onPress={() =>
        confirmAction('Encerrar esta sessão?', session.deviceLabel || 'Esse dispositivo precisará entrar novamente.', 'Encerrar', () => void revoke(session.id))} />}
    </View>)}
    {sessions?.some(item => !item.current) && <Button title="Encerrar as outras sessões" icon="shield" secondary disabled={busy} onPress={() =>
      confirmAction('Encerrar as outras sessões?', 'Somente esta sessão continuará conectada.', 'Encerrar', () => void revoke('others'))} />}
    <Button title="Atualizar sessões" icon="refresh-cw" secondary disabled={busy || resource.loading} onPress={() => void resource.reload()} />
  </Card>;
}
function StudentRegistration() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(false);
  if (open) return <CreateAccountForm studentsOnly onCancel={() => setOpen(false)} onCreated={() => {
    setOpen(false);
    setCreated(true);
  }} />;
  return <Card>
    <ActionRow icon="user-plus" title="Cadastrar aluno" detail="Criar uma conta de acesso" onPress={() => { setCreated(false); setOpen(true); }} />
    {created && <Copy>Conta criada. Entregue a senha inicial ao aluno em particular. Para receber seu acompanhamento, ele pode vincular seu código na aba Perfil.</Copy>}
  </Card>;
}

export default function Settings() {
  const { user, updateProfile, signOut } = useSession();
  const { s, colors, mode } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function changeTheme(theme: ThemeMode) {
    if (theme === mode || busy) return;
    setBusy(true); setError('');
    try { await updateProfile({ theme }); } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await signOut(); } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  return <Page title="Configurações">
    <Card><View style={s.row}><Feather name={mode === 'dark' ? 'moon' : 'sun'} size={20} color={colors.green} /><Heading>Aparência</Heading></View>
      <Copy>O tema escolhido fica salvo na sua conta.</Copy>
      <View style={s.row}><Choice title="Escuro" selected={mode === 'dark'} disabled={busy} onPress={() => void changeTheme('dark')} />
        <Choice title="Claro" selected={mode === 'light'} disabled={busy} onPress={() => void changeTheme('light')} /></View>
    </Card>
    {user?.role === 'admin' && <Card accent><ActionRow icon="shield" title="Área do administrador" detail="Contas ativas, cadastros e usuários" onPress={() => router.push('/admin')} /></Card>}
    {(user?.role === 'trainer' || user?.role === 'nutritionist') && <StudentRegistration />}
    <Notice>{error}</Notice><Sessions />
    <Button title="Sair da conta" icon="log-out" secondary disabled={busy} onPress={() => void logout()} />
  </Page>;
}
