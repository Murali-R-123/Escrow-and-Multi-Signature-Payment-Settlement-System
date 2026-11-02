# Decentralized Escrow & Multi-Signature Payment Settlement Engine

DBMS Experiential Learning – **Level 3 Project** · PES University
**Stack:** Next.js 14 (App Router) · MySQL 8 (relational core) · MongoDB (audit log) · JWT auth · Git/GitHub

Buyers lock funds in an escrow governed by an **m-of-n multi-signature rule** (e.g. 2-of-3: buyer + seller + arbitrator).
Funds are released only when enough signers approve; disputes are settled by an assigned arbitrator; overdue escrows are refunded.
Every rule (state machine, one-payout-only ledger, one-vote-per-signer, immutable amounts…) is enforced **inside MySQL**
with constraints, triggers and transactional stored procedures — the app cannot bypass them.

## 1. Prerequisites
| Tool | Version |
|---|---|
| Node.js | 20.6+ (22 recommended) |
| MySQL | **8.0.16+** (CHECK constraints are enforced from 8.0.16) |
| MongoDB | 6+ (local or Atlas) |
| mongosh / mysql CLI | optional but handy |

## 2. Setup
```bash
git clone <your-repo-url> escrow-engine && cd escrow-engine
npm install
cp .env.example .env.local          # then edit credentials + JWT_SECRET
```

### MySQL (run from the project root)
```bash
mysql -u root -p < db/mysql/00_install_all.sql      # schema, alters, views, procedures, triggers, seed
mysql -u root -p < db/mysql/09_app_user.sql         # optional: least-privilege 'escrow_app' account
```
Windows/PowerShell (no `<` redirect): `mysql -u root -p -e "SOURCE db/mysql/00_install_all.sql"`
Put the `escrow_app` credentials (or root, for a quick start) into `.env.local`.

### MongoDB
```bash
npm run mongo:init          # creates audit_events + validator + indexes, seeds sample events
```

### Run
```bash
npm run dev                 # http://localhost:3000
npm run test:db             # 38 automated database tests (constraints, triggers, procedures, ledger)
```

## 3. Demo accounts (password for all: `Password@123`)
| Role | Email |
|---|---|
| ADMIN | admin@escrow.test |
| BUYER | alice.buyer@escrow.test · rahul.buyer@escrow.test |
| SELLER | priya.seller@escrow.test · arjun.seller@escrow.test |
| ARBITRATOR | meera.arbiter@escrow.test · karan.arbiter@escrow.test |

## 4. Repository layout
```
db/mysql/   01_schema · 02_alter_drop · 03_views · 04_functions_procedures · 05_triggers
            06_seed · 07_queries · 08_dml_and_transaction_demo · 09_app_user · 00_install_all
db/mongo/   init.js (mongosh) · aggregations.js
src/lib/    mysql.js mongo.js audit.js auth.js token.js errors.js validate.js access.js client.js
src/app/    pages: login register dashboard escrows/new escrows/[id] disputes admin
src/app/api REST route handlers (auth, escrows, approve, release, dispute, disputes, admin, audit, users)
src/middleware.js   page-level auth + role gate
scripts/    init-mongo.mjs · setup-db.sh
tests/      run-db-tests.mjs (automated) · TEST_CASES.md
docs/       report, data dictionary, MongoDB design, architecture, demo script, traceability, diagrams/
```

## 5. API summary
| Method & path | Roles | Backed by |
|---|---|---|
| POST `/api/auth/register` · `/login` · `/logout`, GET `/me` | public / any | `users`, scrypt, JWT cookie |
| GET `/api/escrows?status=&q=&page=` | any (own data; ADMIN all) | `v_escrow_summary`, FULLTEXT |
| POST `/api/escrows` | BUYER | `sp_create_escrow` |
| GET `/api/escrows/:id` | participants / ADMIN | joins + Mongo timeline |
| POST `/api/escrows/:id/approve` | signers | `sp_approve_escrow` + trigger |
| POST `/api/escrows/:id/release` | signers / ADMIN | `sp_release_escrow` |
| POST `/api/escrows/:id/dispute` | BUYER, SELLER | `sp_raise_dispute` + trigger |
| GET `/api/disputes?q=` | participants / ADMIN | FULLTEXT on `reason` |
| POST `/api/disputes/:id/resolve` | assigned ARBITRATOR | `sp_resolve_dispute` |
| POST `/api/admin/expire` · GET `/api/admin/stats` | ADMIN | `sp_expire_overdue_escrows` (cursor), GROUP BY/HAVING, Mongo `$group` |
| GET `/api/audit` | participants / ADMIN | MongoDB `audit_events` |

## 6. Security notes
- DB credentials and `JWT_SECRET` live only in `.env.local` (git-ignored); nothing sensitive is hard-coded.
- Passwords are salted **scrypt** hashes; JWT is an `httpOnly`, `SameSite=Lax` cookie.
- All SQL uses parameter placeholders; stored procedures are whitelisted by name.
- The app account (`09_app_user.sql`) has no DELETE/DDL rights.

## 7. Team
See `docs/TEAM_CONTRIBUTIONS.md`.
