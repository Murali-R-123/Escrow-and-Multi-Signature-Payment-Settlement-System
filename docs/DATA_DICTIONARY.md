# Data Dictionary (MySQL 8 · database `escrow_db`)

PK = primary key · FK = foreign key · UQ = unique · AI = auto-increment

## users  (ISA: Buyer/Seller/Arbitrator/Admin via `role`)
| Column | Type | Key | Constraints / notes |
|---|---|---|---|
| user_id | INT AI | PK | |
| name | VARCHAR(100) | | NOT NULL, CHECK length(trim) ≥ 2 |
| email | VARCHAR(150) | UQ | NOT NULL, CHECK regex `x@y.z` |
| password_hash | VARCHAR(255) | | NOT NULL, salted scrypt `scrypt$N$r$p$salt$hash` |
| role | ENUM | | BUYER, SELLER, ARBITRATOR, ADMIN |
| created_at | DATETIME | | DEFAULT CURRENT_TIMESTAMP |

## multisig_rules
| Column | Type | Key | Constraints |
|---|---|---|---|
| rule_id | INT AI | PK | |
| required_signatures | TINYINT | UQ(1) | CHECK ≥ 1 and ≤ total_signers |
| total_signers | TINYINT | UQ(2) | CHECK ≤ 10 |
| created_at | DATETIME | | default now |

## escrows
| Column | Type | Key | Constraints |
|---|---|---|---|
| escrow_id | INT AI | PK | |
| buyer_id | INT | FK→users | NOT NULL |
| seller_id | INT | FK→users | NOT NULL, CHECK buyer_id <> seller_id |
| rule_id | INT | FK→multisig_rules | NOT NULL |
| amount | DECIMAL(12,2) | | CHECK > 0; immutable (trigger) |
| status | ENUM | | PENDING, APPROVED, RELEASED, REFUNDED, DISPUTED, EXPIRED (state machine trigger) |
| description | TEXT | | FULLTEXT index |
| deadline | DATETIME | | NOT NULL |
| created_at / updated_at | DATETIME | | updated_at `ON UPDATE CURRENT_TIMESTAMP` |

## escrow_signers  (weak entity of escrows)
| Column | Type | Key | Constraints |
|---|---|---|---|
| signer_id | INT AI | PK | |
| escrow_id | INT | FK→escrows (ON DELETE CASCADE), UQ(1) | |
| user_id | INT | FK→users, UQ(2) | one row per user per escrow |
| signer_role | ENUM | | BUYER, SELLER, ARBITRATOR |
| added_at | DATETIME | | |

## approvals  (weak entity of escrow_signers)
| Column | Type | Key | Constraints |
|---|---|---|---|
| approval_id | INT AI | PK | |
| escrow_id, user_id | INT, INT | **composite FK**→escrow_signers(escrow_id,user_id), UQ | only signers vote, once |
| decision | ENUM | | APPROVE, REJECT |
| approved_at | DATETIME | | |
| remarks | TEXT | | nullable |

## transactions  (append-only ledger)
| Column | Type | Key | Constraints |
|---|---|---|---|
| transaction_id | INT AI | PK | |
| escrow_id | INT | FK→escrows | index (escrow_id, transaction_type) |
| transaction_type | ENUM | | DEPOSIT, RELEASE, REFUND |
| amount | DECIMAL(12,2) | | CHECK > 0; payout must equal escrow amount (trigger) |
| transaction_status | ENUM | | PENDING, COMPLETED, FAILED; rows immutable/undeletable (triggers) |
| created_at | DATETIME | | |

## disputes
| Column | Type | Key | Constraints |
|---|---|---|---|
| dispute_id | INT AI | PK | |
| escrow_id | INT | FK→escrows | |
| raised_by | INT | FK→users | must be buyer or seller (trigger) |
| resolved_by | INT NULL | FK→users | must be the escrow's arbitrator (procedure) |
| reason | TEXT | | CHECK length ≥ 10; FULLTEXT index |
| status | ENUM | | OPEN, RESOLVED, REJECTED |
| created_at / resolved_at | DATETIME | | CHECK: OPEN ⇔ resolved_at IS NULL |

## Views
`v_escrow_summary`, `v_pending_signatures`, `v_open_disputes`, `v_monthly_released`

## Routines
Functions: `fn_approval_count`, `fn_is_signer` · Procedures: `sp_create_escrow`, `sp_approve_escrow`, `sp_release_escrow`, `sp_raise_dispute`, `sp_resolve_dispute`, `sp_expire_overdue_escrows`

## Triggers
`trg_approvals_before_insert`, `trg_approvals_after_insert` (m-of-n rule), `trg_escrows_before_update` (state machine), `trg_transactions_before_insert/update/delete` (ledger), `trg_disputes_before_insert/after_insert/before_update`

## Indexes
`idx_tx_escrow_type`, `idx_escrows_status_deadline`, `idx_users_role`, `idx_tx_created`, FULLTEXT `ft_escrows_description`, `ft_disputes_reason`, plus FK/UNIQUE indexes.
