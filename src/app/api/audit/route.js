import { NextResponse } from 'next/server';
import { route, ApiError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { assertEscrowAccess } from '@/lib/access';
import { listEvents, ACTIONS } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const escrow_id = sp.get('escrow_id');
  const action = sp.get('action');
  if (action && !ACTIONS.includes(action)) throw new ApiError(400, 'Unknown action');

  if (escrow_id) await assertEscrowAccess(user, escrow_id);
  else if (user.role !== 'ADMIN') throw new ApiError(403, 'Only admins can read the global audit log');

  try {
    const events = await listEvents({ escrow_id, action, limit: sp.get('limit') });
    return NextResponse.json({ events });
  } catch {
    throw new ApiError(503, 'Audit log (MongoDB) is unavailable');
  }
});
