# Kwanza ERP - Docker PostgreSQL Setup

Portable PostgreSQL database using Docker — copy the entire server + data to any PC and start the ERP immediately.

## Prerequisites

- **Docker Desktop** installed ([Download](https://www.docker.com/products/docker-desktop/))
- **Windows**: Enable WSL2 when prompted during Docker Desktop installation

---

## 🚀 Quick Start (Fresh Install)

```bash
# 1. Start PostgreSQL container
docker compose up -d

# 2. Run ERP migrations
cd backend
npm install
npm run migrate

# 3. Start ERP backend
npm start
```

PostgreSQL runs on `localhost:5432` — the ERP connects automatically.

---

## 📦 Migrate Existing Local Database to Docker

If you already have PostgreSQL installed locally with data:

```bash
# 1. Start Docker container
docker compose up -d

# 2. Run migration script
bash docker/migrate-to-docker.sh

# 3. Stop local PostgreSQL (no longer needed)
# Windows: Open Services → Stop "PostgreSQL" → Set to "Disabled"
# Linux: sudo systemctl stop postgresql && sudo systemctl disable postgresql

# 4. Verify ERP works
cd backend && npm start
```

---

## 🔄 Move to Another PC (Portability)

### Export (Source PC)

```bash
bash docker/portable-export.sh
# Creates: kwanza-erp-portable.tar.gz
```

### Import (New PC)

1. Install Docker Desktop on the new PC
2. Copy `kwanza-erp-portable.tar.gz` to the new PC
3. Run:

```bash
bash docker/portable-import.sh kwanza-erp-portable.tar.gz
```

4. Copy the ERP project folder, then:

```bash
cd backend
npm install
npm run migrate
npm start
```

The ERP connects to `localhost:5432` automatically — **no configuration changes needed**.

---

## 🛠️ Docker Commands Reference

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start PostgreSQL |
| `docker compose down` | Stop PostgreSQL (data preserved) |
| `docker compose down -v` | Stop + **delete all data** ⚠️ |
| `docker compose logs -f` | View PostgreSQL logs |
| `docker exec -it kwanza-postgres psql -U postgres -d kwanza_erp` | Open database shell |
| `docker ps` | Check running containers |

---

## ⚙️ Configuration

The default credentials (in `docker-compose.yml`):

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5432` |
| Database | `kwanza_erp` |
| User | `postgres` |
| Password | `yel3an7azi` |

To change the password, set the environment variable before starting:

```bash
POSTGRES_PASSWORD=my_secure_password docker compose up -d
```

Then update `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:my_secure_password@localhost:5432/kwanza_erp
```

---

## ❓ Troubleshooting

**Port 5432 already in use:**
- Stop local PostgreSQL first, or change the port in `docker-compose.yml`:
  ```yaml
  ports:
    - "5433:5432"
  ```
  Then update `DATABASE_URL` to use port 5433.

**Container won't start:**
```bash
docker compose logs
```

**Reset database completely:**
```bash
docker compose down -v
docker compose up -d
cd backend && npm run migrate
```
