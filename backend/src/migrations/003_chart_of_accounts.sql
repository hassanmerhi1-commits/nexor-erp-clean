-- Chart of Accounts Migration
-- Plano de Contas for Angolan accounting standards

-- Account types enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_nature') THEN
    CREATE TYPE public.account_nature AS ENUM ('debit', 'credit');
  END IF;
END $$;

-- Chart of Accounts table
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    account_type account_type NOT NULL,
    account_nature account_nature NOT NULL,
    parent_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    level INTEGER NOT NULL DEFAULT 1,
    is_header BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    opening_balance DECIMAL(18, 2) DEFAULT 0,
    current_balance DECIMAL(18, 2) DEFAULT 0,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Journal entries table (for double-entry bookkeeping)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    total_debit DECIMAL(18, 2) NOT NULL DEFAULT 0,
    total_credit DECIMAL(18, 2) NOT NULL DEFAULT 0,
    is_posted BOOLEAN DEFAULT false,
    posted_at TIMESTAMP WITH TIME ZONE,
    posted_by UUID REFERENCES users(id),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Journal entry lines (individual debits/credits)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    description TEXT,
    debit_amount DECIMAL(18, 2) DEFAULT 0,
    credit_amount DECIMAL(18, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_coa_code ON chart_of_accounts(code);
CREATE INDEX IF NOT EXISTS idx_coa_branch ON chart_of_accounts(branch_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_branch ON journal_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_entry_lines(account_id);

-- Insert default Angolan Chart of Accounts (Plano Geral de Contabilidade - PGC)
INSERT INTO chart_of_accounts (code, name, account_type, account_nature, level, is_header) VALUES
('1', 'Meios Fixos e Investimentos', 'asset', 'debit', 1, true),
('1.1', 'Imobilizações Corpóreas', 'asset', 'debit', 2, true),
('1.1.1', 'Terrenos', 'asset', 'debit', 3, false),
('1.1.2', 'Edifícios', 'asset', 'debit', 3, false),
('1.1.3', 'Equipamentos Básicos', 'asset', 'debit', 3, false),
('1.1.4', 'Equipamentos de Transporte', 'asset', 'debit', 3, false),
('1.1.5', 'Equipamentos Administrativos', 'asset', 'debit', 3, false),
('1.2', 'Imobilizações Incorpóreas', 'asset', 'debit', 2, true),
('1.2.1', 'Trespasses', 'asset', 'debit', 3, false),
('1.2.2', 'Software', 'asset', 'debit', 3, false),
('2', 'Existências', 'asset', 'debit', 1, true),
('2.1', 'Compras', 'asset', 'debit', 2, true),
('2.1.1', 'Mercadorias', 'asset', 'debit', 3, false),
('2.1.2', 'Matérias-Primas', 'asset', 'debit', 3, false),
('2.2', 'Mercadorias', 'asset', 'debit', 2, false),
('2.3', 'Produtos Acabados', 'asset', 'debit', 2, false),
('3', 'Terceiros', 'asset', 'debit', 1, true),
('3.1', 'Clientes', 'asset', 'debit', 2, false),
('3.1.1', 'Clientes c/c', 'asset', 'debit', 3, false),
('3.1.2', 'Clientes - Títulos a Receber', 'asset', 'debit', 3, false),
('3.2', 'Fornecedores', 'liability', 'credit', 2, false),
('3.2.1', 'Fornecedores c/c', 'liability', 'credit', 3, false),
('3.2.2', 'Fornecedores - Títulos a Pagar', 'liability', 'credit', 3, false),
('3.3', 'Estado e Outros Entes Públicos', 'liability', 'credit', 2, true),
('3.3.1', 'IVA', 'liability', 'credit', 3, false),
('3.3.2', 'Imposto sobre Rendimentos', 'liability', 'credit', 3, false),
('3.4', 'Pessoal', 'liability', 'credit', 2, true),
('3.4.1', 'Remunerações a Pagar', 'liability', 'credit', 3, false),
('4', 'Meios Monetários', 'asset', 'debit', 1, true),
('4.1', 'Caixa', 'asset', 'debit', 2, false),
('4.1.1', 'Caixa Principal', 'asset', 'debit', 3, false),
('4.1.2', 'Caixa Pequena (Fundo de Maneio)', 'asset', 'debit', 3, false),
('4.2', 'Depósitos à Ordem', 'asset', 'debit', 2, false),
('4.2.1', 'Banco Principal', 'asset', 'debit', 3, false),
('5', 'Capital Próprio', 'equity', 'credit', 1, true),
('5.1', 'Capital Social', 'equity', 'credit', 2, false),
('5.2', 'Reservas', 'equity', 'credit', 2, true),
('5.2.1', 'Reservas Legais', 'equity', 'credit', 3, false),
('5.2.2', 'Outras Reservas', 'equity', 'credit', 3, false),
('5.3', 'Resultados Transitados', 'equity', 'credit', 2, false),
('5.4', 'Resultado Líquido do Exercício', 'equity', 'credit', 2, false),
('6', 'Gastos e Perdas', 'expense', 'debit', 1, true),
('6.1', 'Custo das Mercadorias Vendidas', 'expense', 'debit', 2, false),
('6.2', 'Fornecimentos e Serviços Externos', 'expense', 'debit', 2, true),
('6.2.1', 'Electricidade', 'expense', 'debit', 3, false),
('6.2.2', 'Água', 'expense', 'debit', 3, false),
('6.2.3', 'Comunicações', 'expense', 'debit', 3, false),
('6.2.4', 'Seguros', 'expense', 'debit', 3, false),
('6.2.5', 'Rendas e Alugueres', 'expense', 'debit', 3, false),
('6.3', 'Gastos com Pessoal', 'expense', 'debit', 2, true),
('6.3.1', 'Remunerações', 'expense', 'debit', 3, false),
('6.3.2', 'Encargos Sociais', 'expense', 'debit', 3, false),
('6.4', 'Amortizações e Depreciações', 'expense', 'debit', 2, false),
('6.5', 'Gastos Financeiros', 'expense', 'debit', 2, true),
('6.5.1', 'Juros Suportados', 'expense', 'debit', 3, false),
('6.5.2', 'Diferenças de Câmbio Desfavoráveis', 'expense', 'debit', 3, false),
('6.6', 'Impostos', 'expense', 'debit', 2, false),
('7', 'Rendimentos e Ganhos', 'revenue', 'credit', 1, true),
('7.1', 'Vendas', 'revenue', 'credit', 2, false),
('7.1.1', 'Vendas de Mercadorias', 'revenue', 'credit', 3, false),
('7.1.2', 'Vendas de Produtos', 'revenue', 'credit', 3, false),
('7.2', 'Prestações de Serviços', 'revenue', 'credit', 2, false),
('7.3', 'Rendimentos Financeiros', 'revenue', 'credit', 2, true),
('7.3.1', 'Juros Obtidos', 'revenue', 'credit', 3, false),
('7.3.2', 'Diferenças de Câmbio Favoráveis', 'revenue', 'credit', 3, false),
('7.4', 'Outros Rendimentos', 'revenue', 'credit', 2, false)
ON CONFLICT (code) DO NOTHING;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_coa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_coa_updated_at ON chart_of_accounts;
CREATE TRIGGER trigger_coa_updated_at
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_coa_updated_at();

DROP TRIGGER IF EXISTS trigger_journal_updated_at ON journal_entries;
CREATE TRIGGER trigger_journal_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_coa_updated_at();
