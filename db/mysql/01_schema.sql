-- =====================================================================
-- 01_schema.sql  |  DDL: CREATE (tables, PK, FK, constraints, index)
-- Decentralized Escrow & Multi-Signature Payment Settlement Engine
-- Requires MySQL 8.0.16+ (CHECK constraints are enforced from 8.0.16)
-- =====================================================================
DROP DATABASE IF EXISTS escrow_db;
CREATE DATABASE escrow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE escrow_db;

-- USERS (ISA Buyer / Seller / Arbitrator mapped to ONE table; `role` = discriminator)
CREATE TABLE users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,                 -- salted scrypt hash, never plain text
  role          ENUM('BUYER','SELLER','ARBITRATOR','ADMIN') NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email  UNIQUE (email),
  CONSTRAINT chk_users_email CHECK (email REGEXP '^[^@ ]+@[^@ ]+[.][^@ ]+$'),
  CONSTRAINT chk_users_name  CHECK (CHAR_LENGTH(TRIM(name)) >= 2)
) ENGINE=InnoDB;

-- MULTISIG_RULES (reusable m-of-n templates; many escrows share one rule => Escrows N:1 Rule)
CREATE TABLE multisig_rules (
  rule_id             INT AUTO_INCREMENT PRIMARY KEY,
  required_signatures TINYINT NOT NULL,
  total_signers       TINYINT NOT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_rule  UNIQUE (required_signatures, total_signers),
  CONSTRAINT chk_rule CHECK (required_signatures >= 1
                         AND required_signatures <= total_signers
                         AND total_signers <= 10)
) ENGINE=InnoDB;

-- ESCROWS
CREATE TABLE escrows (
  escrow_id   INT AUTO_INCREMENT PRIMARY KEY,
  buyer_id    INT NOT NULL,
  seller_id   INT NOT NULL,
  rule_id     INT NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  status      ENUM('PENDING','APPROVED','RELEASED','REFUNDED','DISPUTED','EXPIRED')
              NOT NULL DEFAULT 'PENDING',
  description TEXT NULL,
  deadline    DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_escrow_buyer  FOREIGN KEY (buyer_id)  REFERENCES users(user_id),
  CONSTRAINT fk_escrow_seller FOREIGN KEY (seller_id) REFERENCES users(user_id),
  CONSTRAINT fk_escrow_rule   FOREIGN KEY (rule_id)   REFERENCES multisig_rules(rule_id),
  CONSTRAINT chk_escrow_amount  CHECK (amount > 0),
  CONSTRAINT chk_escrow_parties CHECK (buyer_id <> seller_id)
) ENGINE=InnoDB;

-- ESCROW_SIGNERS (weak entity of ESCROWS)
CREATE TABLE escrow_signers (
  signer_id   INT AUTO_INCREMENT PRIMARY KEY,
  escrow_id   INT NOT NULL,
  user_id     INT NOT NULL,
  signer_role ENUM('BUYER','SELLER','ARBITRATOR') NOT NULL,
  added_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_signer UNIQUE (escrow_id, user_id),
  CONSTRAINT fk_signer_escrow FOREIGN KEY (escrow_id) REFERENCES escrows(escrow_id) ON DELETE CASCADE,
  CONSTRAINT fk_signer_user   FOREIGN KEY (user_id)   REFERENCES users(user_id)
) ENGINE=InnoDB;

-- APPROVALS (weak entity of ESCROW_SIGNERS)
--   composite FK  => only registered signers of THIS escrow can vote
--   UNIQUE        => exactly one vote per signer
CREATE TABLE approvals (
  approval_id INT AUTO_INCREMENT PRIMARY KEY,
  escrow_id   INT NOT NULL,
  user_id     INT NOT NULL,
  decision    ENUM('APPROVE','REJECT') NOT NULL,
  approved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remarks     TEXT NULL,
  CONSTRAINT uq_approval UNIQUE (escrow_id, user_id),
  CONSTRAINT fk_approval_signer FOREIGN KEY (escrow_id, user_id)
             REFERENCES escrow_signers(escrow_id, user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- TRANSACTIONS (append-only ledger)
CREATE TABLE transactions (
  transaction_id     INT AUTO_INCREMENT PRIMARY KEY,
  escrow_id          INT NOT NULL,
  transaction_type   ENUM('DEPOSIT','RELEASE','REFUND') NOT NULL,
  amount             DECIMAL(12,2) NOT NULL,
  transaction_status ENUM('PENDING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tx_escrow  FOREIGN KEY (escrow_id) REFERENCES escrows(escrow_id),
  CONSTRAINT chk_tx_amount CHECK (amount > 0)
) ENGINE=InnoDB;
CREATE INDEX idx_tx_escrow_type ON transactions (escrow_id, transaction_type);

-- DISPUTES
CREATE TABLE disputes (
  dispute_id  INT AUTO_INCREMENT PRIMARY KEY,
  escrow_id   INT NOT NULL,
  raised_by   INT NOT NULL,
  resolved_by INT NULL,
  reason      TEXT NOT NULL,
  status      ENUM('OPEN','RESOLVED','REJECTED') NOT NULL DEFAULT 'OPEN',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  CONSTRAINT fk_dispute_escrow   FOREIGN KEY (escrow_id)   REFERENCES escrows(escrow_id),
  CONSTRAINT fk_dispute_raiser   FOREIGN KEY (raised_by)   REFERENCES users(user_id),
  CONSTRAINT fk_dispute_resolver FOREIGN KEY (resolved_by) REFERENCES users(user_id),
  CONSTRAINT chk_dispute_reason  CHECK (CHAR_LENGTH(TRIM(reason)) >= 10),
  CONSTRAINT chk_dispute_state   CHECK ((status = 'OPEN' AND resolved_at IS NULL)
                                     OR (status <> 'OPEN' AND resolved_at IS NOT NULL))
) ENGINE=InnoDB;
