// Promote an existing registered account; no password or token is accepted by this command.
import pg from 'pg';
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Uso: node --env-file=.env bootstrap-admin.mjs email');
  process.exit(1);
}
const client = new pg.Client();
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(72684103)');
  const admins = await client.query("SELECT id FROM public.nt_users WHERE role = 'admin'");
  if (admins.rowCount) throw new Error('Já existe administrador. Use o painel para cadastrar outros.');
  const result = await client.query(
    "UPDATE public.nt_users SET role = 'admin', professional_code = NULL WHERE lower(email) = $1 RETURNING id", [email],
  );
  if (!result.rowCount) throw new Error('Conta inexistente. Cadastre a conta antes de promovê-la.');
  await client.query('DELETE FROM public.nt_sessions WHERE user_id = $1', [result.rows[0].id]);
  await client.query('COMMIT');
  console.log('Administrador criado. Entre novamente no aplicativo.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
