# Demo script (≈ 12 min, both members speak)

1. **Problem & design (Member A, 2 min)** – show `docs/diagrams/Escrow_ER_Diagram.png`, then the relational schema; point out weak entities (ESCROW_SIGNERS, APPROVALS), the composite FK, the ISA→`role`.
2. **Database implementation (A, 3 min)** – in MySQL Workbench / CLI:
   - `SHOW CREATE TABLE approvals\G` (composite FK, UNIQUE) · `SHOW TRIGGERS;` · `SHOW PROCEDURE STATUS WHERE Db='escrow_db';`
   - run `07_queries.sql` (Q1 join, Q3 HAVING, Q7 FULLTEXT, Q9 window, Q14 EXPLAIN with/without index)
   - **live integrity demo:** run the commented negative tests from `08_dml_and_transaction_demo.sql` (amount ≤ 0, non-signer vote, delete ledger row).
   - **transaction demo:** the START TRANSACTION … ROLLBACK block.
3. **Trigger demo (A, 1 min)** – `CALL sp_approve_escrow(3, 3, …)` flips E3 to APPROVED when the threshold is reached; show `v_escrow_summary`.
4. **NoSQL (B, 2 min)** – `mongosh db/mongo/aggregations.js`; show validator, indexes, an `explain()`; explain *why Mongo* for audit.
5. **Web app (B, 3 min)** – login as Alice (create 2-of-3 escrow) → Priya & Meera approve (progress bar) → release; Rahul raises a dispute → Meera resolves; Admin dashboard: stats + Mongo aggregations + "Process expired".
6. **Security (B, 30 s)** – `.env.local` not in Git, httpOnly cookie, role checks (try `/admin` as buyer).
7. **Tests (both, 1 min)** – `npm run test:db` → 38/38; show `tests/TEST_CASES.md`.
8. **Contributions** – `git shortlog -sn` and `docs/TEAM_CONTRIBUTIONS.md`.
