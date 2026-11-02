// Edge-safe JWT helpers (used by middleware AND route handlers). Only depends on `jose`.
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'escrow_token';
export const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET missing or shorter than 32 characters');
  return new TextEncoder().encode(s);
}

export async function signToken(user) {
  return new SignJWT({ name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.user_id))
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(secret());
}

/** returns { id, name, role } or null */
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: Number(payload.sub), name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}
