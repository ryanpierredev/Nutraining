import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';

const baseUrl = 'http://127.0.0.1:3101/v1/auth';

const database = new pg.Pool({
  max: 1,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
});

const emails = [];
const testName = 'Teste automatizado Nutraining';
let removed = 0;

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    method: options.method || 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
    },
    body: options.body === undefined
      ? undefined
      : JSON.stringify(options.body),
  });

  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}

try {
  const anonymous = await request('/me');
  assert.equal(anonymous.status, 401, 'Acesso sem login deve ser bloqueado');

  let priorSessionId;
  for (const role of ['student', 'trainer', 'nutritionist']) {
    const email = `qa-${randomUUID()}@example.invalid`;
    const password = randomBytes(24).toString('base64url');
    emails.push(email);

    const registered = await request('/register', {
      method: 'POST',
      body: { name: testName, email, password, role, deviceLabel: 'Telefone de teste' },
    });

    assert.equal(registered.status, 201, `Falha no cadastro: ${role}`);
    assert.equal(registered.data.user.role, role);

    const stored = await database.query(
      'SELECT password_hash FROM public.nt_users WHERE email = $1',
      [email],
    );

    assert.ok(
      stored.rows[0]?.password_hash?.startsWith('scrypt-v1$') &&
      stored.rows[0].password_hash !== password,
      'A senha deve estar armazenada como hash',
    );

    const wrongPassword = await request('/login', {
      method: 'POST',
      body: { email, password: 'SenhaIncorreta#Teste123' },
    });

    assert.equal(wrongPassword.status, 401, 'Senha incorreta deve ser recusada');

    const login = await request('/login', {
      method: 'POST',
      body: { email, password },
    });

    assert.equal(login.status, 200, `Falha no login: ${role}`);

    const profile = await request('/me', {
      token: login.data.token,
    });

    assert.equal(profile.status, 200);
    assert.equal(profile.data.user.email, email);
    assert.equal(profile.data.user.role, role);
    assert.equal(profile.data.user.id, registered.data.user.id);

    const auth = { token: login.data.token };
    const sessions = (await request('/sessions', auth)).data.sessions;
    assert.equal(sessions.length, 2);
    const [current, other] = sessions;
    assert.ok(current.current);
    assert.equal(other.current, false);
    assert.equal(other.deviceLabel, 'Telefone de teste');
    assert.ok(sessions.every(s => !('token' in s) && !('token_hash' in s) && !('tokenHash' in s)));
    assert.equal((await request('/sessions/' + current.id, { ...auth, method: 'DELETE' })).status, 400);
    if (priorSessionId) {
      assert.equal((await request('/sessions/' + priorSessionId, { ...auth, method: 'DELETE' })).status, 404);
    }
    priorSessionId = other.id;
    if (role === 'student') {
      // Keep the other session alive to test isolation with the next account.
      const changes = await request('/me', { ...auth, method: 'PATCH', body: { name: testName, theme: 'light' } });
      assert.equal(changes.data.user.theme, 'light');
      assert.equal((await request('/me', { token: registered.data.token })).data.user.theme, 'light');
      assert.equal((await request('/me', { ...auth, method: 'PATCH', body: { role: 'admin' } })).status, 400);
      assert.equal((await request('/me', { ...auth, method: 'PATCH', body: { theme: 'purple' } })).status, 400);
      const jpeg = await sharp({ create: { width: 320, height: 240, channels: 3, background: 'green' } }).jpeg().toBuffer();
      assert.equal((await request('/me/photo', { ...auth, method: 'PUT', body: { image: jpeg.toString('base64') } })).status, 204);
      const photo = (await request('/me/photo', { token: registered.data.token })).data.photo;
      const meta = await sharp(Buffer.from(photo.split(',')[1], 'base64')).metadata();
      assert.equal(meta.format, 'jpeg'); assert.equal(meta.width, 256); assert.equal(meta.height, 256);
      assert.equal((await request('/me/photo', { ...auth, method: 'PUT', body: { image: '/9j/invalid' } })).status, 400);
      assert.equal((await request('/me/photo', auth)).data.photo, photo);
    } else {
      assert.equal((await request('/me/photo', auth)).data.photo, null);
      const path = role === 'trainer' ? '/sessions/' + other.id : '/sessions/others';
      assert.equal((await request(path, { ...auth, method: 'DELETE' })).status, 204);
      assert.equal((await request('/me', { token: registered.data.token })).status, 401);
      assert.equal((await request('/sessions', auth)).data.sessions.length, 1);
    }

    const logout = await request('/logout', {
      method: 'POST',
      body: {},
      token: login.data.token,
    });

    assert.equal(logout.status, 204);

    const revoked = await request('/me', {
      token: login.data.token,
    });

    assert.equal(revoked.status, 401, 'Logout deve revogar a sessão');
    if (role === 'student') {
      assert.equal((await request('/me/photo', { token: registered.data.token, method: 'DELETE' })).status, 204);
      assert.equal((await request('/me/photo', { token: registered.data.token })).data.photo, null);
    }
  }
} finally {
  try {
    if (emails.length) {
      const result = await database.query(
        `DELETE FROM public.nt_users
         WHERE email = ANY($1::text[]) AND name = $2`,
        [emails, testName],
      );

      removed = result.rowCount;
    }
  } finally {
    await database.end();
  }
}

assert.equal(removed, 3, 'As três contas temporárias devem ser removidas');

console.log(
  'OK: cadastro, senha protegida, login, perfil e logout nos três perfis.',
);
console.log('OK: contas temporárias removidas.');
