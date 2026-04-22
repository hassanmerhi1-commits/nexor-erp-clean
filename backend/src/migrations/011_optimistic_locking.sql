-- Migration 011: Phase 3 — Optimistic Locking
-- Adds version columns to critical tables for concurrent multi-user safety.
-- Every UPDATE must include WHERE version = $N and increment version = version + 1.
-- If 0 rows affected → another user modified the record → client must re-read and retry.

-- ==================== 1. ADD VERSION COLUMNS ====================

DO $$ BEGIN
  -- Products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='version') THEN
    ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Sales
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='version') THEN
    ALTER TABLE sales ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Purchase Orders
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_orders' AND column_name='version') THEN
    ALTER TABLE purchase_orders ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Stock Transfers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_transfers' AND column_name='version') THEN
    ALTER TABLE stock_transfers ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Clients
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='version') THEN
    ALTER TABLE clients ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Suppliers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='version') THEN
    ALTER TABLE suppliers ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Journal Entries
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journal_entries' AND column_name='version') THEN
    ALTER TABLE journal_entries ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Payments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='version') THEN
    ALTER TABLE payments ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Open Items
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='open_items' AND column_name='version') THEN
    ALTER TABLE open_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- ==================== 2. HELPER FUNCTION ====================
-- A reusable function that performs an optimistic update and raises an error on conflict.

CREATE OR REPLACE FUNCTION optimistic_update(
  p_table TEXT,
  p_id UUID,
  p_expected_version INTEGER
) RETURNS VOID AS $$
BEGIN
  -- This is a template/documentation function.
  -- Actual optimistic checks are done inline in UPDATE statements:
  --   UPDATE table SET ..., version = version + 1 WHERE id = $1 AND version = $2
  --   Then check rowCount — if 0, raise conflict error.
  NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION optimistic_update IS 'Documentation: All UPDATE statements on versioned tables must include WHERE version = expected_version AND set version = version + 1. If rowCount = 0, return HTTP 409 Conflict.';

-- ==================== DONE ====================
-- Phase 3 Optimistic Locking columns applied.
-- Backend routes must now enforce version checks on all UPDATE operations.
