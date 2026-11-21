import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const roles = new Set(['student', 'trainer', 'nutritionist']);

const scryptOptions = {
  N: 32768,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024,
};

const dummyHash =
  `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

const tokenHash = (token) =>
  createHash('sha256').update(token).digest('hex');

const normalizeEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const validEmail = (value) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validPassword = (value) =>
  typeof value === 'string' &&
  value.length >= 12 &&
  value.length <= 128;

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    professionalCode: row.professional_code,
  };
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, scryptOptions);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}

export async function matchesPassword(password, storedHash) {
  if (
    typeof storedHash !== 'string' ||
    !/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(storedHash)
  ) {
    return false;
  }

  const [, salt, digest] = storedHash.split('$');
  const key = await scrypt(password, salt, 64, scryptOptions);
  return timingSafeEqual(key, Buffer.from(digest, 'hex'));
}

export async function createSession(database, userId, deviceLabel = 'Dispositivo não identificado', event = 'login') {
  const token = randomBytes(32).toString('base64url');

  const result = await database.query(
    `INSERT INTO public.nt_sessions
       (token_hash, user_id, expires_at, device_label)
     VALUES ($1, $2, NOW() + INTERVAL '7 days', $3)
     RETURNING expires_at`,
    [tokenHash(token), userId, deviceLabel],
  );

  await database.query('UPDATE public.nt_users SET last_login_at=NOW() WHERE id=$1', [userId]);
  await database.query('INSERT INTO public.nt_account_events(user_id,actor_id,event) VALUES ($1,$1,$2)', [userId, event]);
  return {
    token,
    expiresAt: result.rows[0].expires_at,
  };
}

export function sessionDevice(req) {
  const label = req.body?.deviceLabel;
  return (typeof label === 'string' && label.trim() ? label : req.get('user-agent') || 'Dispositivo não identificado')
    .replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160);
}

export function createRequireAuth(pool) {
  return async (req, res, next) => {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(
      req.get('authorization') || '',
    );

    if (!match) {
      return res.status(401).json({ error: 'Faça login para continuar.' });
    }

    const hash = tokenHash(match[1]);

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.professional_code, s.id AS session_id
       FROM public.nt_sessions s
       JOIN public.nt_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [hash],
    );

    if (!result.rows[0]) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    req.auth = {
      user: publicUser(result.rows[0]),
      tokenHash: hash,
      sessionId: result.rows[0].session_id,
    };

    await pool.query("UPDATE public.nt_sessions SET last_seen_at=NOW() WHERE token_hash=$1 AND last_seen_at < NOW()-INTERVAL '1 minute'", [hash]);
    next();
  };
}

export function createAuthRouter(pool, { administrative = false } = {}) {
  const router = Router();
  const requireAuth = createRequireAuth(pool);

  const attempts = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
  });

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  if (administrative) {
    router.use(requireAuth, (req, res, next) => {
      if (req.auth.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso exclusivo do administrador.' });
      }
      next();
    });
    router.get('/users', async (req, res) => {
      const offset = Number(req.query.offset ?? 0);
      if (!Number.isSafeInteger(offset) || offset < 0) {
        return res.status(400).json({ error: 'Página inválida.' });
      }
      const result = await pool.query(
        `SELECT id, name, email, role, professional_code FROM public.nt_users
         ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET $1`, [offset],
      );
      res.json({ users: result.rows.slice(0, 50).map(publicUser),
        nextOffset: result.rows.length > 50 ? offset + 50 : null });
    });
  }

  router.post(administrative ? '/users' : '/register', attempts, async (req, res, next) => {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = normalizeEmail(body.email);
    const role = body.role ?? 'student';

    if (
      [...name].length < 2 ||
      [...name].length > 120 ||
      !validEmail(email) ||
      !validPassword(body.password) ||
      !(roles.has(role) || (administrative && role === 'admin'))
    ) {
      return res.status(400).json({
        error: 'Informe nome, e-mail, perfil válido e senha de 12 a 128 caracteres.',
      });
    }

    const passwordHash = await hashPassword(body.password);
    const code = !['trainer', 'nutritionist'].includes(role)
      ? null
      : randomBytes(12).toString('hex');

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO public.nt_users
           (name, email, password_hash, role, professional_code)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, role, professional_code`,
        [name, email, passwordHash, role, code],
      );

      const user = publicUser(result.rows[0]);
      const session = administrative ? {} : await createSession(client, user.id, sessionDevice(req), 'signup');
      if (administrative) await client.query("INSERT INTO public.nt_account_events(user_id,actor_id,event) VALUES ($1,$2,'account_created')", [user.id, req.auth.user.id]);

      await client.query('COMMIT');
      res.status(201).json({ user, ...session });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});

      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Não foi possível criar uma conta com esse e-mail.',
        });
      }

      next(error);
    } finally {
      client.release();
    }
  });

  if (administrative) return router;

  router.post('/login', attempts, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!validEmail(email) || !validPassword(password)) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT id, name, email, role, professional_code, password_hash
         FROM public.nt_users WHERE lower(email) = $1 FOR UPDATE`, [email]);
      const row = result.rows[0];
      const matches = await matchesPassword(password, row?.password_hash || dummyHash);
      if (!row || !matches) {
        await client.query('ROLLBACK');
        return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
      }
      const session = await createSession(client, row.id, sessionDevice(req));
      await client.query('COMMIT');
      res.json({ user: publicUser(row), ...session });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.auth.user });
  });

  router.post('/logout', requireAuth, async (req, res) => {
    await pool.query(
      'DELETE FROM public.nt_sessions WHERE token_hash = $1',
      [req.auth.tokenHash],
    );

    res.status(204).end();
  });

  return router;
}
