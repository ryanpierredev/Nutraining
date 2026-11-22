import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import sharp from 'sharp';

export function publicUser(row) {
  return {
    id: row.id, name: row.name, email: row.email, role: row.role,
    professionalCode: row.professional_code, theme: row.theme, createdAt: row.created_at,
  };
}

const photoLimit = 45 * 1024;
async function profilePhoto(base64) {
  if (typeof base64 !== 'string' || base64.length > Math.ceil(photoLimit / 3) * 4 ||
      !base64.startsWith('/9j/') || !/^[a-zA-Z0-9+/]+={0,2}$/.test(base64)) return null;
  try {
    const input = Buffer.from(base64, 'base64');
    // Decode and re-encode: only image pixels are retained, never EXIF or the original file.
    return await sharp(input, { limitInputPixels: 1024 * 1024, failOn: 'warning' })
      .rotate().resize(256, 256, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer();
  } catch { return null; }
}

// All routes run after authentication and address only the signed-in account.
export function createAccountRouter(pool) {
  const router = Router();

  router.get('/me', (req, res) => res.json({ user: req.auth.user }));
  router.patch('/me', async (req, res) => {
    const { name, theme } = req.body ?? {};
    if ((name === undefined && theme === undefined) ||
        (name !== undefined && (typeof name !== 'string' || [...name.trim()].length < 2 || [...name.trim()].length > 120)) ||
        (theme !== undefined && !['dark', 'light'].includes(theme)) ||
        Object.keys(req.body).some(key => key !== 'name' && key !== 'theme')) {
      return res.status(400).json({ error: 'Informe um nome de 2 a 120 caracteres ou um tema válido.' });
    }
    const result = await pool.query(
      `UPDATE public.nt_users SET name=COALESCE($2,name), theme=COALESCE($3,theme)
       WHERE id=$1 RETURNING id, name, email, role, professional_code, theme, created_at`,
      [req.auth.user.id, name?.trim(), theme]);
    res.json({ user: publicUser(result.rows[0]) });
  });

  router.get('/me/photo', async (req, res) => {
    const { rows } = await pool.query('SELECT photo_jpeg FROM public.nt_users WHERE id=$1', [req.auth.user.id]);
    const photo = rows[0].photo_jpeg;
    res.json({ photo: photo ? 'data:image/jpeg;base64,' + photo.toString('base64') : null });
  });
  router.put('/me/photo', rateLimit({
    windowMs: 60000, limit: 12, keyGenerator: req => req.auth.user.id,
    standardHeaders: true, legacyHeaders: false, message: { error: 'Aguarde um minuto para alterar a foto.' },
  }), async (req, res) => {
    const photo = await profilePhoto(req.body?.image);
    if (!photo) return res.status(400).json({ error: 'Escolha uma foto JPEG válida de até 45 KB.' });
    await pool.query('UPDATE public.nt_users SET photo_jpeg=$2 WHERE id=$1', [req.auth.user.id, photo]);
    res.status(204).end();
  });
  router.delete('/me/photo', async (req, res) => {
    await pool.query('UPDATE public.nt_users SET photo_jpeg=NULL WHERE id=$1', [req.auth.user.id]);
    res.status(204).end();
  });

  router.get('/sessions', async (req, res) => {
    const result = await pool.query(
      `SELECT id, device_label AS "deviceLabel", created_at AS "createdAt",
              last_seen_at AS "lastSeenAt", expires_at AS "expiresAt", id=$2 AS current
       FROM public.nt_sessions WHERE user_id=$1 AND expires_at>NOW()
       ORDER BY current DESC, last_seen_at DESC NULLS LAST, created_at DESC`,
      [req.auth.user.id, req.auth.sessionId]);
    res.json({ sessions: result.rows });
  });
  router.delete('/sessions/others', async (req, res) => {
    await pool.query('DELETE FROM public.nt_sessions WHERE user_id=$1 AND id<>$2', [req.auth.user.id, req.auth.sessionId]);
    res.status(204).end();
  });
  router.delete('/sessions/:id', async (req, res) => {
    const id = req.params.id;
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Sessão inválida.' });
    }
    if (id.toLowerCase() === req.auth.sessionId) {
      return res.status(400).json({ error: 'Para encerrar esta sessão, use Sair da conta.' });
    }
    const result = await pool.query('DELETE FROM public.nt_sessions WHERE user_id=$1 AND id=$2', [req.auth.user.id, id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Sessão não encontrada.' });
    res.status(204).end();
  });
  router.post('/logout', async (req, res) => {
    await pool.query('DELETE FROM public.nt_sessions WHERE id=$1', [req.auth.sessionId]);
    res.status(204).end();
  });
  return router;
}
