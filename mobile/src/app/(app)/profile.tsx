import { useState } from 'react';
import { Alert, Platform, Text } from 'react-native';
import { Link } from 'expo-router';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/resource';
import { labels, message, type Role } from '../../lib/api';
import { Button, Card, Copy, Field, Heading, Loading, Notice, Page, s } from '../../components/ui';
type Professional = { id: string; name: string; role: Role; professionalCode: string };
export default function Profile() {
  const { user, call, signOut } = useSession();
  const [code, setCode] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const links = useResource<{ professionals: Professional[] }>(user?.role === 'student' ? 'app/connections' : null);
  async function connect() {
    if (busy) return; setBusy(true); setNotice('');
    try { await call('app/connections', { method: 'POST', body: { code: code.trim() } }); setCode(''); await links.reload(); setNotice('Profissional vinculado.'); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  async function disconnect(id: string) {
    if (busy) return; setBusy(true); setNotice('');
    try { await call(`app/connections/${id}`, { method: 'DELETE' }); await links.reload(); setNotice('Vínculo removido. O profissional não tem mais acesso aos seus dados.'); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  function confirmDisconnect(id: string) {
    const detail = 'O profissional perderá acesso aos seus dados. Os planos recebidos continuarão na sua conta.';
    if (Platform.OS === 'web') { if (window.confirm(detail)) void disconnect(id); }
    else Alert.alert('Remover vínculo?', detail, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover vínculo', style: 'destructive', onPress: () => void disconnect(id) }]);
  }
  async function logout() {
    setBusy(true); setNotice('');
    try { await signOut(); } catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  return <Page title="Sua conta." subtitle="Seus dados e quem acompanha você.">
    <Card><Text style={s.chipText}>{labels[user?.role || 'student'].toUpperCase()}</Text><Heading>{user?.name}</Heading><Copy>{user?.email}</Copy>
      {!!user?.professionalCode && <><Heading>Seu código profissional</Heading><Text selectable style={{ fontSize: 17, fontWeight: '700', color: '#285b43' }}>{user.professionalCode}</Text>
        <Copy>Compartilhe com seus alunos. Eles precisam inserir esse código na própria conta para autorizar o vínculo.</Copy></>}
      {user?.role === 'admin' && <Link href="/admin" style={s.chipText}>Administrar usuários →</Link>}
    </Card>
    {user?.role === 'student' && <>
      <Card><Heading>Conecte seu acompanhamento</Heading>
        <Copy>Ao vincular um profissional, você permite que ele veja sua evolução e gerencie os planos da especialidade dele. Você pode remover o vínculo quando quiser.</Copy>
        <Field label="Código do personal ou nutricionista" value={code} onChangeText={setCode} maxLength={24} autoCapitalize="none" autoCorrect={false} editable={!busy} />
        <Button title="Vincular profissional" disabled={busy || code.trim().length !== 24} onPress={() => void connect()} />
      </Card>
      <Heading>Profissionais vinculados</Heading>{links.loading && <Loading />}<Notice>{links.error}</Notice>
      {!!links.error && <Button title="Tentar novamente" secondary onPress={() => void links.reload()} />}
      {links.data?.professionals.length === 0 && <Copy>Você ainda não vinculou nenhum profissional. Você também pode criar seus próprios planos.</Copy>}
      {links.data?.professionals.map(pro => <Card key={pro.id}><Heading>{pro.name}</Heading><Copy>{labels[pro.role]}</Copy>
        <Button title="Remover vínculo" secondary disabled={busy} onPress={() => confirmDisconnect(pro.id)} /></Card>)}
    </>}
    <Notice>{notice}</Notice><Button title={busy ? 'Aguarde...' : 'Sair da conta'} secondary disabled={busy} onPress={() => void logout()} />
    <Copy>Nutraining · versão 1.1.0</Copy>
  </Page>;
}
