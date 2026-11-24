import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

export const roles = new Set(['student', 'trainer', 'nutritionist', 'admin']);

const scrypt = promisify(scryptCallback);

const scryptOptions = {
  N: 32768,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024,
};

export const dummyHash =
  `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

export const normalizeEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export const validEmail = (value) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const validPassword = (value) =>
  typeof value === 'string' &&
  value.length >= 12 &&
  value.length <= 128;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, scryptOptions);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}

export async function matchesPassword(password, storedHash) {
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

export function validName(name) {
  return typeof name === 'string' && [...name.trim()].length >= 2 && [...name.trim()].length <= 120;
}

export async function insertUser(database, { name, email, password, role, source, registeredBy = null }) {
  const passwordHash = await hashPassword(password);
  const professionalCode = role === 'trainer' || role === 'nutritionist' ? randomBytes(12).toString('hex') : null;
  const result = await database.query(
    `INSERT INTO public.nt_users
       (name, email, password_hash, role, professional_code, registration_source, registered_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, email, role, professional_code, theme, created_at`,
    [name.trim(), email, passwordHash, role, professionalCode, source, registeredBy],
  );
  return result.rows[0];
}
