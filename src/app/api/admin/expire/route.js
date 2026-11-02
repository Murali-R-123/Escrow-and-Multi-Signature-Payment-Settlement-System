import { NextResponse } from 'next/server';
import { callProc } from '@/lib/mysql';
import { route } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { logEvent } from '@/lib/audit';

export const POST = route(async () => {
  const user = await requireUser(['ADMIN']);
  const rows = await callProc('sp_expire_overdue_escrows');
  const expired = rows[0]?.expired_count ?? 0;
  await logEvent({ actor_id: user.id, actor_role: user.role, action: 'ESCROWS_EXPIRED', meta: { expired_count: expired } });
  return NextResponse.json({ expired_count: expired });
});
