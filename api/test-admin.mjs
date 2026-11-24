import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
const pool = new pg.Pool();
const emails = [];
const password = 'Teste-Administrador-123!';
async function request(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch('http://127.0.0.1:3101/v1/' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
function account(role) {
  const email = `admin-test-${randomUUID()}@example.invalid`;
  emails.push(email);
  return { name: 'Teste Admin', email, password, role };
}
try {
  assert.equal((await request('admin/users')).status, 401);
  for (const role of ['student', 'trainer', 'nutritionist', 'admin']) {
    const body = account(role);
    assert.equal((await request('auth/register', { body })).status, 403);
    assert.equal((await request('auth/login', { body })).status, 401);
  }
  assert.equal((await request('auth/students', { body: account('student') })).status, 401);
  const initialAdmin = account('admin');
  // Exercise bootstrap only on an isolated database with no existing administrators.
  assert.equal(Number((await pool.query("SELECT count(*) FROM nt_users WHERE role='admin'")).rows[0].count), 0,
    'Use banco de teste isolado, sem administradores.');
  const bootstrapArgs = ['bootstrap-admin.mjs', '--create', initialAdmin.email, initialAdmin.name];
  const bootstrapOptions = { encoding: 'utf8', input: password + '\n' };
  const bootstrap = spawnSync(process.execPath, bootstrapArgs, bootstrapOptions);
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  assert.notEqual(spawnSync(process.execPath, bootstrapArgs, bootstrapOptions).status, 0);
  const login = await request('auth/login', { body: initialAdmin });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'admin');
  const token = login.data.token;
  assert.equal((await request('admin/overview')).status, 401);
  const accounts = {};
  const baseline = (await request('admin/overview', { token })).data;
  for (const role of ['student', 'trainer', 'nutritionist', 'admin']) {
    const body = account(role);
    const created = await request('admin/users', { token, body });
    assert.equal(created.status, 201);
    assert.equal(created.data.user.role, role);
    assert.equal(created.data.token, undefined);
    assert.equal(created.data.user.password_hash, undefined);
    assert.equal((await request('admin/users', { token, body })).status, 409);
    const initial = await request('admin/users?q=' + encodeURIComponent(body.email), { token });
    assert.equal(initial.data.users.length, 1);
    assert.equal(initial.data.users[0].registrationSource, 'admin');
    assert.equal(initial.data.users[0].registeredByName, login.data.user.name);
    assert.equal(initial.data.users[0].activeSessions, 0);
    const signedIn = await request('auth/login', { body });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.data.user.role, role);
    accounts[role] = signedIn.data;
  }
  const metrics = (await request('admin/overview', { token })).data;
  assert.equal(metrics.totalUsers, baseline.totalUsers + 4);
  assert.equal(metrics.recentUsers, baseline.recentUsers + 4);
  assert.equal(metrics.activeUsers, baseline.activeUsers + 4);
  assert.equal(metrics.activeSessions, baseline.activeSessions + 4);
  const original = (await request('admin/users?status=active&q=' + encodeURIComponent(initialAdmin.email), { token })).data.users;
  assert.equal(original[0].registrationSource, 'bootstrap');
  assert.equal(original[0].registeredByName, null);
  assert.ok(original[0].createdAt);
  await pool.query("UPDATE nt_sessions SET expires_at=NOW()-interval '1 day' WHERE user_id IN (SELECT id FROM nt_users WHERE email=$1)", [emails.at(-1)]);
  assert.equal((await request('admin/users?status=active&q=' + encodeURIComponent(emails.at(-1)), { token })).data.users.length, 0);
  assert.equal((await request('admin/overview', { token })).data.activeUsers, metrics.activeUsers - 1);
  await pool.query("UPDATE nt_sessions SET last_seen_at=NOW()-interval '16 minutes' WHERE user_id=$1", [accounts.nutritionist.user.id]);
  assert.equal((await request('admin/users?status=active&q=' + encodeURIComponent(accounts.nutritionist.user.email), { token })).data.users.length, 0);
  const afterIdle = (await request('admin/overview', { token })).data;
  assert.equal(afterIdle.activeUsers, metrics.activeUsers - 2);
  assert.equal(afterIdle.activeSessions, metrics.activeSessions - 2);
  assert.equal((await request('admin/users', { token, body: { ...account('invalid'), password: 'short' } })).status, 400);
  assert.equal((await request('admin/users?offset=-1', { token })).status, 400);
  const listed = await request('admin/users', { token });
  assert.equal(listed.status, 200);
  assert.ok(listed.data.users.some(user => user.email === initialAdmin.email));
  assert.ok(listed.data.users.every(user => !('password_hash' in user)));
  const emptyPage = await request('admin/users?offset=10000', { token });
  assert.deepEqual(emptyPage.data, { users: [], nextOffset: null });
  const studentToken = accounts.student.token;
  assert.equal((await request('admin/users', { token: studentToken })).status, 403);
  assert.equal((await request('admin/overview', { token: studentToken })).status, 403);
  assert.equal((await request('auth/students', { token: studentToken, body: account('student') })).status, 403);
  for (const role of ['trainer', 'nutritionist']) {
    const creator = accounts[role];
    if (role === 'nutritionist') creator.token = (await request('auth/login', {
      body: { email: creator.user.email, password },
    })).data.token;
    assert.equal((await request('admin/users', { token: creator.token, body: account('student') })).status, 403);
    for (const forbidden of ['trainer', 'nutritionist', 'admin']) {
      assert.equal((await request('auth/students', { token: creator.token, body: account(forbidden) })).status, 403);
    }
    const body = account('student');
    const created = await request('auth/students', { token: creator.token, body });
    assert.equal(created.status, 201);
    assert.equal(created.data.user.role, 'student');
    assert.equal(created.data.token, undefined);
    assert.equal((await request('auth/students', { token: creator.token, body })).status, 409);
    assert.equal((await request('auth/login', { body })).data.user.id, created.data.user.id);
    const [row] = (await pool.query('SELECT registration_source, registered_by FROM nt_users WHERE id=$1', [created.data.user.id])).rows;
    assert.equal(row.registration_source, 'professional');
    assert.equal(row.registered_by, creator.user.id);
    const directory = await request('admin/users?q=' + encodeURIComponent(body.email), { token });
    assert.equal(directory.data.users[0].registeredByName, creator.user.name);
    assert.equal(directory.data.users[0].registrationSource, 'professional');
  }
  console.log('OK: autorização, bootstrap, revogação, cadastro dos quatro perfis, duplicidade e listagem.');
} finally {
  await pool.query('DELETE FROM nt_users WHERE email = ANY($1::text[])', [emails]);
  await pool.end();
}
