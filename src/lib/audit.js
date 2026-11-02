// NoSQL (MongoDB) audit trail: every state-changing action becomes one flexible document.
import { auditCollection } from './mongo';

export const ACTIONS = [
  'USER_REGISTERED', 'USER_LOGIN', 'LOGIN_FAILED',
  'ESCROW_CREATED', 'APPROVAL_SUBMITTED', 'ESCROW_APPROVED', 'FUNDS_RELEASED',
  'DISPUTE_RAISED', 'DISPUTE_RESOLVED', 'ESCROWS_EXPIRED',
];

/** Never throws: an audit-log outage must not break a payment. */
export async function logEvent({ escrow_id = null, actor_id = null, actor_role = null, action, meta = {} }) {
  try {
    const col = await auditCollection();
    await col.insertOne({ escrow_id, actor_id, actor_role, action, meta, ts: new Date() });
  } catch (e) {
    console.warn('[audit] could not write event', action, e.message);
  }
}

export async function listEvents({ escrow_id, action, limit = 50 } = {}) {
  const col = await auditCollection();
  const filter = {};
  if (escrow_id != null) filter.escrow_id = Number(escrow_id);
  if (action) filter.action = action;
  const docs = await col.find(filter).sort({ ts: -1 }).limit(Math.min(Number(limit) || 50, 200)).toArray();
  return docs.map((d) => ({ ...d, _id: String(d._id) }));
}

// ---- NoSQL aggregation pipelines -------------------------------------------------
export async function auditStats() {
  const col = await auditCollection();
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  const [actionCounts, daily, topActors] = await Promise.all([
    col.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    col.aggregate([
      { $match: { ts: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } }, events: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    col.aggregate([
      { $match: { actor_id: { $ne: null } } },
      { $group: { _id: '$actor_id', events: { $sum: 1 }, last_seen: { $max: '$ts' } } },
      { $sort: { events: -1 } },
      { $limit: 5 },
    ]).toArray(),
  ]);
  return { actionCounts, daily, topActors };
}
