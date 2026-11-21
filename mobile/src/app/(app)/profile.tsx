import { useState } from 'react';
import { Alert, Image, Platform, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Link } from 'expo-router';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/resource';
import { labels, message, type Role } from '../../lib/api';
import { Button, Card, Copy, Field, Heading, Loading, Notice, Page, useUI } from '../../components/ui';
type Professional = { id: string; name: string; role: Role; professionalCode: string };
export default function Profile() {
  const {s,colors}=useUI();
  const { user, call, signOut, refreshUser } = useSession();
  const profile=useResource<{user:{name:string};bio:string;avatar:string|null}>('account/profile');
  const [name,setName]=useState<string|null>(null); const [bio,setBio]=useState<string|null>(null);
  const [code, setCode] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const links = useResource<{ professionals: Professional[] }>(user?.role === 'student' ? 'app/connections' : null);
  async function saveProfile() {
    setBusy(true);setNotice('');
    try { await call('account/profile',{method:'PATCH',body:{name:name??profile.data?.user.name??user?.name,bio:bio??profile.data?.bio??''}});
      await refreshUser();await profile.reload();setName(null);setBio(null);setNotice('Perfil salvo.');
    } catch(e){setNotice(message(e));}finally{setBusy(false);}
  }
  async function choosePhoto() {
    if(busy)return;setBusy(true);setNotice('');
    try {
      const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:1});
      if(picked.canceled)return;
      const asset=picked.assets[0];const size=Math.min(asset.width,asset.height);
      const context=ImageManipulator.manipulate(asset.uri);
      context.crop({originX:Math.floor((asset.width-size)/2),originY:Math.floor((asset.height-size)/2),width:size,height:size}).resize({width:256,height:256});
      const rendered=await context.renderAsync();
      const result=await rendered.saveAsync({format:SaveFormat.JPEG,compress:0.6,base64:true});
      if(!result.base64 || result.base64.length>53332)throw new Error('Foto muito detalhada. Escolha outra imagem para o perfil.');
      await call('account/avatar',{method:'PUT',body:{base64:result.base64}});await profile.reload();setNotice('Foto atualizada.');
    }catch(e){setNotice(message(e));}finally{setBusy(false);}
  }
  async function removePhoto(){setBusy(true);setNotice('');try{await call('account/avatar',{method:'DELETE'});await profile.reload();setNotice('Foto removida.');}catch(e){setNotice(message(e));}finally{setBusy(false);}}
  async function connect() {
    if (busy) return; setBusy(true); setNotice('');
    try { await call('app/connections', { method: 'POST', body: { code: code.trim() } }); setCode(''); await links.reload(); setNotice('Profissional vinculado.'); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  async function disconnect(id: string) {
    if (busy) return; setBusy(true); setNotice('');
    try { await call(`app/connections/${id}`, { method: 'DELETE' }); await links.reload(); setNotice('Vínculo removido. O profissional não tem mais acesso aos seus dados.'); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  function confirmDisconnect(id: string) {
    const detail = 'O profissional perderá acesso aos seus dados. Os planos recebidos continuarão na sua conta.';
    if (Platform.OS === 'web') { if (window.confirm(detail)) void disconnect(id); }
    else Alert.alert('Remover vínculo?', detail, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover vínculo', style: 'destructive', onPress: () => void disconnect(id) }]);
  }
  async function logout() {
    setBusy(true); setNotice('');
    try { await signOut(); } catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  return <Page title="Seu perfil." subtitle="Sua identidade, suas preferências e seu acompanhamento.">
    <Card><View style={{alignItems:'center',gap:12}}>
      {profile.data?.avatar ? <Image source={{uri:profile.data.avatar}} accessibilityLabel="Foto de perfil" style={{width:104,height:104,borderRadius:52}} />
      : <View style={{width:104,height:104,borderRadius:52,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:36,color:colors.green,fontWeight:'800'}}>{user?.name.slice(0,1).toUpperCase()}</Text></View>}
      <Button title="Escolher foto de perfil" secondary disabled={busy} onPress={()=>void choosePhoto()} />
      {!!profile.data?.avatar && <Button title="Remover foto" secondary disabled={busy} onPress={()=>void removePhoto()} />}
    </View><Text style={s.chipText}>{labels[user?.role || 'student'].toUpperCase()}</Text><Heading>{user?.name}</Heading><Copy>{user?.email}</Copy>
      {!!user?.professionalCode && <><Heading>Seu código profissional</Heading><Text selectable style={{ fontSize: 17, fontWeight: '700', color: colors.green }}>{user.professionalCode}</Text>
        <Copy>Compartilhe com seus alunos. Eles precisam inserir esse código na própria conta para autorizar o vínculo.</Copy></>}
      {user?.role === 'admin' && <Link href="/admin" style={s.chipText}>Administrar usuários →</Link>}
    </Card>
    <Card><Heading>Editar perfil</Heading>
      <Field label="Nome do perfil" value={name??profile.data?.user.name??user?.name??''} onChangeText={setName} maxLength={120} editable={!busy} />
      <Field label="Sobre você" value={bio??profile.data?.bio??''} onChangeText={setBio} maxLength={300} multiline editable={!busy} placeholder="Conte um pouco da sua jornada." />
      <Button title="Salvar perfil" disabled={busy || profile.loading} onPress={()=>void saveProfile()} />
      <Notice>{profile.error}</Notice>
    </Card>
    <Card><Heading>Preferências e acesso</Heading><Link href="/settings" style={s.chipText}>Abrir configurações →</Link>
      <Link href="/security" style={s.chipText}>Segurança e senha →</Link><Link href="/sessions" style={s.chipText}>Minhas sessões →</Link></Card>
    {user?.role === 'admin' && <Card><Heading>Seu espaço de administrador</Heading>
      <Link href="/admin-dashboard" style={s.chipText}>Cadastros, sessões e indicadores →</Link>
      <Link href="/training" style={s.chipText}>Passar treino →</Link><Link href="/nutrition" style={s.chipText}>Passar dieta →</Link>
    </Card>}
    {user?.role === 'student' && <>
      <Card><Heading>Conecte seu acompanhamento</Heading>
        <Copy>Ao vincular um profissional, você permite que ele veja sua evolução e gerencie os planos da especialidade dele. Você pode remover o vínculo quando quiser.</Copy>
        <Field label="Código do personal ou nutricionista" value={code} onChangeText={setCode} maxLength={24} autoCapitalize="none" autoCorrect={false} editable={!busy} />
        <Button title="Vincular profissional" disabled={busy || code.trim().length !== 24} onPress={() => void connect()} />
      </Card>
      <Heading>Profissionais vinculados</Heading>{links.loading && <Loading />}<Notice>{links.error}</Notice>
      {!!links.error && <Button title="Tentar novamente" secondary onPress={() => void links.reload()} />}
      {links.data?.professionals.length === 0 && <Copy>Você ainda não vinculou nenhum profissional. Você também pode criar seus próprios planos.</Copy>}
      {links.data?.professionals.map(pro => <Card key={pro.id}><Heading>{pro.name}</Heading><Copy>{labels[pro.role]}</Copy>
        <Button title="Remover vínculo" secondary disabled={busy} onPress={() => confirmDisconnect(pro.id)} /></Card>)}
    </>}
    <Notice>{notice}</Notice><Button title={busy ? 'Aguarde...' : 'Sair da conta'} secondary disabled={busy} onPress={() => void logout()} />
    <Copy>Nutraining · versão 1.2.0</Copy>
  </Page>;
}
