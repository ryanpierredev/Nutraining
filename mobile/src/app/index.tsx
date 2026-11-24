import { useState } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../lib/session';
import { labels, message, type ProfessionalRole } from '../lib/api';
import { Button, Card, Choice, Copy, Field, Loading, Notice, Page, PasswordField } from '../components/ui';

const professionalRoles: ProfessionalRole[] = ['trainer', 'nutritionist'];
export default function Login() {
  const session = useSession();
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<ProfessionalRole>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (session.loading) return <Loading />;
  if (session.user) return <Redirect href="/home" />;
  async function submit() {
    if (busy) return;
    if (!email.trim() || password.length < 12) {
      setError('Informe seu e-mail e uma senha de pelo menos 12 caracteres.'); return;
    }
    if (signup && (!role || name.trim().length < 2)) {
      setError('Informe seu nome e escolha Personal ou Nutricionista.'); return;
    }
    setBusy(true); setError('');
    try {
      if (signup && role) await session.registerProfessional({ name: name.trim(), email: email.trim(), password, role });
      else await session.signIn(email.trim(), password);
      setPassword('');
    }
    catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  function switchMode() {
    setSignup(value => !value);
    setPassword('');
    setError('');
  }
  return <Page title={signup ? 'Cadastro profissional' : 'Entrar'}>
    {session.error ? <Card><Notice>{session.error}</Notice><Button title="Tentar recuperar sessão" onPress={session.reload} /></Card> : <Card>
      {signup && <>
        <Field label="Nome" value={name} onChangeText={setName} maxLength={120} editable={!busy} autoCapitalize="words" autoComplete="name" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{professionalRoles.map(item =>
          <Choice key={item} title={labels[item]} selected={role === item} disabled={busy} onPress={() => setRole(item)} />)}</View>
      </>}
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!busy} autoComplete="email" />
      <PasswordField key={signup ? 'signup' : 'login'} label="Senha (mínimo de 12 caracteres)" value={password} onChangeText={setPassword}
        maxLength={128} editable={!busy} autoComplete={signup ? 'new-password' : 'current-password'} />
      <Notice>{error || (!signup && session.signedOutNotice)}</Notice>
      <Button title={busy ? 'Aguarde...' : signup ? 'Criar conta profissional' : 'Entrar'} disabled={busy} onPress={() => void submit()} />
      <Button title={signup ? 'Voltar para entrar' : 'Cadastrar como profissional'} secondary disabled={busy} onPress={switchMode} />
      {!signup && <Copy>Aluno? Solicite seu cadastro a um personal, nutricionista ou administrador.</Copy>}
    </Card>}
  </Page>;
}
