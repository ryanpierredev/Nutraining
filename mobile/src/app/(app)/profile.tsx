import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/resource';
import { labels, message, type Role } from '../../lib/api';
import { ActionRow, Button, Card, Copy, Field, Heading, Loading, Notice, Page, confirmAction, useTheme } from '../../components/ui';
import ProfileCard from '../../components/ProfileCard';

type Professional = { id: string; name: string; role: Role; professionalCode: string };
export default function Profile() {
  const { s } = useTheme();
  const { user, call } = useSession();
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
    confirmAction('Remover vínculo?', detail, 'Remover vínculo', () => void disconnect(id));
  }
  return <Page title="Perfil">
    <ProfileCard />
    <Card><ActionRow icon="settings" title="Configurações" detail="Aparência, sessões e acesso à conta" onPress={() => router.navigate('/settings')} /></Card>
    {!!user?.professionalCode && <Card><Heading>Seu código profissional</Heading><Text selectable style={s.label}>{user.professionalCode}</Text>
      <Copy>Compartilhe com seus alunos para que eles autorizem o acompanhamento no perfil deles.</Copy></Card>}
    {user?.role === 'student' && <>
      <Card><Heading>Conecte seu acompanhamento</Heading>
        <Copy>Ao vincular um profissional, você permite que ele veja sua evolução e gerencie os planos da especialidade dele. Você pode remover o vínculo quando quiser.</Copy>
        <Field label="Código do personal ou nutricionista" value={code} onChangeText={setCode} maxLength={24} autoCapitalize="none" autoCorrect={false} editable={!busy} />
        <Button title="Vincular profissional" disabled={busy || code.trim().length !== 24} onPress={() => void connect()} />
      </Card>
      <Heading>Profissionais vinculados</Heading>{links.loading && <Loading />}<Notice>{links.error}</Notice>
      {!!links.error && <Button title="Tentar novamente" secondary onPress={() => void links.reload()} />}
      {links.data?.professionals.length === 0 && <Copy>Você ainda não vinculou nenhum profissional. Use o código de um personal ou nutricionista para receber acompanhamento.</Copy>}
      {links.data?.professionals.map(pro => <Card key={pro.id}><Heading>{pro.name}</Heading><Copy>{labels[pro.role]}</Copy>
        <Button title="Remover vínculo" secondary disabled={busy} onPress={() => confirmDisconnect(pro.id)} /></Card>)}
    </>}
    <Notice>{notice}</Notice>
  </Page>;
}
