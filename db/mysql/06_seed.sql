-- =====================================================================
-- 06_seed.sql  |  Demo data (all demo accounts use password:  Password@123)
-- Escrows are created through the stored procedures so triggers/ledger rows are consistent.
-- =====================================================================
USE escrow_db;

INSERT INTO users (user_id, name, email, password_hash, role) VALUES
  (1, 'System Admin', 'admin@escrow.test', 'scrypt$16384$8$1$c857392d1b91d0902d6c5f8d71116847$e25d241cd4b129019addd92a1ad599d9bdfebe4b01929c88b135abaa242b12c97d9c10215644d38619318683e5b38a81ebd7b2d761c7493a316231b90505c426', 'ADMIN'),
  (2, 'Alice Menon', 'alice.buyer@escrow.test', 'scrypt$16384$8$1$74f4549b3cef6a71100f3de7855aa008$b631db8119a3a32434991f6fa2d856bf4e9dec34a4b1e35bbbcb3f7144bba19e14dba3b858802c61d9822286e357752968d5b15d49aef9dda18a1b9212661e9e', 'BUYER'),
  (3, 'Rahul Verma', 'rahul.buyer@escrow.test', 'scrypt$16384$8$1$ff2b06f7196ec90e16af9b44a03f3b21$34d4bd2158dbccd54ec0f71ae9df027ca5605f0cee414694021eb8ceb99713ca5e3bbcae853641eb78a4b4dd97ea02e222e04bc884f1baa60f7a49359c035ac7', 'BUYER'),
  (4, 'Priya Nair', 'priya.seller@escrow.test', 'scrypt$16384$8$1$ce37bc1d21233b45847868014c8453b9$60e831106691f3b0bd3b52c5a09cd7499f142c09ef31bb3f43099ea31bb550940371a2fa2adcc349f165802d5c5aab408c72ce96a9c78938e13bf551d7b207f0', 'SELLER'),
  (5, 'Arjun Rao', 'arjun.seller@escrow.test', 'scrypt$16384$8$1$94137ce9cdf0bd407a6e9377abd86d4c$eb3ce8bc0dbdd5b415c1f2886946b9bae5e37994c7a3cc07663eecac1ca95d4e48b42e53f0c3dd5384e376b2c967f62b2bf7e4aa2bc01f7e3ca70c8677a373d8', 'SELLER'),
  (6, 'Meera Iyer', 'meera.arbiter@escrow.test', 'scrypt$16384$8$1$e9f83a51859410ba56a65a83d8813a19$cfefd7f64f7ebfd88ad2f39d94159b1ec3679e83e4fb6b477ff1e9969e28a3ba2374abf3ab5e54c25e94f8ac852be1c4ac461e8706b64ae62c2dad9dd4e72203', 'ARBITRATOR'),
  (7, 'Karan Shah', 'karan.arbiter@escrow.test', 'scrypt$16384$8$1$36013dc7468e56919bd66da7ff08bef4$c3f07ca573ffb3cb30007a47210b1e79dd916a2ac40348922723a49ee8bebf299e7baae81d0603ca7d1b57847ef56b4400b40d59d079b6650f8af0315053d50e', 'ARBITRATOR');

-- E1: Alice -> Priya (arbiter Meera), 2-of-3. Both approved => APPROVED, awaiting release.
CALL sp_create_escrow(2, 4, 6, 25000.00, 'Website design - milestone 1 payment', DATE_ADD(NOW(), INTERVAL 14 DAY), 2);
CALL sp_approve_escrow(1, 2, 'APPROVE', 'Design files received');
CALL sp_approve_escrow(1, 4, 'APPROVE', 'Delivered as agreed');

-- E2: Alice -> Arjun (arbiter Karan), 2-of-3. Approved and RELEASED.
CALL sp_create_escrow(2, 5, 7, 48000.50, 'Second-hand laptop purchase with 6 month warranty', DATE_ADD(NOW(), INTERVAL 10 DAY), 2);
CALL sp_approve_escrow(2, 2, 'APPROVE', 'Laptop works fine');
CALL sp_approve_escrow(2, 5, 'APPROVE', NULL);
CALL sp_release_escrow(2, 2);

-- E3: Rahul -> Priya, 2-of-2, nobody has voted yet (PENDING)
CALL sp_create_escrow(3, 4, NULL, 12000.00, 'Logo and brand kit design', DATE_ADD(NOW(), INTERVAL 7 DAY), 2);

-- E4: Rahul -> Arjun (arbiter Meera). Delivery delayed => OPEN dispute (dispute 1)
CALL sp_create_escrow(3, 5, 6, 75000.00, 'Used car delivery to Bengaluru', DATE_ADD(NOW(), INTERVAL 5 DAY), 2);
CALL sp_raise_dispute(4, 3, 'Seller has not delivered the car within the agreed delivery window and is not responding.');

-- E5: Alice -> Priya (arbiter Karan). Wrong item delivered => dispute 2 resolved with REFUND
CALL sp_create_escrow(2, 4, 7, 5000.00, 'Textbook set for semester 5', DATE_ADD(NOW(), INTERVAL 3 DAY), 2);
CALL sp_approve_escrow(5, 2, 'REJECT', 'Wrong edition received');
CALL sp_raise_dispute(5, 2, 'Textbook edition delivered does not match the listing, wrong edition received.');
CALL sp_resolve_dispute(2, 7, 'REFUND');

-- E6: Rahul -> Priya. Deadline already passed (admin "process expired" button will refund it)
CALL sp_create_escrow(3, 4, NULL, 8000.00, 'Translation work - overdue demo', DATE_ADD(NOW(), INTERVAL 1 DAY), 2);
UPDATE escrows SET deadline = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE escrow_id = 6;

-- E7: Alice -> Arjun, 1-of-2 rule (shows rule reuse/variety). PENDING.
CALL sp_create_escrow(2, 5, NULL, 15000.00, 'Quick approval demo escrow (1 of 2)', DATE_ADD(NOW(), INTERVAL 20 DAY), 1);
