-- AGT Compliance Schema Extension
-- Audit Trail, Key Management, and AGT Communication Logs

-- ==================== AUDIT LOGS (Tamper-Evident) ====================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_number SERIAL,
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_number VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    previous_hash VARCHAR(64),
    row_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ==================== AGT TRANSMISSION LOGS ====================
CREATE TABLE IF NOT EXISTS agt_transmissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES sales(id),
    invoice_number VARCHAR(100) NOT NULL,
    transmission_type VARCHAR(50) NOT NULL CHECK (transmission_type IN ('invoice', 'credit_note', 'debit_note', 'void')),
    request_payload JSONB NOT NULL,
    response_payload JSONB,
    agt_code VARCHAR(100),
    agt_status VARCHAR(50) DEFAULT 'pending',
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    transmitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agt_transmissions_invoice ON agt_transmissions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_agt_transmissions_status ON agt_transmissions(agt_status);

-- ==================== SIGNING KEYS METADATA ====================
CREATE TABLE IF NOT EXISTS signing_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_alias VARCHAR(100) NOT NULL UNIQUE,
    key_type VARCHAR(20) NOT NULL CHECK (key_type IN ('RSA-2048', 'RSA-4096')),
    public_key_pem TEXT NOT NULL,
    private_key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of encrypted private key file
    certificate_number VARCHAR(100),
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

-- ==================== INVOICE SIGNATURES ====================
CREATE TABLE IF NOT EXISTS invoice_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    signing_key_id UUID REFERENCES signing_keys(id),
    signature_data TEXT NOT NULL, -- Base64 encoded RSA-SHA256 signature
    signed_content_hash VARCHAR(64) NOT NULL, -- SHA-256 of signed data
    algorithm VARCHAR(50) DEFAULT 'RSA-SHA256',
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_signatures_invoice ON invoice_signatures(invoice_id);

-- ==================== CREDIT NOTES ====================
CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number VARCHAR(100) NOT NULL UNIQUE,
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    original_invoice_id UUID REFERENCES sales(id),
    original_invoice_number VARCHAR(100),
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('return', 'discount', 'error', 'other')),
    reason_description TEXT,
    subtotal DECIMAL(15, 2) NOT NULL,
    tax_amount DECIMAL(15, 2) NOT NULL,
    total DECIMAL(15, 2) NOT NULL,
    customer_nif VARCHAR(50),
    customer_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled', 'transmitted')),
    saft_hash VARCHAR(64),
    agt_status VARCHAR(50),
    agt_code VARCHAR(100),
    issued_by UUID REFERENCES users(id),
    issued_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== DEBIT NOTES ====================
CREATE TABLE IF NOT EXISTS debit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number VARCHAR(100) NOT NULL UNIQUE,
    branch_id UUID REFERENCES branches(id),
    branch_name VARCHAR(255),
    original_invoice_id UUID REFERENCES sales(id),
    original_invoice_number VARCHAR(100),
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('price_adjustment', 'additional_charge', 'interest', 'other')),
    reason_description TEXT,
    subtotal DECIMAL(15, 2) NOT NULL,
    tax_amount DECIMAL(15, 2) NOT NULL,
    total DECIMAL(15, 2) NOT NULL,
    customer_nif VARCHAR(50),
    customer_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled', 'transmitted')),
    saft_hash VARCHAR(64),
    agt_status VARCHAR(50),
    agt_code VARCHAR(100),
    issued_by UUID REFERENCES users(id),
    issued_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== DOCUMENT SEQUENCE CONTROL ====================
-- Document sequences moved to migration 013 — skip here to avoid ordering issues.
