// mongosh demo queries (the same pipelines the Admin page uses, plus extras)
db = db.getSiblingDB('escrow_audit');

// 1) Events per action
printjson(db.audit_events.aggregate([
  { $group: { _id: '$action', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray());

// 2) Timeline of ONE escrow (uses idx_escrow_timeline)
printjson(db.audit_events.find({ escrow_id: 1 }).sort({ ts: 1 }).toArray());

// 3) Daily activity
printjson(db.audit_events.aggregate([
  { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } }, events: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]).toArray());

// 4) Most active users
printjson(db.audit_events.aggregate([
  { $match: { actor_id: { $ne: null } } },
  { $group: { _id: '$actor_id', events: { $sum: 1 }, last_seen: { $max: '$ts' } } },
  { $sort: { events: -1 } }, { $limit: 5 }
]).toArray());

// 5) Average number of audit events per escrow, by final outcome action
printjson(db.audit_events.aggregate([
  { $match: { escrow_id: { $ne: null } } },
  { $group: { _id: '$escrow_id', events: { $sum: 1 }, actions: { $addToSet: '$action' } } },
  { $match: { actions: 'FUNDS_RELEASED' } },
  { $group: { _id: null, escrows_released: { $sum: 1 }, avg_events: { $avg: '$events' } } }
]).toArray());

// 6) Index proof
printjson(db.audit_events.find({ escrow_id: 1 }).explain('executionStats').executionStats.totalDocsExamined);
