#!/bin/bash
# =============================================================
# Kwanza ERP - Import Portable Database Package
# =============================================================
# Run this on a NEW PC after installing Docker Desktop.
# It restores the full Kwanza ERP database from archive.
# =============================================================

set -e

CONTAINER="kwanza-postgres"
DB_NAME="kwanza_erp"
DB_USER="postgres"
IMPORT_DIR="/tmp/kwanza-import"

echo "============================================"
echo "  Kwanza ERP - Portable Import"
echo "============================================"
echo ""

# Check if archive provided or we're already extracted
if [ -f "kwanza_erp.sql" ]; then
    SQL_FILE="kwanza_erp.sql"
    COMPOSE_FILE="docker-compose.yml"
elif [ -n "$1" ] && [ -f "$1" ]; then
    echo "[1/4] Extracting archive..."
    rm -rf "${IMPORT_DIR}"
    mkdir -p "${IMPORT_DIR}"
    tar -xzf "$1" -C "${IMPORT_DIR}"
    SQL_FILE="${IMPORT_DIR}/kwanza_erp.sql"
    COMPOSE_FILE="${IMPORT_DIR}/docker-compose.yml"
    echo "  ✅ Archive extracted"
else
    echo "Usage: bash portable-import.sh [kwanza-erp-portable.tar.gz]"
    echo "  Or run from the extracted directory."
    exit 1
fi

# Step 2: Start PostgreSQL container
echo ""
echo "[2/4] Starting PostgreSQL container..."
docker compose -f "${COMPOSE_FILE}" up -d
echo "  Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
    if docker exec ${CONTAINER} pg_isready -U ${DB_USER} > /dev/null 2>&1; then
        break
    fi
    sleep 2
done
echo "  ✅ PostgreSQL is ready"

# Step 3: Restore database
echo ""
echo "[3/4] Restoring database..."
docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} < "${SQL_FILE}"
echo "  ✅ Database restored"

# Step 4: Verify
echo ""
echo "[4/4] Verifying..."
TABLE_COUNT=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "  ✅ Tables found: ${TABLE_COUNT}"

# Cleanup
rm -rf "${IMPORT_DIR}"

echo ""
echo "============================================"
echo "  ✅ Import Complete!"
echo "============================================"
echo ""
echo "  PostgreSQL is running on localhost:5432"
echo "  Database: ${DB_NAME}"
echo ""
echo "  Next steps:"
echo "    1. Copy the Kwanza ERP backend folder to this PC"
echo "    2. cd backend && npm install"
echo "    3. npm run migrate"
echo "    4. npm start"
echo ""
echo "  The ERP will connect automatically!"
echo ""
