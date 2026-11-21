

import { createAuthRouter } from './auth.mjs';
import express from 'express';
import pg from 'pg';

const pool = new pg.Pool({
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

const app = express();
app.disable('x-powered-by');

app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '16kb' }));
app.use('/v1/admin', createAuthRouter(pool, { administrative: true }));
app.use('/v1/auth', createAuthRouter(pool));

app.get('/health', async (_req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    await pool.query('SELECT 1');

    res.json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    console.error('Falha no PostgreSQL:', error.code || 'sem_codigo');

    res.status(503).json({
      status: 'error',
      database: 'unavailable',
    });
  }
});

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);

  console.error('Erro da API:', error.code || error.type || 'INTERNAL');

  const status =
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500
      ? error.status
      : 500;

  res.set('Cache-Control', 'no-store');
  res.status(status).json({
    error: 'Não foi possível processar a solicitação.',
  });
});

const port = Number(process.env.PORT || 3001);

const server = app.listen(port, '127.0.0.1');

server.once('listening', () => {
  console.log(`API local iniciada na porta ${port}`);
});

server.once('error', (error) => {
  console.error('Falha ao iniciar a API:', error.code);
  void pool.end().finally(() => process.exit(1));
});

function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
