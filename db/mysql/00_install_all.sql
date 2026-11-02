-- Run from the PROJECT ROOT:   mysql -u root -p < db/mysql/00_install_all.sql
-- (or inside the mysql client: SOURCE db/mysql/00_install_all.sql;)
SOURCE db/mysql/01_schema.sql;
SOURCE db/mysql/02_alter_drop.sql;
SOURCE db/mysql/03_views.sql;
SOURCE db/mysql/04_functions_procedures.sql;
SOURCE db/mysql/05_triggers.sql;
SOURCE db/mysql/06_seed.sql;
