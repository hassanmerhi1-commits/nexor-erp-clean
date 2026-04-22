#!/bin/bash
# =============================================================
# Kwanza ERP - Export Portable Database Package
# =============================================================
# Creates a tar.gz archive containing the full database dump
# that can be moved to any PC with Docker installed.
# =============================================================

set -e

CONTAINER="kwanza-postgres"
DB_NAME="kwanza_erp"
DB_USER="postgres"
EXPORT_DIR="/tmp/kwanza-portable"
ARCHIVE_NAME="kwanza-erp-portable.tar.gz"

echo "============================================"
echo "  Kwanza ERP - Portable Export"
echo "============================================"
echo ""

# Check container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "ERROR: Container '${CONTAINER}' is not running."
    exit 1
fi

# Prepare export directory
rm -rf "${EXPORT_DIR}"
mkdir -p "${EXPORT_DIR}"

# Step 1: Dump database from Docker
echo "[1/3] Dumping database from container..."
docker exec ${CONTAINER} pg_dump -U ${DB_USER} -d ${DB_NAME} --clean --if-exists --no-owner --no-privileges > "${EXPORT_DIR}/kwanza_erp.sql"
echo "  ✅ Database dumped"

# Step 2: Copy docker-compose and init files
echo "[2/3] Packaging Docker configuration..."
cp "$(dirname "$0")/../docker-compose.yml" "${EXPORT_DIR}/"
cp -r "$(dirname "$0")/postgres" "${EXPORT_DIR}/docker-postgres"
cp "$(dirname "$0")/portable-import.sh" "${EXPORT_DIR}/"
echo "  ✅ Configuration packaged"

# Step 3: Create archive
echo "[3/3] Creating portable archive..."
cd /tmp
tar -czf "${ARCHIVE_NAME}" -C "${EXPORT_DIR}" .
mv "${ARCHIVE_NAME}" "$(dirname "$0")/../${ARCHIVE_NAME}"
rm -rf "${EXPORT_DIR}"

ARCHIVE_PATH="$(dirname "$0")/../${ARCHIVE_NAME}"
ARCHIVE_SIZE=$(du -h "${ARCHIVE_PATH}" | cut -f1)

echo ""
echo "============================================"
echo "  ✅ Export Complete!"
echo "============================================"
echo ""
echo "  Archive: ${ARCHIVE_PATH}"
echo "  Size: ${ARCHIVE_SIZE}"
echo ""
echo "  To move to another PC:"
echo "    1. Copy '${ARCHIVE_NAME}' to the new PC"
echo "    2. Install Docker Desktop on the new PC"
echo "    3. Extract and run: bash portable-import.sh"
echo ""
