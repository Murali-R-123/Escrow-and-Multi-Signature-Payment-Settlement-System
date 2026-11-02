// npm run test:db  -- automated database tests (needs the seeded MySQL DB). Prints PASS/FAIL per case.
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE,
  dateStrings: true, decimalNumbers: true,
});
await conn.query("SET time_zone = '+00:00'");

const results = [];
const future = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace('T', ' ');
const q = async (sql, p = []) => (await conn.query(sql, p))[0];
const call = async (name, args = []) => { const r = await q(`CALL ${name}(${args.map(() => '?').join(',')})`, args); return Array.isArray(r[0]) ? r[0] : []; };

async function ok(id, name, fn) {
  try { const extra = await fn(); results.push([id, name, 'PASS', extra || '']); }
  catch (e) { results.push([id, name, 'FAIL', e.message]); }
}
// the statement must fail; optionally check errno / message fragment
async function fails(id, name, fn, { errno, msg } = {}) {
  try { await fn(); results.push([id, name, 'FAIL', 'expected an error but statement succeeded']); }
  catch (e) {
    const good = (!errno || e.errno === errno) && (!msg || String(e.sqlMessage || e.message).includes(msg));
    results.push([id, name, good ? 'PASS' : 'FAIL', `${e.errno || ''} ${String(e.sqlMessage || e.message).slice(0, 90)}`]);
  }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const status = async (id) => (await q('SELECT status FROM escrows WHERE escrow_id = ?', [id]))[0].status;

// Demo users from 06_seed.sql: 2 Alice(BUYER) 3 Rahul(BUYER) 4 Priya(SELLER) 5 Arjun(SELLER) 6 Meera(ARB) 7 Karan(ARB)

await fails('T01', 'Duplicate email rejected (UNIQUE)', () => q("INSERT INTO users (name,email,password_hash,role) VALUES ('Dup User','alice.buyer@escrow.test','x','BUYER')"), { errno: 1062 });
await fails('T02', 'Invalid email format rejected (CHECK)', () => q("INSERT INTO users (name,email,password_hash,role) VALUES ('Bad Mail','not-an-email','x','BUYER')"), { errno: 3819 });
await fails('T03', 'Invalid role rejected (ENUM)', () => q("INSERT INTO users (name,email,password_hash,role) VALUES ('Bad Role','badrole@escrow.test','x','HACKER')"));
await fails('T04', 'Escrow amount <= 0 rejected (CHECK)', () => q('INSERT INTO escrows (buyer_id,seller_id,rule_id,amount,deadline) VALUES (2,4,1,-5,NOW())'), { errno: 3819 });
await fails('T05', 'Buyer = seller rejected (CHECK)', () => q('INSERT INTO escrows (buyer_id,seller_id,rule_id,amount,deadline) VALUES (2,2,1,10,NOW())'), { errno: 3819 });
await fails('T06', 'Seller cannot act as buyer (procedure)', () => call('sp_create_escrow', [4, 4, null, 100, 'x', future(2), 2]), { msg: 'Buyer must be' });
await fails('T07', 'Past deadline rejected (procedure)', () => call('sp_create_escrow', [2, 4, null, 100, 'late', future(-1), 2]), { msg: 'Deadline must be in the future' });
await fails('T08', 'Required signatures > signers rejected', () => call('sp_create_escrow', [2, 4, null, 100, 'bad rule', future(2), 3]), { msg: 'Required signatures' });

let E; // main happy-path escrow (2-of-3, arbiter 6)
await ok('T09', 'Create escrow = rule + escrow + 3 signers + DEPOSIT (atomic)', async () => {
  const r = await call('sp_create_escrow', [2, 4, 6, 1234.5, 'Automated test escrow', future(5), 2]);
  E = r[0].escrow_id;
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM escrow_signers WHERE escrow_id = ?', [E]);
  const [{ d }] = await q("SELECT COUNT(*) AS d FROM transactions WHERE escrow_id = ? AND transaction_type='DEPOSIT' AND transaction_status='COMPLETED'", [E]);
  assert(n === 3 && d === 1 && (await status(E)) === 'PENDING', `signers=${n} deposits=${d}`);
  return `escrow #${E}`;
});
await ok('T10', 'Multisig rule is reused (UNIQUE m-of-n template)', async () => {
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM multisig_rules WHERE required_signatures=2 AND total_signers=3'); assert(n === 1, `rules=${n}`);
});
await fails('T11', 'Non-signer cannot approve', () => call('sp_approve_escrow', [E, 3, 'APPROVE', null]), { msg: 'not a registered signer' });
await ok('T12', 'First approval keeps escrow PENDING (1 of 2)', async () => {
  await call('sp_approve_escrow', [E, 2, 'APPROVE', 'ok']); assert((await status(E)) === 'PENDING', await status(E));
});
await fails('T13', 'Duplicate vote rejected (UNIQUE)', () => call('sp_approve_escrow', [E, 2, 'APPROVE', null]), { errno: 1062 });
await fails('T14', 'Release before threshold rejected', () => call('sp_release_escrow', [E, 2]), { msg: 'must be APPROVED' });
await ok('T15', 'Second approval flips escrow to APPROVED (trigger)', async () => {
  await call('sp_approve_escrow', [E, 4, 'APPROVE', null]); assert((await status(E)) === 'APPROVED', await status(E));
});
await fails('T16', 'Votes closed after APPROVED (trigger)', () => call('sp_approve_escrow', [E, 6, 'APPROVE', null]), { msg: 'closed' });
await fails('T17', 'Direct INSERT of a vote by a non-signer rejected (composite FK)', () => q("INSERT INTO approvals (escrow_id,user_id,decision) VALUES (?,7,'APPROVE')", [E]));
await fails('T18', 'Non-signer cannot release', () => call('sp_release_escrow', [E, 3]), { msg: 'signer or an admin' });
await ok('T19', 'Release creates exactly one RELEASE row and closes escrow', async () => {
  await call('sp_release_escrow', [E, 2]);
  const [{ n }] = await q("SELECT COUNT(*) AS n FROM transactions WHERE escrow_id=? AND transaction_type='RELEASE'", [E]);
  assert(n === 1 && (await status(E)) === 'RELEASED', `releases=${n}`);
});
await fails('T20', 'Double release rejected', () => call('sp_release_escrow', [E, 2]), { msg: 'must be APPROVED' });
await fails('T21', 'Second payout row rejected by ledger trigger', () => q("INSERT INTO transactions (escrow_id,transaction_type,amount,transaction_status) VALUES (?,'REFUND',1234.50,'COMPLETED')", [E]), { msg: 'already paid out' });
await fails('T22', 'Escrow amount is immutable (trigger)', () => q('UPDATE escrows SET amount = 1 WHERE escrow_id = ?', [E]), { msg: 'immutable' });
await fails('T23', 'Closed escrow status cannot change (trigger)', () => q("UPDATE escrows SET status='PENDING' WHERE escrow_id = ?", [E]), { msg: 'closed' });
await fails('T24', 'Ledger rows cannot be deleted (trigger)', () => q('DELETE FROM transactions WHERE escrow_id = ?', [E]), { msg: 'cannot be deleted' });
await fails('T25', 'Ledger rows cannot be updated (trigger)', () => q('UPDATE transactions SET amount = 1 WHERE escrow_id = ?', [E]), { msg: 'immutable' });
await fails('T26', 'Dispute on a RELEASED escrow rejected', () => call('sp_raise_dispute', [E, 2, 'This should not be allowed now']), { msg: 'PENDING or APPROVED' });

let E2, D;
await ok('T27', 'Dispute flow: raise -> escrow becomes DISPUTED (trigger)', async () => {
  E2 = (await call('sp_create_escrow', [3, 5, 7, 999, 'Dispute test escrow', future(5), 2]))[0].escrow_id;
  D = (await call('sp_raise_dispute', [E2, 3, 'Item never arrived, seller silent for days']))[0].dispute_id;
  assert((await status(E2)) === 'DISPUTED', await status(E2));
});
await fails('T28', 'Only buyer/seller can raise a dispute', async () => {
  const e3 = (await call('sp_create_escrow', [3, 5, null, 50, 'tmp', future(5), 2]))[0].escrow_id;
  await call('sp_raise_dispute', [e3, 2, 'I am not a party to this escrow']);
}, { msg: 'Only the buyer or the seller' });
await fails('T29', 'Second open dispute on same escrow rejected', () => call('sp_raise_dispute', [E2, 5, 'Another dispute for the same escrow']), { msg: 'PENDING or APPROVED' });
await fails('T30', 'Wrong arbitrator cannot resolve', () => call('sp_resolve_dispute', [D, 6, 'REFUND']), { msg: 'assigned to this escrow' });
await ok('T31', 'Assigned arbitrator REFUND -> escrow REFUNDED + REFUND ledger row', async () => {
  await call('sp_resolve_dispute', [D, 7, 'REFUND']);
  const [{ n }] = await q("SELECT COUNT(*) AS n FROM transactions WHERE escrow_id=? AND transaction_type='REFUND'", [E2]);
  assert((await status(E2)) === 'REFUNDED' && n === 1, 'status/ledger mismatch');
});
await fails('T32', 'Resolved dispute is immutable / cannot be resolved twice', () => call('sp_resolve_dispute', [D, 7, 'RELEASE']), { msg: 'already resolved' });

await ok('T33', 'Expiry batch (cursor) refunds overdue PENDING escrows', async () => {
  const e4 = (await call('sp_create_escrow', [2, 4, null, 77, 'Overdue test escrow', future(3), 2]))[0].escrow_id;
  await q('UPDATE escrows SET deadline = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE escrow_id = ?', [e4]);
  const r = await call('sp_expire_overdue_escrows');
  assert(r[0].expired_count >= 1 && (await status(e4)) === 'EXPIRED', `expired=${r[0].expired_count}`);
});
await fails('T34', 'Voting after the deadline rejected', async () => {
  const e5 = (await call('sp_create_escrow', [2, 4, null, 60, 'Deadline vote test', future(3), 2]))[0].escrow_id;
  await q('UPDATE escrows SET deadline = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE escrow_id = ?', [e5]);
  await call('sp_approve_escrow', [e5, 2, 'APPROVE', null]);
}, { msg: 'deadline has passed' });

await ok('T35', 'ROLLBACK leaves no partial data', async () => {
  const [{ a }] = await q('SELECT COUNT(*) AS a FROM users');
  await conn.beginTransaction();
  await q("INSERT INTO users (name,email,password_hash,role) VALUES ('Rollback Test','rb@escrow.test','x','BUYER')");
  await conn.rollback();
  const [{ b }] = await q('SELECT COUNT(*) AS b FROM users'); assert(a === b, `${a} vs ${b}`);
});
await ok('T36', 'FULLTEXT search finds disputes (MATCH ... AGAINST)', async () => {
  const r = await q("SELECT dispute_id FROM disputes WHERE MATCH(reason) AGAINST ('delivered' IN NATURAL LANGUAGE MODE)");
  assert(r.length >= 1, 'no rows');
});
await ok('T37', 'View v_escrow_summary approvals_count matches approvals table', async () => {
  const r = await q(`SELECT s.escrow_id FROM v_escrow_summary s
     WHERE s.approvals_count <> (SELECT COUNT(*) FROM approvals a WHERE a.escrow_id = s.escrow_id AND a.decision='APPROVE')`);
  assert(r.length === 0, `${r.length} mismatches`);
});
await ok('T38', 'Ledger balance: every RELEASED/REFUNDED escrow has deposit == payout', async () => {
  const r = await q(`SELECT e.escrow_id FROM escrows e WHERE e.status IN ('RELEASED','REFUNDED','EXPIRED')
     AND (SELECT SUM(amount) FROM transactions t WHERE t.escrow_id=e.escrow_id AND transaction_type='DEPOSIT')
      <> (SELECT SUM(amount) FROM transactions t WHERE t.escrow_id=e.escrow_id AND transaction_type IN ('RELEASE','REFUND'))`);
  assert(r.length === 0, `${r.length} unbalanced`);
});

await conn.end();
console.log('\nID   RESULT  TEST');
for (const [id, name, res, extra] of results) console.log(`${id}  ${res === 'PASS' ? 'PASS ' : 'FAIL '}  ${name}${extra ? '   -> ' + extra : ''}`);
const failed = results.filter((r) => r[2] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
