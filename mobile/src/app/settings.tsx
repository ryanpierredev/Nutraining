import { useState } from 'react';
import { Link, Redirect } from 'expo-router';
import { useSession } from '../lib/session';
import { useTheme, type ThemeMode } from '../lib/theme';
import { message } from '../lib/api';
import { Button, Card, Copy, Heading, Loading, Notice, Page, useUI } from '../components/ui';
export default function Settings() {
  const {s}=useUI(); const {user,loading}=useSession(); const {mode,setMode}=useTheme();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  if(loading)return <Loading />;
  if(!user)return <Redirect href="/" />;
  async function select(value: ThemeMode) { setBusy(true);setError(''); try{await setMode(value);}catch(e){setError(message(e));}finally{setBusy(false);} }
  return <Page title="Configurações." subtitle="Deixe seu espaço do seu jeito.">
    <Link href="/profile" style={s.chipText}>← Voltar ao perfil</Link>
    <Card><Heading>Conta e segurança</Heading>
      <Link href="/security" style={s.chipText}>Alterar senha →</Link>
      <Link href="/sessions" style={s.chipText}>Dispositivos e sessões →</Link>
    </Card>
    <Card><Heading>Aparência</Heading><Copy>Seu tema fica salvo neste dispositivo.</Copy>
      {([['system','Seguir o sistema'],['light','Tema claro'],['dark','Tema escuro']] as [ThemeMode,string][]).map(([value,label])=><Button key={value} title={`${mode===value?'✓ ':''}${label}`} secondary={mode!==value} disabled={busy} onPress={()=>void select(value)} />)}
      <Notice>{error}</Notice>
    </Card>
    {user.role==='admin' && <Card><Heading>Administração</Heading>
      <Copy>Cadastros, adesão, acessos e atividade do aplicativo.</Copy>
      <Link href="/admin-dashboard" style={s.chipText}>Visão administrativa e sessões →</Link>
      <Link href="/admin" style={s.chipText}>Cadastrar e gerenciar usuários →</Link>
      <Link href="/training" style={s.chipText}>Passar treino a um aluno →</Link>
      <Link href="/nutrition" style={s.chipText}>Passar dieta a um aluno →</Link>
    </Card>}
  </Page>;
}
