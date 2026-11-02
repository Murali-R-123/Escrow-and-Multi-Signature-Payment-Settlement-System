#!/usr/bin/env bash
# Usage (from project root):  bash scripts/setup-db.sh [mysql-user]
set -euo pipefail
cd "$(dirname "$0")/.."
USER_NAME="${1:-root}"
echo ">> Installing MySQL schema, views, procedures, triggers and seed data as '$USER_NAME'"
mysql -u "$USER_NAME" -p < db/mysql/00_install_all.sql
echo ">> (optional) create the least-privilege app account:  mysql -u root -p < db/mysql/09_app_user.sql"
echo ">> Done."
