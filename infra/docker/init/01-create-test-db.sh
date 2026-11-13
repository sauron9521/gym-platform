#!/usr/bin/env bash
set -euo pipefail

# Runs only when PostgreSQL initializes a NEW local Docker volume.
# Never drop or modify an existing database.
if [[ "${D}{POSTGRES_DB}" == "gym_app_test" ]]; then
  echo "POSTGRES_DB must not be gym_app_test; use gym_app_dev for the main local database." >&2
  exit 1
fi

psql --username "${D}{POSTGRES_USER}" --dbname "${D}{POSTGRES_DB}" \
  --set=ON_ERROR_STOP=1 --command="CREATE DATABASE gym_app_test;"
