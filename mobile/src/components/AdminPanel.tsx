import { useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { labels, message, timestamp, type Role } from '../lib/api';
import { useSession } from '../lib/session';
import { useResource } from '../lib/resource';
import { Button, Card, Choice, Copy, Field, Heading, Loading, Notice, useTheme } from './ui';

type Overview = { totalUsers: number; activeUsers: number; recentUsers: number; activeSessions: number };
type Account = { id: string; name: string; email: string; role: Role; createdAt: string;
  registrationSource: 'admin' | 'self' | 'unknown'; registeredByName: string | null; activeSessions: number };

function CreateAccount({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { call } = useSession();
  const { s } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    if (name.trim().length < 2 || !email.trim() || password.length < 12) {
      setError('Informe nome, e-mail e uma senha de pelo menos 12 caracteres.'); return;
    }
    setBusy(true); setError('');
    try {
      await call('admin/users', { method: 'POST', body: { name: name.trim(), email: email.trim(), password, role } });
      onCreated();
    } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  return <Card><Heading>Nova conta</Heading>
    <Field label="Nome do novo usuário" value={name} onChangeText={setName} maxLength={120} editable={!busy} />
    <Field label="E-mail do novo usuário" value={email} onChangeText={setEmail} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} />
    <Field label="Senha inicial (12 a 128 caracteres)" value={password} onChangeText={setPassword} maxLength={128} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} />
    <Text style={s.label}>Perfil de acesso</Text><View style={s.row}>{(Object.keys(labels) as Role[]).map(item =>
      <Choice key={item} title={labels[item]} selected={item === role} disabled={busy} onPress={() => setRole(item)} />)}</View>
    <Notice>{error}</Notice><Button title={busy ? 'Cadastrando…' : 'Cadastrar usuário'} disabled={busy} onPress={() => void submit()} />
    <Button title="Cancelar" secondary disabled={busy} onPress={onCancel} />
  </Card>;
}

function Directory() {
  const { user } = useSession();
  const { s } = useTheme();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(false);
  const [offset, setOffset] = useState(0);
  const accounts = useResource<{ users: Account[]; nextOffset: number | null }>(
    `admin/users?q=${encodeURIComponent(search)}&status=${active ? 'active' : 'all'}&offset=${offset}`);
  function submit() { setOffset(0); setSearch(query.trim()); }
  return <>
    <Card><Heading>Contas cadastradas</Heading>
      <Field label="Buscar por nome ou e-mail" value={query} onChangeText={setQuery} onSubmitEditing={submit} returnKeyType="search" autoCapitalize="none" maxLength={254} />
      <View style={s.row}><Button title="Buscar" icon="search" secondary onPress={submit} />
        {!!search && <Button title="Limpar busca" secondary onPress={() => { setQuery(''); setSearch(''); setOffset(0); }} />}</View>
      <View style={s.row}>{[false, true].map(value => <Choice key={String(value)} title={value ? 'Somente ativas' : 'Todas'} selected={active === value}
        onPress={() => { setActive(value); setOffset(0); }} />)}</View>
    </Card>
    {accounts.loading && <Loading />}<Notice>{accounts.error}</Notice>
    {!!accounts.error && <Button title="Recarregar contas" secondary onPress={() => void accounts.reload()} />}
    {accounts.data?.users.length === 0 && <Copy>Nenhuma conta encontrada para esse filtro.</Copy>}
    {accounts.data?.users.map(account => <Card key={account.id}>
      <View style={s.row}><Text style={s.chipText}>{labels[account.role]}</Text>
        <Text style={s.copy}>{account.activeSessions ? `${account.activeSessions} ${account.activeSessions === 1 ? 'sessão ativa' : 'sessões ativas'}` : 'Sem sessão ativa'}</Text></View>
      <View><Heading>{account.name}</Heading><Copy>{account.email}</Copy></View>
      <View style={s.divider}><Copy>Cadastro em {timestamp(account.createdAt)}</Copy>
        <Text style={s.label}>{account.registrationSource === 'self' ? 'Criada pelo próprio usuário' :
          account.registrationSource === 'admin' ? `Criada por ${account.registeredByName || 'administrador indisponível'}` : 'Origem do cadastro não registrada'}</Text></View>
      {(account.role === 'student' || account.id === user?.id) && <View style={s.row}>
        <Button title="Treino" secondary onPress={() => router.navigate({ pathname: '/training', params: { recipient: account.id } })} />
        <Button title="Dieta" secondary onPress={() => router.navigate({ pathname: '/nutrition', params: { recipient: account.id } })} />
        <Button title="Evolução" secondary onPress={() => router.navigate({ pathname: '/progress', params: { recipient: account.id } })} />
      </View>}
    </Card>)}
    {(offset > 0 || accounts.data?.nextOffset != null) && <View style={s.row}>
      <Button title="Página anterior" secondary disabled={offset === 0 || accounts.loading} onPress={() => setOffset(Math.max(0, offset - 50))} />
      <Button title="Próxima página" secondary disabled={accounts.data?.nextOffset == null || accounts.loading} onPress={() => setOffset(accounts.data?.nextOffset ?? offset)} />
    </View>}
  </>;
}

export default function AdminPanel() {
  const { s } = useTheme();
  const overview = useResource<Overview>('admin/overview');
  const [creating, setCreating] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  function refresh() { void overview.reload(); setRevision(value => value + 1); }
  return <>
    {overview.loading && <Loading />}<Notice>{overview.error}</Notice>
    {overview.data && <Card accent>
      <Heading>Contas ativas</Heading><Text style={s.stat}>{overview.data.activeUsers}</Text>
      <Copy>Contas com pelo menos uma sessão válida. Há {overview.data.activeSessions} {overview.data.activeSessions === 1 ? 'sessão ativa' : 'sessões ativas'} no total.</Copy>
      <View style={[s.divider, s.row]}>
        <View style={{ flex: 1 }}><Heading>{overview.data.totalUsers}</Heading><Copy>Contas cadastradas</Copy></View>
        <View style={{ flex: 1 }}><Heading>{overview.data.recentUsers}</Heading><Copy>Novas em 7 dias</Copy></View>
      </View>
    </Card>}
    <View style={s.row}><Button title="Criar conta" icon="user-plus" onPress={() => { setCreating(true); setNotice(''); }} />
      <Button title="Atualizar painel" icon="refresh-cw" secondary onPress={refresh} /></View>
    {creating && <CreateAccount onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); setNotice('Conta criada. O usuário já pode entrar.'); refresh(); }} />}
    <Notice>{notice}</Notice><Directory key={revision} />
  </>;
}
