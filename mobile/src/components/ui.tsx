import { type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
export const colors = { ink: '#193d31', muted: '#62756a', green: '#285b43', paper: '#f5f7f0', line: '#dce5d6', orange: '#e9a35b' };
export function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
      <View style={s.container}><Text style={s.brand}>nutraining.</Text>
        <Text style={s.title}>{title}</Text>{!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
        {children}<Text style={s.footer}>Seu ritmo. Sua jornada.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
export function Card({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <View style={[s.card, dark && { backgroundColor: colors.ink }]}>{children}</View>;
}
export function Heading({ children }: { children: ReactNode }) { return <Text style={s.heading}>{children}</Text>; }
export function Copy({ children }: { children: ReactNode }) { return <Text style={s.copy}>{children}</Text>; }
export function Notice({ children }: { children?: ReactNode }) { return children ? <Text accessibilityRole="alert" style={s.notice}>{children}</Text> : null; }
export function Button({ title, onPress, disabled, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={disabled}
    style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled) && { opacity: 0.55 }]}>
    <Text style={[s.buttonText, secondary && { color: colors.green }]}>{title}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label}
    placeholderTextColor="#819085" {...props} style={[s.input, props.multiline && { minHeight: 90 }, props.style]} /></View>;
}
export function Empty({ title, detail }: { title: string; detail: string }) { return <Card><Heading>{title}</Heading><Copy>{detail}</Copy></Card>; }
export function Loading() { return <ActivityIndicator color={colors.green} style={{ margin: 24 }} />; }
export const s = StyleSheet.create({
  page: { padding: 22, paddingTop: 26, paddingBottom: 36, flexGrow: 1 },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 18 },
  brand: { fontSize: 27, fontWeight: '900', letterSpacing: -1.2, color: colors.green },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.7, color: colors.ink },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: -8 },
  card: { backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 20, padding: 20, gap: 14 },
  heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: '#fafcf7', padding: 13, minHeight: 50, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  button: { backgroundColor: colors.green, borderRadius: 12, minHeight: 50, padding: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondary: { backgroundColor: '#edf3e7', borderWidth: 1, borderColor: colors.line },
  notice: { color: '#754526', backgroundColor: '#fff0df', padding: 14, borderRadius: 12, lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  stat: { fontSize: 34, fontWeight: '800', color: colors.ink },
  chip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#edf3e7', alignSelf: 'flex-start' },
  chipText: { color: colors.green, fontSize: 12, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 10 },
});
