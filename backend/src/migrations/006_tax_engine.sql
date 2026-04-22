-- Migration 006: Tax Engine (IVA)
-- Tax codes, tax calculation, tax reporting

-- ==================== TAX CODES ====================
CREATE TABLE IF NOT EXISTS tax_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,           -- e.g., 'IVA14', 'IVA0', 'ISENTO'
    name VARCHAR(100) NOT NULL,                  -- e.g., 'IVA Normal 14%'
    rate DECIMAL(5, 2) NOT NULL DEFAULT 0,       -- 14.00, 0.00
    tax_type VARCHAR(20) NOT NULL DEFAULT 'IVA' CHECK (tax_type IN ('IVA', 'IS', 'RETENCAO', 'OUTRO')),
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    account_code_output VARCHAR(20),              -- Chart of accounts code for output tax (3.3.1)
    account_code_input VARCHAR(20),               -- Chart of accounts code for input tax (3.3.2)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default Angolan tax codes
INSERT INTO tax_codes (code, name, rate, tax_type, account_code_output, account_code_input, description) VALUES
    ('IVA14', 'IVA Normal', 14.00, 'IVA', '3.3.1', '3.3.2', 'Taxa normal de IVA em Angola'),
    ('IVA0', 'IVA Zero', 0.00, 'IVA', '3.3.1', '3.3.2', 'Taxa zero de IVA'),
    ('ISENTO', 'Isento de IVA', 0.00, 'IVA', NULL, NULL, 'Operações isentas de IVA'),
    ('IVA5', 'IVA Reduzida', 5.00, 'IVA', '3.3.1', '3.3.2', 'Taxa reduzida de IVA (bens essenciais)'),
    ('IVA7', 'IVA Intermédia', 7.00, 'IVA', '3.3.1', '3.3.2', 'Taxa intermédia de IVA'),
    ('RET3.5', 'Retenção na Fonte 3.5%', 3.50, 'RETENCAO', '3.4.1', '3.4.2', 'Retenção na fonte de rendimentos'),
    ('RET6.5', 'Retenção na Fonte 6.5%', 6.50, 'RETENCAO', '3.4.1', '3.4.2', 'Retenção na fonte serviços'),
    ('IS', 'Imposto de Selo', 0.10, 'IS', '3.5.1', '3.5.2', 'Imposto de selo sobre recibos')
ON CONFLICT (code) DO NOTHING;

-- ==================== TAX LINES (per document line) ====================
CREATE TABLE IF NOT EXISTS tax_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(30) NOT NULL,           -- 'sale', 'purchase', 'credit_note'
    document_id UUID NOT NULL,
    line_number INTEGER NOT NULL,
    tax_code_id UUID REFERENCES tax_codes(id),
    tax_code VARCHAR(20) NOT NULL,
    tax_rate DECIMAL(5, 2) NOT NULL,
    base_amount DECIMAL(15, 2) NOT NULL,          -- Amount before tax
    tax_amount DECIMAL(15, 2) NOT NULL,           -- Calculated tax
    is_inclusive BOOLEAN DEFAULT false,            -- Was tax included in the price?
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tax_lines_doc ON tax_lines(document_type, document_id);

-- ==================== TAX SUMMARY (per document) ====================
CREATE TABLE IF NOT EXISTS tax_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(30) NOT NULL,
    document_id UUID NOT NULL,
    tax_code VARCHAR(20) NOT NULL,
    tax_rate DECIMAL(5, 2) NOT NULL,
    total_base DECIMAL(15, 2) NOT NULL,
    total_tax DECIMAL(15, 2) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('output', 'input')),  -- output = sales, input = purchases
    period_year INTEGER,
    period_month INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tax_summaries_doc ON tax_summaries(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_tax_summaries_period ON tax_summaries(period_year, period_month);

-- ==================== VIEW: Monthly IVA Declaration ====================
CREATE OR REPLACE VIEW v_iva_monthly AS
SELECT
    period_year,
    period_month,
    direction,
    tax_code,
    tax_rate,
    SUM(total_base) AS total_base,
    SUM(total_tax) AS total_tax,
    COUNT(*) AS document_count
FROM tax_summaries
WHERE tax_code LIKE 'IVA%'
GROUP BY period_year, period_month, direction, tax_code, tax_rate
ORDER BY period_year DESC, period_month DESC, direction, tax_rate;

-- Add tax_code column to products if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tax_code') THEN
        ALTER TABLE products ADD COLUMN tax_code VARCHAR(20) DEFAULT 'IVA14';
    END IF;
END $$;
