import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';
import { route, ApiError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Counterparty picker for the "new escrow" form. Only SELLER / ARBITRATOR are listed; no emails/hashes leak.
export const GET = route(async (req) => {
  await requireUser(['BUYER', 'ADMIN']);
  const role = new URL(req.url).searchParams.get('role');
  if (!['SELLER', 'ARBITRATOR'].includes(role)) throw new ApiError(400, 'role must be SELLER or ARBITRATOR');
  const users = await query('SELECT user_id, name FROM users WHERE role = ? ORDER BY name', [role]);
  return NextResponse.json({ users });
});
