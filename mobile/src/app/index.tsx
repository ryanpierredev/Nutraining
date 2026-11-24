import { useState } from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../lib/session';
import { message } from '../lib/api';
import { Button, Card, Copy, Field, Loading, Notice, Page, PasswordField } from '../components/ui';
export default function Login() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (session.loading) return <Loading />;
  if (session.user) return <Redirect href="/home" />;
  async function submit() {
    if (busy) return;
    if (!email.trim() || password.length < 12) {
      setError('Informe seu e-mail e uma senha de pelo menos 12 caracteres.'); return;
    }
    setBusy(true); setError('');
    try { await session.signIn(email.trim(), password); setPassword(''); }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  return <Page title="Entrar">
    {session.error ? <Card><Notice>{session.error}</Notice><Button title="Tentar recuperar sessão" onPress={session.reload} /></Card> : <Card>
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!busy} autoComplete="email" />
      <PasswordField label="Senha (mínimo de 12 caracteres)" value={password} onChangeText={setPassword}
        maxLength={128} editable={!busy} autoComplete="current-password" />
      <Notice>{error || session.signedOutNotice}</Notice>
      <Button title={busy ? 'Aguarde...' : 'Entrar'} disabled={busy} onPress={() => void submit()} />
      <Copy>Precisa de uma conta? Solicite seu cadastro a um personal, nutricionista ou administrador.</Copy>
    </Card>}
  </Page>;
}
