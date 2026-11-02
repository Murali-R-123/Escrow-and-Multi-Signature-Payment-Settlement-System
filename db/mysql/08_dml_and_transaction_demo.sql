-- =====================================================================
-- 08_dml_and_transaction_demo.sql  |  INSERT / UPDATE / DELETE / SELECT + ROLLBACK demo
-- Safe to run repeatedly (cleans up after itself).
-- =====================================================================
USE escrow_db;

-- INSERT
INSERT INTO users (name, email, password_hash, role)
VALUES ('Temp Demo User', 'temp.demo@escrow.test', 'scrypt$demo', 'BUYER');
-- SELECT
SELECT user_id, name, email, role FROM users WHERE email = 'temp.demo@escrow.test';
-- UPDATE
UPDATE users SET name = 'Temp Demo Renamed' WHERE email = 'temp.demo@escrow.test';
-- DELETE
DELETE FROM users WHERE email = 'temp.demo@escrow.test';

-- TRANSACTION + ROLLBACK: a failed multi-step operation leaves NO partial data
SELECT COUNT(*) AS users_before FROM users;
START TRANSACTION;
  INSERT INTO users (name, email, password_hash, role)
  VALUES ('Rollback User', 'rollback.demo@escrow.test', 'scrypt$demo', 'SELLER');
  SELECT COUNT(*) AS users_inside_txn FROM users;      -- +1 inside the transaction
ROLLBACK;
SELECT COUNT(*) AS users_after_rollback FROM users;    -- back to the original number

-- TRANSACTION + COMMIT through a stored procedure (atomic: rule + escrow + signers + deposit)
-- CALL sp_create_escrow(2, 4, 6, 1000.00, 'Demo escrow', DATE_ADD(NOW(), INTERVAL 2 DAY), 2);

-- -------------------------------------------------------------------
-- NEGATIVE TESTS (each statement below MUST fail; run one at a time):
-- -------------------------------------------------------------------
-- INSERT INTO escrows (buyer_id,seller_id,rule_id,amount,deadline) VALUES (2,2,1,100,NOW());   -- CHECK buyer<>seller
-- INSERT INTO escrows (buyer_id,seller_id,rule_id,amount,deadline) VALUES (2,4,1,-5,NOW());    -- CHECK amount>0
-- INSERT INTO users (name,email,password_hash,role) VALUES ('X Y','not-an-email','h','BUYER'); -- CHECK email format
-- INSERT INTO approvals (escrow_id,user_id,decision) VALUES (1,7,'APPROVE');                   -- composite FK: 7 is not a signer
-- UPDATE escrows SET amount = 1 WHERE escrow_id = 1;                                           -- trigger: amount immutable
-- DELETE FROM transactions WHERE transaction_id = 1;                                           -- trigger: ledger immutable
-- INSERT INTO transactions (escrow_id,transaction_type,amount,transaction_status) VALUES (2,'RELEASE',48000.50,'COMPLETED'); -- trigger: already paid out
