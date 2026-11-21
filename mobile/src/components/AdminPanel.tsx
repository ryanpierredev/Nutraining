import { Link } from 'expo-router';
import { useUI } from './ui';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Role = 'student' | 'trainer' | 'nutritionist' | 'admin';
type User = { id: string; name: string; email: string; role: Role };
type Request = (path: string, options: {
  method?: string; body?: Record<string, unknown>; token?: string; admin?: boolean;
}) => Promise<any>;
const labels: Record<Role, string> = {
  student: 'Aluno', trainer: 'Personal', nutritionist: 'Nutricionista', admin: 'Administrador',
};

export default function AdminPanel({ token, request }: { token: string; request: Request }) {
  const {colors}=useUI();
  const styles=makeStyles(colors);
  const [users, setUsers] = useState<User[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async (offset = 0) => {
    try {
      const data = await request(`users?offset=${offset}`, { token, admin: true });
      setUsers(previous => offset ? [...previous, ...data.users] : data.users);
      setNextOffset(data.nextOffset);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar usuários.');
    } finally { setLoading(false); }
  }, [request, token]);
  useEffect(() => {
    let active = true;
    void request('users?offset=0', { token, admin: true })
      .then(data => {
        if (!active) return;
        setUsers(data.users);
        setNextOffset(data.nextOffset);
      })
      .catch(error => {
        if (active) setMessage(error instanceof Error ? error.message : 'Falha ao carregar usuários.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, token, refresh]);

  async function create() {
    if (busy) return;
    if (name.trim().length < 2 || !email.trim() || password.length < 12) {
      setMessage('Informe nome, e-mail e senha com pelo menos 12 caracteres.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await request('users', { admin: true, token, method: 'POST',
        body: { name: name.trim(), email: email.trim(), password, role } });
      setName(''); setEmail(''); setPassword(''); setRole('student');
      setMessage('Usuário cadastrado. Ele já pode entrar com o e-mail e a senha informados.');
      setRefresh(value => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao cadastrar.');
    } finally { setBusy(false); }
  }

  return <View style={styles.panel}>
    <Text style={styles.title}>Administração de usuários</Text>
    <Text style={styles.label}>Novo usuário</Text>
    <TextInput accessibilityLabel="Nome do novo usuário" placeholder="Nome" value={name}
      onChangeText={setName} maxLength={120} editable={!busy} style={styles.input} placeholderTextColor={colors.muted} />
    <TextInput accessibilityLabel="E-mail do novo usuário" placeholder="E-mail" value={email}
      onChangeText={setEmail} maxLength={254} autoCapitalize="none" autoCorrect={false}
      keyboardType="email-address" editable={!busy} style={styles.input} placeholderTextColor={colors.muted} />
    <TextInput accessibilityLabel="Senha do novo usuário" placeholder="Senha (12 a 128 caracteres)"
      value={password} onChangeText={setPassword} maxLength={128} secureTextEntry
      autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} placeholderTextColor={colors.muted} />
    {(Object.keys(labels) as Role[]).map(item => <Pressable key={item}
      accessibilityRole="radio" accessibilityState={{ checked: role === item }}
      disabled={busy} onPress={() => setRole(item)} style={styles.action}>
      <Text style={{color:colors.ink}}>{role === item ? '●' : '○'} {labels[item]}</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void create()} style={styles.action}>
      <Text style={{color:colors.ink}}>{busy ? 'Cadastrando...' : 'Cadastrar usuário'}</Text>
    </Pressable>
    {!!message && <Text accessibilityRole="alert" style={styles.label}>{message}</Text>}
    <Text style={styles.title}>Usuários cadastrados</Text>
    <Pressable accessibilityRole="button" disabled={loading} onPress={() => { setMessage(''); setLoading(true); void load(); }} style={styles.action}>
      <Text style={{color:colors.ink}}>Atualizar lista</Text>
    </Pressable>
    {users.map(user => <View key={user.id} style={styles.row}>
      <Text style={styles.label}>{user.name}</Text>
      <Text style={{color:colors.ink}}>{user.email}</Text><Text style={{color:colors.ink}}>{labels[user.role]}</Text>
      {user.role==='student' && <View style={{gap:10,marginTop:8}}>
        <Link href={{pathname:'/training',params:{userId:user.id}}} style={{color:colors.green,fontWeight:'700'}}>Passar treino →</Link>
        <Link href={{pathname:'/nutrition',params:{userId:user.id}}} style={{color:colors.green,fontWeight:'700'}}>Passar dieta →</Link>
      </View>}
    </View>)}
    {!users.length && !loading && <Text style={{color:colors.ink}}>Nenhum usuário carregado.</Text>}
    {loading && <ActivityIndicator />}
    {nextOffset !== null && <Pressable accessibilityRole="button" disabled={loading}
      onPress={() => { setLoading(true); void load(nextOffset); }} style={styles.action}><Text style={{color:colors.ink}}>Carregar mais</Text></Pressable>}
  </View>;
}
const makeStyles=(colors: ReturnType<typeof useUI>['colors'])=>StyleSheet.create({
  panel: { marginTop: 24, gap: 8 },
  title: { fontSize: 19, fontWeight: '700', color: colors.ink, marginTop: 12 },
  label: { fontWeight: '600', color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, minHeight: 48, padding: 12, color: colors.ink },
  action: { minHeight: 48, padding: 12, backgroundColor: colors.soft, borderRadius: 10, justifyContent: 'center' },
  row: { borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 12, gap: 4 },
});
