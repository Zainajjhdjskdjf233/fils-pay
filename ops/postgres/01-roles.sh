#!/bin/sh
# E02/E91: runs once, on the first start with an empty data volume (postgres
# image /docker-entrypoint-initdb.d). The superuser stays for the image only;
# migrations run as filspay_owner, each service has its own login role, and
# none of them is a superuser. Passwords come from the environment (never typed
# here); see ops/gen-env.sh.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_pw="$FILSPAY_OWNER_DB_PASSWORD" -v api_pw="$FILSPAY_API_DB_PASSWORD" \
  -v settlement_pw="$FILSPAY_SETTLEMENT_DB_PASSWORD" -v reporting_pw="$FILSPAY_REPORTING_DB_PASSWORD" <<'SQL'
CREATE ROLE filspay_owner      LOGIN NOSUPERUSER NOCREATEROLE PASSWORD :'owner_pw';
CREATE ROLE filspay_api        LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB PASSWORD :'api_pw';
CREATE ROLE filspay_settlement LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB PASSWORD :'settlement_pw';
CREATE ROLE filspay_reporting  LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB PASSWORD :'reporting_pw';
CREATE DATABASE filspay OWNER filspay_owner;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname filspay <<'SQL'
ALTER SCHEMA public OWNER TO filspay_owner;
REVOKE ALL ON DATABASE filspay FROM PUBLIC;
GRANT CONNECT ON DATABASE filspay TO filspay_api, filspay_settlement, filspay_reporting;
GRANT USAGE ON SCHEMA public TO filspay_api, filspay_settlement, filspay_reporting;
-- Tables/sequences/functions the owner creates in migrations are usable by the
-- app roles automatically (data access only, no DDL).
ALTER DEFAULT PRIVILEGES FOR ROLE filspay_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO filspay_api, filspay_settlement, filspay_reporting;
ALTER DEFAULT PRIVILEGES FOR ROLE filspay_owner IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO filspay_api, filspay_settlement, filspay_reporting;
ALTER DEFAULT PRIVILEGES FOR ROLE filspay_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO filspay_api, filspay_settlement, filspay_reporting;
SQL
