-- =====================================================================
-- 02_alter_drop.sql  |  DDL: ALTER / DROP / extra indexes (incl. FULLTEXT)
-- =====================================================================
USE escrow_db;

-- (A) ALTER on real tables: performance + full-text indexes
ALTER TABLE escrows      ADD INDEX idx_escrows_status_deadline (status, deadline);
ALTER TABLE escrows      ADD FULLTEXT INDEX ft_escrows_description (description);
ALTER TABLE disputes     ADD FULLTEXT INDEX ft_disputes_reason (reason);
ALTER TABLE users        ADD INDEX idx_users_role (role);
ALTER TABLE transactions ADD INDEX idx_tx_created (created_at);

-- (B) Temporary index added, then DROPPED
ALTER TABLE users ADD INDEX idx_tmp_name (name);
DROP INDEX idx_tmp_name ON users;

-- (C) Scratch table: CREATE -> ALTER (add/modify/rename/drop column, add/drop CHECK) -> DROP
CREATE TABLE demo_scratch (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  note VARCHAR(50) NULL
);
ALTER TABLE demo_scratch ADD COLUMN flag TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE demo_scratch MODIFY COLUMN note VARCHAR(200) NOT NULL DEFAULT 'n/a';
ALTER TABLE demo_scratch ADD CONSTRAINT chk_demo_note CHECK (CHAR_LENGTH(note) > 0);
ALTER TABLE demo_scratch DROP CHECK chk_demo_note;
ALTER TABLE demo_scratch RENAME COLUMN note TO message;
ALTER TABLE demo_scratch DROP COLUMN flag;
DROP TABLE demo_scratch;
