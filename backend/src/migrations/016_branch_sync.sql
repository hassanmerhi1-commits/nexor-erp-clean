-- ============================================================
--  Migration 016 — Branch Sync (Push / Receive Sales)
-- ------------------------------------------------------------
--  Adds idempotency + traceability columns to `sales` so
--  end-of-day exports from branch PCs can be re-imported into
--  the head office database safely.
--
--  - sync_uuid          : globally unique key per sale, set on
--                         the originating branch. Used as the
--                         ON CONFLICT key by the receive routine
--                         so the same .dat file can be imported
--                         100 times without duplicating sales.
--  - sync_origin_branch : friendly label of the source PC
--                         (e.g. "SOYO01") for audit / reporting.
--  - sync_received_at   : timestamp the head office accepted it.
-- ============================================================

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sync_uuid UUID,
  ADD COLUMN IF NOT EXISTS sync_origin_branch TEXT,
  ADD COLUMN IF NOT EXISTS sync_received_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS sales_sync_uuid_uidx
  ON sales(sync_uuid)
  WHERE sync_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS sales_sync_origin_branch_idx
  ON sales(sync_origin_branch)
  WHERE sync_origin_branch IS NOT NULL;