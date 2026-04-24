# NEXOR ERP Production Topology (LAN + Branches)

## Objective

Define the supported production architecture for a multi-user ERP deployment across HQ and branch offices without Docker.

## Runtime Principles

- Docker is not used in production runtime.
- PostgreSQL runs as a native OS service.
- Backend API runs as a managed OS service.
- Clients (desktop or browser) connect to backend API over LAN/VPN.
- All writes are audited and branch-scoped where applicable.

## Reference Topology

### Layer 1: Data Layer

- Primary PostgreSQL 16 instance on HQ server.
- Nightly full backup + frequent incremental/WAL backup.
- Read replicas are optional for reporting scale.

### Layer 2: Application Layer

- Node.js backend API process on HQ server (`backend`).
- Web client build served from backend `/app`.
- Real-time events over Socket.IO for client synchronization.

### Layer 3: Access Layer

- HQ users connect over office LAN.
- Branch users connect through site-to-site VPN or secure tunnel.
- No direct database access from user workstations.

## Network and Security Baseline

- Fixed internal DNS/IP for HQ application server.
- Strict firewall policy:
  - Allow API port from trusted LAN/VPN ranges.
  - Allow PostgreSQL port only from application host and approved admin host.
- TLS termination required for branch/wan traffic.
- Separate application and database credentials per environment.

## Multi-Branch Operating Model

- Every transaction carries `branch_id` or explicit global scope.
- Permissions are branch-aware and role-aware.
- Branch-level period close and lock controls.
- Consolidated reporting runs from controlled reporting endpoints/jobs.

## Scale Baseline for Phase 1

- Target concurrent users: 50-150 initially (scale plan to 300+).
- Daily transactions: thousands of sales/stock/accounting writes.
- P95 API latency target:
  - Simple reads under 300 ms on LAN.
  - Critical write operations under 800 ms.

## Reliability Controls

- Health endpoints for API and database.
- Automatic restart policy for backend service.
- Backup verification with monthly restore drill.
- Migration-based schema change policy only (no manual production DDL).

## Deployment Units

- `backend` service package (Node runtime + env + migrations).
- `webapp` static build deployed under backend `webapp` directory.
- Database migration package with rollback notes.

## Not Supported

- Docker Compose in production runtime.
- Developer-only local containers as official deployment path.
- Direct workstation-to-database writes.
