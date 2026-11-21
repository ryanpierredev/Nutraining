import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/resource';
import { dateLabel, message, today } from '../../lib/api';
import ClientPicker, { type Client } from '../../components/ClientPicker';
import { Button, Card, Copy, Empty, Field, Heading, Loading, Notice, Page, useUI } from '../../components/ui';
type Checkin = { day: string; weightKg: number; waistCm: number | null; notes: string };
export default function Progress() {
  const {s}=useUI();
  const { user, call } = useSession();
  const professional = user?.role !== 'student';
  const clients = useResource<{ clients: Client[] }>(professional ? 'app/clients' : null);
  const [selected, setSelected] = useState('');
  const target = professional ? selected || clients.data?.clients[0]?.id : user?.id;
  const resource = useResource<{ checkins: Checkin[] }>(target ? `app/progress?userId=${target}` : null);
  const [date, setDate] = useState(today()); const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState(''); const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  async function save() {
    if (busy) return;
    const weightKg = Number(weight.replace(',', '.')); const waistCm = waist.trim() ? Number(waist.replace(',', '.')) : null;
    if (!weight.trim() || !Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400 ||
      (waistCm !== null && (!Number.isFinite(waistCm) || waistCm < 30 || waistCm > 300))) {
      setNotice('Informe peso entre 20 e 400 kg e, opcionalmente, cintura entre 30 e 300 cm.'); return;
    }
    setBusy(true); setNotice('');
    try { await call('app/progress', { method: 'PUT', body: { day: date, weightKg, waistCm, notes } });
      await resource.reload(); setNotice('Registro salvo. Um novo envio na mesma data atualiza o registro.');
      setWeight(''); setWaist(''); setNotes(''); setDate(today());
    } catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  async function remove(day: string) {
    setBusy(true); setNotice('');
    try { await call(`app/progress/${day}`, { method: 'DELETE' }); await resource.reload(); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  function confirmRemove(day: string) {
    if (Platform.OS === 'web') { if (window.confirm('Excluir este registro de evolução?')) void remove(day); }
    else Alert.alert('Excluir registro?', dateLabel(day), [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => void remove(day) }]);
  }
  const entries = resource.data?.checkins ?? [];
  const first = entries[entries.length - 1]; const last = entries[0];
  const delta = last && first ? last.weightKg - first.weightKg : 0;
  return <Page title="Sua evolução." subtitle="Um histórico para entender sua jornada, sem pressa.">
    {clients.loading && <Loading />}<Notice>{clients.error}</Notice>
    {!!clients.error && <Button title="Tentar carregar alunos" secondary onPress={() => void clients.reload()} />}
    {professional && !!clients.data?.clients.length && <ClientPicker clients={clients.data.clients} selected={target} onSelect={id => { setSelected(id); setNotice(''); }} />}
    {professional && clients.data?.clients.length === 0 && <Empty title="Nenhum aluno vinculado" detail="O aluno pode se vincular pelo código disponível na sua conta." />}
    {last && <Card><Heading>Seu histórico em números</Heading><Text style={s.stat}>{last.weightKg} kg</Text>
      <Copy>Último registro em {dateLabel(last.day)}{entries.length > 1 ? ` · variação de ${delta > 0 ? '+' : ''}${delta.toFixed(2)} kg desde ${dateLabel(first.day)}` : ''}</Copy>
      <Copy>O peso é apenas uma parte do acompanhamento. Converse com seu profissional para interpretar sua evolução.</Copy>
    </Card>}
    {!professional && <Card><Heading>Registrar medidas</Heading><Copy>Um registro por dia. Para corrigir um dia anterior, use a mesma data.</Copy>
      <Field label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} maxLength={10} editable={!busy} />
      <Field label="Peso (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={6} editable={!busy} placeholder="Ex.: 72,5" />
      <Field label="Cintura (cm, opcional)" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" maxLength={6} editable={!busy} />
      <Field label="Como você está se sentindo? (opcional)" value={notes} onChangeText={setNotes} maxLength={2000} multiline editable={!busy} />
      <Notice>{notice}</Notice><Button title={busy ? 'Salvando...' : 'Salvar evolução'} disabled={busy} onPress={() => void save()} />
    </Card>}
    {professional && <Notice>{notice}</Notice>}
    {resource.loading && <Loading />}<Notice>{resource.error}</Notice>
    {!!resource.error && <Button title="Tentar novamente" secondary onPress={() => void resource.reload()} />}
    {!resource.loading && resource.data && entries.length === 0 && <Empty title="Sua jornada começa com um registro" detail="As medidas e observações salvas aparecerão aqui." />}
    {!!entries.length && <Heading>Últimos {entries.length} registros</Heading>}
    {entries.map(entry => <Card key={entry.day}><Text style={s.chipText}>{dateLabel(entry.day)}</Text><Heading>{entry.weightKg} kg</Heading>
      {entry.waistCm !== null && <Copy>Cintura: {entry.waistCm} cm</Copy>}{!!entry.notes && <Copy>{entry.notes}</Copy>}
      {!professional && <View style={s.row}><Button title="Corrigir" secondary disabled={busy} onPress={() => { setDate(entry.day); setWeight(String(entry.weightKg)); setWaist(entry.waistCm === null ? '' : String(entry.waistCm)); setNotes(entry.notes); setNotice('Dados carregados no formulário acima.'); }} />
        <Button title="Excluir" secondary disabled={busy} onPress={() => confirmRemove(entry.day)} /></View>}
    </Card>)}
  </Page>;
}
