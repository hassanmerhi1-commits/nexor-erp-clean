-- Migration 007: Audit Trail, Budget Control, Workflow Approvals
-- Enterprise-grade compliance and control systems

-- ==================== AUDIT LOG ====================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'status_change', 'approve', 'reject', 'void', 'print', 'export', 'login', 'logout')),
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(255),
    branch_id UUID REFERENCES branches(id),
    old_values JSONB,                              -- Before snapshot
    new_values JSONB,                              -- After snapshot
    metadata JSONB,                                -- Extra info (IP, user agent, etc.)
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- ==================== COST CENTERS ====================
CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES cost_centers(id),
    branch_id UUID REFERENCES branches(id),
    manager_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==================== BUDGETS ====================
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_center_id UUID NOT NULL REFERENCES cost_centers(id),
    account_code VARCHAR(20),                      -- Chart of accounts code
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    budget_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    actual_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    variance DECIMAL(15, 2) GENERATED ALWAYS AS (budget_amount - actual_amount) STORED,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'exceeded', 'closed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cost_center_id, account_code, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_center ON budgets(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period_year, period_month);

-- ==================== BUDGET VIEW ====================
CREATE OR REPLACE VIEW v_budget_summary AS
SELECT 
    b.period_year,
    b.period_month,
    cc.code AS cost_center_code,
    cc.name AS cost_center_name,
    b.account_code,
    b.budget_amount,
    b.actual_amount,
    b.variance,
    CASE WHEN b.budget_amount > 0 
         THEN ROUND((b.actual_amount / b.budget_amount * 100)::numeric, 1) 
         ELSE 0 
    END AS utilization_pct,
    b.status
FROM budgets b
JOIN cost_centers cc ON cc.id = b.cost_center_id
WHERE cc.is_active = true
ORDER BY b.period_year DESC, b.period_month DESC, cc.code;

-- ==================== WORKFLOW DEFINITIONS ====================
CREATE TABLE IF NOT EXISTS approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    document_type VARCHAR(30) NOT NULL,            -- 'purchase_order', 'expense', 'credit_note', 'payment'
    min_amount DECIMAL(15, 2) DEFAULT 0,           -- Trigger threshold
    max_amount DECIMAL(15, 2),                     -- Upper limit (NULL = no limit)
    steps JSONB NOT NULL DEFAULT '[]',             -- Array of { step, role, approver_id? }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==================== APPROVAL REQUESTS ====================
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES approval_workflows(id),
    document_type VARCHAR(30) NOT NULL,
    document_id UUID NOT NULL,
    document_number VARCHAR(100),
    amount DECIMAL(15, 2),
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_by UUID REFERENCES users(id),
    requested_by_name VARCHAR(255),
    branch_id UUID REFERENCES branches(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_doc ON approval_requests(document_type, document_id);

-- ==================== APPROVAL ACTIONS (per step) ====================
CREATE TABLE IF NOT EXISTS approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES approval_requests(id),
    step_number INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('approve', 'reject', 'comment')),
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(255),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_actions_request ON approval_actions(request_id);

-- Insert default workflows
INSERT INTO approval_workflows (name, document_type, min_amount, steps) VALUES
    ('Aprovação Ordem de Compra', 'purchase_order', 0, '[{"step": 1, "role": "manager", "label": "Gestor de Compras"}]'),
    ('Aprovação Ordem de Compra Alto Valor', 'purchase_order', 500000, '[{"step": 1, "role": "manager", "label": "Gestor de Compras"}, {"step": 2, "role": "admin", "label": "Director Financeiro"}]'),
    ('Aprovação Despesa', 'expense', 50000, '[{"step": 1, "role": "manager", "label": "Gestor"}]'),
    ('Aprovação Nota de Crédito', 'credit_note', 0, '[{"step": 1, "role": "admin", "label": "Administrador"}]')
ON CONFLICT DO NOTHING;
