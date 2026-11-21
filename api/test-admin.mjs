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
  assert.equal((await request('auth/register', { body: account('admin') })).status, 400);
  const ordinaryBody = account('student');
  const ordinary = await request('auth/register', { body: ordinaryBody });
  assert.equal(ordinary.status, 201);
  assert.equal((await request('admin/users', { token: ordinary.data.token })).status, 403);
  assert.equal((await request('admin/users', { token: ordinary.data.token, body: account('admin') })).status, 403);
  // Exercise bootstrap only on an isolated database with no existing administrators.
  assert.equal(Number((await pool.query("SELECT count(*) FROM nt_users WHERE role='admin'")).rows[0].count), 0,
    'Use banco de teste isolado, sem administradores.');
  const bootstrap = spawnSync(process.execPath, ['bootstrap-admin.mjs', ordinaryBody.email], { encoding: 'utf8' });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  assert.equal((await request('auth/me', { token: ordinary.data.token })).status, 401);
  assert.notEqual(spawnSync(process.execPath, ['bootstrap-admin.mjs', ordinaryBody.email]).status, 0);
  const login = await request('auth/login', { body: ordinaryBody });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'admin');
  const token = login.data.token;
  for (const role of ['student', 'trainer', 'nutritionist', 'admin']) {
    const body = account(role);
    const created = await request('admin/users', { token, body });
    assert.equal(created.status, 201);
    assert.equal(created.data.user.role, role);
    assert.equal(created.data.token, undefined);
    assert.equal(created.data.user.password_hash, undefined);
    assert.equal((await request('admin/users', { token, body })).status, 409);
    const signedIn = await request('auth/login', { body });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.data.user.role, role);
  }
  assert.equal((await request('admin/users', { token, body: { ...account('invalid'), password: 'short' } })).status, 400);
  assert.equal((await request('admin/users?offset=-1', { token })).status, 400);
  const listed = await request('admin/users', { token });
  assert.equal(listed.status, 200);
  assert.ok(listed.data.users.some(user => user.email === ordinaryBody.email));
  assert.ok(listed.data.users.every(user => !('password_hash' in user)));
  const emptyPage = await request('admin/users?offset=10000', { token });
  assert.deepEqual(emptyPage.data, { users: [], nextOffset: null });
  console.log('OK: autorização, bootstrap, revogação, cadastro dos quatro perfis, duplicidade e listagem.');
} finally {
  await pool.query('DELETE FROM nt_users WHERE email = ANY($1::text[])', [emails]);
  await pool.end();
}
