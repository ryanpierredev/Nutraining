import { Router } from 'express';
import { createAccountRouter, publicUser } from './account.mjs';
import { createDirectoryRouter } from './directory.mjs';
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

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, scryptOptions);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}

async function matchesPassword(password, storedHash) {
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

async function createSession(database, userId, deviceLabel) {
  const label = typeof deviceLabel === 'string'
    ? [...deviceLabel.replace(/\p{C}/gu, ' ').trim()].slice(0, 80).join('') : '';
  const token = randomBytes(32).toString('base64url');

  const result = await database.query(
    `INSERT INTO public.nt_sessions
       (token_hash, user_id, device_label, last_seen_at, expires_at)
     VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '7 days')
     RETURNING expires_at`,
    [tokenHash(token), userId, label || null],
  );

  return {
    token,
    expiresAt: result.rows[0].expires_at,
  };
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
      `WITH seen AS (
         UPDATE public.nt_sessions SET last_seen_at=NOW()
         WHERE token_hash=$1 AND expires_at>NOW()
           AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '5 minutes')
       )
       SELECT u.id, u.name, u.email, u.role, u.professional_code, u.theme, u.created_at, s.id AS session_id
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
      sessionId: result.rows[0].session_id,
    };

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
    router.use(createDirectoryRouter(pool));
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
           (name, email, password_hash, role, professional_code, registration_source, registered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email, role, professional_code, theme, created_at`,
        [name, email, passwordHash, role, code, administrative ? 'admin' : 'self', administrative ? req.auth.user.id : null],
      );

      const user = publicUser(result.rows[0]);
      const session = administrative ? {} : await createSession(client, user.id, body.deviceLabel);

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

    const result = await pool.query(
      `SELECT id, name, email, role, professional_code, theme, created_at, password_hash
       FROM public.nt_users
       WHERE lower(email) = $1`,
      [email],
    );

    const row = result.rows[0];
    const matches = await matchesPassword(
      password,
      row?.password_hash || dummyHash,
    );

    if (!row || !matches) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const session = await createSession(pool, row.id, req.body.deviceLabel);
    res.json({ user: publicUser(row), ...session });
  });

  router.use(requireAuth, createAccountRouter(pool));
  return router;
}
