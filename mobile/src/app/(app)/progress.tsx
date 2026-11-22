import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/resource';
import { dateLabel, measure, message, today } from '../../lib/api';
import ClientPicker from '../../components/ClientPicker';
import ProgressChart, { type Checkin } from '../../components/ProgressChart';
import { Button, Card, Choice, Copy, Empty, Field, Heading, Loading, Notice, Page, confirmAction, useTheme } from '../../components/ui';

function MeasureForm({ entry, onSave, onCancel }: { entry?: Checkin; onSave: () => void; onCancel: () => void }) {
  const { call } = useSession();
  const [date, setDate] = useState(entry?.day ?? today());
  const [weight, setWeight] = useState(entry ? measure(entry.weightKg) : '');
  const [waist, setWaist] = useState(entry?.waistCm != null ? measure(entry.waistCm) : '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (busy) return;
    const weightKg = Number(weight.replace(',', '.'));
    const waistCm = waist.trim() ? Number(waist.replace(',', '.')) : null;
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400 ||
        (waistCm !== null && (!Number.isFinite(waistCm) || waistCm < 30 || waistCm > 300))) {
      setError('Informe peso entre 20 e 400 kg e, se desejar, cintura entre 30 e 300 cm.'); return;
    }
    setBusy(true); setError('');
    try {
      await call('app/progress', { method: 'PUT', body: { day: date, weightKg, waistCm, notes } });
      onSave();
    } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  return <Card><Heading>{entry ? 'Corrigir medidas' : 'Registrar medidas'}</Heading>
    <Field label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} maxLength={10} editable={!busy && !entry} />
    {!entry && <Copy>Se já houver um registro nessa data, as novas medidas substituem as anteriores.</Copy>}
    <Field label="Peso (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={6} editable={!busy} placeholder="Ex.: 72,5" />
    <Field label="Cintura (cm, opcional)" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" maxLength={6} editable={!busy} />
    <Field label="Observações (opcional)" value={notes} onChangeText={setNotes} maxLength={2000} multiline editable={!busy} />
    <Notice>{error}</Notice><Button title={busy ? 'Salvando…' : 'Salvar medidas'} disabled={busy} onPress={() => void save()} />
    <Button title="Cancelar" secondary disabled={busy} onPress={onCancel} />
  </Card>;
}

function History({ id, own }: { id: string; own: boolean }) {
  const { call } = useSession();
  const { s } = useTheme();
  const resource = useResource<{ checkins: Checkin[] }>(`app/progress?userId=${id}`);
  const [days, setDays] = useState(0);
  const [editing, setEditing] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const since = Date.parse(today()) - (days - 1) * 86400000;
  const entries = (resource.data?.checkins ?? []).filter(entry => !days || Date.parse(entry.day) >= since);
  function saved() { setEditing(''); setNotice('Medidas salvas.'); void resource.reload(); }
  async function remove(day: string) {
    setDeleting(true); setNotice('');
    try { await call(`app/progress/${day}`, { method: 'DELETE' }); await resource.reload(); setNotice('Registro excluído.'); }
    catch (failure) { setNotice(message(failure)); } finally { setDeleting(false); }
  }
  return <>
    {own && (editing === 'new' ? <MeasureForm onSave={saved} onCancel={() => setEditing('')} /> :
      <Button title="Registrar medidas" icon="plus" onPress={() => { setEditing('new'); setNotice(''); }} />)}
    <View style={s.row}>{[[0, 'Recentes'], [30, '30 dias'], [90, '90 dias']].map(([value, label]) =>
      <Choice key={value} title={String(label)} selected={days === value} onPress={() => { setDays(Number(value)); setEditing(''); }} />)}</View>
    {resource.loading && <Loading />}<Notice>{resource.error || notice}</Notice>
    {!!resource.error && <Button title="Tentar novamente" secondary onPress={() => void resource.reload()} />}
    {resource.data && (entries.length ? <>
      <ProgressChart entries={entries} />
      <Heading>Histórico de medidas</Heading>
      <Copy>{entries.length} {entries.length === 1 ? 'registro' : 'registros'}{days ? ` nos últimos ${days} dias` : ' · até os 90 registros mais recentes'}</Copy>
      {entries.map(entry => editing === entry.day && own ? <MeasureForm key={entry.day} entry={entry} onSave={saved} onCancel={() => setEditing('')} /> :
        <Card key={entry.day}><Text style={s.chipText}>{dateLabel(entry.day)}</Text>
          <Heading>{measure(entry.weightKg)} kg</Heading>{entry.waistCm !== null && <Copy>Cintura: {measure(entry.waistCm)} cm</Copy>}
          {!!entry.notes && <Copy>{entry.notes}</Copy>}
          {own && <View style={s.row}><Button title="Corrigir" secondary disabled={deleting} onPress={() => setEditing(entry.day)} />
            <Button title="Excluir" secondary disabled={deleting} onPress={() => confirmAction('Excluir registro?', dateLabel(entry.day), 'Excluir', () => void remove(entry.day))} /></View>}
        </Card>)}
    </> : <Empty title="Nenhuma medida neste período" detail={own ? 'Registre suas medidas ou escolha outro período.' : 'As medidas registradas pelo aluno aparecerão aqui.'} />)}
  </>;
}
export default function Progress() {
  return <Page title="Evolução" subtitle="Histórico de peso e cintura">
    <ClientPicker>{subject => <History key={subject.id} id={subject.id} own={subject.own} />}</ClientPicker>
  </Page>;
}
