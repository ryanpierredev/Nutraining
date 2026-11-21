import { Router } from 'express';
import { createRequireAuth } from './auth.mjs';
export function createManagementRouter(pool) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control','no-store'); next(); });
  router.use(createRequireAuth(pool), (req,res,next) => {
    if (req.auth.user.role !== 'admin') return res.status(403).json({ error: 'Acesso exclusivo do administrador.' });
    next();
  });
  router.get('/overview', async (_req,res) => {
    const result = await pool.query(`SELECT
      (SELECT count(*)::int FROM nt_users) AS "totalUsers",
      (SELECT count(*)::int FROM nt_users WHERE created_at>=NOW()-INTERVAL '7 days') AS "newUsers7d",
      (SELECT count(*)::int FROM nt_sessions WHERE expires_at>NOW()) AS "activeSessions",
      (SELECT count(DISTINCT user_id)::int FROM nt_sessions WHERE expires_at>NOW() AND last_seen_at>=NOW()-INTERVAL '15 minutes') AS "recentlyActive",
      (SELECT count(*)::int FROM nt_plans WHERE kind='workout' AND archived_at IS NULL) AS workouts,
      (SELECT count(*)::int FROM nt_plans WHERE kind='nutrition' AND archived_at IS NULL) AS diets,
      (SELECT count(*)::int FROM nt_connections) AS connections`);
    const roles = await pool.query('SELECT role,count(*)::int AS count FROM nt_users GROUP BY role');
    res.json({ ...result.rows[0], roles: Object.fromEntries(roles.rows.map(r=>[r.role,r.count])) });
  });
  router.use((req,res,next) => {
    const offset = Number(req.query.offset ?? 0);
    if (!Number.isSafeInteger(offset) || offset<0 || offset>1000000 || (req.query.q!==undefined && (typeof req.query.q!=='string' || req.query.q.length>120))) return res.status(400).json({ error:'Filtro inválido.' });
    req.listOffset=offset; req.listSearch=`%${(req.query.q || '').trim()}%`; next();
  });
  router.get('/users', async (req,res) => {
    const result=await pool.query(`SELECT u.id,u.name,u.email,u.role,u.created_at AS "createdAt",u.last_login_at AS "lastLoginAt",
      (SELECT count(*)::int FROM nt_sessions s WHERE s.user_id=u.id AND s.expires_at>NOW()) AS "activeSessions",
      (SELECT e.event FROM nt_account_events e WHERE e.user_id=u.id AND e.event IN ('signup','account_created') ORDER BY e.id LIMIT 1) AS source
      FROM nt_users u WHERE u.name ILIKE $1 OR u.email ILIKE $1 ORDER BY u.created_at DESC,u.id DESC LIMIT 26 OFFSET $2`, [req.listSearch,req.listOffset]);
    res.json({ users:result.rows.slice(0,25),nextOffset:result.rows.length>25?req.listOffset+25:null });
  });
  router.get('/sessions', async (req,res) => {
    const result=await pool.query(`SELECT s.id,u.id AS "userId",u.name,u.email,u.role,s.device_label AS "deviceLabel",
      s.created_at AS "createdAt",s.last_seen_at AS "lastSeenAt",s.expires_at AS "expiresAt",s.id=$3 AS current
      FROM nt_sessions s JOIN nt_users u ON u.id=s.user_id WHERE s.expires_at>NOW()
      AND (u.name ILIKE $1 OR u.email ILIKE $1) ORDER BY s.last_seen_at DESC,s.id DESC LIMIT 26 OFFSET $2`, [req.listSearch,req.listOffset,req.auth.sessionId]);
    res.json({ sessions:result.rows.slice(0,25),nextOffset:result.rows.length>25?req.listOffset+25:null });
  });
  router.get('/events', async (req,res) => {
    const result=await pool.query(`SELECT e.id::text,e.event,e.created_at AS "createdAt",u.name,u.email,a.name AS "actorName"
      FROM nt_account_events e JOIN nt_users u ON u.id=e.user_id LEFT JOIN nt_users a ON a.id=e.actor_id
      WHERE u.name ILIKE $1 OR u.email ILIKE $1 ORDER BY e.created_at DESC,e.id DESC LIMIT 26 OFFSET $2`,[req.listSearch,req.listOffset]);
    res.json({ events:result.rows.slice(0,25),nextOffset:result.rows.length>25?req.listOffset+25:null });
  });
  router.delete('/sessions/:id', async (req,res) => {
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(req.params.id) || req.params.id===req.auth.sessionId) return res.status(400).json({ error:'Sessão inválida. Para encerrar sua sessão atual, use Sair da conta.' });
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const result=await client.query('DELETE FROM nt_sessions WHERE id=$1 RETURNING user_id',[req.params.id]);
      if(!result.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error:'Sessão não encontrada.' }); }
      await client.query("INSERT INTO nt_account_events(user_id,actor_id,event) VALUES ($1,$2,'session_revoked')",[result.rows[0].user_id,req.auth.user.id]);
      await client.query('COMMIT'); res.status(204).end();
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  return router;
}
