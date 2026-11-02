import { NextResponse } from 'next/server';
import { query, callProc, toMysqlDate } from '@/lib/mysql';
import { route, ApiError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { createEscrowSchema, ESCROW_STATUSES } from '@/lib/validate';
import { logEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// LIST + SEARCH + FILTER + PAGINATE (role-aware)
export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status');
  const q = (sp.get('q') || '').trim().slice(0, 100);
  const pageSize = Math.min(Math.max(Number(sp.get('pageSize')) || 20, 1), 100);
  const page = Math.max(Number(sp.get('page')) || 1, 1);

  const where = [];
  const params = [];
  if (user.role !== 'ADMIN') {
    where.push(`(s.buyer_id = ? OR s.seller_id = ?
                 OR EXISTS (SELECT 1 FROM escrow_signers x WHERE x.escrow_id = s.escrow_id AND x.user_id = ?))`);
    params.push(user.id, user.id, user.id);
  }
  if (status && ESCROW_STATUSES.includes(status)) { where.push('s.status = ?'); params.push(status); }
  if (q) {
    // FULLTEXT on description (ft_escrows_description) + LIKE fallback for short words / names / ids
    where.push(`(MATCH(e.description) AGAINST (? IN NATURAL LANGUAGE MODE)
                 OR e.description LIKE ? OR s.buyer_name LIKE ? OR s.seller_name LIKE ? OR s.escrow_id = ?)`);
    const like = `%${q}%`;
    params.push(q, like, like, like, Number(q) || 0);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'FROM v_escrow_summary s JOIN escrows e ON e.escrow_id = s.escrow_id';

  const [{ total }] = await query(`SELECT COUNT(*) AS total ${from} ${whereSql}`, params);
  const escrows = await query(
    `SELECT s.* ${from} ${whereSql} ORDER BY s.created_at DESC, s.escrow_id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]);
  return NextResponse.json({ escrows, total, page, pageSize });
});

// CREATE (buyer funds the escrow) -> one ACID stored procedure
export const POST = route(async (req) => {
  const user = await requireUser(['BUYER']);
  const b = createEscrowSchema.parse(await req.json());
  const deadline = toMysqlDate(b.deadline);
  if (!deadline) throw new ApiError(400, 'Invalid deadline');
  const rows = await callProc('sp_create_escrow', [
    user.id, b.seller_id, b.arbitrator_id ?? null, b.amount, b.description, deadline, b.required_signatures,
  ]);
  const { escrow_id, total_signers } = rows[0];
  await logEvent({
    escrow_id, actor_id: user.id, actor_role: user.role, action: 'ESCROW_CREATED',
    meta: { amount: b.amount, rule: `${b.required_signatures}-of-${total_signers}`, seller_id: b.seller_id, arbitrator_id: b.arbitrator_id ?? null },
  });
  return NextResponse.json({ escrow_id }, { status: 201 });
});
