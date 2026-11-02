// Server-side auth helpers (Node runtime only).
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { COOKIE_NAME, verifyToken } from './token';
import { ApiError } from './errors';

const scrypt = promisify(crypto.scrypt);
const N = 16384, R = 8, P = 1, KEYLEN = 64;

/** format: scrypt$N$r$p$saltHex$hashHex */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [alg, n, r, p, saltHex, hashHex] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function getSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

/** Throws 401/403 ApiError. roles = optional allow-list. */
export async function requireUser(roles) {
  const user = await getSession();
  if (!user) throw new ApiError(401, 'Not authenticated');
  if (roles && !roles.includes(user.role)) throw new ApiError(403, 'Your role is not allowed to do this');
  return user;
}
