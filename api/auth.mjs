import { Router } from 'express';
import { createAccountRouter, publicUser } from './account.mjs';
import { createDirectoryRouter } from './directory.mjs';
import { activeSession } from './session-policy.mjs';
import { rateLimit } from 'express-rate-limit';
import { createHash, randomBytes } from 'node:crypto';
import { dummyHash, insertUser, matchesPassword, normalizeEmail, roles, validEmail, validName, validPassword } from './users.mjs';

const tokenHash = (token) =>
  createHash('sha256').update(token).digest('hex');
const professionalRoles = ['trainer', 'nutritionist'];

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
      `UPDATE public.nt_sessions s SET last_seen_at=GREATEST(s.last_seen_at, NOW())
       FROM public.nt_users u
       WHERE u.id=s.user_id AND s.token_hash=$1 AND ${activeSession}
       RETURNING u.id, u.name, u.email, u.role, u.professional_code, u.theme, u.created_at, s.id AS session_id`,
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

  const creations = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    keyGenerator: req => req.auth.user.id,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitos cadastros. Aguarde 15 minutos.' },
  });

  async function createAccount(req, res) {
    const actor = req.auth.user;
    const body = req.body ?? {};
    const role = body.role ?? 'student';
    if (!administrative && role !== 'student') {
      return res.status(403).json({ error: 'Seu perfil não pode cadastrar este tipo de conta.' });
    }
    const email = normalizeEmail(body.email);
    if (!roles.has(role) || !validName(body.name) || !validEmail(email) || !validPassword(body.password)) {
      return res.status(400).json({ error: 'Informe nome, e-mail e senha de 12 a 128 caracteres.' });
    }
    try {
      const row = await insertUser(pool, {
        name: body.name, email, password: body.password, role, registeredBy: actor.id,
        source: actor.role === 'admin' ? 'admin' : 'professional',
      });
      res.status(201).json({ user: publicUser(row) });
    } catch (error) {
      if (error.code !== '23505') throw error;
      return res.status(409).json({ error: 'Não foi possível criar uma conta com esse e-mail.' });
    }
  }

  if (administrative) {
    router.use(requireAuth, (req, res, next) => {
      if (req.auth.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso exclusivo do administrador.' });
      }
      next();
    });
    router.use(createDirectoryRouter(pool));
    router.post('/users', creations, createAccount);
    return router;
  }

  const signupAttempts = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de cadastro. Aguarde 15 minutos.' },
  });
  router.post('/register', signupAttempts, async (req, res) => {
    const { name, password, role, deviceLabel } = req.body ?? {};
    if (!professionalRoles.includes(role)) {
      return res.status(403).json({ error: 'O cadastro público é para personal e nutricionista. Contas de aluno devem ser criadas por um profissional ou administrador.' });
    }
    const email = normalizeEmail(req.body.email);
    if (!validName(name) || !validEmail(email) || !validPassword(password)) {
      return res.status(400).json({ error: 'Informe nome, e-mail e senha de 12 a 128 caracteres.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await insertUser(client, { name, email, password, role, source: 'self' });
      const session = await createSession(client, row.id, deviceLabel);
      await client.query('COMMIT');
      res.status(201).json({ user: publicUser(row), ...session });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code !== '23505') throw error;
      res.status(409).json({ error: 'Não foi possível criar uma conta com esse e-mail.' });
    } finally {
      client.release();
    }
  });
  router.post('/students', requireAuth, (req, res, next) => {
    const { role } = req.auth.user;
    if (role !== 'admin' && !professionalRoles.includes(role)) {
      return res.status(403).json({ error: 'Seu perfil não pode cadastrar alunos.' });
    }
    next();
  }, creations, createAccount);

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
