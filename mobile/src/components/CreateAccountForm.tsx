import { useState } from 'react';
import { Text, View } from 'react-native';
import { labels, message, type Role } from '../lib/api';
import { useSession } from '../lib/session';
import { Button, Card, Choice, Field, Heading, Notice, PasswordField, useTheme } from './ui';

export default function CreateAccountForm({ studentsOnly = false, onCreated, onCancel }: {
  studentsOnly?: boolean; onCreated: () => void; onCancel: () => void;
}) {
  const { call } = useSession();
  const { s } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    if (name.trim().length < 2 || !email.trim() || password.length < 12) {
      setError('Informe nome, e-mail e uma senha de pelo menos 12 caracteres.'); return;
    }
    setBusy(true); setError('');
    try {
      await call(studentsOnly ? 'auth/students' : 'admin/users', { method: 'POST', body: { name: name.trim(), email: email.trim(), password, role } });
      onCreated();
    } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  return <Card><Heading>{studentsOnly ? 'Nova conta de aluno' : 'Nova conta'}</Heading>
    <Field label="Nome do novo usuário" value={name} onChangeText={setName} maxLength={120} editable={!busy} />
    <Field label="E-mail do novo usuário" value={email} onChangeText={setEmail} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} />
    <PasswordField label="Senha inicial (12 a 128 caracteres)" value={password} onChangeText={setPassword}
      maxLength={128} editable={!busy} autoComplete="new-password" />
    {!studentsOnly && <><Text style={s.label}>Perfil de acesso</Text><View style={s.row}>{(Object.keys(labels) as Role[]).map(item =>
      <Choice key={item} title={labels[item]} selected={item === role} disabled={busy} onPress={() => setRole(item)} />)}</View></>}
    <Notice>{error}</Notice><Button title={busy ? 'Cadastrando…' : studentsOnly ? 'Salvar conta do aluno' : 'Cadastrar usuário'} disabled={busy} onPress={() => void submit()} />
    <Button title="Cancelar" secondary disabled={busy} onPress={onCancel} />
  </Card>;
}
