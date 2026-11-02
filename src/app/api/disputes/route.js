import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';
import { route } from '@/lib/errors';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status');
  const q = (sp.get('q') || '').trim().slice(0, 100);

  const where = [];
  const params = [user.id]; // first ? = can_resolve subquery
  if (user.role !== 'ADMIN') {
    where.push(`(e.buyer_id = ? OR e.seller_id = ?
                 OR EXISTS (SELECT 1 FROM escrow_signers x WHERE x.escrow_id = d.escrow_id AND x.user_id = ?))`);
    params.push(user.id, user.id, user.id);
  }
  if (['OPEN', 'RESOLVED', 'REJECTED'].includes(status)) { where.push('d.status = ?'); params.push(status); }
  if (q) {
    where.push('(MATCH(d.reason) AGAINST (? IN NATURAL LANGUAGE MODE) OR d.reason LIKE ?)');
    params.push(q, `%${q}%`);
  }
  const rows = await query(
    `SELECT d.dispute_id, d.escrow_id, d.reason, d.status, d.created_at, d.resolved_at,
            ru.name AS raised_by_name, rs.name AS resolved_by_name,
            e.amount AS escrow_amount, e.status AS escrow_status,
            (d.status = 'OPEN' AND EXISTS (SELECT 1 FROM escrow_signers z
                 WHERE z.escrow_id = d.escrow_id AND z.user_id = ? AND z.signer_role = 'ARBITRATOR')) AS can_resolve
       FROM disputes d
       JOIN escrows e ON e.escrow_id = d.escrow_id
       JOIN users ru ON ru.user_id = d.raised_by
       LEFT JOIN users rs ON rs.user_id = d.resolved_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY d.status = 'OPEN' DESC, d.created_at DESC`, params);
  return NextResponse.json({ disputes: rows });
});
