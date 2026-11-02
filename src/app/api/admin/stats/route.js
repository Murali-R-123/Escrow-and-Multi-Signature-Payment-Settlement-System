import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';
import { route } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { auditStats } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireUser(['ADMIN']);

  // ---- SQL analytics (GROUP BY / HAVING / views / subqueries) ----
  const byStatus = await query('SELECT status, COUNT(*) AS count, SUM(amount) AS total FROM escrows GROUP BY status ORDER BY total DESC');
  const monthly = await query('SELECT month, release_count, total_released FROM v_monthly_released ORDER BY month DESC LIMIT 12');
  const topBuyers = await query(
    `SELECT u.name, COUNT(*) AS escrows, SUM(e.amount) AS total
       FROM escrows e JOIN users u ON u.user_id = e.buyer_id
      GROUP BY u.user_id, u.name HAVING COUNT(*) >= 1 ORDER BY total DESC LIMIT 5`);
  const usersByRole = await query('SELECT role, COUNT(*) AS count FROM users GROUP BY role');
  const [totals] = await query(
    `SELECT (SELECT COUNT(*) FROM escrows) AS escrows,
            (SELECT COALESCE(SUM(amount),0) FROM escrows WHERE status IN ('PENDING','APPROVED','DISPUTED')) AS locked_value,
            (SELECT COUNT(*) FROM disputes WHERE status = 'OPEN') AS open_disputes,
            (SELECT COUNT(*) FROM escrows WHERE status = 'PENDING' AND deadline < UTC_TIMESTAMP()) AS overdue`);
  const pendingSignatures = await query('SELECT * FROM v_pending_signatures ORDER BY deadline LIMIT 10');

  // ---- NoSQL analytics (MongoDB aggregation) ----
  let audit = null;
  try { audit = await auditStats(); } catch { audit = null; }

  return NextResponse.json({ byStatus, monthly, topBuyers, usersByRole, totals, pendingSignatures, audit });
});
