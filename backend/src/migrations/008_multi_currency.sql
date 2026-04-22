-- Migration 008: Multi-Currency Support
-- Exchange rates, currency columns on transactions

-- ==================== EXCHANGE RATES ====================
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
    rate DECIMAL(15, 6) NOT NULL,
    effective_date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',          -- 'manual', 'bna', 'api'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_currency, to_currency, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency);

-- Insert default rates (BNA approximate rates)
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source) VALUES
    ('USD', 'AOA', 835.00, CURRENT_DATE, 'manual'),
    ('EUR', 'AOA', 910.00, CURRENT_DATE, 'manual')
ON CONFLICT DO NOTHING;

-- Add currency columns to sales if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'currency') THEN
        ALTER TABLE sales ADD COLUMN currency VARCHAR(3) DEFAULT 'AOA';
        ALTER TABLE sales ADD COLUMN exchange_rate DECIMAL(15, 6) DEFAULT 1;
        ALTER TABLE sales ADD COLUMN total_aoa DECIMAL(15, 2);  -- Total in AOA (for reporting)
    END IF;
END $$;

-- Add currency columns to payments if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'original_currency') THEN
        ALTER TABLE payments ADD COLUMN original_currency VARCHAR(3) DEFAULT 'AOA';
        ALTER TABLE payments ADD COLUMN exchange_rate DECIMAL(15, 6) DEFAULT 1;
        ALTER TABLE payments ADD COLUMN amount_aoa DECIMAL(15, 2);
    END IF;
END $$;

-- Add currency to open_items if not exists (already has currency column)

-- ==================== VIEW: Latest Exchange Rates ====================
CREATE OR REPLACE VIEW v_latest_exchange_rates AS
SELECT DISTINCT ON (from_currency, to_currency)
    from_currency,
    to_currency,
    rate,
    effective_date,
    source
FROM exchange_rates
ORDER BY from_currency, to_currency, effective_date DESC;

-- ==================== GAIN/LOSS TRACKING ====================
-- Realized exchange gain/loss on payment clearing
CREATE TABLE IF NOT EXISTS exchange_gain_loss (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id),
    clearing_id UUID,
    currency VARCHAR(3) NOT NULL,
    original_rate DECIMAL(15, 6) NOT NULL,         -- Rate at invoice time
    clearing_rate DECIMAL(15, 6) NOT NULL,          -- Rate at payment time
    original_amount DECIMAL(15, 2) NOT NULL,        -- Amount in original currency
    gain_loss_aoa DECIMAL(15, 2) NOT NULL,          -- Gain (+) or Loss (-) in AOA
    journal_entry_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
