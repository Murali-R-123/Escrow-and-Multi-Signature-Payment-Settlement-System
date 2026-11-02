import { MongoClient } from 'mongodb';

// lazily connect (so `next build` works without a running MongoDB)
function client() {
  if (!globalThis.__escrowMongo) {
    globalThis.__escrowMongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 }).connect();
  }
  return globalThis.__escrowMongo;
}

export async function auditCollection() {
  const c = await client();
  return c.db(process.env.MONGODB_DB || 'escrow_audit').collection('audit_events');
}
