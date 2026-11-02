# Requirement → Evidence map (DBMS Level 3 PDF)

| # | PDF requirement | Where it is satisfied |
|---|---|---|
| 1 | Unique, non-CRUD, real-world title | "Decentralized Escrow & Multi-Signature Payment Settlement Engine" – m-of-n approvals, ledger, disputes, expiry batch |
| 2 | 2-member team, both do DB + app | `docs/TEAM_CONTRIBUTIONS.md` + Git history |
| 3 | SQL (MySQL) + NoSQL (MongoDB) | `db/mysql/*`, `db/mongo/*` |
| 4 | ER diagram → relational schema; entities, attrs, PK, FK, relationships, constraints; NoSQL data model | `docs/diagrams/`, `docs/DATA_DICTIONARY.md`, `docs/MONGODB_DESIGN.md` |
| 5 | DDL: CREATE, ALTER, DROP, PK/FK, constraints, indexes, views | `01_schema.sql`, `02_alter_drop.sql`, `03_views.sql` |
| 6 | DML: INSERT/UPDATE/DELETE/SELECT; JOIN, GROUP BY, HAVING, ORDER BY, aggregates, subqueries | `06_seed.sql`, `07_queries.sql`, `08_dml_and_transaction_demo.sql`, API routes |
| 7 | ≥4 advanced SQL concepts + 1 NoSQL | **Transactions** (procedures), **Views**, **Stored procedures/functions** (+cursor), **Triggers** (9), **Indexing** (+EXPLAIN), **Full-text search**; **MongoDB aggregation** |
| 8 | Vector/semantic search (optional) | Not used – justified in report §4 (no embedding-worthy unstructured data); full-text search used instead |
| 9 | Next.js web UI with forms/tables/search/filter/dashboard | `src/app/*` |
| 10 | App ↔ DB via API layer, env vars, no hard-coded credentials | `src/app/api/*`, `src/lib/mysql.js`, `.env.example` |
| 11 | Backend authentication, ≥2 roles | JWT + 4 roles (BUYER, SELLER, ARBITRATOR, ADMIN); `requireUser(roles)`, `middleware.js` |
| 12 | DB-level validation & integrity | ENUM, CHECK, UNIQUE, FK (incl. composite), triggers, procedures with `SIGNAL` |
| 13 | Documentation (12 sections) | `docs/PROJECT_REPORT.md` (+ linked docs) |
| 14 | Git/GitHub, individual commits, README | `README.md`, `docs/TEAM_CONTRIBUTIONS.md` |
| 15 | Demo: ER, schema, DB impl, queries, UI, integration, advanced features, tests, contributions | `docs/DEMO_SCRIPT.md`, `tests/` |
| 16 | Originality | Own design; no tutorial/repo copied |
| 17 | Beyond CRUD; DB choice justified | Report §4; money-moving logic lives in ACID procedures/triggers |
