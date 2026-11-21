import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';

import AdminPanel from './AdminPanel';

type Role = 'student' | 'trainer' | 'nutritionist' | 'admin';

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  professionalCode: string | null;
};

const roles: Role[] = ['student', 'trainer', 'nutritionist'];

const labels: Record<Role, string> = {
  admin: 'Administrador',
  student: 'Aluno',
  trainer: 'Personal',
  nutritionist: 'Nutricionista',
};

const API = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
const SESSION_KEY = 'nutraining.session.v1';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function validUser(value: any): value is User {
  return (
    value &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    [...roles, 'admin'].includes(value.role)
  );
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}

async function request(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    token?: string;
    admin?: boolean;
  } = {},
): Promise<any> {
  if (!API.startsWith('https://')) {
    throw new Error('Endereço HTTPS da API não configurado.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API}/v1/${options.admin ? 'admin' : 'auth'}/${path}`, {
      method: options.method || 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token
          ? { Authorization: `Bearer ${options.token}` }
          : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let data: any = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Resposta inesperada do serviço.');
      }
    }

    if (!response.ok) {
      throw new ApiError(
        typeof data?.error === 'string'
          ? data.error
          : 'Não foi possível concluir a solicitação.',
        response.status,
      );
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}


type SessionResult = {
  token: string;
  user: User | null;
  expired: boolean;
};

async function readStoredSession(): Promise<SessionResult> {
  const saved = await SecureStore.getItemAsync(SESSION_KEY);

  if (!saved) {
    return { token: '', user: null, expired: false };
  }

  try {
    const data = await request('me', { token: saved });

    if (!validUser(data?.user)) {
      throw new Error('Perfil inválido.');
    }

    return { token: saved, user: data.user, expired: false };
  } catch (failure) {
    if (failure instanceof ApiError && failure.status === 401) {
      await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
      return { token: '', user: null, expired: true };
    }

    throw failure;
  }
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [error, setError] = useState('');
  const [restoreError, setRestoreError] = useState('');

  function retrySession() {
    setLoading(true);
    setRestoreError('');
    setError('');

    void readStoredSession()
      .then((session) => {
        setToken(session.token);
        setUser(session.user);
        if (session.expired) {
          setError('Sua sessão expirou. Entre novamente.');
        }
      })
      .catch((failure) => {
        setRestoreError(errorMessage(failure));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    let active = true;

    void readStoredSession()
      .then((session) => {
        if (!active) return;

        setToken(session.token);
        setUser(session.user);

        if (session.expired) {
          setError('Sua sessão expirou. Entre novamente.');
        }
      })
      .catch((failure) => {
        if (active) {
          setRestoreError(errorMessage(failure));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    if (busy) return;

    setError('');

    if (!email.trim() || !password) {
      setError('Informe seu e-mail e sua senha.');
      return;
    }

    if (signup && (name.trim().length < 2 || password.length < 12)) {
      setError('Informe seu nome e uma senha com pelo menos 12 caracteres.');
      return;
    }

    setBusy(true);

    try {
      const body = signup
        ? { name: name.trim(), email: email.trim(), password, role }
        : { email: email.trim(), password };

      const data = await request(signup ? 'register' : 'login', {
        method: 'POST',
        body,
      });

      if (typeof data?.token !== 'string' || !validUser(data?.user)) {
        throw new Error('Resposta de autenticação inválida.');
      }

      await SecureStore.setItemAsync(SESSION_KEY, data.token);

      setToken(data.token);
      setUser(data.user);
      setPassword('');
      Keyboard.dismiss();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      try {
        await request('logout', { method: 'POST', token });
      } catch (failure) {
        if (!(failure instanceof ApiError && failure.status === 401)) {
          throw failure;
        }
      }

      await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
      setUser(null);
      setToken('');
      setName('');
      setEmail('');
      setPassword('');
      setRole('student');
      setSignup(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#28513e" />
            <Text style={styles.subtitle}>Abrindo seu espaço...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              <View style={styles.container}>
                <Text style={styles.brand}>nutraining.</Text>
                <Text style={styles.tagline}>
                  Treino, nutrição e acompanhamento.
                </Text>

                <View style={styles.card}>
                  {restoreError ? (
                    <>
                      <Text style={styles.title}>
                        Vamos tentar novamente?
                      </Text>
                      <Text style={styles.subtitle}>{restoreError}</Text>
                      <Pressable
                        accessibilityRole="button"
                        style={styles.button}
                        onPress={() => void retrySession()}
                      >
                        <Text style={styles.buttonText}>Tentar novamente</Text>
                      </Pressable>
                    </>
                  ) : user ? (
                    <>
                      <Text style={styles.eyebrow}>SEU ESPAÇO</Text>
                      <Text style={styles.title}>
                        Olá, {user.name.split(' ')[0]}.
                      </Text>
                      <Text style={styles.subtitle}>
                        Cuidado e acompanhamento no seu ritmo.
                      </Text>

                      <View style={styles.profile}>
                        <Text style={styles.label}>Nome</Text>
                        <Text style={styles.value}>{user.name}</Text>

                        <Text style={styles.label}>E-mail</Text>
                        <Text style={styles.value}>{user.email}</Text>

                        <Text style={styles.label}>Perfil</Text>
                        <Text style={styles.value}>{labels[user.role]}</Text>

                        {user.professionalCode && (
                          <>
                            <Text style={styles.label}>
                              Código de profissional
                            </Text>
                            <Text selectable style={styles.code}>
                              {user.professionalCode}
                            </Text>
                          </>
                        )}
                      </View>

                      {user.role === 'admin' && <AdminPanel token={token} request={request} />}

                      {!!error && (
                        <Text accessibilityRole="alert" style={styles.error}>
                          {error}
                        </Text>
                      )}

                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        style={[styles.button, busy && styles.disabled]}
                        onPress={() => void logout()}
                      >
                        <Text style={styles.buttonText}>
                          {busy ? 'Aguarde...' : 'Sair da conta'}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.eyebrow}>BEM-VINDO AO NUTRAINING</Text>
                      <Text style={styles.title}>
                        {signup ? 'Comece sua jornada.' : 'Seu próximo passo.'}
                      </Text>
                      <Text style={styles.subtitle}>
                        {signup
                          ? 'Crie sua conta para começar.'
                          : 'Entre para acessar seu espaço.'}
                      </Text>

                      {signup && (
                        <>
                          <Text style={styles.label}>Nome</Text>
                          <TextInput
                            accessibilityLabel="Nome"
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Como você se chama?"
                            placeholderTextColor="#7c897e"
                            autoCapitalize="words"
                            maxLength={120}
                            editable={!busy}
                          />
                        </>
                      )}

                      <Text style={styles.label}>E-mail</Text>
                      <TextInput
                        accessibilityLabel="E-mail"
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Seu e-mail"
                        placeholderTextColor="#7c897e"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        maxLength={254}
                        editable={!busy}
                      />

                      <Text style={styles.label}>
                        {signup ? 'Senha — mínimo de 12 caracteres' : 'Senha'}
                      </Text>
                      <TextInput
                        accessibilityLabel="Senha"
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Sua senha"
                        placeholderTextColor="#7c897e"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete={signup ? 'new-password' : 'current-password'}
                        maxLength={128}
                        editable={!busy}
                        onSubmitEditing={() => void submit()}
                      />

                      {signup && (
                        <>
                          <Text style={styles.label}>Seu perfil</Text>
                          <View style={styles.roles}>
                            {roles.map((item) => (
                              <Pressable
                                key={item}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: role === item }}
                                disabled={busy}
                                onPress={() => setRole(item)}
                                style={[
                                  styles.roleButton,
                                  role === item && styles.roleSelected,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.roleText,
                                    role === item && styles.roleTextSelected,
                                  ]}
                                >
                                  {labels[item]}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </>
                      )}

                      {!!error && (
                        <Text accessibilityRole="alert" style={styles.error}>
                          {error}
                        </Text>
                      )}

                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        style={[styles.button, busy && styles.disabled]}
                        onPress={() => void submit()}
                      >
                        <Text style={styles.buttonText}>
                          {busy ? 'Aguarde...' : signup ? 'Criar conta' : 'Entrar'}
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        style={styles.linkButton}
                        onPress={() => {
                          setSignup(!signup);
                          setError('');
                        }}
                      >
                        <Text style={styles.linkText}>
                          {signup
                            ? 'Já tenho uma conta'
                            : 'Ainda não tenho conta'}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>

                <Text style={styles.footer}>Seu ritmo. Sua jornada.</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#f4f7ef' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  container: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { fontSize: 34, fontWeight: '800', color: '#28513e', letterSpacing: -1.5 },
  tagline: { color: '#5f7063', fontSize: 14, marginTop: 8, marginBottom: 28 },
  card: {
    padding: 22,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dfe7d7',
  },
  eyebrow: { color: '#58744b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#263e30', fontSize: 26, fontWeight: '700', marginTop: 10 },
  subtitle: { color: '#5f7063', fontSize: 14, lineHeight: 22, marginTop: 10 },
  label: { color: '#496047', fontSize: 13, fontWeight: '600', marginTop: 20 },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd7c3',
    backgroundColor: '#fbfcf8',
    color: '#263e30',
    fontSize: 16,
  },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  roleButton: {
    flexGrow: 1,
    flexBasis: 90,
    minHeight: 46,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd7c3',
  },
  roleSelected: { backgroundColor: '#eaf2df', borderColor: '#58744b' },
  roleText: { fontSize: 12, color: '#5f7063' },
  roleTextSelected: { color: '#28513e', fontWeight: '700' },
  button: {
    minHeight: 50,
    marginTop: 24,
    padding: 14,
    backgroundColor: '#28513e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  linkButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  linkText: { color: '#355f42', fontSize: 14, fontWeight: '600' },
  error: {
    marginTop: 16,
    padding: 12,
    color: '#9f3924',
    backgroundColor: '#fff1ec',
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 20,
  },
  profile: { marginTop: 8 },
  value: { color: '#263e30', fontSize: 16, marginTop: 6 },
  code: { color: '#28513e', fontSize: 14, marginTop: 8, lineHeight: 22 },
  footer: { color: '#5f7063', fontSize: 12, textAlign: 'center', marginTop: 24 },
});
