import { useState } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../lib/session';
import { labels, message, type Role } from '../lib/api';
import { Button, Card, Field, Loading, Notice, Page } from '../components/ui';
export default function Login() {
  const session = useSession();
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [role, setRole] = useState<Role>('student');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (session.loading) return <Loading />;
  if (session.user) return <Redirect href="/home" />;
  async function submit() {
    if (busy) return;
    if (!email.trim() || password.length < 12 || (signup && name.trim().length < 2)) {
      setError('Informe e-mail, senha com pelo menos 12 caracteres e nome no cadastro.'); return;
    }
    setBusy(true); setError('');
    try { await session.signIn(email.trim(), password, signup ? { name: name.trim(), role } : undefined); setPassword(''); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  return <Page title={signup ? 'Criar conta' : 'Entrar'}>
    {session.error ? <Card><Notice>{session.error}</Notice><Button title="Tentar recuperar sessão" onPress={session.reload} /></Card> : <Card>
      {signup && <Field label="Nome" value={name} onChangeText={setName} maxLength={120} editable={!busy} autoCapitalize="words" />}
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!busy} autoComplete="email" />
      <Field label="Senha (mínimo de 12 caracteres)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} editable={!busy} autoComplete={signup ? 'new-password' : 'current-password'} />
      {signup && <View style={{ gap: 8 }}>{(['student', 'trainer', 'nutritionist'] as Role[]).map(item => <Button key={item}
        title={`${role === item ? '● ' : ''}${labels[item]}`} secondary={role !== item} disabled={busy} onPress={() => setRole(item)} />)}</View>}
      <Notice>{error}</Notice>
      <Button title={busy ? 'Aguarde...' : signup ? 'Criar conta' : 'Entrar'} disabled={busy} onPress={() => void submit()} />
      <Button title={signup ? 'Já tenho uma conta' : 'Ainda não tenho conta'} secondary disabled={busy} onPress={() => { setSignup(!signup); setError(''); }} />
    </Card>}
  </Page>;
}
