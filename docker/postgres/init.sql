-- Initialization script for Kwanza ERP PostgreSQL container
-- This runs automatically on first container start only

-- Ensure the database exists (created via POSTGRES_DB env var)
-- Grant full privileges to the postgres user
GRANT ALL PRIVILEGES ON DATABASE kwanza_erp TO postgres;

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
