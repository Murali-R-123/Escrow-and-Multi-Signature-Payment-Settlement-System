-- =====================================================================
-- 04_functions_procedures.sql  |  Stored functions + procedures (with TRANSACTIONS)
-- Every money-moving operation is one ACID transaction using row locks (FOR UPDATE).
-- =====================================================================
USE escrow_db;

DROP FUNCTION  IF EXISTS fn_approval_count;
DROP FUNCTION  IF EXISTS fn_is_signer;
DROP PROCEDURE IF EXISTS sp_create_escrow;
DROP PROCEDURE IF EXISTS sp_approve_escrow;
DROP PROCEDURE IF EXISTS sp_release_escrow;
DROP PROCEDURE IF EXISTS sp_raise_dispute;
DROP PROCEDURE IF EXISTS sp_resolve_dispute;
DROP PROCEDURE IF EXISTS sp_expire_overdue_escrows;

DELIMITER $$

CREATE FUNCTION fn_approval_count(p_escrow_id INT) RETURNS INT
READS SQL DATA
BEGIN
  DECLARE v_cnt INT DEFAULT 0;
  SELECT COUNT(*) INTO v_cnt FROM approvals
   WHERE escrow_id = p_escrow_id AND decision = 'APPROVE';
  RETURN v_cnt;
END$$

CREATE FUNCTION fn_is_signer(p_escrow_id INT, p_user_id INT) RETURNS INT
READS SQL DATA
BEGIN
  DECLARE v_cnt INT DEFAULT 0;
  SELECT COUNT(*) INTO v_cnt FROM escrow_signers
   WHERE escrow_id = p_escrow_id AND user_id = p_user_id;
  RETURN v_cnt;
END$$

-- ---------------------------------------------------------------------
-- Create an escrow: reuse/create rule, create escrow, register signers, record DEPOSIT.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_create_escrow(
  IN p_buyer_id INT, IN p_seller_id INT, IN p_arbitrator_id INT,
  IN p_amount DECIMAL(12,2), IN p_description TEXT,
  IN p_deadline DATETIME, IN p_required INT)
BEGIN
  DECLARE v_total INT;
  DECLARE v_rule_id INT;
  DECLARE v_escrow_id INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_buyer_id AND role = 'BUYER') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Buyer must be an existing user with role BUYER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_seller_id AND role = 'SELLER') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seller must be an existing user with role SELLER';
  END IF;
  IF p_arbitrator_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_arbitrator_id AND role = 'ARBITRATOR') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Arbitrator must be an existing user with role ARBITRATOR';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Amount must be greater than zero';
  END IF;
  IF p_deadline IS NULL OR p_deadline <= NOW() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Deadline must be in the future';
  END IF;

  SET v_total = IF(p_arbitrator_id IS NULL, 2, 3);
  IF p_required IS NULL OR p_required < 1 OR p_required > v_total THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Required signatures must be between 1 and the number of signers';
  END IF;

  START TRANSACTION;

  SET v_rule_id = (SELECT rule_id FROM multisig_rules
                    WHERE required_signatures = p_required AND total_signers = v_total LIMIT 1);
  IF v_rule_id IS NULL THEN
    INSERT INTO multisig_rules (required_signatures, total_signers) VALUES (p_required, v_total);
    SET v_rule_id = LAST_INSERT_ID();
  END IF;

  INSERT INTO escrows (buyer_id, seller_id, rule_id, amount, description, deadline)
  VALUES (p_buyer_id, p_seller_id, v_rule_id, p_amount, p_description, p_deadline);
  SET v_escrow_id = LAST_INSERT_ID();

  INSERT INTO escrow_signers (escrow_id, user_id, signer_role) VALUES (v_escrow_id, p_buyer_id,  'BUYER');
  INSERT INTO escrow_signers (escrow_id, user_id, signer_role) VALUES (v_escrow_id, p_seller_id, 'SELLER');
  IF p_arbitrator_id IS NOT NULL THEN
    INSERT INTO escrow_signers (escrow_id, user_id, signer_role) VALUES (v_escrow_id, p_arbitrator_id, 'ARBITRATOR');
  END IF;

  INSERT INTO transactions (escrow_id, transaction_type, amount, transaction_status)
  VALUES (v_escrow_id, 'DEPOSIT', p_amount, 'COMPLETED');

  COMMIT;
  SELECT v_escrow_id AS escrow_id, v_total AS total_signers;
END$$

-- ---------------------------------------------------------------------
-- A signer votes. The AFTER INSERT trigger on approvals flips the escrow to APPROVED
-- once the m-of-n threshold is reached.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_approve_escrow(
  IN p_escrow_id INT, IN p_user_id INT, IN p_decision VARCHAR(10), IN p_remarks TEXT)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_deadline DATETIME;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_decision IS NULL OR p_decision NOT IN ('APPROVE','REJECT') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Decision must be APPROVE or REJECT';
  END IF;

  START TRANSACTION;
  SELECT status, deadline INTO v_status, v_deadline
    FROM escrows WHERE escrow_id = p_escrow_id FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Escrow not found';
  END IF;
  IF fn_is_signer(p_escrow_id, p_user_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You are not a registered signer of this escrow';
  END IF;
  IF v_status <> 'PENDING' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Approvals are closed: escrow is not PENDING';
  END IF;
  IF v_deadline < NOW() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Escrow deadline has passed';
  END IF;

  INSERT INTO approvals (escrow_id, user_id, decision, remarks)
  VALUES (p_escrow_id, p_user_id, p_decision, p_remarks);
  COMMIT;

  SELECT status, fn_approval_count(p_escrow_id) AS approvals_count
    FROM escrows WHERE escrow_id = p_escrow_id;
END$$

-- ---------------------------------------------------------------------
-- Release funds to the seller (only when APPROVED). Row lock prevents double release.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_release_escrow(IN p_escrow_id INT, IN p_actor_id INT)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_amount DECIMAL(12,2);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT status, amount INTO v_status, v_amount
    FROM escrows WHERE escrow_id = p_escrow_id FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Escrow not found';
  END IF;
  IF fn_is_signer(p_escrow_id, p_actor_id) = 0
     AND NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_actor_id AND role = 'ADMIN') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only a signer or an admin can release funds';
  END IF;
  IF v_status <> 'APPROVED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Escrow must be APPROVED before funds can be released';
  END IF;

  INSERT INTO transactions (escrow_id, transaction_type, amount, transaction_status)
  VALUES (p_escrow_id, 'RELEASE', v_amount, 'COMPLETED');
  UPDATE escrows SET status = 'RELEASED' WHERE escrow_id = p_escrow_id;
  COMMIT;

  SELECT 'RELEASED' AS status, v_amount AS amount;
END$$

-- ---------------------------------------------------------------------
-- Raise a dispute (buyer or seller). Trigger moves the escrow to DISPUTED.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_raise_dispute(IN p_escrow_id INT, IN p_user_id INT, IN p_reason TEXT)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_dispute_id INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT status INTO v_status FROM escrows WHERE escrow_id = p_escrow_id FOR UPDATE;
  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Escrow not found';
  END IF;

  INSERT INTO disputes (escrow_id, raised_by, reason) VALUES (p_escrow_id, p_user_id, p_reason);
  SET v_dispute_id = LAST_INSERT_ID();
  COMMIT;

  SELECT v_dispute_id AS dispute_id;
END$$

-- ---------------------------------------------------------------------
-- Arbitrator resolves a dispute: RELEASE (to seller) | REFUND (to buyer) | DISMISS
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_resolve_dispute(
  IN p_dispute_id INT, IN p_arbitrator_id INT, IN p_outcome VARCHAR(10))
BEGIN
  DECLARE v_escrow_id INT;
  DECLARE v_dstatus VARCHAR(20);
  DECLARE v_amount DECIMAL(12,2);
  DECLARE v_required INT;
  DECLARE v_new_status VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_outcome IS NULL OR p_outcome NOT IN ('RELEASE','REFUND','DISMISS') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Outcome must be RELEASE, REFUND or DISMISS';
  END IF;

  START TRANSACTION;
  SELECT escrow_id, status INTO v_escrow_id, v_dstatus
    FROM disputes WHERE dispute_id = p_dispute_id FOR UPDATE;

  IF v_escrow_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Dispute not found';
  END IF;
  IF v_dstatus <> 'OPEN' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Dispute is already resolved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM escrow_signers
                  WHERE escrow_id = v_escrow_id AND user_id = p_arbitrator_id
                    AND signer_role = 'ARBITRATOR') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only the arbitrator assigned to this escrow can resolve the dispute';
  END IF;

  SELECT e.amount, r.required_signatures INTO v_amount, v_required
    FROM escrows e JOIN multisig_rules r ON r.rule_id = e.rule_id
   WHERE e.escrow_id = v_escrow_id FOR UPDATE;

  SET v_new_status = IF(p_outcome = 'DISMISS', 'REJECTED', 'RESOLVED');

  IF p_outcome = 'RELEASE' THEN
    INSERT INTO transactions (escrow_id, transaction_type, amount, transaction_status)
    VALUES (v_escrow_id, 'RELEASE', v_amount, 'COMPLETED');
    UPDATE escrows SET status = 'RELEASED' WHERE escrow_id = v_escrow_id;
  ELSEIF p_outcome = 'REFUND' THEN
    INSERT INTO transactions (escrow_id, transaction_type, amount, transaction_status)
    VALUES (v_escrow_id, 'REFUND', v_amount, 'COMPLETED');
    UPDATE escrows SET status = 'REFUNDED' WHERE escrow_id = v_escrow_id;
  ELSE
    -- dismissed: put the escrow back where the approvals say it should be
    UPDATE escrows
       SET status = IF(fn_approval_count(v_escrow_id) >= v_required, 'APPROVED', 'PENDING')
     WHERE escrow_id = v_escrow_id;
  END IF;

  UPDATE disputes
     SET status = v_new_status, resolved_by = p_arbitrator_id, resolved_at = NOW()
   WHERE dispute_id = p_dispute_id;
  COMMIT;

  SELECT p_dispute_id AS dispute_id, v_new_status AS status, p_outcome AS outcome;
END$$

-- ---------------------------------------------------------------------
-- Admin batch job (CURSOR): refund + EXPIRE every PENDING escrow past its deadline
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_expire_overdue_escrows()
BEGIN
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_id INT;
  DECLARE v_amount DECIMAL(12,2);
  DECLARE v_count INT DEFAULT 0;
  DECLARE cur CURSOR FOR SELECT escrow_id, amount FROM tmp_overdue;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  DROP TEMPORARY TABLE IF EXISTS tmp_overdue;
  CREATE TEMPORARY TABLE tmp_overdue AS
    SELECT escrow_id, amount FROM escrows WHERE status = 'PENDING' AND deadline < NOW();

  START TRANSACTION;
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_id, v_amount;
    IF v_done = 1 THEN
      LEAVE read_loop;
    END IF;
    INSERT INTO transactions (escrow_id, transaction_type, amount, transaction_status)
    VALUES (v_id, 'REFUND', v_amount, 'COMPLETED');
    UPDATE escrows SET status = 'EXPIRED' WHERE escrow_id = v_id;
    SET v_count = v_count + 1;
  END LOOP;
  CLOSE cur;
  COMMIT;

  DROP TEMPORARY TABLE IF EXISTS tmp_overdue;
  SELECT v_count AS expired_count;
END$$

DELIMITER ;
