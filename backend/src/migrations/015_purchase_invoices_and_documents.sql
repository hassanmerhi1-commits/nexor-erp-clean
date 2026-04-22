-- Migration 015: persist Purchase Invoices and ERP Documents in PostgreSQL
-- This restores the central storage path that was previously falling back to
-- browser localStorage when the desktop IPC bridge was unavailable.

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id UUID PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  supplier_account_code TEXT,
  supplier_name TEXT NOT NULL,
  supplier_nif TEXT,
  supplier_phone TEXT,
  supplier_balance NUMERIC(18,2) DEFAULT 0,
  ref TEXT,
  supplier_invoice_no TEXT,
  contact TEXT,
  department TEXT,
  ref2 TEXT,
  date DATE,
  payment_date DATE,
  project TEXT,
  currency TEXT DEFAULT 'AOA',
  warehouse_id TEXT,
  warehouse_name TEXT,
  price_type TEXT DEFAULT 'last_price',
  address TEXT,
  purchase_account_code TEXT DEFAULT '2.1.1',
  iva_account_code TEXT DEFAULT '3.3.1',
  transaction_type TEXT DEFAULT 'ALL',
  currency_rate NUMERIC(18,6) DEFAULT 1,
  tax_rate_2 NUMERIC(8,2) DEFAULT 0,
  order_no TEXT,
  surcharge_percent NUMERIC(8,2) DEFAULT 0,
  change_price BOOLEAN DEFAULT false,
  is_pending BOOLEAN DEFAULT false,
  extra_note TEXT,
  lines_json JSONB DEFAULT '[]'::jsonb,
  journal_lines_json JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(18,2) DEFAULT 0,
  iva_total NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) DEFAULT 0,
  status TEXT DEFAULT 'draft',
  branch_id TEXT,
  branch_name TEXT,
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_branch ON public.purchase_invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON public.purchase_invoices(supplier_name);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON public.purchase_invoices(date);

CREATE TABLE IF NOT EXISTS public.erp_documents (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL,
  branch_id TEXT,
  branch_name TEXT,
  entity_type TEXT,
  entity_name TEXT,
  entity_nif TEXT,
  entity_address TEXT,
  entity_phone TEXT,
  entity_email TEXT,
  entity_id TEXT,
  entity_code TEXT,
  payment_condition TEXT,
  account_code TEXT,
  lines_json JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(18,2) DEFAULT 0,
  total_discount NUMERIC(18,2) DEFAULT 0,
  total_tax NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) DEFAULT 0,
  currency TEXT DEFAULT 'AOA',
  payment_method TEXT,
  amount_paid NUMERIC(18,2) DEFAULT 0,
  amount_due NUMERIC(18,2) DEFAULT 0,
  parent_document_id TEXT,
  parent_document_number TEXT,
  parent_document_type TEXT,
  status TEXT DEFAULT 'draft',
  issue_date TEXT,
  issue_time TEXT,
  due_date TEXT,
  valid_until TEXT,
  notes TEXT,
  internal_notes TEXT,
  terms_and_conditions TEXT,
  created_by TEXT,
  created_by_name TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMP,
  child_documents_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_erp_documents_branch ON public.erp_documents(branch_id);
CREATE INDEX IF NOT EXISTS idx_erp_documents_type ON public.erp_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_erp_documents_entity ON public.erp_documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_erp_documents_number ON public.erp_documents(document_number);
