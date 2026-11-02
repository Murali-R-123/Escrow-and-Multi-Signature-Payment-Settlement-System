-- =====================================================================
-- 03_views.sql  |  Views
-- =====================================================================
USE escrow_db;

-- Escrow + parties + rule + live approval counts
CREATE OR REPLACE VIEW v_escrow_summary AS
SELECT e.escrow_id, e.amount, e.status, e.description, e.deadline, e.created_at, e.updated_at,
       e.buyer_id,  b.name AS buyer_name,
       e.seller_id, s.name AS seller_name,
       r.required_signatures, r.total_signers,
       (SELECT COUNT(*) FROM approvals a WHERE a.escrow_id = e.escrow_id AND a.decision = 'APPROVE') AS approvals_count,
       (SELECT COUNT(*) FROM approvals a WHERE a.escrow_id = e.escrow_id AND a.decision = 'REJECT')  AS rejections_count,
       ((SELECT COUNT(*) FROM approvals a WHERE a.escrow_id = e.escrow_id AND a.decision = 'REJECT')
          > r.total_signers - r.required_signatures) AS approval_blocked
FROM escrows e
JOIN users b ON b.user_id = e.buyer_id
JOIN users s ON s.user_id = e.seller_id
JOIN multisig_rules r ON r.rule_id = e.rule_id;

-- Signers who still have to vote on PENDING escrows
CREATE OR REPLACE VIEW v_pending_signatures AS
SELECT es.escrow_id, es.user_id, u.name AS signer_name, es.signer_role, e.amount, e.deadline
FROM escrow_signers es
JOIN escrows e ON e.escrow_id = es.escrow_id AND e.status = 'PENDING'
JOIN users u   ON u.user_id   = es.user_id
LEFT JOIN approvals a ON a.escrow_id = es.escrow_id AND a.user_id = es.user_id
WHERE a.approval_id IS NULL;

-- Open disputes with context
CREATE OR REPLACE VIEW v_open_disputes AS
SELECT d.dispute_id, d.escrow_id, d.reason, d.created_at,
       u.name AS raised_by_name, e.amount, e.status AS escrow_status
FROM disputes d
JOIN users u   ON u.user_id   = d.raised_by
JOIN escrows e ON e.escrow_id = d.escrow_id
WHERE d.status = 'OPEN';

-- Monthly released volume (aggregate view)
CREATE OR REPLACE VIEW v_monthly_released AS
SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
       COUNT(*)    AS release_count,
       SUM(amount) AS total_released
FROM transactions
WHERE transaction_type = 'RELEASE' AND transaction_status = 'COMPLETED'
GROUP BY DATE_FORMAT(created_at, '%Y-%m');
