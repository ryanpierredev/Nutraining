import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { useSession } from '../lib/session';
import { useResource } from '../lib/resource';
import { dateLabel, message, today } from '../lib/api';
import ClientPicker, { type Client } from './ClientPicker';
import { Button, Card, Copy, Empty, Field, Heading, Loading, Notice, Page, s } from './ui';
type Kind = 'workout' | 'nutrition';
type Item = { name: string; sets: string; reps: string; restSeconds: string; time: string; foods: string };
type Plan = { id: string; userId: string; createdBy: string; title: string; notes: string; authorName: string;
  items: { name: string; sets?: number; reps?: string; restSeconds?: number; time?: string; foods?: string }[] };
type Result = { plans: Plan[]; logs: { planId: string; itemIndex: number }[] };
const blankItem = (): Item => ({ name: '', sets: '3', reps: '10 a 12', restSeconds: '60', time: '08:00', foods: '' });
export default function PlanScreen({ kind }: { kind: Kind }) {
  const { user, call } = useSession();
  const workout = kind === 'workout';
  const professional = user?.role !== 'student';
  const specialty = user?.role === 'admin' || user?.role === (workout ? 'trainer' : 'nutritionist');
  const clients = useResource<{ clients: Client[] }>(professional && specialty ? 'app/clients' : null);
  const [selected, setSelected] = useState('');
  const target = professional ? (selected || clients.data?.clients[0]?.id) : user?.id;
  const date = today();
  const path = target && (!professional || specialty) ? `app/plans?kind=${kind}&day=${date}&userId=${target}` : null;
  const resource = useResource<Result>(path);
  const [creating, setCreating] = useState(false); const [title, setTitle] = useState('');
  const [notes, setNotes] = useState(''); const [items, setItems] = useState<Item[]>([blankItem()]);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  function change(index: number, key: keyof Item, value: string) { setItems(previous => previous.map((item, i) => i === index ? { ...item, [key]: value } : item)); }
  async function create() {
    if (busy || !target) return;
    if (title.trim().length < 2 || items.some(item => item.name.trim().length < 2 || (workout ? !item.reps.trim() : item.foods.trim().length < 2))) {
      setNotice('Preencha o título e os dados de todos os itens.'); return;
    }
    setBusy(true); setNotice('');
    try {
      await call('app/plans', { method: 'POST', body: { kind, userId: target, title, notes,
        items: items.map(item => workout ? { name: item.name, sets: Number(item.sets), reps: item.reps, restSeconds: Number(item.restSeconds) } : { name: item.name, time: item.time, foods: item.foods }) } });
      setCreating(false); setTitle(''); setNotes(''); setItems([blankItem()]);
      await resource.reload(); setNotice(workout ? 'Treino salvo.' : 'Plano alimentar salvo.');
    } catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  async function toggle(plan: Plan, itemIndex: number) {
    if (busy) return; setBusy(true); setNotice('');
    const completed = !resource.data?.logs.some(log => log.planId === plan.id && log.itemIndex === itemIndex);
    try { await call(`app/plans/${plan.id}/log`, { method: 'PUT', body: { day: date, itemIndex, completed } }); await resource.reload(); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  async function archive(id: string) {
    if (busy) return; setBusy(true); setNotice('');
    try { await call(`app/plans/${id}`, { method: 'DELETE' }); await resource.reload(); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  function confirmArchive(id: string) {
    if (Platform.OS === 'web') { if (window.confirm('Arquivar este plano? Ele sairá da lista de planos ativos.')) void archive(id); }
    else Alert.alert('Arquivar plano?', 'Ele sairá da lista de planos ativos.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Arquivar', style: 'destructive', onPress: () => void archive(id) }]);
  }
  const done = (id: string, index: number) => resource.data?.logs.some(log => log.planId === id && log.itemIndex === index);
  return <Page title={workout ? 'Seus treinos.' : 'Sua alimentação.'} subtitle={professional ? 'Planos para acompanhar seus alunos.' : `Organize sua rotina e registre o dia · ${dateLabel(date)}`}>
    {professional && !specialty ? <Empty title="Cada especialidade no seu espaço" detail={workout ? 'O personal acompanha os planos de treino. Seus alunos e planos alimentares estão na aba Alimentação.' : 'O nutricionista acompanha os planos alimentares. Seus alunos e treinos estão na aba Treinos.'} /> : <>
      {clients.loading && <Loading />}<Notice>{clients.error}</Notice>
      {!!clients.error && <Button title="Tentar carregar alunos" secondary onPress={() => void clients.reload()} />}
      {professional && !!clients.data?.clients.length && <ClientPicker clients={clients.data.clients} selected={target} onSelect={id => { setSelected(id); setCreating(false); setNotice(''); }} />}
      {professional && clients.data?.clients.length === 0 && <Empty title="Nenhum aluno vinculado" detail="Compartilhe o código disponível em Conta. O aluno precisa vinculá-lo antes de você acessar os dados dele." />}
      {!!target && <>
        <Button title={creating ? 'Fechar formulário' : workout ? '+ Criar treino' : '+ Criar plano alimentar'} secondary disabled={busy} onPress={() => { setCreating(!creating); setNotice(''); }} />
        {creating && <Card><Heading>{workout ? 'Novo treino' : 'Novo plano alimentar'}</Heading>
          <Field label="Título" value={title} onChangeText={setTitle} maxLength={100} editable={!busy} placeholder={workout ? 'Ex.: Treino A · membros superiores' : 'Ex.: Rotina da semana'} />
          <Field label="Orientações (opcional)" value={notes} onChangeText={setNotes} maxLength={2000} multiline editable={!busy} />
          {items.map((item, index) => <View key={index} style={{ gap: 12, borderTopWidth: 1, borderColor: '#dce5d6', paddingTop: 16 }}>
            <Heading>{workout ? 'Exercício' : 'Refeição'} {index + 1}</Heading>
            <Field label={workout ? 'Nome do exercício' : 'Nome da refeição'} value={item.name} onChangeText={v => change(index, 'name', v)} maxLength={100} editable={!busy} />
            {workout ? <>
              <Field label="Séries (1 a 20)" value={item.sets} onChangeText={v => change(index, 'sets', v)} keyboardType="number-pad" maxLength={2} editable={!busy} />
              <Field label="Repetições ou duração" value={item.reps} onChangeText={v => change(index, 'reps', v)} maxLength={40} editable={!busy} />
              <Field label="Descanso em segundos (0 a 600)" value={item.restSeconds} onChangeText={v => change(index, 'restSeconds', v)} keyboardType="number-pad" maxLength={3} editable={!busy} />
            </> : <><Field label="Horário (HH:MM)" value={item.time} onChangeText={v => change(index, 'time', v)} maxLength={5} editable={!busy} />
              <Field label="Alimentos e porções" value={item.foods} onChangeText={v => change(index, 'foods', v)} maxLength={1000} multiline editable={!busy} placeholder="Descreva a refeição e as quantidades." /></>}
            {items.length > 1 && <Button title={`Remover item ${index + 1}`} secondary disabled={busy} onPress={() => setItems(previous => previous.filter((_, i) => i !== index))} />}
          </View>)}
          <Button title={workout ? '+ Adicionar exercício' : '+ Adicionar refeição'} secondary disabled={busy || items.length >= 30} onPress={() => setItems([...items, blankItem()])} />
          <Notice>{notice}</Notice><Button title={busy ? 'Salvando...' : 'Salvar plano'} disabled={busy} onPress={() => void create()} />
        </Card>}
        {!creating && <Notice>{notice}</Notice>}
        {resource.loading && <Loading />}<Notice>{resource.error}</Notice>
        {!!resource.error && <Button title="Tentar novamente" secondary onPress={() => void resource.reload()} />}
        {!resource.loading && resource.data?.plans.length === 0 && <Empty title={workout ? 'Seu próximo treino começa aqui' : 'Vamos organizar as refeições?'} detail="Crie um plano ou vincule um profissional na aba Conta para receber acompanhamento." />}
        {resource.data?.plans.map(plan => <Card key={plan.id}>
          <View style={s.chip}><Text style={s.chipText}>{workout ? `${plan.items.length} EXERCÍCIOS` : `${plan.items.length} REFEIÇÕES`}</Text></View>
          <Heading>{plan.title}</Heading><Copy>Por {plan.authorName}</Copy>{!!plan.notes && <Copy>{plan.notes}</Copy>}
          {plan.items.map((item, index) => <View key={index} style={{ gap: 8, borderTopWidth: 1, borderColor: '#e5ecde', paddingTop: 14 }}>
            <Text style={s.label}>{workout ? `${index + 1}. ` : `${item.time} · `}{item.name}</Text>
            <Copy>{workout ? `${item.sets} séries · ${item.reps} · descanso ${item.restSeconds}s` : item.foods}</Copy>
            {!workout && !professional && <Button title={done(plan.id, index) ? '✓ Refeição registrada · desfazer' : 'Registrar refeição de hoje'} secondary={!!done(plan.id, index)} disabled={busy} onPress={() => void toggle(plan, index)} />}
          </View>)}
          {workout && !professional && <Button title={done(plan.id, -1) ? '✓ Treino concluído hoje · desfazer' : 'Concluir treino de hoje'} secondary={!!done(plan.id, -1)} disabled={busy} onPress={() => void toggle(plan, -1)} />}
          {professional && <Copy>{(resource.data?.logs ?? []).filter(log => log.planId === plan.id).length} registro(s) do aluno hoje.</Copy>}
          {(plan.createdBy === user?.id || user?.role === 'admin') && <Button title="Arquivar plano" secondary disabled={busy} onPress={() => confirmArchive(plan.id)} />}
        </Card>)}
      </>}
    </>}
  </Page>;
}
