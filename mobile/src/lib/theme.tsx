import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
export type ThemeMode = 'system' | 'light' | 'dark';
const palettes = {
  light: { ink: '#193d31', muted: '#62756a', green: '#285b43', paper: '#f5f7f0', line: '#dce5d6', orange: '#e9a35b', card: '#ffffff', input: '#fafcf7', soft: '#edf3e7', button: '#285b43', notice: '#fff0df', noticeText: '#754526' },
  dark: { ink: '#e6f2e8', muted: '#aabfb1', green: '#a2d8b0', paper: '#101a16', line: '#344b3d', orange: '#edb879', card: '#1a2a21', input: '#142219', soft: '#253c2e', button: '#326a4a', notice: '#3b3021', noticeText: '#f3d4a9' },
};
type Theme = { mode: ThemeMode; dark: boolean; colors: typeof palettes.light; setMode: (mode: ThemeMode) => Promise<void> };
const Context = createContext<Theme | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode,setState] = useState<ThemeMode>('system');
  useEffect(() => { let active=true;
    void AsyncStorage.getItem('nutraining.theme').then(saved=> { if(active && ['system','light','dark'].includes(saved || '')) setState(saved as ThemeMode); }).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  const dark=mode==='dark' || (mode==='system' && system==='dark');
  async function setMode(value: ThemeMode) { await AsyncStorage.setItem('nutraining.theme',value); setState(value); }
  return <Context.Provider value={{ mode,dark,colors:dark?palettes.dark:palettes.light,setMode }}>{children}</Context.Provider>;
}
export function useTheme() { const theme=useContext(Context); if(!theme)throw new Error('Tema não inicializado.'); return theme; }
