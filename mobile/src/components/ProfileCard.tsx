import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { labels, message } from '../lib/api';
import { useSession } from '../lib/session';
import { useResource } from '../lib/resource';
import { Button, Card, Copy, Field, Heading, Loading, Notice, confirmAction, useTheme } from './ui';

async function selectPhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  try {
    const side = Math.min(asset.width, asset.height);
    if (side > 0) context.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
    context.resize({ width: 256, height: 256 });
    const photo = await context.renderAsync();
    try {
      const output = await photo.saveAsync({ base64: true, compress: 0.72, format: SaveFormat.JPEG });
      if (!output.base64) throw new Error('Não foi possível preparar a foto. Escolha outra imagem.');
      return output.base64;
    } finally { photo.release(); }
  } finally { context.release(); }
}

export default function ProfileCard() {
  const { user, call, updateProfile } = useSession();
  const { colors, s } = useTheme();
  const avatar = useResource<{ photo: string | null }>('auth/me/photo');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  if (!user) return null;
  const parts = user.name.trim().split(/\s+/);
  const initials = [parts[0], ...(parts.length > 1 ? [parts[parts.length - 1]] : [])].map(word => [...word][0]).join('').toLocaleUpperCase('pt-BR');
  async function changePhoto(remove = false) {
    setBusy(true); setNotice('');
    try {
      if (remove) await call('auth/me/photo', { method: 'DELETE' });
      else {
        const image = await selectPhoto();
        if (!image) return;
        await call('auth/me/photo', { method: 'PUT', body: { image } });
      }
      await avatar.reload(); setNotice(remove ? 'Foto removida.' : 'Foto atualizada.');
    } catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  async function saveName() {
    setBusy(true); setNotice('');
    try { await updateProfile({ name: name.trim() }); setEditing(false); setNotice('Nome atualizado.'); }
    catch (failure) { setNotice(message(failure)); } finally { setBusy(false); }
  }
  return <Card accent>
    <View style={s.spread}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center', borderColor: colors.green, borderWidth: 1, overflow: 'hidden' }}>
        {avatar.data?.photo ? <Image accessibilityLabel="Sua foto de perfil" source={{ uri: avatar.data.photo }} style={{ width: 76, height: 76 }} /> :
          <Text style={[s.stat, { color: colors.green, fontSize: 27 }]}>{initials}</Text>}
      </View>
      <View style={{ flex: 1, gap: 3 }}><Text style={s.chipText}>{labels[user.role]}</Text><Heading>{user.name}</Heading><Copy>{user.email}</Copy></View>
    </View>
    {!!user.createdAt && <Copy>Na Nutraining desde {new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Copy>}
    {avatar.loading && <Loading />}<Notice>{avatar.error || notice}</Notice>
    {!!avatar.error && <Button title="Recarregar foto" secondary onPress={() => void avatar.reload()} />}
    <View style={s.row}>
      <Button title={avatar.data?.photo ? 'Trocar foto' : 'Adicionar foto'} icon="image" secondary disabled={busy} onPress={() => void changePhoto()} />
      <Button title="Editar nome" icon="edit-2" secondary disabled={busy} onPress={() => { setName(user.name); setEditing(true); setNotice(''); }} />
      {!!avatar.data?.photo && <Button title="Remover foto" secondary disabled={busy} onPress={() => confirmAction('Remover foto?', 'Suas iniciais voltarão a aparecer no perfil.', 'Remover', () => void changePhoto(true))} />}
    </View>
    {editing && <View style={s.divider}><Field label="Nome no perfil" value={name} onChangeText={setName} maxLength={120} editable={!busy} autoCapitalize="words" />
      <Button title="Salvar nome" disabled={busy || name.trim().length < 2} onPress={() => void saveName()} />
      <Button title="Cancelar" secondary disabled={busy} onPress={() => setEditing(false)} /></View>}
  </Card>;
}
