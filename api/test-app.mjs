import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { insertUser } from './users.mjs';
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
  await insertUser(pool, { name: 'Teste App', email, password, role, source: 'unknown' });
  const response = await request('auth/login', null, { email, password });
  assert.equal(response.status, 200);
  return { ...response.data.user, token: response.data.token };
}
const exercise = { name: 'Agachamento', sets: 3, reps: '10 a 12', restSeconds: 60 };
const meal = { name: 'Café da manhã', time: '08:00', foods: 'Fruta e iogurte · porção orientada' };
try {
  const student = await account('student'); const other = await account('student');
  const trainer = await account('trainer'); const nutritionist = await account('nutritionist');
  const admin = await account('admin');
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
  const workout = await request('app/plans', trainer.token, {
    kind: 'workout', userId: student.id, title: 'Treino A', items: [exercise, { ...exercise, name: 'Remada' }],
  });
  assert.equal(workout.status, 201);
  const nutrition = await request('app/plans', nutritionist.token, { kind: 'nutrition', userId: student.id, title: 'Plano semanal', items: [meal] });
  assert.equal(nutrition.status, 201);
  const loadsPath = `app/plans/${workout.data.id}/exercise-loads`;
  const previousDay = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
  const saveLoad = (token, index, weightKg, date = day) =>
    request(`${loadsPath}/${index}`, token, { day: date, weightKg }, 'PUT');
  assert.equal((await saveLoad(other.token, 0, 10)).status, 404);
  assert.equal((await saveLoad(trainer.token, 0, 10)).status, 404);
  assert.equal((await saveLoad(student.token, 2, 10)).status, 400);
  assert.equal((await saveLoad(student.token, 0, -1)).status, 400);
  assert.equal((await saveLoad(student.token, 0, 1001)).status, 400);
  assert.equal((await saveLoad(student.token, 0, 10, '2026-02-30')).status, 400);
  assert.equal((await request(`app/plans/${nutrition.data.id}/exercise-loads/0`, student.token, { day, weightKg: 10 }, 'PUT')).status, 404);
  assert.equal((await saveLoad(student.token, 0, 17.5, previousDay)).status, 200);
  assert.equal((await saveLoad(student.token, 0, 20)).status, 200);
  assert.equal((await saveLoad(student.token, 0, 22.5)).status, 200);
  assert.equal((await saveLoad(student.token, 1, 0)).status, 200);
  const history = [
    { itemIndex: 0, day, weightKg: 22.5 },
    { itemIndex: 0, day: previousDay, weightKg: 17.5 },
    { itemIndex: 1, day, weightKg: 0 },
  ];
  for (const reader of [student, trainer, admin]) {
    assert.deepEqual((await request(loadsPath, reader.token)).data.loads, history);
  }
  assert.equal((await request(loadsPath, other.token)).status, 403);
  assert.equal((await request(loadsPath, nutritionist.token)).status, 403);
  assert.equal((await request('app/plans', trainer.token, { kind: 'nutrition', userId: student.id, title: 'Plano inválido', items: [meal] })).status, 403);
  assert.equal((await request('app/plans', nutritionist.token, { kind: 'workout', userId: student.id, title: 'Treino inválido', items: [exercise] })).status, 403);
  assert.equal((await request('app/plans', other.token, { kind: 'workout', userId: student.id, title: 'Treino indevido', items: [exercise] })).status, 403);
  for (const [kind, item, wrongSpecialist] of [['workout', exercise, nutritionist], ['nutrition', meal, trainer]]) {
    const plan = { kind, title: 'Plano pessoal', items: [item] };
    assert.equal((await request('app/plans', student.token, plan)).status, 403);
    assert.equal((await request('app/plans', wrongSpecialist.token, plan)).status, 403);
  }
  assert.equal((await request('app/plans', trainer.token, { kind: 'workout', userId: other.id, title: 'Aluno sem vínculo', items: [exercise] })).status, 403);
  assert.equal((await request('app/plans', trainer.token, { kind: 'workout', title: 'Sem itens', items: [] })).status, 400);
  assert.equal((await request('app/plans', trainer.token, { kind: 'workout', title: 'Inválido', items: [{ ...exercise, sets: 0 }] })).status, 400);
  assert.equal((await request('app/plans', nutritionist.token, { kind: 'nutrition', title: 'Inválido', items: [{ ...meal, time: '25:00' }] })).status, 400);
  assert.equal((await request('app/plans', nutritionist.token, { kind: 'nutrition', title: 'Plano completo',
    items: Array.from({ length: 30 }, (_, i) => ({ ...meal, name: `Refeição ${i + 1}`, foods: 'a'.repeat(1000) })) })).status, 201);
  assert.equal((await request('app/plans', nutritionist.token, { kind: 'nutrition', title: 'Itens demais', items: Array(31).fill(meal) })).status, 400);
  // Preserve plans created by a student before plan authoring was restricted.
  const { rows: [legacyPlan] } = await pool.query(`INSERT INTO nt_plans(user_id,created_by,kind,title,items)
    VALUES ($1,$1,'workout','Meu treino anterior',$2) RETURNING id`, [student.id, JSON.stringify([exercise])]);
  const ownPlans = await request(`app/plans?kind=workout&day=${day}`, student.token);
  assert.equal(ownPlans.data.plans.length, 2);
  assert.ok(ownPlans.data.plans.some(plan => plan.id === legacyPlan.id));
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
  assert.equal((await request(`app/plans/${legacyPlan.id}`, student.token, undefined, 'DELETE')).status, 403);
  assert.equal((await request(`app/plans/${legacyPlan.id}`, trainer.token, undefined, 'DELETE')).status, 403);
  assert.equal((await request(`app/plans/${legacyPlan.id}`, admin.token, undefined, 'DELETE')).status, 204);
  assert.equal((await request(`app/connections/${trainer.id}`, student.token, undefined, 'DELETE')).status, 204);
  assert.equal((await request(`app/progress?userId=${student.id}`, trainer.token)).status, 403);
  assert.equal((await request(`app/plans/${workout.data.id}`, trainer.token, undefined, 'DELETE')).status, 403);
  assert.equal((await request(loadsPath, trainer.token)).status, 403);
  assert.equal((await request(`app/plans?kind=workout&day=${day}`, student.token)).data.plans.length, 1);
  assert.equal((await request(`app/plans/${workout.data.id}`, admin.token, undefined, 'DELETE')).status, 204);
  assert.equal((await saveLoad(student.token, 0, 30)).status, 404);
  assert.deepEqual((await request(loadsPath, student.token)).data.loads, history);
  const archivedWorkouts = await request(`app/plans?kind=workout&day=${day}&archived=1`, student.token);
  assert.ok(archivedWorkouts.data.plans.some(plan => plan.id === workout.data.id));
  assert.equal((await request(`app/progress/${day}`, student.token, undefined, 'DELETE')).status, 204);
  assert.equal((await request('app/progress', student.token)).data.checkins.length, 0);
  const diet = { kind: 'nutrition', title: 'Dieta diária', items: [meal], isFixed: true };
  const personalDiet = await request('app/plans', admin.token, diet);
  assert.equal(personalDiet.status, 201);
  const personalWorkout = await request('app/plans', admin.token, { kind: 'workout', title: 'Minha ficha', items: [exercise], isFixed: true });
  assert.equal(personalWorkout.status, 201);
  const assigned = await request('app/plans', admin.token, { ...diet, userId: student.id });
  assert.equal(assigned.status, 201);
  assert.equal((await request('app/plans', student.token, diet)).status, 403);
  assert.equal((await request(`app/plans/${assigned.data.id}/fixed`, trainer.token, { isFixed: false }, 'PUT')).status, 403);
  const fixedFor = async (token, date = day) => (await request(`app/plans?kind=nutrition&day=${date}`, token)).data.plans.filter(p => p.isFixed).map(p => p.id);
  assert.deepEqual(await fixedFor(student.token), [assigned.data.id]);
  assert.deepEqual(await fixedFor(other.token), []);
  assert.deepEqual(await fixedFor(admin.token), [personalDiet.data.id]);
  const dailyLog = `app/plans/${personalDiet.data.id}/log`;
  assert.equal((await request(dailyLog, admin.token, { day, completed: true, itemIndex: 0 }, 'PUT')).status, 200);
  const nextDay = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
  const next = (await request(`app/plans?kind=nutrition&day=${nextDay}`, admin.token)).data;
  assert.equal(next.plans[0].id, personalDiet.data.id);
  assert.equal(next.logs.length, 0);
  const alternatives = await Promise.all(['Opção A', 'Opção B'].map(title => request('app/plans', admin.token, { ...diet, title })));
  assert.ok(alternatives.every(item => item.status === 201));
  const fixed = await fixedFor(admin.token);
  assert.equal(fixed.length, 1);
  assert.ok(alternatives.some(item => item.data.id === fixed[0]));
  assert.equal((await request(`app/plans/${personalDiet.data.id}/fixed`, admin.token, { isFixed: true }, 'PUT')).status, 204);
  assert.deepEqual(await fixedFor(admin.token), [personalDiet.data.id]);
  assert.deepEqual(await fixedFor(student.token), [assigned.data.id]);
  const ownDay = (await request(`app/dashboard?day=${day}`, admin.token)).data;
  assert.equal(ownDay.fixedPlans.workout, 'Minha ficha');
  assert.equal(ownDay.fixedPlans.nutrition, 'Dieta diária');
  assert.equal(ownDay.completed.nutrition, 1);
  assert.equal((await request('app/progress', admin.token, { day, weightKg: 80.4, waistCm: 85 }, 'PUT')).status, 200);
  assert.equal((await request('app/progress', admin.token)).data.checkins[0].weightKg, 80.4);
  assert.equal((await request(`app/progress?userId=${admin.id}`, student.token)).status, 403);
  assert.equal((await request(`app/plans/${personalDiet.data.id}/fixed`, admin.token, { isFixed: false }, 'PUT')).status, 204);
  assert.deepEqual(await fixedFor(admin.token), []);
  console.log('OK: vínculos, consentimento, isolamento, especialidades, planos, atividades, hidratação, evolução e administração.');
} finally {
  // created_by deliberately has no cascade: remove only fixtures before removing accounts.
  await pool.query('DELETE FROM nt_plans WHERE created_by IN (SELECT id FROM nt_users WHERE email=ANY($1::text[]))', [emails]);
  await pool.query('DELETE FROM nt_users WHERE email=ANY($1::text[])', [emails]);
  await pool.end();
}
