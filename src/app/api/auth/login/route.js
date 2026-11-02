import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';
import { route, ApiError } from '@/lib/errors';
import { loginSchema } from '@/lib/validate';
import { verifyPassword } from '@/lib/auth';
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/token';
import { logEvent } from '@/lib/audit';

export const POST = route(async (req) => {
  const { email, password } = loginSchema.parse(await req.json());
  const rows = await query('SELECT user_id, name, role, password_hash FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await logEvent({ actor_id: user?.user_id ?? null, action: 'LOGIN_FAILED', meta: { email } });
    throw new ApiError(401, 'Invalid email or password');
  }
  const res = NextResponse.json({ user: { id: user.user_id, name: user.name, role: user.role } });
  res.cookies.set(COOKIE_NAME, await signToken(user), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: COOKIE_MAX_AGE,
  });
  await logEvent({ actor_id: user.user_id, actor_role: user.role, action: 'USER_LOGIN' });
  return res;
});
