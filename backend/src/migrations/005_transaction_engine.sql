-- Migration 005: Central Transaction Engine Tables
-- Stock Movements as source of truth, Open Item Management, Accounting Periods

-- ==================== STOCK MOVEMENTS (Single Source of Truth for Inventory) ====================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID REFERENCES branches(id),        -- branch = warehouse
    movement_type VARCHAR(10) NOT NULL CHECK (movement_type IN ('IN', 'OUT')),
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(15, 4) DEFAULT 0,               -- cost at time of movement
    reference_type VARCHAR(30) NOT NULL,               -- 'sale', 'purchase', 'transfer', 'adjustment', 'return', 'damage', 'initial'
    reference_id UUID,                                 -- ID of source document
    reference_number VARCHAR(100),                     -- Human-readable doc number
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- ==================== OPEN ITEMS (SAP-style Clearing System) ====================
-- Every invoice creates an open item. Payments clear them.
CREATE TABLE IF NOT EXISTS open_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('customer', 'supplier')),
    entity_id UUID NOT NULL,                           -- client or supplier ID
    document_type VARCHAR(20) NOT NULL,                -- 'invoice', 'credit_note', 'debit_note', 'payment', 'advance'
    document_id UUID NOT NULL,                         -- FK to the source document
    document_number VARCHAR(100) NOT NULL,
    document_date DATE NOT NULL,
    due_date DATE,
    currency VARCHAR(3) DEFAULT 'AOA',
    original_amount DECIMAL(15, 2) NOT NULL,           -- Original document amount
    remaining_amount DECIMAL(15, 2) NOT NULL,          -- Still open (unpaid)
    is_debit BOOLEAN NOT NULL,                         -- true = receivable/payable, false = payment/credit
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'partial', 'cleared')),
    branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cleared_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_open_items_entity ON open_items(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_open_items_status ON open_items(status);
CREATE INDEX IF NOT EXISTS idx_open_items_document ON open_items(document_type, document_id);

-- ==================== CLEARING TABLE (Links payments to invoices) ====================
CREATE TABLE IF NOT EXISTS clearings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debit_item_id UUID NOT NULL REFERENCES open_items(id),    -- The invoice/receivable
    credit_item_id UUID NOT NULL REFERENCES open_items(id),   -- The payment/credit note
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    clearing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clearings_debit ON clearings(debit_item_id);
CREATE INDEX IF NOT EXISTS idx_clearings_credit ON clearings(credit_item_id);

-- ==================== ACCOUNTING PERIODS ====================
CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    name VARCHAR(50) NOT NULL,                         -- e.g., 'Janeiro 2025'
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
    closed_by UUID REFERENCES users(id),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month)
);

-- Initialize current year periods
INSERT INTO accounting_periods (year, month, name)
SELECT 
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    m,
    TO_CHAR(MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, m, 1), 'TMMonth YYYY')
FROM generate_series(1, 12) AS m
ON CONFLICT DO NOTHING;

-- ==================== PAYMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(100) NOT NULL UNIQUE,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('receipt', 'payment')),  -- receipt = from customer, payment = to supplier
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('customer', 'supplier')),
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'cheque', 'mixed')),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AOA',
    bank_account VARCHAR(100),
    reference VARCHAR(255),                            -- cheque number, transfer ref, etc.
    notes TEXT,
    branch_id UUID REFERENCES branches(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    posted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payments_entity ON payments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(created_at);

-- ==================== DOCUMENT FLOW LINKS ====================
-- Generic table to track the chain: Quote → Order → Delivery → Invoice → Payment
CREATE TABLE IF NOT EXISTS document_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(30) NOT NULL,                  -- 'proforma', 'purchase_order', 'sales_order', 'delivery', 'goods_receipt'
    source_id UUID NOT NULL,
    source_number VARCHAR(100),
    target_type VARCHAR(30) NOT NULL,                  -- 'invoice', 'credit_note', 'payment', 'goods_receipt'
    target_id UUID NOT NULL,
    target_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_links_source ON document_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_document_links_target ON document_links(target_type, target_id);

-- ==================== VIEW: Current Stock (calculated from movements) ====================
CREATE OR REPLACE VIEW v_current_stock AS
SELECT 
    product_id,
    warehouse_id,
    COALESCE(SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END), 0) AS total_in,
    COALESCE(SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END), 0) AS total_out,
    COALESCE(SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END), 0) AS current_stock,
    MAX(created_at) AS last_movement_at
FROM stock_movements
GROUP BY product_id, warehouse_id;

-- ==================== VIEW: Open Balance per Entity ====================
CREATE OR REPLACE VIEW v_entity_balance AS
SELECT
    entity_type,
    entity_id,
    COALESCE(SUM(CASE WHEN is_debit THEN remaining_amount ELSE -remaining_amount END), 0) AS balance,
    COUNT(*) FILTER (WHERE status = 'open') AS open_items_count,
    MIN(due_date) FILTER (WHERE status = 'open') AS oldest_due_date
FROM open_items
GROUP BY entity_type, entity_id;
