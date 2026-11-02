// npm run mongo:init   -> creates collection + validator + indexes, seeds sample events once.
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'escrow_audit';
if (!uri) { console.error('MONGODB_URI is not set (create .env.local first)'); process.exit(1); }

const ACTIONS = ['USER_REGISTERED','USER_LOGIN','LOGIN_FAILED','ESCROW_CREATED','APPROVAL_SUBMITTED',
  'ESCROW_APPROVED','FUNDS_RELEASED','DISPUTE_RAISED','DISPUTE_RESOLVED','ESCROWS_EXPIRED'];

const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 4000 }).connect();
const db = client.db(dbName);

const existing = (await db.listCollections({ name: 'audit_events' }).toArray()).length;
if (!existing) {
  await db.createCollection('audit_events', {
    validator: { $jsonSchema: {
      bsonType: 'object', required: ['action', 'ts'],
      properties: {
        escrow_id: { bsonType: ['number', 'null'] }, actor_id: { bsonType: ['number', 'null'] },
        actor_role: { bsonType: ['string', 'null'] }, action: { enum: ACTIONS },
        meta: { bsonType: 'object' }, ts: { bsonType: 'date' },
      },
    } },
    validationAction: 'error',
  });
}
const col = db.collection('audit_events');
await col.createIndex({ escrow_id: 1, ts: -1 }, { name: 'idx_escrow_timeline' });
await col.createIndex({ actor_id: 1, ts: -1 }, { name: 'idx_actor_activity' });
await col.createIndex({ action: 1, ts: -1 }, { name: 'idx_action' });

if ((await col.countDocuments()) === 0) {
  // sample events mirroring db/mysql/06_seed.sql so the demo dashboards are not empty
  const t = (minsAgo) => new Date(Date.now() - minsAgo * 60000);
  const ev = (escrow_id, actor_id, actor_role, action, meta, minsAgo) => ({ escrow_id, actor_id, actor_role, action, meta, ts: t(minsAgo) });
  await col.insertMany([
    ev(1, 2, 'BUYER', 'ESCROW_CREATED', { amount: 25000, rule: '2-of-3' }, 600),
    ev(1, 2, 'BUYER', 'APPROVAL_SUBMITTED', { decision: 'APPROVE', status_after: 'PENDING' }, 560),
    ev(1, 4, 'SELLER', 'APPROVAL_SUBMITTED', { decision: 'APPROVE', status_after: 'APPROVED' }, 540),
    ev(1, null, 'SYSTEM', 'ESCROW_APPROVED', { note: 'multisig threshold reached (database trigger)' }, 540),
    ev(2, 2, 'BUYER', 'ESCROW_CREATED', { amount: 48000.5, rule: '2-of-3' }, 500),
    ev(2, 2, 'BUYER', 'APPROVAL_SUBMITTED', { decision: 'APPROVE' }, 480),
    ev(2, 5, 'SELLER', 'APPROVAL_SUBMITTED', { decision: 'APPROVE' }, 470),
    ev(2, 2, 'BUYER', 'FUNDS_RELEASED', { amount: 48000.5 }, 460),
    ev(4, 3, 'BUYER', 'ESCROW_CREATED', { amount: 75000, rule: '2-of-3' }, 300),
    ev(4, 3, 'BUYER', 'DISPUTE_RAISED', { dispute_id: 1, reason: 'Seller has not delivered the car' }, 280),
    ev(5, 2, 'BUYER', 'DISPUTE_RAISED', { dispute_id: 2 }, 200),
    ev(5, 7, 'ARBITRATOR', 'DISPUTE_RESOLVED', { dispute_id: 2, outcome: 'REFUND', note: 'Wrong edition confirmed' }, 150),
    ev(null, 1, 'ADMIN', 'USER_LOGIN', {}, 100),
  ]);
}
console.log(`audit_events ready in "${dbName}": ${await col.countDocuments()} documents`);
await client.close();
