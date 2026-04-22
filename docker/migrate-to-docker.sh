#!/bin/bash
# =============================================================
# Kwanza ERP - Migrate Local PostgreSQL to Docker Container
# =============================================================
# Prerequisites:
#   - Local PostgreSQL running with kwanza_erp database
#   - Docker container 'kwanza-postgres' running (docker compose up -d)
# =============================================================

set -e

DUMP_FILE="/tmp/kwanza_erp_dump.sql"
CONTAINER="kwanza-postgres"
DB_NAME="kwanza_erp"
DB_USER="postgres"

echo "============================================"
echo "  Kwanza ERP - Database Migration to Docker"
echo "============================================"
echo ""

# Step 1: Check Docker container is running
echo "[1/4] Checking Docker container..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "ERROR: Container '${CONTAINER}' is not running."
    echo "Start it first: docker compose up -d"
    exit 1
fi
echo "  ✅ Container '${CONTAINER}' is running"

# Step 2: Dump local database
echo ""
echo "[2/4] Dumping local database '${DB_NAME}'..."
pg_dump -U ${DB_USER} -d ${DB_NAME} --clean --if-exists --no-owner --no-privileges > "${DUMP_FILE}"
DUMP_SIZE=$(du -h "${DUMP_FILE}" | cut -f1)
echo "  ✅ Dump created: ${DUMP_FILE} (${DUMP_SIZE})"

# Step 3: Restore into Docker container
echo ""
echo "[3/4] Restoring into Docker container..."
docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} < "${DUMP_FILE}"
echo "  ✅ Database restored into container"

# Step 4: Verify
echo ""
echo "[4/4] Verifying migration..."
TABLE_COUNT=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "  ✅ Tables in Docker database: ${TABLE_COUNT}"

# Cleanup
rm -f "${DUMP_FILE}"

echo ""
echo "============================================"
echo "  ✅ Migration Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Stop local PostgreSQL: sudo systemctl stop postgresql"
echo "     (Windows: Stop 'PostgreSQL' service in Services)"
echo "  2. Test ERP: cd backend && npm start"
echo "  3. The backend connects to localhost:5432 (same as before)"
echo ""
