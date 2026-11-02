import { NextResponse } from 'next/server';
import { callProc } from '@/lib/mysql';
import { route } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { disputeSchema } from '@/lib/validate';
import { logEvent } from '@/lib/audit';

export const POST = route(async (req, { params }) => {
  const user = await requireUser(['BUYER', 'SELLER']);
  const id = Number(params.id);
  const { reason } = disputeSchema.parse(await req.json());
  const rows = await callProc('sp_raise_dispute', [id, user.id, reason]);
  await logEvent({ escrow_id: id, actor_id: user.id, actor_role: user.role, action: 'DISPUTE_RAISED',
    meta: { dispute_id: rows[0].dispute_id, reason } });
  return NextResponse.json({ dispute_id: rows[0].dispute_id }, { status: 201 });
});
