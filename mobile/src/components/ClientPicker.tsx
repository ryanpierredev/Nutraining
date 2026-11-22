import { useState, type ReactNode } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useSession } from '../lib/session';
import { useResource } from '../lib/resource';
import { ActionRow, Button, Card, Copy, Empty, Field, Loading, Notice, useTheme } from './ui';

type Client = { id: string; name: string; email: string };
type Subject = { id: string; name: string; own: boolean };
type Kind = 'workout' | 'nutrition';

export default function ClientPicker({ kind, children }: { kind?: Kind; children: (subject: Subject) => ReactNode }) {
  const { user } = useSession();
  const { s } = useTheme();
  const admin = user?.role === 'admin';
  const staff = !!user && user.role !== 'student';
  const allowed = !kind || admin || user?.role === (kind === 'workout' ? 'trainer' : 'nutritionist');
  const clients = useResource<{ clients: Client[] }>(staff && allowed ? 'app/clients' : null);
  const { recipient } = useLocalSearchParams<{ recipient?: string }>();
  const selected = typeof recipient === 'string' ? recipient : '';
  const [open, setOpen] = useState(false);
  const [query, search] = useState('');
  const [limit, setLimit] = useState(15);

  if (!user) return null;
  if (!staff) return <>{children({ id: user.id, name: user.name, own: true })}</>;
  const list = clients.data?.clients ?? [];
  const own = selected === 'me' || selected === user.id || (!selected && (admin || !allowed));
  if (!allowed && !own) return <Empty title="Outra especialidade" detail="Este acompanhamento não faz parte da sua especialidade." />;
  const client = selected ? list.find(item => item.id === selected) : list[0];
  const subject = own ? { id: user.id, name: user.name, own: true } : client ? { id: client.id, name: client.name, own: false } : null;
  const filter = query.trim().toLocaleLowerCase('pt-BR');
  const matches = list.filter(item => (item.name + ' ' + item.email).toLocaleLowerCase('pt-BR').includes(filter));
  function choose(recipient: string) {
    router.setParams({ recipient });
    setOpen(false);
    search('');
    setLimit(15);
  }

  return <>
    <Card>
      <Text style={s.chipText}>{kind ? 'DESTINATÁRIO DO PLANO' : 'ACOMPANHAMENTO'}</Text>
      <ActionRow icon={own ? 'user' : 'users'} title={own ? 'Para mim' : client?.name ?? 'Escolher aluno'} detail={own ? user.email : client?.email} onPress={() => setOpen(!open)} />
      {open && <View style={s.divider}>
        <Button title="Para mim" icon="user" secondary={!own} onPress={() => choose('me')} />
        {!!list.length && <Field label="Buscar aluno" placeholder="Nome ou e-mail" value={query} onChangeText={value => { search(value); setLimit(15); }} autoCapitalize="none" />}
        {matches.slice(0, limit).map(item => <ActionRow key={item.id} icon={item.id === subject?.id ? 'check-circle' : 'user'} title={item.name} detail={item.email} onPress={() => choose(item.id)} />)}
        {matches.length > limit && <Button title="Mostrar mais alunos" secondary onPress={() => setLimit(limit + 15)} />}
        {allowed && !clients.loading && !matches.length && <Copy>{query ? 'Nenhum aluno encontrado.' : 'Nenhum aluno disponível.'}</Copy>}
      </View>}
      {clients.loading && <Loading />}<Notice>{clients.error}</Notice>
      {!!clients.error && <Button title="Recarregar alunos" secondary onPress={() => void clients.reload()} />}
      {allowed && !admin && !clients.loading && !clients.error && !list.length && <Copy>Compartilhe o código do seu perfil com o aluno para que ele autorize o acompanhamento.</Copy>}
    </Card>
    {!own && !!selected && clients.data && !client && <Notice>Aluno indisponível. Selecione outro destinatário.</Notice>}
    {subject && children(subject)}
  </>;
}
