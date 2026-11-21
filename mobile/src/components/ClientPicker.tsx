import { ScrollView, View } from 'react-native';
import { Button, Copy, Heading } from './ui';
export type Client = { id: string; name: string; email: string };
export default function ClientPicker({ clients, selected, onSelect }: { clients: Client[]; selected?: string; onSelect: (id: string) => void }) {
  return <View style={{ gap: 12 }}><Heading>Seus alunos</Heading>
    <Copy>Selecione quem você vai acompanhar.</Copy>
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
      {clients.map(client => <Button key={client.id} title={client.name} secondary={selected !== client.id} onPress={() => onSelect(client.id)} />)}
    </ScrollView>
  </View>;
}
