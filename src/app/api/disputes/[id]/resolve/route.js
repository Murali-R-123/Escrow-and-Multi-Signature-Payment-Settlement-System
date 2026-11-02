import { NextResponse } from 'next/server';
import { query, callProc } from '@/lib/mysql';
import { route, ApiError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { resolveSchema } from '@/lib/validate';
import { logEvent } from '@/lib/audit';

export const POST = route(async (req, { params }) => {
  const user = await requireUser(['ARBITRATOR']);
  const id = Number(params.id);
  const b = resolveSchema.parse(await req.json());
  const [d] = await query('SELECT escrow_id FROM disputes WHERE dispute_id = ?', [id]);
  if (!d) throw new ApiError(404, 'Dispute not found');
  const rows = await callProc('sp_resolve_dispute', [id, user.id, b.outcome]);
  await logEvent({ escrow_id: d.escrow_id, actor_id: user.id, actor_role: user.role, action: 'DISPUTE_RESOLVED',
    meta: { dispute_id: id, outcome: b.outcome, note: b.note || null } });
  return NextResponse.json(rows[0]);
});
