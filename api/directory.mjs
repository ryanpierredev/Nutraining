import { Router } from 'express';
import { activeSession } from './session-policy.mjs';

// Mounted behind the administrator role check.
export function createDirectoryRouter(pool) {
  const router = Router();
  router.get('/overview', async (_req, res) => {
    const { rows } = await pool.query(`
      SELECT count(*)::int AS "totalUsers",
        count(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS "recentUsers",
        (SELECT count(DISTINCT user_id)::int FROM public.nt_sessions s WHERE ${activeSession}) AS "activeUsers",
        (SELECT count(*)::int FROM public.nt_sessions s WHERE ${activeSession}) AS "activeSessions"
      FROM public.nt_users`);
    res.json(rows[0]);
  });
  router.get('/users', async (req, res) => {
    const offset = Number(req.query.offset ?? 0);
    const query = req.query.q ?? '';
    const status = req.query.status ?? 'all';
    if (!Number.isSafeInteger(offset) || offset < 0 || typeof query !== 'string' || query.length > 254 ||
        !['all', 'active'].includes(status)) {
      return res.status(400).json({ error: 'Filtro ou página inválida.' });
    }
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.professional_code AS "professionalCode",
             u.created_at AS "createdAt", u.registration_source AS "registrationSource",
             creator.name AS "registeredByName", sessions.total AS "activeSessions"
      FROM public.nt_users u LEFT JOIN public.nt_users creator ON creator.id=u.registered_by
      CROSS JOIN LATERAL (SELECT count(*)::int AS total FROM public.nt_sessions s
                         WHERE s.user_id=u.id AND ${activeSession}) sessions
      WHERE ($2='' OR strpos(lower(u.name),lower($2))>0 OR strpos(lower(u.email),lower($2))>0)
        AND ($3='all' OR sessions.total>0)
      ORDER BY u.created_at DESC, u.id DESC LIMIT 51 OFFSET $1`, [offset, query.trim(), status]);
    res.json({ users: rows.slice(0, 50), nextOffset: rows.length > 50 ? offset + 50 : null });
  });
  return router;
}
