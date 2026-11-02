# MongoDB design – `audit_events`

## Why MongoDB here (and not SQL)
Audit events differ in shape per action (an approval carries `decision`/`remarks`, a release carries `amount`, a dispute
resolution carries `outcome`/`note`). A document store holds this heterogeneous, append-only, write-heavy log without a
wide sparse table or constant migrations, while the money and relationships stay in MySQL where ACID and FKs matter.
Audit writes are also non-critical: if MongoDB is down the payment still succeeds (`logEvent` never throws).

## Data model (one collection)
```json
{
  "_id": "ObjectId",
  "escrow_id": 12,                 // number | null  (references escrows.escrow_id logically)
  "actor_id": 3,                   // number | null  (references users.user_id logically)
  "actor_role": "ARBITRATOR",      // string | null  ('SYSTEM' for trigger-driven events)
  "action": "DISPUTE_RESOLVED",    // enum validated by $jsonSchema
  "meta": { "dispute_id": 2, "outcome": "REFUND", "note": "..." },   // free-form per action
  "ts": ISODate("2026-10-25T10:15:00Z")
}
```
Validation: `$jsonSchema` validator (required `action`, `ts`; `action` enum; `ts` must be a date), `validationAction: error`.

## Indexes
| Index | Serves |
|---|---|
| `{ escrow_id: 1, ts: -1 }` | per-escrow timeline on the escrow detail page |
| `{ actor_id: 1, ts: -1 }` | user activity / top actors |
| `{ action: 1, ts: -1 }` | admin audit-log filter |

## Aggregations (NoSQL advanced feature)
`$group` events per action · `$match`+`$dateToString`+`$group` daily activity (14 days) · `$match`/`$group`/`$max`/`$sort`/`$limit` most active actors · `$addToSet` pipeline (see `db/mongo/aggregations.js`).

## Retrieval strategy
- Escrow page → `find({escrow_id}).sort({ts: 1})` (index scan, no collection scan).
- Admin page → the three pipelines above in parallel (`Promise.all`).
- Vector search is **not** used: no embedding-worthy free text is queried by meaning; text search is done with MySQL FULLTEXT.
