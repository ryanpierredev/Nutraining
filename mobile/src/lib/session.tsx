import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ApiError, message, request, type User } from './api';
const KEY = 'nutraining.session.v1';
const saveToken = async (token: string) => {
  if (Platform.OS !== 'web') {
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  }
};
type Session = {
  user: User | null; token: string; loading: boolean; error: string;
  reload: () => void; signIn: (email: string, password: string, registration?: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>; call: (path: string, options?: { method?: string; body?: Record<string, unknown> }) => Promise<any>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const saved = Platform.OS === 'web' ? '' : await SecureStore.getItemAsync(KEY);
        if (!saved) return;
        const data = await request('auth/me', { token: saved });
        if (active) { setUser(data.user); setToken(saved); }
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 401) await saveToken('');
        else if (active) setError(message(failure));
      } finally { if (active) setLoading(false); }
    }
    void restore();
    return () => { active = false; };
  }, [attempt]);
  const call = useCallback(async (path: string, options = {}) => {
    try { return await request(path, { ...options, token }); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        await saveToken(''); setUser(null); setToken('');
      }
      throw failure;
    }
  }, [token]);
  async function signIn(email: string, password: string, registration?: Record<string, unknown>) {
    const data = await request(registration ? 'auth/register' : 'auth/login', {
      method: 'POST', body: { ...registration, email, password },
    });
    await saveToken(data.token);
    setToken(data.token); setUser(data.user);
  }
  async function signOut() {
    try { await call('auth/logout', { method: 'POST' }); }
    catch (failure) { if (!(failure instanceof ApiError && failure.status === 401)) throw failure; }
    await saveToken(''); setToken(''); setUser(null);
  }
  return <Context.Provider value={{ user, token, loading, error,
    reload: () => { setLoading(true); setError(''); setAttempt(v => v + 1); }, signIn, signOut, call }}>{children}</Context.Provider>;
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error('Sessão não inicializada.');
  return context;
}
