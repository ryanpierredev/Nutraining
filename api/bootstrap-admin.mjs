import { text } from 'node:stream/consumers';
import pg from 'pg';
import { insertUser, normalizeEmail, validEmail, validName, validPassword } from './users.mjs';

const [action, emailArg, name] = process.argv.slice(2);
const create = action === '--create';
const email = normalizeEmail(create ? emailArg : action);
if (!validEmail(email) || (create && !validName(name))) {
  console.error('Uso: node --env-file=.env bootstrap-admin.mjs email');
  console.error('Para criar a primeira conta: node --env-file=.env bootstrap-admin.mjs --create email "Nome" (senha pela entrada padrão).');
  process.exit(1);
}

let password;
if (create) {
  if (process.stdin.isTTY) {
    console.error('Forneça a senha pela entrada padrão, conforme docs/EC2.md.');
    process.exit(1);
  }
  password = (await text(process.stdin)).replace(/\r?\n$/, '');
  if (!validPassword(password)) {
    console.error('A senha deve ter entre 12 e 128 caracteres.');
    process.exit(1);
  }
}

const client = new pg.Client();
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(72684103)');
  const admins = await client.query("SELECT id FROM public.nt_users WHERE role = 'admin' LIMIT 1");
  if (admins.rowCount) throw new Error('Já existe administrador. Use o painel para cadastrar outros.');

  if (create) {
    await insertUser(client, { name, email, password, role: 'admin', source: 'bootstrap' });
  } else {
    const result = await client.query(
      "UPDATE public.nt_users SET role = 'admin', professional_code = NULL WHERE lower(email) = $1 RETURNING id", [email],
    );
    if (!result.rowCount) throw new Error('Conta inexistente. Use --create para criar o primeiro administrador.');
    await client.query('DELETE FROM public.nt_sessions WHERE user_id = $1', [result.rows[0].id]);
  }

  await client.query('COMMIT');
  console.log('Administrador disponível. Entre no aplicativo com essa conta.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error.code === '23505' ? 'Já existe uma conta com esse e-mail. Use o modo de promoção.' : error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
