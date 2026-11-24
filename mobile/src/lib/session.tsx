import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { ApiError, message, request, type ProfessionalRole, type User, type ThemeMode } from './api';
const KEY = 'nutraining.session.v1';
const IDLE_MS = 15 * 60 * 1000;
const SYNC_MS = 15 * 1000;
const idleMessage = 'Sessão encerrada após 15 minutos sem atividade. Entre novamente.';
const expiredMessage = 'Sua sessão terminou. Entre novamente.';
type ActiveSession = { token: string; lastActivityAt: number; lastServerRequestAt: number };
const saveToken = async (token: string) => {
  if (Platform.OS === 'web') {
    if (token) window.sessionStorage.setItem(KEY, token);
    else window.sessionStorage.removeItem(KEY);
  } else {
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  }
};
function deviceLabel() {
  if (Platform.OS !== 'web') {
    const os = Platform.OS === 'ios' ? 'iOS' : 'Android';
    return Device.modelName ? `${Device.modelName} · ${os}` : os;
  }
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Navegador';
  return [browser, Device.osName].filter(Boolean).join(' · ');
}
type Session = {
  user: User | null; token: string; loading: boolean; error: string; signedOutNotice: string; trackActivity: () => void;
  reload: () => void; signIn: (email: string, password: string) => Promise<void>;
  registerProfessional: (input: { name: string; email: string; password: string; role: ProfessionalRole }) => Promise<void>;
  updateProfile: (changes: { name?: string; theme?: ThemeMode }) => Promise<void>;
  signOut: () => Promise<void>; call: (path: string, options?: { method?: string; body?: Record<string, unknown> }) => Promise<any>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signedOutNotice, setSignedOutNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const current = useRef<ActiveSession | null>(null);
  const storageWrite = useRef(Promise.resolve());

  const persist = useCallback((nextToken: string) => {
    const write = storageWrite.current.catch(() => {}).then(() => saveToken(nextToken));
    storageWrite.current = write;
    return write;
  }, []);

  const activate = useCallback((nextToken: string, nextUser: User) => {
    const now = Date.now();
    current.current = { token: nextToken, lastActivityAt: now, lastServerRequestAt: now };
    setSignedOutNotice('');
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const endSession = useCallback((session: ActiveSession, notice = '') => {
    if (current.current !== session) return;
    current.current = null;
    setUser(null);
    setToken('');
    setSignedOutNotice(notice);
    void persist('').catch(() => {});
  }, [persist]);

  useEffect(() => {
    let mounted = true;
    async function restore() {
      try {
        const saved = Platform.OS === 'web' ? window.sessionStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
        if (!saved) return;
        const data = await request('auth/me', { token: saved });
        if (mounted) activate(saved, data.user);
      } catch (failure) {
        if (!mounted) return;
        if (failure instanceof ApiError && failure.status === 401) {
          setSignedOutNotice(expiredMessage);
          void persist('').catch(() => {});
        } else {
          setError(message(failure));
        }
      } finally { if (mounted) setLoading(false); }
    }
    void restore();
    return () => { mounted = false; };
  }, [activate, attempt, persist]);

  const trackActivity = useCallback(() => {
    const session = current.current;
    if (!session) return;
    const now = Date.now();
    if (now - session.lastActivityAt >= IDLE_MS) {
      endSession(session, idleMessage);
      return;
    }
    session.lastActivityAt = now;
    // Only actual interactions send a keep-alive, and frequent events share one request.
    if (now - session.lastServerRequestAt >= SYNC_MS) {
      session.lastServerRequestAt = now;
      void request('auth/activity', { token: session.token, method: 'POST' }).catch(failure => {
        if (failure instanceof ApiError && failure.status === 401) endSession(session, expiredMessage);
      });
    }
  }, [endSession]);

  useEffect(() => {
    const session = current.current;
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiration = () => {
      clearTimeout(timer);
      if (current.current !== session) return;
      const remaining = session.lastActivityAt + IDLE_MS - Date.now();
      if (remaining <= 0) endSession(session, idleMessage);
      else timer = setTimeout(checkExpiration, remaining);
    };
    checkExpiration();
    if (Platform.OS === 'web') {
      const events = ['pointerdown', 'keydown', 'wheel'] as const;
      for (const event of events) document.addEventListener(event, trackActivity, { capture: true, passive: true });
      document.addEventListener('visibilitychange', checkExpiration);
      return () => {
        clearTimeout(timer);
        for (const event of events) document.removeEventListener(event, trackActivity, true);
        document.removeEventListener('visibilitychange', checkExpiration);
      };
    }
    const subscription = AppState.addEventListener('change', checkExpiration);
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [endSession, token, trackActivity]);

  const call = useCallback(async (path: string, options = {}) => {
    const session = current.current;
    if (!session || session.token !== token) throw new ApiError(expiredMessage, 401);
    const now = Date.now();
    if (now - session.lastActivityAt >= IDLE_MS) {
      endSession(session, idleMessage);
      throw new ApiError(idleMessage, 401);
    }
    session.lastActivityAt = now;
    session.lastServerRequestAt = now;
    try { return await request(path, { ...options, token }); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) endSession(session, expiredMessage);
      throw failure;
    }
  }, [endSession, token]);
  async function startSession(path: 'auth/login' | 'auth/register', body: Record<string, unknown>) {
    const data = await request(path, {
      method: 'POST', body: { ...body, deviceLabel: deviceLabel() },
    });
    await persist(data.token);
    activate(data.token, data.user);
  }
  async function updateProfile(changes: { name?: string; theme?: ThemeMode }) {
    const result = await call('auth/me', { method: 'PATCH', body: changes });
    setUser(current => current?.id === result.user.id ? result.user : current);
  }
  async function signOut() {
    const session = current.current;
    if (!session) return;
    try { await call('auth/logout', { method: 'POST' }); }
    catch (failure) { if (!(failure instanceof ApiError && failure.status === 401)) throw failure; }
    endSession(session);
  }
  return <Context.Provider value={{ user, token, loading, error, signedOutNotice, trackActivity,
    reload: () => { setLoading(true); setError(''); setAttempt(v => v + 1); },
    signIn: (email, password) => startSession('auth/login', { email, password }),
    registerProfessional: input => startSession('auth/register', input),
    signOut, updateProfile, call }}>{children}</Context.Provider>;
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error('Sessão não inicializada.');
  return context;
}
