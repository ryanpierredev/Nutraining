import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { useState } from 'react';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/resource';
import { dateLabel, labels, message, today } from '../../lib/api';
import { Button, Card, Copy, Heading, Loading, Notice, Page, s } from '../../components/ui';
type Dashboard = { plans: { workout?: number; nutrition?: number }; completed: { workout?: number; nutrition?: number }; waterMl: number; lastCheckin: { day: string; weightKg: number } | null };
export default function Home() {
  const { user, call } = useSession();
  const date = today();
  const { data, loading, error, reload } = useResource<Dashboard>(`app/dashboard?day=${date}`);
  const clients = useResource<{ clients: { id: string }[] }>(user?.role !== 'student' ? 'app/clients' : null);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  async function water(amountMl: number) {
    if (busy) return; setBusy(true); setNotice('');
    try { await call('app/water', { method: 'POST', body: { day: date, amountMl } }); await reload(); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  return <Page title={`Olá, ${user?.name.split(' ')[0]}.`} subtitle={`Seu espaço de ${labels[user?.role || 'student'].toLowerCase()} · ${dateLabel(date)}`}>
    <Card dark><Text style={{ color: '#c9ddae', fontWeight: '700', fontSize: 12 }}>UM PASSO DE CADA VEZ</Text>
      <Text style={{ color: '#fff', fontSize: 25, lineHeight: 32, fontWeight: '700' }}>Cuide de você.{"\n"}Acompanhe sua jornada.</Text>
      <Text style={{ color: '#d1dfce', lineHeight: 22 }}>Seus planos, registros e profissionais conectados em um só lugar.</Text>
    </Card>
    {loading && <Loading />}<Notice>{error}</Notice>
    {!!error && <Button secondary title="Tentar novamente" onPress={() => void reload()} />}
    {user?.role !== 'student' && <Card><Heading>Acompanhamento</Heading>
      {clients.loading ? <Loading /> : <><Text style={s.stat}>{clients.data?.clients.length ?? 0}</Text><Copy>alunos disponíveis para acompanhar</Copy></>}
      <Notice>{clients.error}</Notice>
      <Copy>Abra Treinos, Alimentação ou Evolução e selecione um aluno. O aluno se vincula usando o código na sua conta.</Copy>
      {user?.role === 'admin' && <Link href="/admin" style={s.chipText}>Abrir administração de usuários →</Link>}
    </Card>}
    {data && <>
      <View style={s.row}>
        <View style={{ flex: 1, minWidth: 130 }}><Card><Text style={s.stat}>{data.completed.workout ?? 0}</Text><Copy>treinos feitos hoje</Copy><Link href="/training" style={s.chipText}>Ver treinos →</Link></Card></View>
        <View style={{ flex: 1, minWidth: 130 }}><Card><Text style={s.stat}>{data.completed.nutrition ?? 0}</Text><Copy>refeições registradas</Copy><Link href="/nutrition" style={s.chipText}>Ver alimentação →</Link></Card></View>
      </View>
      <Card><Heading>Sua hidratação de hoje</Heading><Text style={s.stat}>{data.waterMl} <Text style={{ fontSize: 16 }}>ml</Text></Text>
        <Copy>Registre a água que bebeu. A necessidade diária varia; siga a orientação do seu profissional.</Copy>
        <Notice>{notice}</Notice><View style={s.row}>
          <View style={{ flex: 1 }}><Button title="+ 250 ml" disabled={busy || data.waterMl >= 10000} onPress={() => void water(250)} /></View>
          <View style={{ flex: 1 }}><Button title="− 250 ml" secondary disabled={busy || data.waterMl === 0} onPress={() => void water(-250)} /></View>
        </View>
      </Card>
      <Card><Heading>Último registro de evolução</Heading>{data.lastCheckin ? <><Text style={s.stat}>{data.lastCheckin.weightKg} kg</Text><Copy>{dateLabel(data.lastCheckin.day)}</Copy></> : <Copy>Você ainda não registrou sua evolução. Comece quando quiser.</Copy>}
        <Link href="/progress" style={s.chipText}>Acompanhar evolução →</Link>
      </Card>
    </>}
  </Page>;
}
