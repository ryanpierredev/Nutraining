import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { dateLabel, measure, message } from '../lib/api';
import { useSession } from '../lib/session';
import { useResource } from '../lib/resource';
import { Button, Card, Copy, Field, Loading, Notice, useTheme } from './ui';

type Workout = {
  id: string;
  title: string;
  authorName: string;
  notes: string;
  isFixed: boolean;
  items: { name: string; sets?: number; reps?: string; restSeconds?: number }[];
};
type Load = { itemIndex: number; day: string; weightKg: number };

function ExerciseLoads({ path, date, name, history, editable, onSave }: {
  path: string; date: string; name: string; history: Load[]; editable: boolean; onSave: () => Promise<void>;
}) {
  const { call } = useSession();
  const { s } = useTheme();
  const [draft, setDraft] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const current = history.find(load => load.day === date);
  const last = history[0];

  async function save() {
    const input = draft?.trim() ?? '';
    const weightKg = Number(input.replace(',', '.'));
    if (!/^\d{1,4}(?:[.,]\d{1,2})?$/.test(input) || weightKg > 1000) {
      setError('Informe a carga de 0 a 1.000 kg, com até duas casas decimais.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await call(path, { method: 'PUT', body: { day: date, weightKg } });
      await onSave();
      setDraft(undefined);
      setSaved(true);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <>
    {last && <Copy>Última carga: {measure(last.weightKg)} kg em {dateLabel(last.day)}</Copy>}
    {editable && <>
      <Field label={`Carga de hoje para ${name} (kg)`} keyboardType="decimal-pad" maxLength={7}
        value={draft ?? (current ? String(current.weightKg).replace('.', ',') : '')}
        onChangeText={value => { setDraft(value); setError(''); setSaved(false); }}
        placeholder="Ex.: 12,5" editable={!busy} />
      <View style={s.row}>
        <Button title={busy ? 'Salvando…' : 'Salvar carga'} secondary disabled={busy || !draft?.trim()} onPress={() => void save()} />
        {saved && <Text accessibilityLiveRegion="polite" style={s.chipText}>Carga salva.</Text>}
      </View>
      <Notice>{error}</Notice>
    </>}
    <Button title={showHistory ? 'Ocultar histórico de cargas' : 'Ver histórico de cargas'} icon="clock" secondary onPress={() => setShowHistory(value => !value)} />
    {showHistory && <View style={s.divider}>
      {history.length ? history.map(load => <View key={load.day} style={s.spread}>
        <Text style={s.copy}>{dateLabel(load.day)}</Text><Text style={s.label}>{measure(load.weightKg)} kg</Text>
      </View>) : <Copy>Nenhuma carga registrada para este exercício.</Copy>}
    </View>}
  </>;
}

function WorkoutDetails({ plan, date, canLog, children }: {
  plan: Workout; date: string; canLog: boolean; children?: ReactNode;
}) {
  const { s } = useTheme();
  const path = `app/plans/${plan.id}/exercise-loads`;
  const resource = useResource<{ loads: Load[] }>(path);
  return <>
    {plan.isFixed && <Text style={s.chipText}>TREINO FIXO</Text>}
    <Copy>Por {plan.authorName}</Copy>{!!plan.notes && <Copy>{plan.notes}</Copy>}
    {resource.loading && <Loading />}
    <Notice>{resource.error}</Notice>
    {!!resource.error && <Button title="Recarregar cargas" secondary onPress={() => void resource.reload()} />}
    {plan.items.map((item, index) => <View key={index} style={s.divider}>
      <Text style={s.label}>{index + 1}. {item.name}</Text>
      <Copy>{item.sets} séries · {item.reps} · descanso {item.restSeconds}s</Copy>
      {resource.data && <ExerciseLoads
        key={date} name={item.name} date={date} path={`${path}/${index}`} editable={canLog}
        history={resource.data.loads.filter(load => load.itemIndex === index)} onSave={resource.reload} />}
    </View>)}
    {children}
  </>;
}

export default function WorkoutSheet({ plan, date, canLog, children }: {
  plan: Workout; date: string; canLog: boolean; children?: ReactNode;
}) {
  const { s, colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  return <Card accent={plan.isFixed}>
    <Pressable accessibilityRole="button" accessibilityLabel={plan.title} aria-expanded={expanded}
      onPress={() => setExpanded(value => !value)} style={({ pressed }) => [s.spread, { minHeight: 32, opacity: pressed ? 0.65 : 1 }]}>
      <Text style={[s.heading, { flex: 1 }]}>{plan.title}</Text>
      <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.green} />
    </Pressable>
    {expanded && <WorkoutDetails plan={plan} date={date} canLog={canLog}>{children}</WorkoutDetails>}
  </Card>;
}
