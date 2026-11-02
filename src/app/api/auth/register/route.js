import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';
import { route, ApiError } from '@/lib/errors';
import { registerSchema } from '@/lib/validate';
import { hashPassword } from '@/lib/auth';
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/token';
import { logEvent } from '@/lib/audit';

export const POST = route(async (req) => {
  const body = registerSchema.parse(await req.json());
  const password_hash = await hashPassword(body.password);
  let result;
  try {
    result = await query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [body.name, body.email, password_hash, body.role]);
  } catch (e) {
    if (e.errno === 1062) throw new ApiError(409, 'This email is already registered');
    throw e;
  }
  const user = { user_id: result.insertId, name: body.name, role: body.role };
  const res = NextResponse.json({ user: { id: user.user_id, name: user.name, role: user.role } }, { status: 201 });
  res.cookies.set(COOKIE_NAME, await signToken(user), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: COOKIE_MAX_AGE,
  });
  await logEvent({ actor_id: user.user_id, actor_role: user.role, action: 'USER_REGISTERED', meta: { email: body.email } });
  return res;
});
