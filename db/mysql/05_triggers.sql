-- =====================================================================
-- 05_triggers.sql  |  Triggers = database-level validation & integrity rules
-- =====================================================================
USE escrow_db;

DROP TRIGGER IF EXISTS trg_approvals_before_insert;
DROP TRIGGER IF EXISTS trg_approvals_after_insert;
DROP TRIGGER IF EXISTS trg_escrows_before_update;
DROP TRIGGER IF EXISTS trg_transactions_before_insert;
DROP TRIGGER IF EXISTS trg_transactions_before_update;
DROP TRIGGER IF EXISTS trg_transactions_before_delete;
DROP TRIGGER IF EXISTS trg_disputes_before_insert;
DROP TRIGGER IF EXISTS trg_disputes_after_insert;
DROP TRIGGER IF EXISTS trg_disputes_before_update;

DELIMITER $$

-- Votes are only accepted while the escrow is PENDING and before the deadline
CREATE TRIGGER trg_approvals_before_insert BEFORE INSERT ON approvals
FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_deadline DATETIME;
  SELECT status, deadline INTO v_status, v_deadline FROM escrows WHERE escrow_id = NEW.escrow_id;
  IF v_status IS NOT NULL AND v_status <> 'PENDING' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Approvals are closed: escrow is not PENDING';
  END IF;
  IF v_deadline IS NOT NULL AND v_deadline < NOW() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Escrow deadline has passed';
  END IF;
END$$

-- Core multi-signature rule: m approvals  =>  escrow becomes APPROVED
CREATE TRIGGER trg_approvals_after_insert AFTER INSERT ON approvals
FOR EACH ROW
BEGIN
  DECLARE v_required INT;
  DECLARE v_approved INT;
  SELECT r.required_signatures INTO v_required
    FROM escrows e JOIN multisig_rules r ON r.rule_id = e.rule_id
   WHERE e.escrow_id = NEW.escrow_id;
  SELECT COUNT(*) INTO v_approved FROM approvals
   WHERE escrow_id = NEW.escrow_id AND decision = 'APPROVE';
  IF v_approved >= v_required THEN
    UPDATE escrows SET status = 'APPROVED'
     WHERE escrow_id = NEW.escrow_id AND status = 'PENDING';
  END IF;
END$$

-- Escrow state machine + immutability of money/parties
CREATE TRIGGER trg_escrows_before_update BEFORE UPDATE ON escrows
FOR EACH ROW
BEGIN
  IF NEW.amount <> OLD.amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Escrow amount is immutable';
  END IF;
  IF NEW.buyer_id <> OLD.buyer_id OR NEW.seller_id <> OLD.seller_id OR NEW.rule_id <> OLD.rule_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Escrow parties and rule are immutable';
  END IF;
  IF NEW.status <> OLD.status THEN
    IF OLD.status IN ('RELEASED','REFUNDED','EXPIRED') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Escrow is closed; its status cannot change';
    END IF;
    IF OLD.status = 'PENDING'  AND NEW.status NOT IN ('APPROVED','DISPUTED','EXPIRED') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid status transition from PENDING';
    END IF;
    IF OLD.status = 'APPROVED' AND NEW.status NOT IN ('RELEASED','DISPUTED') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid status transition from APPROVED';
    END IF;
  END IF;
END$$

-- Ledger rule: money can leave an escrow only once, and only for the full amount
CREATE TRIGGER trg_transactions_before_insert BEFORE INSERT ON transactions
FOR EACH ROW
BEGIN
  DECLARE v_amount DECIMAL(12,2);
  IF NEW.transaction_type IN ('RELEASE','REFUND') THEN
    IF EXISTS (SELECT 1 FROM transactions
                WHERE escrow_id = NEW.escrow_id
                  AND transaction_type IN ('RELEASE','REFUND')
                  AND transaction_status <> 'FAILED') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Funds were already paid out for this escrow';
    END IF;
    SELECT amount INTO v_amount FROM escrows WHERE escrow_id = NEW.escrow_id;
    IF v_amount IS NOT NULL AND NEW.amount <> v_amount THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payout must equal the escrowed amount';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_transactions_before_update BEFORE UPDATE ON transactions
FOR EACH ROW
BEGIN
  IF OLD.transaction_status <> 'PENDING'
     OR NEW.amount <> OLD.amount
     OR NEW.escrow_id <> OLD.escrow_id
     OR NEW.transaction_type <> OLD.transaction_type THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries are immutable';
  END IF;
END$$

CREATE TRIGGER trg_transactions_before_delete BEFORE DELETE ON transactions
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries cannot be deleted';
END$$

-- Disputes: only the buyer/seller, only on a live escrow, only one open dispute at a time
CREATE TRIGGER trg_disputes_before_insert BEFORE INSERT ON disputes
FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_buyer INT;
  DECLARE v_seller INT;
  SELECT status, buyer_id, seller_id INTO v_status, v_buyer, v_seller
    FROM escrows WHERE escrow_id = NEW.escrow_id;
  IF v_status IS NOT NULL THEN
    IF NEW.raised_by <> v_buyer AND NEW.raised_by <> v_seller THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only the buyer or the seller can raise a dispute';
    END IF;
    IF v_status NOT IN ('PENDING','APPROVED') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A dispute can only be raised on a PENDING or APPROVED escrow';
    END IF;
    IF EXISTS (SELECT 1 FROM disputes WHERE escrow_id = NEW.escrow_id AND status = 'OPEN') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This escrow already has an open dispute';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_disputes_after_insert AFTER INSERT ON disputes
FOR EACH ROW
BEGIN
  UPDATE escrows SET status = 'DISPUTED' WHERE escrow_id = NEW.escrow_id;
END$$

CREATE TRIGGER trg_disputes_before_update BEFORE UPDATE ON disputes
FOR EACH ROW
BEGIN
  IF OLD.status <> 'OPEN' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A resolved dispute is immutable';
  END IF;
END$$

DELIMITER ;
