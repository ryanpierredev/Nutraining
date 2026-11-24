import { useState, type ComponentProps, type ReactNode } from 'react';
import { useIsFocused } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSession } from '../lib/session';

export type IconName = ComponentProps<typeof Feather>['name'];
const dark = {
  paper: '#101715', surface: '#1a2420', raised: '#23302a', line: '#34433a',
  ink: '#f3f6ed', muted: '#adbcb2', green: '#b6e98b', onGreen: '#182717',
  tint: '#293d2b', field: '#131c18', warm: '#f3be86', warmTint: '#3b2f23', hero: '#253b2d',
};
const light: typeof dark = {
  paper: '#f4f6ef', surface: '#ffffff', raised: '#edf1e8', line: '#d5dfd0',
  ink: '#182b21', muted: '#526659', green: '#285c36', onGreen: '#ffffff',
  tint: '#e5f0df', field: '#f8faf5', warm: '#865024', warmTint: '#f9ecd9', hero: '#e2efd8',
};

function styles(c: typeof dark) {
  return StyleSheet.create({
    page: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36, flexGrow: 1 },
    container: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16 },
    masthead: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line },
    mark: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: c.green },
    brand: { fontSize: 21, fontWeight: '800', letterSpacing: -1, color: c.ink },
    title: { fontSize: 34, fontWeight: '800', letterSpacing: -1.3, color: c.ink },
    subtitle: { color: c.muted, fontSize: 14, lineHeight: 21, marginTop: 4 },
    card: { backgroundColor: c.surface, borderColor: c.line, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 18, gap: 13 },
    heading: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4, color: c.ink },
    copy: { color: c.muted, fontSize: 14, lineHeight: 21 },
    label: { fontSize: 14, fontWeight: '600', color: c.ink },
    input: { borderWidth: 1, borderColor: c.line, borderRadius: 11, backgroundColor: c.field, padding: 12, minHeight: 46, fontSize: 16, color: c.ink },
    button: { flexDirection: 'row', gap: 8, backgroundColor: c.green, borderRadius: 12, minHeight: 46, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: c.onGreen, fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
    secondary: { backgroundColor: c.raised, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line },
    notice: { color: c.warm, backgroundColor: c.warmTint, padding: 12, borderRadius: 10, lineHeight: 21 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
    spread: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingTop: 14, gap: 8 },
    stat: { fontSize: 34, fontWeight: '800', letterSpacing: -1.4, fontVariant: ['tabular-nums'], color: c.ink },
    chip: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: c.tint, alignSelf: 'flex-start' },
    chipText: { color: c.green, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
    iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: c.tint },
  });
}
const themes = { dark: { colors: dark, s: styles(dark) }, light: { colors: light, s: styles(light) } };
export function useTheme() {
  const mode = useSession().user?.theme === 'light' ? 'light' : 'dark';
  return { mode, ...themes[mode] } as const;
}
export function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { s, colors } = useTheme();
  const focused = useIsFocused();
  return <KeyboardAvoidingView aria-hidden={!focused} style={{ flex: 1, backgroundColor: colors.paper, display: Platform.OS === 'web' && !focused ? 'none' : 'flex' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
      <View style={s.container}>
        <View style={s.masthead}><View style={s.mark}><Feather name="activity" size={18} color={colors.onGreen} /></View><Text style={s.brand}>nutraining.</Text></View>
        <View><Text accessibilityRole="header" style={s.title}>{title}</Text>{!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}</View>
        {children}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
export function Card({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  const { s, colors } = useTheme();
  return <View style={[s.card, accent && { backgroundColor: colors.hero }]}>{children}</View>;
}
export function Heading({ children }: { children: ReactNode }) { return <Text accessibilityRole="header" style={useTheme().s.heading}>{children}</Text>; }
export function Copy({ children }: { children: ReactNode }) { return <Text style={useTheme().s.copy}>{children}</Text>; }
export function Notice({ children }: { children?: ReactNode }) {
  const { s } = useTheme();
  return children ? <Text accessibilityRole="alert" style={s.notice}>{children}</Text> : null;
}
export function Button({ title, icon, onPress, disabled, secondary = false }: { title: string; icon?: IconName; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const { s, colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} onPress={onPress} disabled={disabled}
    style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled) && { opacity: 0.55 }]}>
    {icon && <Feather name={icon} size={17} color={secondary ? colors.green : colors.onGreen} />}
    <Text style={[s.buttonText, secondary && { color: colors.green }]}>{title}</Text>
  </Pressable>;
}
export function Choice({ title, selected, onPress, disabled }: { title: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const { s, colors } = useTheme();
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 42, justifyContent: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 13,
      backgroundColor: selected ? colors.tint : colors.surface, borderColor: selected ? colors.green : colors.line, opacity: pressed || disabled ? 0.65 : 1 })}>
    <Text style={[s.label, { color: selected ? colors.green : colors.muted }]}>{title}</Text>
  </Pressable>;
}
export function ActionRow({ icon, title, detail, onPress }: { icon: IconName; title: string; detail?: string; onPress: () => void }) {
  const { s, colors } = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [s.spread, { minHeight: 48, opacity: pressed ? 0.65 : 1 }]}>
    <View style={s.iconBox}><Feather name={icon} size={20} color={colors.green} /></View>
    <View style={{ flex: 1, gap: 3 }}><Text style={s.label}>{title}</Text>{!!detail && <Text style={s.copy}>{detail}</Text>}</View>
    <Feather name="chevron-right" size={18} color={colors.muted} />
  </Pressable>;
}
type FieldProps = TextInputProps & { label: string };
export function Field({ label, ...props }: FieldProps) {
  const { s, colors, mode } = useTheme();
  const { trackActivity } = useSession();
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} keyboardAppearance={mode} selectionColor={colors.green}
    placeholderTextColor={colors.muted} {...props} onChangeText={value => { trackActivity(); props.onChangeText?.(value); }} style={[s.input, props.multiline && { minHeight: 82, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function PasswordField({ style, ...props }: Omit<FieldProps, 'secureTextEntry' | 'multiline'>) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Ocultar senha' : 'Mostrar senha';
  return <View>
    <Field autoCapitalize="none" autoCorrect={false} {...props} secureTextEntry={!visible} style={[style, { paddingRight: 54 }]} />
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={() => setVisible(value => !value)}
      style={({ pressed }) => ({ position: 'absolute', right: 2, bottom: 1, width: 46, height: 44,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}>
      <Feather name={visible ? 'eye-off' : 'eye'} size={20} color={colors.green} />
    </Pressable>
  </View>;
}
export function Empty({ title, detail }: { title: string; detail: string }) { return <Card><Heading>{title}</Heading><Copy>{detail}</Copy></Card>; }
export function Loading() { return <ActivityIndicator accessibilityLabel="Carregando" color={useTheme().colors.green} style={{ margin: 20 }} />; }
export function confirmAction(title: string, detail: string, action: string, accept: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(title + '\n' + detail)) accept(); }
  else Alert.alert(title, detail, [{ text: 'Cancelar', style: 'cancel' }, { text: action, style: 'destructive', onPress: accept }]);
}
