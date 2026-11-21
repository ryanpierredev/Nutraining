import { useState } from 'react';
import { Link, Redirect } from 'expo-router';
import { useSession } from '../lib/session';
import { deviceLabel, message } from '../lib/api';
import { Button, Card, Copy, Field, Loading, Notice, Page, useUI } from '../components/ui';
export default function Security() {
  const {s}=useUI(); const {user,loading,call,replaceSession}=useSession();
  const [current,setCurrent]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
  if(loading)return <Loading />;if(!user)return <Redirect href="/" />;
  async function save(){
    if(busy)return;
    if(password!==confirm || password.length<12 || !current){setNotice('Informe a senha atual e confirme uma nova senha com pelo menos 12 caracteres.');return;}
    setBusy(true);setNotice('');
    try{const data=await call('account/password',{method:'PUT',body:{currentPassword:current,newPassword:password,deviceLabel:deviceLabel()}});await replaceSession(data);setCurrent('');setPassword('');setConfirm('');setNotice('Senha alterada. As outras sessões foram encerradas.');}
    catch(e){setNotice(message(e));}finally{setBusy(false);}
  }
  return <Page title="Segurança." subtitle="Proteja sua conta e controle seus acessos.">
    <Link href="/settings" style={s.chipText}>← Configurações</Link>
    <Card><Copy>Ao trocar a senha, todos os acessos anteriores serão encerrados. Você continuará conectado aqui com uma nova sessão.</Copy>
      <Field label="Senha atual" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" maxLength={128} autoComplete="current-password" editable={!busy} />
      <Field label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} autoComplete="new-password" editable={!busy} />
      <Field label="Confirmar nova senha" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" maxLength={128} editable={!busy} />
      <Notice>{notice}</Notice><Button title={busy?'Alterando...':'Alterar senha'} disabled={busy} onPress={()=>void save()} />
    </Card>
    <Link href="/sessions" style={s.chipText}>Ver minhas sessões →</Link>
  </Page>;
}
