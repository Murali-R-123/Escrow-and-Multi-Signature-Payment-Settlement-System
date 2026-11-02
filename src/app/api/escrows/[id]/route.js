import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';
import { route, ApiError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { assertEscrowAccess } from '@/lib/access';
import { listEvents } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = route(async (_req, { params }) => {
  const user = await requireUser();
  const id = await assertEscrowAccess(user, params.id);

  const [escrow] = await query('SELECT * FROM v_escrow_summary WHERE escrow_id = ?', [id]);
  if (!escrow) throw new ApiError(404, 'Escrow not found');

  const signers = await query(
    `SELECT es.user_id, u.name, es.signer_role, a.decision, a.approved_at, a.remarks
       FROM escrow_signers es
       JOIN users u ON u.user_id = es.user_id
       LEFT JOIN approvals a ON a.escrow_id = es.escrow_id AND a.user_id = es.user_id
      WHERE es.escrow_id = ? ORDER BY es.signer_id`, [id]);
  const transactions = await query(
    'SELECT transaction_id, transaction_type, amount, transaction_status, created_at FROM transactions WHERE escrow_id = ? ORDER BY transaction_id', [id]);
  const disputes = await query(
    `SELECT d.dispute_id, d.reason, d.status, d.created_at, d.resolved_at, u.name AS raised_by_name, r.name AS resolved_by_name
       FROM disputes d JOIN users u ON u.user_id = d.raised_by LEFT JOIN users r ON r.user_id = d.resolved_by
      WHERE d.escrow_id = ? ORDER BY d.dispute_id`, [id]);

  let audit = [];
  try { audit = (await listEvents({ escrow_id: id, limit: 100 })).reverse(); } catch { /* MongoDB offline: page still works */ }

  const mine = signers.find((s) => s.user_id === user.id) || null;
  return NextResponse.json({ escrow, signers, transactions, disputes, audit, me: { id: user.id, role: user.role, signer: mine } });
});
