import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
if (process.env.NUTRAINING_TEST_DB !== '1') throw new Error('Use banco isolado e NUTRAINING_TEST_DB=1. Nunca execute em produção.');
const pool = new pg.Pool();
const emails = [];
const password = 'App-Integracao-123!';
const day = new Date().toISOString().slice(0, 10);
async function request(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`http://127.0.0.1:3101/v1/${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
async function account(role) {
  const email = `app-test-${randomUUID()}@example.invalid`; emails.push(email);
  const response = await request('auth/register', null, { name: 'Teste App', email, password, role });
  assert.equal(response.status, 201);
  return { ...response.data.user, token: response.data.token };
}
const exercise = { name: 'Agachamento', sets: 3, reps: '10 a 12', restSeconds: 60 };
const meal = { name: 'Café da manhã', time: '08:00', foods: 'Fruta e iogurte · porção orientada' };
try {
  const student = await account('student'); const other = await account('student');
  const trainer = await account('trainer'); const nutritionist = await account('nutritionist');
  const admin = await account('student');
  await pool.query("UPDATE nt_users SET role='admin' WHERE id=$1", [admin.id]);
  assert.equal((await request(`app/dashboard?day=${day}`)).status, 401);
  assert.equal((await request(`app/progress?userId=${student.id}`, other.token)).status, 403);
  assert.equal((await request(`app/progress?userId=${student.id}`, trainer.token)).status, 403);
  assert.equal((await request('app/connections', student.token, { code: '000000000000000000000000' })).status, 404);
  for (const professional of [trainer, nutritionist]) {
    assert.equal((await request('app/connections', student.token, { code: professional.professionalCode })).status, 201);
    assert.equal((await request('app/connections', student.token, { code: professional.professionalCode })).status, 201);
  }
  assert.equal((await request('app/connections', student.token)).data.professionals.length, 2);
  assert.deepEqual((await request('app/clients', trainer.token)).data.clients.map(c => c.id), [student.id]);
  assert.equal((await request('app/clients', student.token)).status, 403);
  assert.equal((await request('app/connections', trainer.token, { code: nutritionist.professionalCode })).status, 403);
  const workout = await request('app/plans', trainer.token, { kind: 'workout', userId: student.id, title: 'Treino A', items: [exercise] });
  assert.equal(workout.status, 201);
  const nutrition = await request('app/plans', nutritionist.token, { kind: 'nutrition', userId: student.id, title: 'Plano semanal', items: [meal] });
  assert.equal(nutrition.status, 201);
  assert.equal((await request('app/plans', trainer.token, { kind: 'nutrition', userId: student.id, title: 'Plano inválido', items: [meal] })).status, 403);
  assert.equal((await request('app/plans', nutritionist.token, { kind: 'workout', userId: student.id, title: 'Treino inválido', items: [exercise] })).status, 403);
  assert.equal((await request('app/plans', other.token, { kind: 'workout', userId: student.id, title: 'Treino indevido', items: [exercise] })).status, 403);
  assert.equal((await request('app/plans', student.token, { kind: 'workout', title: 'Sem itens', items: [] })).status, 400);
  assert.equal((await request('app/plans', student.token, { kind: 'workout', title: 'Inválido', items: [{ ...exercise, sets: 0 }] })).status, 400);
  assert.equal((await request('app/plans', student.token, { kind: 'nutrition', title: 'Inválido', items: [{ ...meal, time: '25:00' }] })).status, 400);
  assert.equal((await request('app/plans', student.token, { kind: 'nutrition', title: 'Plano completo',
    items: Array.from({ length: 30 }, (_, i) => ({ ...meal, name: `Refeição ${i + 1}`, foods: 'a'.repeat(1000) })) })).status, 201);
  assert.equal((await request('app/plans', student.token, { kind: 'nutrition', title: 'Itens demais', items: Array(31).fill(meal) })).status, 400);
  const selfPlan = await request('app/plans', student.token, { kind: 'workout', title: 'Meu treino', items: [exercise] });
  assert.equal(selfPlan.status, 201);
  const ownPlans = await request(`app/plans?kind=workout&day=${day}`, student.token);
  assert.equal(ownPlans.data.plans.length, 2);
  assert.equal(ownPlans.data.plans.find(p => p.id === workout.data.id).authorName, trainer.name);
  assert.equal((await request(`app/plans?kind=workout&day=${day}&userId=${student.id}`, trainer.token)).status, 200);
  assert.equal((await request(`app/plans?kind=workout&day=${day}&userId=${student.id}`, nutritionist.token)).status, 403);
  assert.equal((await request(`app/plans?kind=workout&day=2026-02-30`, student.token)).status, 400);
  const logPath = `app/plans/${workout.data.id}/log`;
  assert.equal((await request(logPath, other.token, { day, itemIndex: -1, completed: true }, 'PUT')).status, 404);
  assert.equal((await request(logPath, trainer.token, { day, itemIndex: -1, completed: true }, 'PUT')).status, 404);
  assert.equal((await request(logPath, student.token, { day, itemIndex: 0, completed: true }, 'PUT')).status, 400);
  for (let i = 0; i < 2; i++) assert.equal((await request(logPath, student.token, { day, itemIndex: -1, completed: true }, 'PUT')).status, 200);
  assert.equal((await request(`app/plans/${nutrition.data.id}/log`, student.token, { day, itemIndex: 1, completed: true }, 'PUT')).status, 400);
  assert.equal((await request(`app/plans/${nutrition.data.id}/log`, student.token, { day, itemIndex: 0, completed: true }, 'PUT')).status, 200);
  assert.equal((await request('app/water', student.token, { day, amountMl: 250 })).data.waterMl, 250);
  assert.equal((await request('app/water', student.token, { day, amountMl: 250 })).data.waterMl, 500);
  assert.equal((await request('app/water', student.token, { day, amountMl: -2000 })).data.waterMl, 0);
  assert.equal((await request('app/water', student.token, { day, amountMl: 999999 })).status, 400);
  await request('app/water', student.token, { day, amountMl: 250 });
  assert.equal((await request('app/progress', student.token, { day, weightKg: 72.5, waistCm: 85, notes: 'Bom dia' }, 'PUT')).status, 200);
  assert.equal((await request('app/progress', student.token, { day, weightKg: 72, waistCm: null }, 'PUT')).status, 200);
  assert.equal((await request('app/progress', student.token, { day, weightKg: 0 }, 'PUT')).status, 400);
  const progress = await request(`app/progress?userId=${student.id}`, trainer.token);
  assert.equal(progress.data.checkins.length, 1);
  assert.equal(progress.data.checkins[0].weightKg, 72);
  const dashboard = (await request(`app/dashboard?day=${day}`, student.token)).data;
  assert.equal(dashboard.completed.workout, 1); assert.equal(dashboard.completed.nutrition, 1);
  assert.equal(dashboard.plans.workout, 2); assert.equal(dashboard.waterMl, 250);
  assert.equal(dashboard.lastCheckin.weightKg, 72);
  assert.equal((await request(`app/dashboard?day=${day}`, other.token)).data.lastCheckin, null);
  await request(logPath, student.token, { day, itemIndex: -1, completed: false }, 'PUT');
  assert.equal((await request(`app/dashboard?day=${day}`, student.token)).data.completed.workout, undefined);
  assert.equal((await request(`app/plans/${workout.data.id}`, student.token, undefined, 'DELETE')).status, 403);
  assert.equal((await request(`app/plans/${selfPlan.data.id}`, student.token, undefined, 'DELETE')).status, 204);
  assert.equal((await request(`app/connections/${trainer.id}`, student.token, undefined, 'DELETE')).status, 204);
  assert.equal((await request(`app/progress?userId=${student.id}`, trainer.token)).status, 403);
  assert.equal((await request(`app/plans/${workout.data.id}`, trainer.token, undefined, 'DELETE')).status, 403);
  assert.equal((await request(`app/plans?kind=workout&day=${day}`, student.token)).data.plans.length, 1);
  assert.equal((await request(`app/plans/${workout.data.id}`, admin.token, undefined, 'DELETE')).status, 204);
  assert.equal((await request(`app/progress/${day}`, student.token, undefined, 'DELETE')).status, 204);
  assert.equal((await request('app/progress', student.token)).data.checkins.length, 0);
  console.log('OK: vínculos, consentimento, isolamento, especialidades, planos, atividades, hidratação, evolução e administração.');
} finally {
  // created_by deliberately has no cascade: remove only fixtures before removing accounts.
  await pool.query('DELETE FROM nt_plans WHERE created_by IN (SELECT id FROM nt_users WHERE email=ANY($1::text[]))', [emails]);
  await pool.query('DELETE FROM nt_users WHERE email=ANY($1::text[])', [emails]);
  await pool.end();
}
