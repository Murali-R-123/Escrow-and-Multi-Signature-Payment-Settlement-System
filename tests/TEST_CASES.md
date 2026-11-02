# Test cases

Automated: `npm run test:db` (file `tests/run-db-tests.mjs`, 38 cases against the seeded MySQL DB).
Manual UI cases are marked **UI**. Record the actual result + screenshot in the "Result" column for the report.

## A. Database-level validation & integrity (automated)
| ID | Test | Expected | Result |
|---|---|---|---|
| T01 | Insert user with duplicate email | error 1062 (UNIQUE) | |
| T02 | Insert user with invalid email | error 3819 (CHECK) | |
| T03 | Insert user with role `HACKER` | rejected (ENUM) | |
| T04 | Escrow with amount ≤ 0 | error 3819 (CHECK) | |
| T05 | Escrow with buyer = seller | error 3819 (CHECK) | |
| T06 | A SELLER used as buyer | `Buyer must be…` | |
| T07 | Deadline in the past | `Deadline must be in the future` | |
| T08 | 3 required signatures with 2 signers | `Required signatures…` | |

## B. Multi-signature workflow (automated)
| ID | Test | Expected |
|---|---|---|
| T09 | Create escrow | 1 rule, escrow, 3 signers, 1 DEPOSIT in one transaction |
| T10 | Rules reused | exactly one 2-of-3 rule row |
| T11 | Non-signer approves | rejected |
| T12 | First approval | stays PENDING |
| T13 | Same signer votes twice | error 1062 |
| T14 | Release before threshold | rejected |
| T15 | Second approval | status → APPROVED (trigger) |
| T16 | Vote after APPROVED | rejected (`closed`) |
| T17 | Direct INSERT vote by non-signer | rejected (trigger / composite FK) |
| T18 | Non-signer releases | rejected |
| T19 | Release | one RELEASE row, status RELEASED |
| T20 | Release twice | rejected |

## C. Ledger & immutability (automated)
| ID | Test | Expected |
|---|---|---|
| T21 | Second payout row | rejected (`already paid out`) |
| T22 | Change escrow amount | rejected (trigger) |
| T23 | Re-open a RELEASED escrow | rejected (state machine) |
| T24 | Delete ledger row | rejected |
| T25 | Update ledger row | rejected |
| T38 | Deposit = payout for all closed escrows | no unbalanced escrow |

## D. Disputes, expiry, transactions (automated)
| ID | Test | Expected |
|---|---|---|
| T26 | Dispute on RELEASED escrow | rejected |
| T27 | Raise dispute | escrow DISPUTED (trigger) |
| T28 | Dispute by non-party | rejected |
| T29 | Second dispute while one is open | rejected |
| T30 | Wrong arbitrator resolves | rejected |
| T31 | Arbitrator REFUND | escrow REFUNDED + REFUND row |
| T32 | Resolve twice | rejected |
| T33 | Expiry batch (cursor) | overdue PENDING → EXPIRED + REFUND row |
| T34 | Vote after deadline | rejected |
| T35 | ROLLBACK | no partial data |
| T36 | FULLTEXT search | ≥ 1 dispute found |
| T37 | View consistency | `approvals_count` matches table |

## E. Application / security (manual – **UI**)
| ID | Test | Expected | Result |
|---|---|---|---|
| U01 | Register with 7-char password | validation error | |
| U02 | Login with wrong password | 401 "Invalid email or password" | |
| U03 | Open `/dashboard` logged out | redirect to `/login` | |
| U04 | BUYER opens `/admin` | redirect to `/dashboard` | |
| U05 | SELLER calls `POST /api/escrows` (DevTools) | 403 | |
| U06 | Buyer A opens escrow of Buyer B by URL | 403 "not a participant" | |
| U07 | Dashboard search "laptop" / status filter | filtered rows | |
| U08 | Create 2-of-3 escrow, approve with 2 accounts, release | statuses PENDING → APPROVED → RELEASED; audit timeline shows events | |
| U09 | Raise dispute; arbitrator resolves REFUND | DISPUTED → REFUNDED | |
| U10 | Admin → "Process expired" | overdue escrow becomes EXPIRED | |
| U11 | Stop MongoDB, approve an escrow | payment flow still succeeds; audit panel shows offline notice | |
| U12 | Disputes page full-text search "delivered" | matching disputes | |
