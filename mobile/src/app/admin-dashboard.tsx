import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useSession } from '../lib/session';
import { useResource } from '../lib/resource';
import { labels, message, timestamp, type SessionRow, type Role } from '../lib/api';
import { Button, Card, Copy, Field, Heading, Loading, Notice, Page, useUI } from '../components/ui';
type Overview={totalUsers:number;newUsers7d:number;activeSessions:number;recentlyActive:number;workouts:number;diets:number;connections:number;roles:Partial<Record<Role,number>>};
type UserRow={id:string;name:string;email:string;role:Role;createdAt:string;lastLoginAt:string|null;activeSessions:number;source:string|null};
type AdminSession=SessionRow & {name:string;email:string;role:Role};
type EventRow={id:string;name:string;email:string;event:string;createdAt:string;actorName:string|null};
type Lists={users?:UserRow[];sessions?:AdminSession[];events?:EventRow[];nextOffset:number|null};
const eventLabels:Record<string,string>={signup:'Cadastro pelo aplicativo',account_created:'Conta criada pelo administrador',login:'Login',password_changed:'Senha alterada',session_revoked:'Sessão encerrada'};
export default function AdminDashboard(){
  const {s,colors}=useUI();const {user,loading,call}=useSession();const allowed=user?.role==='admin';
  const [tab,setTab]=useState<'users'|'sessions'|'events'>('users');const [offset,setOffset]=useState(0);
  const [query,setQuery]=useState('');const [search,setSearch]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  const summary=useResource<Overview>(allowed?'management/overview':null);
  const list=useResource<Lists>(allowed?`management/${tab}?offset=${offset}&q=${encodeURIComponent(search)}`:null);
  if(loading)return <Loading />;if(!allowed)return <Redirect href="/home" />;
  async function revoke(id:string){setBusy(true);setNotice('');try{await call(`management/sessions/${id}`,{method:'DELETE'});await list.reload();await summary.reload();setNotice('Sessão encerrada.');}catch(e){setNotice(message(e));}finally{setBusy(false);}}
  function confirm(id:string){if(Platform.OS==='web'){if(window.confirm('Encerrar o acesso deste usuário neste dispositivo?'))void revoke(id);}else Alert.alert('Encerrar sessão?','O usuário precisará entrar novamente nesse dispositivo.',[{text:'Cancelar',style:'cancel'},{text:'Encerrar',style:'destructive',onPress:()=>void revoke(id)}]);}
  const stats=summary.data;
  return <Page title="Gestão do aplicativo." subtitle="Uma visão dos cadastros, acessos e acompanhamento.">
    <Link href="/settings" style={s.chipText}>← Configurações</Link>
    <Button title="Atualizar indicadores" secondary disabled={summary.loading || list.loading} onPress={()=>{void summary.reload();void list.reload();}} />
    <Notice>{summary.error || list.error || notice}</Notice>{summary.loading && <Loading />}
    {stats && <><View style={s.row}>
      {[[stats.totalUsers,'contas cadastradas'],[stats.newUsers7d,'novas contas em 7 dias'],[stats.activeSessions,'sessões válidas'],[stats.recentlyActive,'usuários ativos nos últimos 15 min']].map(([value,label])=><View key={label} style={{flexGrow:1,flexBasis:140}}><Card><Text style={s.stat}>{value}</Text><Copy>{label}</Copy></Card></View>)}
    </View><Card><Heading>Acompanhamento</Heading><Copy>{stats.workouts} treinos · {stats.diets} dietas ativas · {stats.connections} vínculos</Copy>
      {(Object.keys(labels) as Role[]).map(role=><Copy key={role}>{labels[role]}: {stats.roles[role]??0}</Copy>)}
      <Copy>Sessões válidas podem estar inativas. A atividade é atualizada quando a API é utilizada, com intervalo de até um minuto.</Copy>
    </Card></>}
    <Card><Heading>Consultar</Heading><View style={s.row}>{([['users','Cadastros'],['sessions','Sessões'],['events','Atividade']] as const).map(([value,label])=><Button key={value} title={label} secondary={tab!==value} onPress={()=>{setTab(value);setOffset(0);setNotice('');}} />)}</View>
      <Field label="Buscar por nome ou e-mail" value={query} onChangeText={setQuery} maxLength={120} autoCapitalize="none" />
      <Button title="Buscar" secondary onPress={()=>{setSearch(query.trim());setOffset(0);}} />
      <Link href="/admin" style={s.chipText}>Cadastrar usuários →</Link>
    </Card>
    {list.loading && <Loading />}
    {list.data?.users?.map(person=><Card key={person.id}><Heading>{person.name}</Heading><Copy>{person.email} · {labels[person.role]}</Copy>
      <Copy>Cadastro: {timestamp(person.createdAt)}</Copy><Copy>Último login: {timestamp(person.lastLoginAt)}</Copy><Copy>{person.activeSessions} sessão(ões) válida(s)</Copy>
      <Copy>Origem: {person.source?eventLabels[person.source]:'Cadastro anterior ao histórico'}</Copy>
      {person.role==='student' && <View style={{gap:12}}><Link href={{pathname:'/training',params:{userId:person.id}}} style={s.chipText}>Passar treino para {person.name} →</Link>
        <Link href={{pathname:'/nutrition',params:{userId:person.id}}} style={s.chipText}>Passar dieta para {person.name} →</Link></View>}
    </Card>)}
    {list.data?.sessions?.map(session=><Card key={session.id}><Heading>{session.name}</Heading><Copy>{session.email} · {labels[session.role]}</Copy><Copy>{session.deviceLabel}</Copy>
      <Copy>Início: {timestamp(session.createdAt)}</Copy><Copy>Última atividade: {timestamp(session.lastSeenAt)}</Copy><Copy>Expira: {timestamp(session.expiresAt)}</Copy>
      {session.current?<Text style={{color:colors.green}}>Sua sessão atual</Text>:<Button title="Encerrar sessão do usuário" secondary disabled={busy} onPress={()=>confirm(session.id)} />}
    </Card>)}
    {list.data?.events?.map(event=><Card key={event.id}><Heading>{eventLabels[event.event]??event.event}</Heading><Copy>{event.name} · {event.email}</Copy><Copy>{timestamp(event.createdAt)}</Copy>{event.actorName && <Copy>Realizado por {event.actorName}</Copy>}</Card>)}
    {list.data && !list.data[tab]?.length && <Copy>Nenhum resultado encontrado.</Copy>}
    <View style={s.row}><Button title="Página anterior" secondary disabled={offset===0 || list.loading} onPress={()=>setOffset(Math.max(0,offset-25))} />
      <Button title="Próxima página" secondary disabled={list.data?.nextOffset==null || list.loading} onPress={()=>setOffset(list.data?.nextOffset??offset)} /></View>
  </Page>;
}
