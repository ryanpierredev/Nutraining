import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useSession } from '../lib/session';
import { useResource } from '../lib/resource';
import { message, timestamp } from '../lib/api';
import { Button, Card, Copy, Heading, Loading, Notice, Page, useUI } from '../components/ui';
import { type SessionRow } from '../lib/api';
export default function Sessions(){
  const {s}=useUI();const {user,loading,call}=useSession();const resource=useResource<{sessions:SessionRow[]}>(user?'account/sessions':null);
  const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
  if(loading)return <Loading />;if(!user)return <Redirect href="/" />;
  async function revoke(id:string){setBusy(true);setNotice('');try{await call(`account/sessions/${id}`,{method:'DELETE'});await resource.reload();setNotice('Acesso encerrado.');}catch(e){setNotice(message(e));}finally{setBusy(false);}}
  function confirm(id:string){const text=id==='others'?'Encerrar todos os outros acessos?':'Encerrar o acesso neste dispositivo?';if(Platform.OS==='web'){if(window.confirm(text))void revoke(id);}else Alert.alert('Encerrar sessão?',text,[{text:'Cancelar',style:'cancel'},{text:'Encerrar',style:'destructive',onPress:()=>void revoke(id)}]);}
  return <Page title="Suas sessões." subtitle="Veja onde sua conta está conectada.">
    <Link href="/settings" style={s.chipText}>← Configurações</Link>
    <Copy>São sessões ainda válidas, não necessariamente dispositivos online neste instante. O nome do dispositivo é informado pelo aplicativo.</Copy>
    <Button title="Encerrar outras sessões" secondary disabled={busy || !resource.data?.sessions.some(v=>!v.current)} onPress={()=>confirm('others')} />
    <Notice>{notice || resource.error}</Notice><Button title="Atualizar sessões" secondary disabled={busy || resource.loading} onPress={()=>void resource.reload()} />
    {resource.loading && <Loading />}
    {resource.data?.sessions.map(session=><Card key={session.id}><Heading>{session.deviceLabel}</Heading>{session.current && <Copy>✓ Esta sessão</Copy>}
      <Copy>Início: {timestamp(session.createdAt)}</Copy><Copy>Última atividade: {timestamp(session.lastSeenAt)}</Copy><Copy>Expira: {timestamp(session.expiresAt)}</Copy>
      {!session.current && <Button title="Encerrar este acesso" secondary disabled={busy} onPress={()=>confirm(session.id)} />}
    </Card>)}
  </Page>;
}
