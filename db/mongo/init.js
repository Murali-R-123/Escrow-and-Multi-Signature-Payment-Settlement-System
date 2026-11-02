// mongosh script:   mongosh "mongodb://localhost:27017/escrow_audit" db/mongo/init.js
// Creates the audit_events collection with a $jsonSchema validator and its indexes.
db = db.getSiblingDB('escrow_audit');

if (!db.getCollectionNames().includes('audit_events')) {
  db.createCollection('audit_events', {
    validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['action', 'ts'],
      properties: {
        escrow_id:  { bsonType: ['number', 'null'] },
        actor_id:   { bsonType: ['number', 'null'] },
        actor_role: { bsonType: ['string', 'null'] },
        action: { enum: ['USER_REGISTERED','USER_LOGIN','LOGIN_FAILED','ESCROW_CREATED','APPROVAL_SUBMITTED',
                         'ESCROW_APPROVED','FUNDS_RELEASED','DISPUTE_RAISED','DISPUTE_RESOLVED','ESCROWS_EXPIRED'] },
        meta: { bsonType: 'object' },
        ts:   { bsonType: 'date' }
      }
    } },
    validationAction: 'error'
  });
}

db.audit_events.createIndex({ escrow_id: 1, ts: -1 }, { name: 'idx_escrow_timeline' });
db.audit_events.createIndex({ actor_id: 1, ts: -1 },  { name: 'idx_actor_activity' });
db.audit_events.createIndex({ action: 1, ts: -1 },    { name: 'idx_action' });
print('audit_events ready: ' + db.audit_events.countDocuments() + ' documents');
