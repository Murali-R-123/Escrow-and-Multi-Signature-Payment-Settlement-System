# Team contributions  (edit names; keep it consistent with `git shortlog -sn`)

| Area | Member A – <name / SRN> | Member B – <name / SRN> |
|---|---|---|
| ER diagram & schema | ER + relational schema, normalisation notes | review, data dictionary |
| MySQL | `01_schema`, `02_alter_drop`, `04_functions_procedures`, `05_triggers`, `07_queries` | `03_views`, `06_seed`, `08_dml_and_transaction_demo`, `09_app_user` |
| MongoDB | – | `init.js`, `aggregations.js`, `lib/audit.js`, admin aggregations |
| Backend API | escrows / approve / release / dispute / resolve routes | auth (register/login/JWT), middleware, admin/audit routes |
| Frontend | escrow detail, dispute pages | login/register, dashboard, new escrow, admin |
| Testing | `tests/run-db-tests.mjs` (DB cases) | `tests/TEST_CASES.md` UI cases, screenshots |
| Documentation | report §1–§7, data dictionary | report §8–§12, README, architecture |

Suggested commit convention: `feat(db): …`, `feat(api): …`, `feat(ui): …`, `docs: …`, `test: …` — each member commits their own files so history shows individual work.
