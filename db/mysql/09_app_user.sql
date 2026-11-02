-- =====================================================================
-- 09_app_user.sql  |  Least-privilege MySQL account used by the Next.js app
-- (Run as root AFTER the schema is installed. Change the password!)
-- The app never needs DDL rights, and it can never DELETE ledger/approval data.
-- =====================================================================
CREATE USER IF NOT EXISTS 'escrow_app'@'localhost' IDENTIFIED BY 'ChangeMe_Str0ng!';
GRANT SELECT, INSERT, UPDATE, EXECUTE ON escrow_db.* TO 'escrow_app'@'localhost';
FLUSH PRIVILEGES;
