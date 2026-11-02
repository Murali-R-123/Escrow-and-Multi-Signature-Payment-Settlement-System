import { NextResponse } from 'next/server';
import { callProc } from '@/lib/mysql';
import { route } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { approveSchema } from '@/lib/validate';
import { logEvent } from '@/lib/audit';

export const POST = route(async (req, { params }) => {
  const user = await requireUser(['BUYER', 'SELLER', 'ARBITRATOR']);
  const id = Number(params.id);
  const b = approveSchema.parse(await req.json());
  const rows = await callProc('sp_approve_escrow', [id, user.id, b.decision, b.remarks || null]);
  const { status, approvals_count } = rows[0];
  await logEvent({ escrow_id: id, actor_id: user.id, actor_role: user.role, action: 'APPROVAL_SUBMITTED',
    meta: { decision: b.decision, remarks: b.remarks || null, approvals_count, status_after: status } });
  if (status === 'APPROVED') {
    await logEvent({ escrow_id: id, actor_id: null, actor_role: 'SYSTEM', action: 'ESCROW_APPROVED',
      meta: { approvals_count, note: 'multisig threshold reached (database trigger)' } });
  }
  return NextResponse.json({ status, approvals_count });
});
