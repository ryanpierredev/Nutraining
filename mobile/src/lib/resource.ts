import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { message } from './api';
import { useSession } from './session';
export function useResource<T>(path: string | null) {
  const { call } = useSession();
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!path);
  const sequence = useRef(0);
  const load = useCallback(async (clear = false) => {
    const current = ++sequence.current;
    if (!path) { setData(undefined); setLoading(false); return; }
    if (clear) setData(undefined);
    setLoading(true); setError('');
    try {
      const result = await call(path);
      if (current === sequence.current) setData(result);
    } catch (failure) { if (current === sequence.current) setError(message(failure)); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [call, path]);
  useFocusEffect(useCallback(() => {
    void load(true);
    return () => { sequence.current++; };
  }, [load]));
  return { data, loading, error, reload: () => load(false) };
}
