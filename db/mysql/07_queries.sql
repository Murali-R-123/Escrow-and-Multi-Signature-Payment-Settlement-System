-- =====================================================================
-- 07_queries.sql  |  Important queries (JOIN, GROUP BY, HAVING, ORDER BY,
--                    aggregates, subqueries, window fn, UNION, full-text, EXPLAIN)
-- =====================================================================
USE escrow_db;

-- Q1  INNER JOIN: escrows with buyer, seller and multisig rule
SELECT e.escrow_id, b.name AS buyer, s.name AS seller, e.amount, e.status,
       CONCAT(r.required_signatures, '-of-', r.total_signers) AS rule
FROM escrows e
JOIN users b ON b.user_id = e.buyer_id
JOIN users s ON s.user_id = e.seller_id
JOIN multisig_rules r ON r.rule_id = e.rule_id
ORDER BY e.created_at DESC;

-- Q2  GROUP BY + aggregates: escrows and value per status
SELECT status, COUNT(*) AS escrows, SUM(amount) AS total_amount, AVG(amount) AS avg_amount
FROM escrows GROUP BY status ORDER BY total_amount DESC;

-- Q3  GROUP BY + HAVING: buyers who locked more than 20,000 in total
SELECT u.name, COUNT(*) AS escrows, SUM(e.amount) AS total_locked
FROM escrows e JOIN users u ON u.user_id = e.buyer_id
GROUP BY u.user_id, u.name
HAVING SUM(e.amount) > 20000
ORDER BY total_locked DESC;

-- Q4  Subquery: escrows that still need more approvals than they currently have
SELECT escrow_id, status, approvals_count, required_signatures
FROM v_escrow_summary
WHERE status = 'PENDING'
  AND approvals_count < required_signatures;

-- Q5  Correlated subquery: sellers who have never received a RELEASE payout
SELECT u.user_id, u.name
FROM users u
WHERE u.role = 'SELLER'
  AND NOT EXISTS (SELECT 1 FROM escrows e
                  JOIN transactions t ON t.escrow_id = e.escrow_id
                  WHERE e.seller_id = u.user_id AND t.transaction_type = 'RELEASE');

-- Q6  LEFT JOIN via view: who still has to sign what
SELECT * FROM v_pending_signatures ORDER BY deadline;

-- Q7  FULL-TEXT search on dispute reasons, ranked by relevance
SELECT dispute_id, escrow_id, status,
       MATCH(reason) AGAINST ('delivered wrong delivery' IN NATURAL LANGUAGE MODE) AS relevance,
       reason
FROM disputes
WHERE MATCH(reason) AGAINST ('delivered wrong delivery' IN NATURAL LANGUAGE MODE)
ORDER BY relevance DESC;

-- Q8  Aggregate view: monthly released volume
SELECT * FROM v_monthly_released ORDER BY month DESC;

-- Q9  Window function: rank sellers by value received
SELECT seller, received,
       RANK() OVER (ORDER BY received DESC) AS seller_rank
FROM (SELECT s.name AS seller, SUM(t.amount) AS received
      FROM transactions t
      JOIN escrows e ON e.escrow_id = t.escrow_id
      JOIN users s   ON s.user_id   = e.seller_id
      WHERE t.transaction_type = 'RELEASE'
      GROUP BY s.user_id, s.name) x;

-- Q10 UNION ALL: unified money-flow ledger
SELECT escrow_id, 'IN'  AS direction, amount, created_at FROM transactions WHERE transaction_type = 'DEPOSIT'
UNION ALL
SELECT escrow_id, 'OUT' AS direction, amount, created_at FROM transactions WHERE transaction_type IN ('RELEASE','REFUND')
ORDER BY created_at;

-- Q11 EXISTS: escrows that currently have an open dispute
SELECT e.escrow_id, e.amount, e.status
FROM escrows e
WHERE EXISTS (SELECT 1 FROM disputes d WHERE d.escrow_id = e.escrow_id AND d.status = 'OPEN');

-- Q12 Average dispute resolution time (hours)
SELECT COUNT(*) AS resolved_disputes,
       AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at)) / 60 AS avg_hours_to_resolve
FROM disputes WHERE resolved_at IS NOT NULL;

-- Q13 Signer participation per escrow (approve / reject / pending)
SELECT es.escrow_id,
       SUM(a.decision = 'APPROVE') AS approved,
       SUM(a.decision = 'REJECT')  AS rejected,
       SUM(a.approval_id IS NULL)  AS not_voted
FROM escrow_signers es
LEFT JOIN approvals a ON a.escrow_id = es.escrow_id AND a.user_id = es.user_id
GROUP BY es.escrow_id;

-- Q14 INDEX proof: compare the plan with and without the composite index
EXPLAIN SELECT escrow_id FROM escrows WHERE status = 'PENDING' AND deadline < NOW();
EXPLAIN SELECT escrow_id FROM escrows IGNORE INDEX (idx_escrows_status_deadline)
         WHERE status = 'PENDING' AND deadline < NOW();
