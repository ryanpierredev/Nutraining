import pg from 'pg';
import { readFile } from 'node:fs/promises';

const client = new pg.Client();
await client.connect();
try {
  await client.query('SELECT pg_advisory_lock(72684102)');
  const exists = await client.query("SELECT to_regclass('public.nt_schema_migrations') AS name");
  const versions = exists.rows[0].name
    ? new Set((await client.query('SELECT version FROM public.nt_schema_migrations')).rows.map(r => r.version))
    : new Set();
  for (const [version, file] of [[1, '001_auth.sql'], [2, '002_admin.sql'], [3, '003_app.sql'], [4, '004_account_and_plans.sql'], [5, '005_account_creators.sql'], [6, '006_exercise_loads.sql']]) {
    if (versions.has(version)) continue;
    await client.query(await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8'));
    console.log(`Migração ${version} aplicada.`);
  }
  console.log('Banco atualizado.');
} finally {
  await client.end();
}
