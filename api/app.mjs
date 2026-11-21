import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createRequireAuth } from './auth.mjs';

class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new InputError(message, status); };
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
function text(value, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || [...value.trim()].length > max || (required && value.trim().length < 2)) {
    fail('Preencha os campos de texto dentro do limite indicado.');
  }
  return value.trim();
}
function day(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    fail('Informe uma data válida (AAAA-MM-DD).');
  }
  return value;
}
function logDay(value) {
  const result = day(value);
  if (Date.parse(result) > Date.now() + 86400000) fail('Não é possível registrar uma atividade futura.');
  return result;
}
function kind(value) {
  if (!['workout', 'nutrition'].includes(value)) fail('Tipo de plano inválido.');
  return value;
}
function planItems(value, type) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) fail('Inclua de 1 a 30 itens.');
  return value.map(item => {
    if (!item || typeof item !== 'object') fail('Item inválido.');
    const name = text(item.name, 100, true);
    if (type === 'nutrition') {
      if (typeof item.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)) fail('Informe o horário da refeição (HH:MM).');
      return { name, time: item.time, foods: text(item.foods, 1000, true) };
    }
    if (!Number.isInteger(item.sets) || item.sets < 1 || item.sets > 20 ||
        !Number.isInteger(item.restSeconds) || item.restSeconds < 0 || item.restSeconds > 600) {
      fail('Séries: 1 a 20. Descanso: 0 a 600 segundos.');
    }
    return { name, sets: item.sets, reps: text(item.reps, 40, true), restSeconds: item.restSeconds };
  });
}

export function createAppRouter(pool) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(createRequireAuth(pool));
  router.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Muitas solicitações. Aguarde um minuto.' } }));

  // A live relationship is required on every request, including old plans/check-ins.
  async function subject(req, target, type) {
    const id = target ?? req.auth.user.id;
    if (!uuid(id)) fail('Usuário inválido.');
    if (id === req.auth.user.id) return id;
    const role = req.auth.user.role;
    if (role !== 'admin' && !['trainer', 'nutritionist'].includes(role)) fail('Acesso não permitido.', 403);
    if (role !== 'admin' && type && role !== (type === 'workout' ? 'trainer' : 'nutritionist')) fail('Esse plano pertence a outra especialidade.', 403);
    const allowed = await pool.query(
      `SELECT u.id FROM public.nt_users u WHERE u.id = $1 AND u.role = 'student'
       AND ($2 = 'admin' OR EXISTS (SELECT 1 FROM public.nt_connections c
         WHERE c.student_id = u.id AND c.professional_id = $3))`, [id, role, req.auth.user.id]);
    if (!allowed.rowCount) fail('Aluno não vinculado ou indisponível.', 403);
    return id;
  }

  router.get('/connections', async (req, res) => {
    const result = await pool.query(`SELECT u.id, u.name, u.role, u.professional_code AS "professionalCode"
      FROM public.nt_connections c JOIN public.nt_users u ON u.id = c.professional_id
      WHERE c.student_id = $1 ORDER BY u.name`, [req.auth.user.id]);
    res.json({ professionals: result.rows });
  });
  router.post('/connections', async (req, res) => {
    if (req.auth.user.role !== 'student') fail('Somente alunos podem vincular profissionais.', 403);
    const code = text(req.body?.code, 24, true).toLowerCase();
    const pro = await pool.query(`SELECT id FROM public.nt_users WHERE professional_code = $1
      AND role IN ('trainer', 'nutritionist')`, [code]);
    if (!pro.rowCount) fail('Código de profissional não encontrado.', 404);
    await pool.query(`INSERT INTO public.nt_connections(student_id, professional_id) VALUES ($1,$2)
      ON CONFLICT DO NOTHING`, [req.auth.user.id, pro.rows[0].id]);
    res.status(201).json({ message: 'Profissional vinculado.' });
  });
  router.delete('/connections/:id', async (req, res) => {
    if (!uuid(req.params.id)) fail('Profissional inválido.');
    await pool.query('DELETE FROM public.nt_connections WHERE student_id=$1 AND professional_id=$2', [req.auth.user.id, req.params.id]);
    res.status(204).end();
  });
  router.get('/clients', async (req, res) => {
    if (!['trainer', 'nutritionist', 'admin'].includes(req.auth.user.role)) fail('Acesso não permitido.', 403);
    const result = await pool.query(`SELECT u.id, u.name, u.email FROM public.nt_users u
      WHERE u.role = 'student' AND ($1 = 'admin' OR EXISTS (SELECT 1 FROM public.nt_connections c
      WHERE c.student_id=u.id AND c.professional_id=$2)) ORDER BY u.name, u.id`, [req.auth.user.role, req.auth.user.id]);
    res.json({ clients: result.rows });
  });

  router.get('/plans', async (req, res) => {
    const type = kind(req.query.kind);
    const id = await subject(req, req.query.userId, type);
    const result = await pool.query(`SELECT p.id, p.user_id AS "userId", p.created_by AS "createdBy",
      p.kind, p.title, p.notes, p.items, u.name AS "authorName", p.created_at AS "createdAt"
      FROM public.nt_plans p JOIN public.nt_users u ON u.id=p.created_by
      WHERE p.user_id=$1 AND p.kind=$2 AND p.archived_at IS NULL ORDER BY p.created_at DESC, p.id DESC`, [id, type]);
    const selectedDay = day(req.query.day);
    const logs = await pool.query(`SELECT plan_id AS "planId", item_index AS "itemIndex" FROM public.nt_plan_logs
      WHERE user_id=$1 AND day=$2`, [id, selectedDay]);
    res.json({ plans: result.rows, logs: logs.rows });
  });
  router.post('/plans', async (req, res) => {
    const body = req.body || {};
    const type = kind(body.kind);
    const id = await subject(req, body.userId, type);
    const title = text(body.title, 100, true);
    const notes = text(body.notes, 2000);
    const items = planItems(body.items, type);
    const result = await pool.query(`INSERT INTO public.nt_plans(user_id,created_by,kind,title,notes,items)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [id, req.auth.user.id, type, title, notes, JSON.stringify(items)]);
    res.status(201).json({ id: result.rows[0].id });
  });
  router.delete('/plans/:id', async (req, res) => {
    if (!uuid(req.params.id)) fail('Plano inválido.');
    const found = await pool.query('SELECT * FROM public.nt_plans WHERE id=$1 AND archived_at IS NULL', [req.params.id]);
    const plan = found.rows[0];
    if (!plan) fail('Plano não encontrado.', 404);
    await subject(req, plan.user_id, plan.kind);
    if (plan.created_by !== req.auth.user.id && req.auth.user.role !== 'admin') fail('Somente o autor pode arquivar este plano.', 403);
    await pool.query('UPDATE public.nt_plans SET archived_at=NOW() WHERE id=$1', [plan.id]);
    res.status(204).end();
  });
  router.put('/plans/:id/log', async (req, res) => {
    if (!uuid(req.params.id)) fail('Plano inválido.');
    const selectedDay = logDay(req.body?.day);
    const index = req.body?.itemIndex;
    const completed = req.body?.completed;
    if (!Number.isInteger(index) || typeof completed !== 'boolean') fail('Registro inválido.');
    const found = await pool.query('SELECT * FROM public.nt_plans WHERE id=$1 AND user_id=$2 AND archived_at IS NULL', [req.params.id, req.auth.user.id]);
    const plan = found.rows[0];
    if (!plan) fail('Plano não encontrado.', 404);
    if ((plan.kind === 'workout' && index !== -1) || (plan.kind === 'nutrition' && (index < 0 || index >= plan.items.length))) fail('Item inválido.');
    if (completed) {
      await pool.query(`INSERT INTO public.nt_plan_logs(plan_id,user_id,day,item_index) VALUES ($1,$2,$3,$4)
        ON CONFLICT DO NOTHING`, [plan.id, req.auth.user.id, selectedDay, index]);
    } else {
      await pool.query('DELETE FROM public.nt_plan_logs WHERE plan_id=$1 AND user_id=$2 AND day=$3 AND item_index=$4', [plan.id, req.auth.user.id, selectedDay, index]);
    }
    res.json({ completed });
  });

  router.get('/progress', async (req, res) => {
    const id = await subject(req, req.query.userId);
    const result = await pool.query(`SELECT day::text, weight_kg::float AS "weightKg", waist_cm::float AS "waistCm", notes
      FROM public.nt_checkins WHERE user_id=$1 ORDER BY day DESC LIMIT 90`, [id]);
    res.json({ checkins: result.rows });
  });
  router.put('/progress', async (req, res) => {
    const { weightKg, waistCm } = req.body || {};
    const selectedDay = logDay(req.body?.day);
    const notes = text(req.body?.notes, 2000);
    if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400 ||
        (waistCm != null && (typeof waistCm !== 'number' || !Number.isFinite(waistCm) || waistCm < 30 || waistCm > 300))) fail('Peso: 20 a 400 kg. Cintura opcional: 30 a 300 cm.');
    await pool.query(`INSERT INTO public.nt_checkins(user_id,day,weight_kg,waist_cm,notes) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT(user_id,day) DO UPDATE SET weight_kg=EXCLUDED.weight_kg, waist_cm=EXCLUDED.waist_cm, notes=EXCLUDED.notes`,
    [req.auth.user.id, selectedDay, weightKg, waistCm ?? null, notes]);
    res.json({ message: 'Evolução registrada.' });
  });
  router.delete('/progress/:day', async (req, res) => {
    await pool.query('DELETE FROM public.nt_checkins WHERE user_id=$1 AND day=$2', [req.auth.user.id, day(req.params.day)]);
    res.status(204).end();
  });
  router.post('/water', async (req, res) => {
    const selectedDay = logDay(req.body?.day);
    const amount = req.body?.amountMl;
    if (!Number.isInteger(amount) || amount < -2000 || amount > 2000 || amount === 0) fail('Informe uma quantidade entre -2000 e 2000 ml.');
    const result = await pool.query(`INSERT INTO public.nt_hydration(user_id,day,water_ml) VALUES ($1,$2,GREATEST(0,$3::int))
      ON CONFLICT(user_id,day) DO UPDATE SET water_ml=LEAST(10000,GREATEST(0,nt_hydration.water_ml+$3::int))
      RETURNING water_ml AS "waterMl"`, [req.auth.user.id, selectedDay, amount]);
    res.json(result.rows[0]);
  });
  router.get('/dashboard', async (req, res) => {
    const id = await subject(req, req.query.userId);
    const selectedDay = day(req.query.day);
    const [plans, logs, water, last] = await Promise.all([
      pool.query(`SELECT kind, count(*)::int AS count FROM public.nt_plans WHERE user_id=$1 AND archived_at IS NULL GROUP BY kind`, [id]),
      pool.query(`SELECT p.kind, count(*)::int AS count FROM public.nt_plan_logs l JOIN public.nt_plans p ON p.id=l.plan_id
        WHERE l.user_id=$1 AND l.day=$2 AND p.archived_at IS NULL GROUP BY p.kind`, [id, selectedDay]),
      pool.query('SELECT water_ml FROM public.nt_hydration WHERE user_id=$1 AND day=$2', [id, selectedDay]),
      pool.query('SELECT day::text, weight_kg::float AS "weightKg" FROM public.nt_checkins WHERE user_id=$1 ORDER BY day DESC LIMIT 1', [id]),
    ]);
    res.json({ day: selectedDay, plans: Object.fromEntries(plans.rows.map(r => [r.kind, r.count])),
      completed: Object.fromEntries(logs.rows.map(r => [r.kind, r.count])), waterMl: water.rows[0]?.water_ml ?? 0,
      lastCheckin: last.rows[0] ?? null });
  });
  router.use((error, _req, res, next) => {
    if (error instanceof InputError) return res.status(error.status).json({ error: error.message });
    next(error);
  });
  return router;
}
