import { NextResponse } from 'next/server';
import { callProc } from '@/lib/mysql';
import { route } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { logEvent } from '@/lib/audit';

export const POST = route(async (_req, { params }) => {
  const user = await requireUser();
  const id = Number(params.id);
  const rows = await callProc('sp_release_escrow', [id, user.id]);
  await logEvent({ escrow_id: id, actor_id: user.id, actor_role: user.role, action: 'FUNDS_RELEASED', meta: { amount: rows[0].amount } });
  return NextResponse.json(rows[0]);
});
