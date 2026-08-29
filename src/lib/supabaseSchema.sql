-- ============================================================================
-- OST VENDAS ERP - SUPABASE POSTGRESQL SCHEMA, RLS & MULTI-TENANT ISOLATION
-- ============================================================================
-- Architecture: Supabase Auth (Google Provider) -> Supabase Client -> PostgreSQL + RLS
-- Financial Types: All monetary & quantity metrics use NUMERIC(14,2)
-- Multi-Tenancy: Strict isolation via tenant_id, auth.uid() and profiles.company_id
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLES DEFINITIONS
-- ============================================================================

-- EMPRESAS / COMPANIES (Multi-tenant boundaries)
CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY DEFAULT ('comp_' || substr(uuid_generate_v4()::TEXT, 1, 8)),
  name TEXT NOT NULL,
  owner_uid TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  currency TEXT DEFAULT 'MT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERFIS DE UTILIZADOR / PROFILES (Direct mapping with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'ADMIN',
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CATEGORIAS DE ARTIGOS
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FORNECEDORES
CREATE TABLE IF NOT EXISTS public.suppliers (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  nif TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUTOS / ARTIGOS (Inventário & Preços)
CREATE TABLE IF NOT EXISTS public.produtos (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  barcode TEXT,
  category TEXT NOT NULL DEFAULT 'Geral',
  category_id TEXT,
  supplier TEXT,
  supplier_id TEXT,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  min_stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
  unit TEXT NOT NULL DEFAULT 'un',
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MOVIMENTOS DE STOCK (Kardex / Rastreabilidade)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'ENTRY', 'EXIT_SALE', 'LOSS', 'ADJUSTMENT', 'TRANSFER'
  quantity NUMERIC(14,2) NOT NULL,
  previous_stock NUMERIC(14,2) NOT NULL,
  new_stock NUMERIC(14,2) NOT NULL,
  cost_price NUMERIC(14,2) DEFAULT 0.00,
  reason TEXT,
  reference_id TEXT,
  user_id TEXT,
  user_name TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  nuit TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DÍVIDAS / CONTAS A RECEBER (Customer Debts)
CREATE TABLE IF NOT EXISTS public.customer_debts (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  sale_id TEXT,
  total_amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  remaining_balance NUMERIC(14,2) NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- PAGAMENTOS DE DÍVIDAS
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  debt_id TEXT NOT NULL REFERENCES public.customer_debts(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL,
  received_by TEXT,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- VENDAS / FATURAS (Transactions)
CREATE TABLE IF NOT EXISTS public.vendas (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT DEFAULT 'Consumidor Final',
  customer_nuit TEXT,
  seller_id TEXT,
  seller_name TEXT,
  operator_name TEXT,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PAID',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  vat_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  change_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ITENS DA VENDA
CREATE TABLE IF NOT EXISTS public.venda_itens (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  sale_id TEXT NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  quantity NUMERIC(14,2) NOT NULL,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FLUXO DE CAIXA / MOVIMENTOS DE CAIXA
CREATE TABLE IF NOT EXISTS public.caixa (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  cash_register_id TEXT,
  type TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  reason TEXT NOT NULL,
  responsible_user TEXT,
  reference_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- SESSÕES DE CAIXA REGISTRADORA
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  opened_by TEXT NOT NULL,
  opener_name TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  closing_balance NUMERIC(14,2),
  actual_closing_balance NUMERIC(14,2),
  difference NUMERIC(14,2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- HISTÓRICO DE FECHAMENTO DE TURNOS
CREATE TABLE IF NOT EXISTS public.cash_closures (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  shift_id TEXT,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL,
  opened_by TEXT NOT NULL,
  closed_by TEXT NOT NULL,
  opening_supervisor TEXT,
  closing_supervisor TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  theoretical_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  physical_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  difference NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  difference_type TEXT NOT NULL DEFAULT 'EXACT',
  reconciliation JSONB NOT NULL DEFAULT '{}'::JSONB,
  denominations JSONB DEFAULT '{}'::JSONB,
  closing_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ESTADO ATIVO DO TURNO DE CAIXA
CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id TEXT PRIMARY KEY DEFAULT 'current_shift',
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CLOSED',
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  opened_by TEXT NOT NULL DEFAULT 'Admin',
  opening_supervisor TEXT,
  opening_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COLABORADORES / UTILIZADORES DO SISTEMA
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  auth_uid TEXT,
  name TEXT NOT NULL,
  email TEXT,
  contact TEXT,
  whatsapp TEXT,
  role TEXT NOT NULL DEFAULT 'Operador',
  salary NUMERIC(14,2) DEFAULT 0.00,
  admission_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  pin TEXT,
  pin_created_at TIMESTAMPTZ,
  pin_changed BOOLEAN DEFAULT true,
  foto_perfil TEXT,
  subscription_plan TEXT DEFAULT 'OURO',
  branch TEXT DEFAULT 'Sede Principal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LOGS DE AUDITORIA & SEGURANÇA
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  device TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- DEFINIÇÕES DO SISTEMA
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'config',
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT 'OST Comércio Geral, Lda',
  company_address TEXT DEFAULT 'Av. Eduardo Mondlane, Nº 1234, Maputo - Moçambique',
  company_nuit TEXT DEFAULT '400123987',
  company_phone TEXT DEFAULT '+258 84 000 0000',
  company_email TEXT DEFAULT 'contacto@ostvendas.co.mz',
  receipt_footer_message TEXT DEFAULT 'Obrigado pela sua preferência! Processado por computador.',
  enable_vat BOOLEAN DEFAULT true,
  vat_percentage NUMERIC(5,2) DEFAULT 16.00,
  currency TEXT DEFAULT 'MT',
  low_stock_threshold NUMERIC(14,2) DEFAULT 5.00,
  default_printer TEXT DEFAULT 'thermal_80mm',
  cloud_backup_enabled BOOLEAN DEFAULT true,
  backup_frequency TEXT DEFAULT 'daily',
  backup_time TEXT DEFAULT '18:00',
  logo_url TEXT,
  theme TEXT DEFAULT 'laranja',
  val_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PEDIDOS DE RECUPERAÇÃO DE ACESSO
CREATE TABLE IF NOT EXISTS public.recovery_requests (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_produtos_tenant ON public.produtos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_code ON public.produtos(code);
CREATE INDEX IF NOT EXISTS idx_produtos_barcode ON public.produtos(barcode);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON public.clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nuit ON public.clientes(nuit);
CREATE INDEX IF NOT EXISTS idx_vendas_tenant ON public.vendas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_invoice ON public.vendas(invoice_number);
CREATE INDEX IF NOT EXISTS idx_vendas_timestamp ON public.vendas(timestamp);
CREATE INDEX IF NOT EXISTS idx_caixa_tenant ON public.caixa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_caixa_timestamp ON public.caixa(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_colaboradores_tenant ON public.colaboradores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id);

-- ============================================================================
-- 4. TENANT ISOLATION HELPERS & TRIGGER FOR GOOGLE AUTH
-- ============================================================================

-- Helper: Obtém o tenant/empresa_id exclusivo do utilizador autenticado a partir do perfil
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND company_id IS NOT NULL AND company_id <> '' LIMIT 1),
    (SELECT tenant_id FROM public.colaboradores WHERE auth_uid = auth.uid()::text AND status = 'ACTIVE' AND tenant_id IS NOT NULL AND tenant_id <> '' LIMIT 1),
    (SELECT id FROM public.companies WHERE owner_uid = auth.uid()::text AND id IS NOT NULL AND id <> '' LIMIT 1)
  );
$$;

-- Trigger: Cria automaticamente Empresa e Perfil ao registar via Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id TEXT;
  v_company_name TEXT;
  v_user_name TEXT;
BEGIN
  v_user_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  
  v_company_name := COALESCE(
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'branch',
    v_user_name || ' - Vendas'
  );

  v_company_id := 'comp_' || substr(new.id::text, 1, 8);

  -- 1. Criar empresa isolada para o novo utilizador
  INSERT INTO public.companies (id, name, owner_uid, email, created_at, updated_at)
  VALUES (
    v_company_id,
    v_company_name,
    new.id::text,
    new.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Criar perfil vinculado à empresa
  INSERT INTO public.profiles (id, company_id, email, full_name, role, avatar_url, created_at, updated_at)
  VALUES (
    new.id,
    v_company_id,
    new.email,
    v_user_name,
    COALESCE(new.raw_user_meta_data->>'role', 'ADMIN'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id),
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();

  -- 3. Criar colaborador inicial como Administrador
  INSERT INTO public.colaboradores (
    id, tenant_id, auth_uid, name, email, role, status, branch, subscription_plan, created_at, updated_at
  )
  VALUES (
    'emp_' || substr(new.id::text, 1, 8),
    v_company_id,
    new.id::text,
    v_user_name,
    new.email,
    'ADMIN',
    'ACTIVE',
    v_company_name,
    'OURO',
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  -- 4. Criar configurações iniciais da empresa isolada
  INSERT INTO public.settings (
    id, tenant_id, company_name, company_email, company_phone, currency, enable_vat, vat_percentage, updated_at
  )
  VALUES (
    'config_' || v_company_id,
    v_company_id,
    v_company_name,
    new.email,
    '+258 84 000 0000',
    'MT',
    true,
    16.00,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;

-- Vincular trigger ao auth.users se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) - STRICT TENANT ISOLATION POLICIES (AUTHENTICATED PROFILE ONLY)
-- ============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;

-- COMPANIES: Apenas membros da mesma empresa autenticada ou o proprietário com tenant ativo
DROP POLICY IF EXISTS "Companies Isolation" ON public.companies;
CREATE POLICY "Companies Isolation" ON public.companies
  FOR ALL TO authenticated
  USING (
    public.get_my_company_id() IS NOT NULL AND 
    (id = public.get_my_company_id() OR owner_uid = auth.uid()::text)
  )
  WITH CHECK (
    public.get_my_company_id() IS NOT NULL AND 
    (id = public.get_my_company_id() OR owner_uid = auth.uid()::text)
  );

-- PROFILES: Cada utilizador acede ao seu próprio perfil ou aos da sua empresa vinculada
DROP POLICY IF EXISTS "Profiles Isolation" ON public.profiles;
CREATE POLICY "Profiles Isolation" ON public.profiles
  FOR ALL TO authenticated
  USING (
    id = auth.uid() OR 
    (public.get_my_company_id() IS NOT NULL AND company_id = public.get_my_company_id())
  )
  WITH CHECK (
    id = auth.uid() OR 
    (public.get_my_company_id() IS NOT NULL AND company_id = public.get_my_company_id())
  );

-- Helper para verificar papel do utilizador corrente no JWT/Metadados
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role'),
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
    'GUEST'
  );
$$;

-- PRODUTOS: Leitura para todos do tenant; Escrita e Atualização para Vendedores/Supervisores/Admin; Eliminação estrita para ADMIN
DROP POLICY IF EXISTS "Produtos Tenant Isolation" ON public.produtos;
DROP POLICY IF EXISTS "Produtos Select" ON public.produtos;
DROP POLICY IF EXISTS "Produtos Insert" ON public.produtos;
DROP POLICY IF EXISTS "Produtos Update" ON public.produtos;
DROP POLICY IF EXISTS "Produtos Delete" ON public.produtos;

CREATE POLICY "Produtos Select" ON public.produtos
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Produtos Insert" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Produtos Update" ON public.produtos
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'))
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'));

CREATE POLICY "Produtos Delete" ON public.produtos
  FOR DELETE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() = 'ADMIN');

-- CLIENTES: Leitura e criação para todos do tenant; Atualização para Operadores/Supervisores/Admin; Eliminação estrita para ADMIN
DROP POLICY IF EXISTS "Clientes Tenant Isolation" ON public.clientes;
DROP POLICY IF EXISTS "Clientes Select" ON public.clientes;
DROP POLICY IF EXISTS "Clientes Insert" ON public.clientes;
DROP POLICY IF EXISTS "Clientes Update" ON public.clientes;
DROP POLICY IF EXISTS "Clientes Delete" ON public.clientes;

CREATE POLICY "Clientes Select" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Clientes Insert" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Clientes Update" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id())
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Clientes Delete" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() = 'ADMIN');

-- VENDAS: Leitura para todos do tenant; Criação para Caixas/Vendedores/Admin; Proibida eliminação arbitrária (Append-Only fiscal)
DROP POLICY IF EXISTS "Vendas Tenant Isolation" ON public.vendas;
DROP POLICY IF EXISTS "Vendas Select" ON public.vendas;
DROP POLICY IF EXISTS "Vendas Insert" ON public.vendas;
DROP POLICY IF EXISTS "Vendas Update" ON public.vendas;

CREATE POLICY "Vendas Select" ON public.vendas
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Vendas Insert" ON public.vendas
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Vendas Update" ON public.vendas
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR'))
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR'));

-- VENDA ITENS: Leitura e Inserção para o tenant; Bloqueado DELETE
DROP POLICY IF EXISTS "Venda Itens Tenant Isolation" ON public.venda_itens;
DROP POLICY IF EXISTS "Venda Itens Select" ON public.venda_itens;
DROP POLICY IF EXISTS "Venda Itens Insert" ON public.venda_itens;

CREATE POLICY "Venda Itens Select" ON public.venda_itens
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Venda Itens Insert" ON public.venda_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

-- CAIXA E MOVIMENTAÇÕES:
DROP POLICY IF EXISTS "Caixa Tenant Isolation" ON public.caixa;
DROP POLICY IF EXISTS "Caixa Select" ON public.caixa;
DROP POLICY IF EXISTS "Caixa Insert" ON public.caixa;

CREATE POLICY "Caixa Select" ON public.caixa
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Caixa Insert" ON public.caixa
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

-- CASH REGISTERS & SHIFTS:
DROP POLICY IF EXISTS "Cash Registers Tenant Isolation" ON public.cash_registers;
DROP POLICY IF EXISTS "Cash Registers Select" ON public.cash_registers;
DROP POLICY IF EXISTS "Cash Registers Insert" ON public.cash_registers;
DROP POLICY IF EXISTS "Cash Registers Update" ON public.cash_registers;

CREATE POLICY "Cash Registers Select" ON public.cash_registers
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Cash Registers Insert" ON public.cash_registers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Cash Registers Update" ON public.cash_registers
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR'))
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR'));

DROP POLICY IF EXISTS "Cash Shifts Tenant Isolation" ON public.cash_shifts;
DROP POLICY IF EXISTS "Cash Shifts Select" ON public.cash_shifts;
DROP POLICY IF EXISTS "Cash Shifts Insert" ON public.cash_shifts;
DROP POLICY IF EXISTS "Cash Shifts Update" ON public.cash_shifts;

CREATE POLICY "Cash Shifts Select" ON public.cash_shifts
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Cash Shifts Insert" ON public.cash_shifts
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Cash Shifts Update" ON public.cash_shifts
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id())
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Cash Closures Tenant Isolation" ON public.cash_closures;
DROP POLICY IF EXISTS "Cash Closures Select" ON public.cash_closures;
DROP POLICY IF EXISTS "Cash Closures Insert" ON public.cash_closures;

CREATE POLICY "Cash Closures Select" ON public.cash_closures
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Cash Closures Insert" ON public.cash_closures
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

-- COLABORADORES: Leitura para o tenant; Modificação e Eliminação estrita para ADMIN
DROP POLICY IF EXISTS "Colaboradores Tenant Isolation" ON public.colaboradores;
DROP POLICY IF EXISTS "Colaboradores Select" ON public.colaboradores;
DROP POLICY IF EXISTS "Colaboradores Insert" ON public.colaboradores;
DROP POLICY IF EXISTS "Colaboradores Update" ON public.colaboradores;
DROP POLICY IF EXISTS "Colaboradores Delete" ON public.colaboradores;

CREATE POLICY "Colaboradores Select" ON public.colaboradores
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Colaboradores Insert" ON public.colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR'));

CREATE POLICY "Colaboradores Update" ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR'))
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR'));

CREATE POLICY "Colaboradores Delete" ON public.colaboradores
  FOR DELETE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() = 'ADMIN');

-- AUDIT LOGS: Append-Only por tenant_id (Apenas SELECT e INSERT)
DROP POLICY IF EXISTS "Audit Logs Tenant Isolation" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit Logs Tenant Select" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit Logs Tenant Insert" ON public.audit_logs;

CREATE POLICY "Audit Logs Tenant Select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Audit Logs Tenant Insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

-- SETTINGS: Leitura para todos; Alteração estrita para ADMIN
DROP POLICY IF EXISTS "Settings Tenant Isolation" ON public.settings;
DROP POLICY IF EXISTS "Settings Select" ON public.settings;
DROP POLICY IF EXISTS "Settings Insert" ON public.settings;
DROP POLICY IF EXISTS "Settings Update" ON public.settings;

CREATE POLICY "Settings Select" ON public.settings
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Settings Insert" ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() = 'ADMIN');

CREATE POLICY "Settings Update" ON public.settings
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() = 'ADMIN')
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() = 'ADMIN');

-- STOCK MOVEMENTS: Isolamento estrito por tenant_id (Append-Only)
DROP POLICY IF EXISTS "Stock Movements Tenant Isolation" ON public.stock_movements;
DROP POLICY IF EXISTS "Stock Movements Tenant Select" ON public.stock_movements;
DROP POLICY IF EXISTS "Stock Movements Tenant Insert" ON public.stock_movements;

CREATE POLICY "Stock Movements Tenant Select" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Stock Movements Tenant Insert" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

-- CUSTOMER DEBTS & PAYMENTS:
DROP POLICY IF EXISTS "Debts Tenant Isolation" ON public.customer_debts;
DROP POLICY IF EXISTS "Debts Select" ON public.customer_debts;
DROP POLICY IF EXISTS "Debts Insert" ON public.customer_debts;
DROP POLICY IF EXISTS "Debts Update" ON public.customer_debts;

CREATE POLICY "Debts Select" ON public.customer_debts
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Debts Insert" ON public.customer_debts
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Debts Update" ON public.customer_debts
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id())
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Debt Payments Tenant Isolation" ON public.debt_payments;
DROP POLICY IF EXISTS "Debt Payments Select" ON public.debt_payments;
DROP POLICY IF EXISTS "Debt Payments Insert" ON public.debt_payments;

CREATE POLICY "Debt Payments Select" ON public.debt_payments
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Debt Payments Insert" ON public.debt_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

-- CATEGORIES & SUPPLIERS:
DROP POLICY IF EXISTS "Categories Tenant Isolation" ON public.categories;
DROP POLICY IF EXISTS "Categories Select" ON public.categories;
DROP POLICY IF EXISTS "Categories Modify" ON public.categories;

CREATE POLICY "Categories Select" ON public.categories
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Categories Modify" ON public.categories
  FOR ALL TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'))
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'));

DROP POLICY IF EXISTS "Suppliers Tenant Isolation" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers Select" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers Modify" ON public.suppliers;

CREATE POLICY "Suppliers Select" ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Suppliers Modify" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'))
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'));

-- RECOVERY REQUESTS:
DROP POLICY IF EXISTS "Recovery Requests Tenant Isolation" ON public.recovery_requests;
DROP POLICY IF EXISTS "Recovery Requests Select" ON public.recovery_requests;
DROP POLICY IF EXISTS "Recovery Requests Insert" ON public.recovery_requests;

CREATE POLICY "Recovery Requests Select" ON public.recovery_requests
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Recovery Requests Insert" ON public.recovery_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

-- ============================================================================
-- 6. ATOMIC STORED PROCEDURES / POSTGRESQL FUNCTIONS (RPC) - HARDENED
-- ============================================================================

-- RPC 1: PROCESS SALE ATOMIC (Idempotent, Transactional, Stock-Validated & Tenant-Hardened)
CREATE OR REPLACE FUNCTION public.process_sale_atomic(
  p_tenant_id TEXT,
  p_sale_id TEXT,
  p_invoice_number TEXT,
  p_customer_id TEXT,
  p_customer_name TEXT,
  p_customer_nuit TEXT,
  p_seller_id TEXT,
  p_seller_name TEXT,
  p_payment_method TEXT,
  p_subtotal NUMERIC,
  p_discount_total NUMERIC,
  p_vat_total NUMERIC,
  p_grand_total NUMERIC,
  p_amount_paid NUMERIC,
  p_change_amount NUMERIC,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id TEXT;
  v_item JSONB;
  v_prod_id TEXT;
  v_prod_name TEXT;
  v_qty NUMERIC;
  v_unit_price NUMERIC;
  v_cost_price NUMERIC;
  v_curr_stock NUMERIC;
  v_new_stock NUMERIC;
  v_total_item NUMERIC;
  v_is_credit BOOLEAN;
  v_remaining_debt NUMERIC;
BEGIN
  -- 0. Determinar e validar autoritativamente o tenant da sessão (não confiar no frontend)
  IF auth.uid() IS NOT NULL THEN
    v_tenant_id := public.get_my_company_id();
  ELSE
    v_tenant_id := p_tenant_id;
  END IF;

  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identificador de tenant não autorizado ou utilizador sem empresa.');
  END IF;

  -- 0.1 Validação de valores monetários
  IF p_subtotal < 0 OR p_discount_total < 0 OR p_vat_total < 0 OR p_grand_total < 0 OR p_amount_paid < 0 OR p_change_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valores monetários inválidos ou negativos.');
  END IF;

  -- 0.2 Verificação de Idempotência: Se a venda já foi registada para este tenant, devolver com sucesso
  IF EXISTS (SELECT 1 FROM public.vendas WHERE id = p_sale_id AND tenant_id = v_tenant_id) THEN
    RETURN jsonb_build_object(
      'success', true,
      'sale_id', p_sale_id,
      'invoice_number', p_invoice_number,
      'grand_total', p_grand_total,
      'message', 'Venda já processada anteriormente (idempotente).'
    );
  END IF;

  -- 0.3 Validação de cliente (se fornecido, deve pertencer ao mesmo tenant)
  IF p_customer_id IS NOT NULL AND p_customer_id <> '' THEN
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_customer_id AND tenant_id = v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cliente especificado não existe ou pertence a outra empresa.');
    END IF;
  END IF;

  -- 0.4 Validação de itens e integridade de stock (Passo atómico de pré-validação)
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A venda deve conter pelo menos um artigo.');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := COALESCE(v_item->>'productId', v_item->>'id');
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'quantidade')::NUMERIC, 0.00);
    v_unit_price := COALESCE((v_item->>'salePrice')::NUMERIC, (v_item->>'unitPrice')::NUMERIC, (v_item->>'price')::NUMERIC, -1.00);

    IF v_prod_id IS NULL OR v_prod_id = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Identificador de produto não especificado num dos itens.');
    END IF;

    IF v_qty <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Quantidade inválida para o artigo.');
    END IF;

    IF v_unit_price < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Preço unitário inválido para o artigo.');
    END IF;

    -- Bloquear e validar produto no inventário do tenant
    SELECT stock, name INTO v_curr_stock, v_prod_name 
    FROM public.produtos 
    WHERE id = v_prod_id AND tenant_id = v_tenant_id AND is_active = TRUE 
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Artigo (' || v_prod_id || ') não existe, está desativado ou não pertence à sua empresa.');
    END IF;

    IF v_curr_stock < v_qty THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente para o artigo "' || v_prod_name || '". Stock atual: ' || v_curr_stock || ', Solicitado: ' || v_qty);
    END IF;
  END LOOP;

  -- 1. Inserir registo mestre de venda
  INSERT INTO public.vendas (
    id, tenant_id, invoice_number, customer_id, customer_name, customer_nuit,
    seller_id, seller_name, operator_name, payment_method, payment_status,
    subtotal, discount_total, vat_total, grand_total, amount_paid, change_amount,
    status, items, notes, timestamp, created_at
  ) VALUES (
    p_sale_id, v_tenant_id, p_invoice_number, p_customer_id, p_customer_name, p_customer_nuit,
    p_seller_id, p_seller_name, p_seller_name, p_payment_method,
    CASE WHEN p_payment_method IN ('A Prazo / Dívida', 'Crédito', 'CREDITO', 'DEBT') THEN 'PENDING_DEBT' ELSE 'PAID' END,
    p_subtotal, p_discount_total, p_vat_total, p_grand_total, p_amount_paid, p_change_amount,
    'COMPLETED', p_items, p_notes, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    subtotal = EXCLUDED.subtotal,
    grand_total = EXCLUDED.grand_total,
    items = EXCLUDED.items;

  -- 2. Iterar sobre os itens: inserir itens individuais e decrementar o stock atomicamente
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := COALESCE(v_item->>'productId', v_item->>'id');
    v_prod_name := COALESCE(v_item->>'name', v_item->>'productName', v_item->>'nome', 'Artigo');
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'quantidade')::NUMERIC, 1.00);
    v_unit_price := COALESCE((v_item->>'salePrice')::NUMERIC, (v_item->>'unitPrice')::NUMERIC, (v_item->>'price')::NUMERIC, 0.00);
    v_cost_price := COALESCE((v_item->>'costPrice')::NUMERIC, (v_item->>'cost')::NUMERIC, 0.00);
    v_total_item := COALESCE((v_item->>'totalPrice')::NUMERIC, (v_item->>'total')::NUMERIC, v_qty * v_unit_price);

    -- Inserir item da venda
    INSERT INTO public.venda_itens (
      id, tenant_id, sale_id, product_id, product_name,
      unit_price, quantity, cost_price, total_price, created_at
    ) VALUES (
      uuid_generate_v4()::TEXT, v_tenant_id, p_sale_id, v_prod_id, v_prod_name,
      v_unit_price, v_qty, v_cost_price, v_total_item, NOW()
    );

    -- Buscar e atualizar stock do produto pertencente ao mesmo tenant
    SELECT stock INTO v_curr_stock FROM public.produtos WHERE id = v_prod_id AND tenant_id = v_tenant_id FOR UPDATE;
    v_new_stock := GREATEST(0.00, v_curr_stock - v_qty);

    UPDATE public.produtos 
    SET stock = v_new_stock, updated_at = NOW() 
    WHERE id = v_prod_id AND tenant_id = v_tenant_id;

    -- Registar movimento no Kardex
    INSERT INTO public.stock_movements (
      id, tenant_id, product_id, type, quantity,
      previous_stock, new_stock, cost_price, reason, reference_id, user_name, timestamp
    ) VALUES (
      uuid_generate_v4()::TEXT, v_tenant_id, v_prod_id, 'EXIT_SALE', v_qty,
      v_curr_stock, v_new_stock, v_cost_price, 'Venda ' || p_invoice_number, p_sale_id, p_seller_name, NOW()
    );
  END LOOP;

  -- 3. Gestão de Dívida se a venda foi a prazo
  v_is_credit := p_payment_method IN ('A Prazo / Dívida', 'Crédito', 'CREDITO', 'DEBT');
  IF v_is_credit AND p_customer_id IS NOT NULL AND p_customer_id <> '' THEN
    v_remaining_debt := GREATEST(0.00, p_grand_total - p_amount_paid);
    
    INSERT INTO public.customer_debts (
      id, tenant_id, customer_id, sale_id, total_amount, paid_amount,
      remaining_balance, due_date, status, created_at
    ) VALUES (
      uuid_generate_v4()::TEXT, v_tenant_id, p_customer_id, p_sale_id, p_grand_total, p_amount_paid,
      v_remaining_debt, NOW() + INTERVAL '30 days',
      CASE WHEN v_remaining_debt <= 0 THEN 'SETTLED' ELSE 'PENDING' END,
      NOW()
    );

    -- Atualizar saldo em aberto do cliente
    UPDATE public.clientes 
    SET balance = balance + v_remaining_debt, updated_at = NOW()
    WHERE id = p_customer_id AND tenant_id = v_tenant_id;
  END IF;

  -- 4. Registar entrada no fluxo de caixa se pago em dinheiro
  IF p_payment_method IN ('Dinheiro', 'Cash', 'Numerário', 'CASH') AND p_amount_paid > 0 THEN
    INSERT INTO public.caixa (
      id, tenant_id, type, amount, reason, responsible_user, reference_id, timestamp
    ) VALUES (
      uuid_generate_v4()::TEXT, v_tenant_id, 'INPUT', p_amount_paid, 'Recebimento Venda ' || p_invoice_number, p_seller_name, p_sale_id, NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'invoice_number', p_invoice_number,
    'grand_total', p_grand_total,
    'message', 'Venda e movimentações de inventário processadas com sucesso.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- RPC 2: REPLENISH STOCK ATOMIC (Validated, Authorized & Tenant-Hardened)
CREATE OR REPLACE FUNCTION public.replenish_stock_atomic(
  p_tenant_id TEXT,
  p_product_id TEXT,
  p_quantity NUMERIC,
  p_cost_price NUMERIC DEFAULT NULL,
  p_reason TEXT DEFAULT 'Reabastecimento de Stock',
  p_user_name TEXT DEFAULT 'Sistema'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id TEXT;
  v_curr_stock NUMERIC;
  v_new_stock NUMERIC;
  v_curr_cost NUMERIC;
  v_new_cost NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_tenant_id := public.get_my_company_id();
  ELSE
    v_tenant_id := p_tenant_id;
  END IF;

  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identificador de tenant não autorizado ou utilizador sem empresa.');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantidade de reabastecimento deve ser superior a zero.');
  END IF;

  IF p_cost_price IS NOT NULL AND p_cost_price < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preço de custo não pode ser negativo.');
  END IF;

  SELECT stock, cost_price INTO v_curr_stock, v_curr_cost 
  FROM public.produtos 
  WHERE id = p_product_id AND tenant_id = v_tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Artigo não encontrado no inventário da empresa ou pertence a outra organização.');
  END IF;

  v_new_stock := v_curr_stock + p_quantity;
  v_new_cost := COALESCE(p_cost_price, v_curr_cost);

  UPDATE public.produtos 
  SET stock = v_new_stock, cost_price = v_new_cost, updated_at = NOW()
  WHERE id = p_product_id AND tenant_id = v_tenant_id;

  INSERT INTO public.stock_movements (
    id, tenant_id, product_id, type, quantity,
    previous_stock, new_stock, cost_price, reason, user_name, timestamp
  ) VALUES (
    uuid_generate_v4()::TEXT, v_tenant_id, p_product_id, 'ENTRY', p_quantity,
    v_curr_stock, v_new_stock, v_new_cost, p_reason, p_user_name, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'previous_stock', v_curr_stock,
    'new_stock', v_new_stock
  );
END;
$$;

-- RPC 3: SETTLE DEBT PAYMENT ATOMIC (Hardened against Overpayment & Cross-Tenant Access)
CREATE OR REPLACE FUNCTION public.settle_debt_payment_atomic(
  p_tenant_id TEXT,
  p_debt_id TEXT,
  p_customer_id TEXT,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_received_by TEXT DEFAULT 'Operador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id TEXT;
  v_remaining NUMERIC;
  v_new_remaining NUMERIC;
  v_debt_customer_id TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_tenant_id := public.get_my_company_id();
  ELSE
    v_tenant_id := p_tenant_id;
  END IF;

  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identificador de tenant não autorizado ou utilizador sem empresa.');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor do pagamento de dívida deve ser superior a zero.');
  END IF;

  -- 1. Validar que a dívida pertence ao tenant
  SELECT remaining_balance, customer_id INTO v_remaining, v_debt_customer_id 
  FROM public.customer_debts 
  WHERE id = p_debt_id AND tenant_id = v_tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registo de dívida não encontrado ou pertence a outra organização.');
  END IF;

  -- 2. Validar que o cliente corresponde à dívida e pertence ao mesmo tenant
  IF p_customer_id IS NOT NULL AND p_customer_id <> '' AND v_debt_customer_id <> p_customer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'O cliente informado não corresponde ao titular deste registo de dívida.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = v_debt_customer_id AND tenant_id = v_tenant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente titular da dívida não encontrado na organização.');
  END IF;

  -- 3. Impedir pagamento superior ao saldo devedor
  IF p_amount > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'error', 'O valor do pagamento (' || p_amount || ') é superior ao saldo devedor pendente (' || v_remaining || ').');
  END IF;

  v_new_remaining := GREATEST(0.00, v_remaining - p_amount);

  UPDATE public.customer_debts 
  SET 
    paid_amount = paid_amount + p_amount,
    remaining_balance = v_new_remaining,
    status = CASE WHEN v_new_remaining <= 0 THEN 'SETTLED' ELSE 'PARTIAL' END,
    settled_at = CASE WHEN v_new_remaining <= 0 THEN NOW() ELSE NULL END
  WHERE id = p_debt_id AND tenant_id = v_tenant_id;

  INSERT INTO public.debt_payments (
    id, tenant_id, debt_id, customer_id, amount, payment_method, received_by, timestamp
  ) VALUES (
    uuid_generate_v4()::TEXT, v_tenant_id, p_debt_id, v_debt_customer_id, p_amount, p_payment_method, p_received_by, NOW()
  );

  UPDATE public.clientes 
  SET balance = GREATEST(0.00, balance - p_amount), updated_at = NOW()
  WHERE id = v_debt_customer_id AND tenant_id = v_tenant_id;

  INSERT INTO public.caixa (
    id, tenant_id, type, amount, reason, responsible_user, reference_id, timestamp
  ) VALUES (
    uuid_generate_v4()::TEXT, v_tenant_id, 'INPUT', p_amount, 'Liquidação de Dívida (Cliente ' || v_debt_customer_id || ')', p_received_by, p_debt_id, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'debt_id', p_debt_id,
    'amount_paid', p_amount,
    'remaining_balance', v_new_remaining
  );
END;
$$;

-- ============================================================================
-- 7. PRIVILEGE ESCALATION & TENANT MUTATION PROTECTION TRIGGERS
-- ============================================================================

-- Impede alteração não autorizada de papéis (role) e empresa em profiles
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user != 'service_role' AND (old.role IS DISTINCT FROM new.role OR old.company_id IS DISTINCT FROM new.company_id) THEN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'ADMIN' THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o papel ou a empresa associada ao perfil.';
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- Impede mutação de tenant_id em tabelas de negócio
CREATE OR REPLACE FUNCTION public.prevent_tenant_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF old.tenant_id IS DISTINCT FROM new.tenant_id THEN
    RAISE EXCEPTION 'Violação de segurança: Não é permitido transferir registos entre empresas (mutação de tenant_id negada).';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_produtos ON public.produtos;
CREATE TRIGGER trg_prevent_tenant_mutation_produtos
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_clientes ON public.clientes;
CREATE TRIGGER trg_prevent_tenant_mutation_clientes
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_vendas ON public.vendas;
CREATE TRIGGER trg_prevent_tenant_mutation_vendas
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_caixa ON public.caixa;
CREATE TRIGGER trg_prevent_tenant_mutation_caixa
  BEFORE UPDATE ON public.caixa
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_colaboradores ON public.colaboradores;
CREATE TRIGGER trg_prevent_tenant_mutation_colaboradores
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_mutation();
