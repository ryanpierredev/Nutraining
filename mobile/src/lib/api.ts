export type Role = 'student' | 'trainer' | 'nutritionist' | 'admin';
export type ThemeMode = 'dark' | 'light';
export type User = { id: string; name: string; email: string; role: Role; professionalCode: string | null; theme: ThemeMode; createdAt: string };
export const labels: Record<Role, string> = { student: 'Aluno', trainer: 'Personal', nutritionist: 'Nutricionista', admin: 'Administrador' };
export const API = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export type RequestOptions = { method?: string; body?: Record<string, unknown>; token?: string };
export async function request(path: string, options: RequestOptions = {}): Promise<any> {
  if (!API.startsWith('https://') && !(__DEV__ && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API))) {
    throw new Error('O endereço da API não está configurado neste aplicativo. Instale a versão atualizada.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API}/v1/${path}`, {
      method: options.method || 'GET', signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; }
    catch { throw new Error('O serviço retornou uma resposta inesperada. Tente novamente.'); }
    if (!response.ok) throw new ApiError(data?.error || 'Não foi possível concluir a solicitação.', response.status);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error('Não foi possível acessar o serviço. Verifique sua conexão e tente novamente.');
    }
    throw error;
  } finally { clearTimeout(timeout); }
}
export function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir.'; }
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dateLabel(day: string) { return day.split('-').reverse().join('/'); }

export function timestamp(value: string) {
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function measure(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
