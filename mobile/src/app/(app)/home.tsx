import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Text, View } from 'react-native';
import { useState } from 'react';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/resource';
import { dateLabel, measure, message, today } from '../../lib/api';
import { ActionRow, Button, Card, Copy, Heading, Loading, Notice, Page, useTheme } from '../../components/ui';

type Dashboard = { plans: { workout?: number; nutrition?: number }; completed: { workout?: number; nutrition?: number };
  fixedPlans: { workout?: string; nutrition?: string }; waterMl: number; lastCheckin: { day: string; weightKg: number } | null };
export default function Home() {
  const { user, call } = useSession();
  const { s, colors } = useTheme();
  const date = today();
  const { data, loading, error, reload } = useResource<Dashboard>(`app/dashboard?day=${date}`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function water(amountMl: number) {
    if (busy) return;
    setBusy(true); setNotice('');
    try { await call('app/water', { method: 'POST', body: { day: date, amountMl } }); await reload(); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  return <Page title={`Olá, ${user?.name.split(' ')[0]}.`} subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}>
    {loading && <Loading />}<Notice>{error}</Notice>
    {!!error && <Button secondary title="Tentar novamente" onPress={() => void reload()} />}
    {data && <>
      <Card accent><View style={s.row}><Feather name="calendar" color={colors.green} size={19} /><Heading>Rotina de hoje</Heading></View>
        <ActionRow icon="activity" title={data.fixedPlans?.workout || 'Meus treinos'}
          detail={data.fixedPlans?.workout ? 'Treino fixo' : (data.plans.workout ? `${data.plans.workout} ${data.plans.workout === 1 ? 'treino disponível' : 'treinos disponíveis'}` : 'Nenhum treino cadastrado')} onPress={() => router.navigate('/training?recipient=me')} />
        <View style={s.divider}><ActionRow icon="coffee" title={data.fixedPlans?.nutrition || 'Minha alimentação'}
          detail={data.fixedPlans?.nutrition ? 'Dieta fixa' : (data.plans.nutrition ? `${data.plans.nutrition} ${data.plans.nutrition === 1 ? 'plano disponível' : 'planos disponíveis'}` : 'Nenhum plano alimentar cadastrado')} onPress={() => router.navigate('/nutrition?recipient=me')} /></View>
      </Card>
      <Card><Heading>Atividades de hoje</Heading><View style={s.row}>
        <View style={{ flex: 1 }}><Text style={s.stat}>{data.completed.workout ?? 0}</Text><Copy>Treinos concluídos</Copy></View>
        <View style={{ flex: 1 }}><Text style={s.stat}>{data.completed.nutrition ?? 0}</Text><Copy>Refeições registradas</Copy></View>
      </View></Card>
      <Card><View style={s.spread}><Heading>Hidratação</Heading><Feather name="droplet" size={20} color={colors.green} /></View>
        <Text style={s.stat}>{measure(data.waterMl)} <Text style={s.heading}>ml</Text></Text>
        <View style={s.row}><Button title="+ 250 ml" disabled={busy || data.waterMl >= 10000} onPress={() => void water(250)} />
          <Button title="− 250 ml" secondary disabled={busy || data.waterMl === 0} onPress={() => void water(-250)} /></View><Notice>{notice}</Notice>
      </Card>
      <Card><ActionRow icon="trending-up" title="Evolução" detail={data.lastCheckin ? `${measure(data.lastCheckin.weightKg)} kg em ${dateLabel(data.lastCheckin.day)}` : 'Consultar histórico e registrar medidas'}
        onPress={() => router.navigate('/progress?recipient=me')} /></Card>
    </>}
    {(user?.role === 'trainer' || user?.role === 'nutritionist') && <Card><ActionRow icon="users" title="Acompanhar alunos" detail="Selecione um aluno para ver as medidas." onPress={() => router.navigate('/progress')} /></Card>}
  </Page>;
}
