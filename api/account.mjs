import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createRequireAuth, createSession, hashPassword, matchesPassword, sessionDevice } from './auth.mjs';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
export function createAccountRouter(pool) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(createRequireAuth(pool));
  router.get('/profile', async (req, res) => {
    const row = (await pool.query('SELECT bio, avatar_jpeg FROM public.nt_users WHERE id=$1', [req.auth.user.id])).rows[0];
    res.json({ user: req.auth.user, bio: row.bio, avatar: row.avatar_jpeg ? `data:image/jpeg;base64,${row.avatar_jpeg.toString('base64')}` : null });
  });
  router.patch('/profile', async (req, res) => {
    const { name, bio } = req.body || {};
    if (typeof name !== 'string' || [...name.trim()].length < 2 || [...name.trim()].length > 120 ||
      typeof bio !== 'string' || [...bio.trim()].length > 300) return res.status(400).json({ error: 'Nome: 2 a 120 caracteres. Biografia: até 300 caracteres.' });
    await pool.query('UPDATE public.nt_users SET name=$2,bio=$3 WHERE id=$1', [req.auth.user.id, name.trim(), bio.trim()]);
    res.json({ message: 'Perfil atualizado.' });
  });
  router.put('/avatar', async (req, res) => {
    const base64 = req.body?.base64;
    if (typeof base64 !== 'string' || base64.length > 53336 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return res.status(400).json({ error: 'Envie uma foto JPEG de até 40 KB.' });
    const image = Buffer.from(base64, 'base64');
    if (image.length < 10 || image.length > 40000 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff ||
      image[image.length-2] !== 0xff || image[image.length-1] !== 0xd9) return res.status(400).json({ error: 'Foto JPEG inválida ou muito grande.' });
    await pool.query('UPDATE public.nt_users SET avatar_jpeg=$2 WHERE id=$1', [req.auth.user.id, image]);
    res.json({ message: 'Foto atualizada.' });
  });
  router.delete('/avatar', async (req, res) => {
    await pool.query('UPDATE public.nt_users SET avatar_jpeg=NULL WHERE id=$1', [req.auth.user.id]); res.status(204).end();
  });
  router.get('/sessions', async (req, res) => {
    const result = await pool.query(`SELECT id, device_label AS "deviceLabel", created_at AS "createdAt",
      last_seen_at AS "lastSeenAt", expires_at AS "expiresAt", id=$2 AS current
      FROM public.nt_sessions WHERE user_id=$1 AND expires_at>NOW() ORDER BY last_seen_at DESC`, [req.auth.user.id, req.auth.sessionId]);
    res.json({ sessions: result.rows });
  });
  router.delete('/sessions/others', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize with login and password changes for this account.
      await client.query('SELECT id FROM public.nt_users WHERE id=$1 FOR UPDATE', [req.auth.user.id]);
      const active=await client.query('SELECT id FROM public.nt_sessions WHERE id=$1 AND expires_at>NOW()', [req.auth.sessionId]);
      if(!active.rowCount){await client.query('ROLLBACK');return res.status(401).json({error:'Entre novamente.'});}
      await client.query('DELETE FROM public.nt_sessions WHERE user_id=$1 AND id<>$2', [req.auth.user.id, req.auth.sessionId]);
      await client.query("INSERT INTO public.nt_account_events(user_id,actor_id,event) VALUES ($1,$1,'session_revoked')", [req.auth.user.id]);
      await client.query('COMMIT'); res.status(204).end();
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  router.delete('/sessions/:id', async (req, res) => {
    if (!uuid(req.params.id) || req.params.id === req.auth.sessionId) return res.status(400).json({ error: 'Use Sair da conta para encerrar a sessão atual.' });
    const result = await pool.query('DELETE FROM public.nt_sessions WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.auth.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Sessão não encontrada.' });
    await pool.query("INSERT INTO public.nt_account_events(user_id,actor_id,event) VALUES ($1,$1,'session_revoked')", [req.auth.user.id]);
    res.status(204).end();
  });
  const passwords = rateLimit({ windowMs: 15*60*1000, limit: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Muitas tentativas de alteração de senha. Aguarde 15 minutos.' } });
  router.put('/password', passwords, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || currentPassword.length>128 || typeof newPassword !== 'string' || newPassword.length<12 || newPassword.length>128 || newPassword===currentPassword) {
      return res.status(400).json({ error: 'Informe a senha atual e uma nova senha diferente, de 12 a 128 caracteres.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = (await client.query('SELECT password_hash FROM public.nt_users WHERE id=$1 FOR UPDATE', [req.auth.user.id])).rows[0];
      // The session must still be valid after acquiring the account lock.
      const active = await client.query('SELECT id FROM public.nt_sessions WHERE id=$1 AND expires_at>NOW()', [req.auth.sessionId]);
      if (!active.rowCount) { await client.query('ROLLBACK'); return res.status(401).json({ error: 'Entre novamente.' }); }
      if (!(await matchesPassword(currentPassword, row.password_hash))) {
        await client.query('ROLLBACK'); return res.status(403).json({ error: 'Senha atual incorreta.' });
      }
      await client.query('UPDATE public.nt_users SET password_hash=$2 WHERE id=$1', [req.auth.user.id, await hashPassword(newPassword)]);
      await client.query('DELETE FROM public.nt_sessions WHERE user_id=$1', [req.auth.user.id]);
      const session = await createSession(client, req.auth.user.id, sessionDevice(req), 'password_changed');
      await client.query('COMMIT');
      res.json({ ...session, user: req.auth.user });
    } catch(error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  });
  return router;
}
