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
  role TEXT,
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

-- Compatibilidade e resiliência: garantir coluna 'price' (alias para 'sale_price')
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'price'
  ) THEN 
    ALTER TABLE public.produtos ADD COLUMN price NUMERIC(14,2) GENERATED ALWAYS AS (sale_price) STORED; 
  END IF; 
EXCEPTION WHEN OTHERS THEN NULL; 
END $$;

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
  opened_by TEXT NOT NULL,
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

-- CHAVES DE IDEMPOTÊNCIA PERSISTENTES (PREVENÇÃO DE DUPLICIDADE EM VENDAS/PAGAMENTOS)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
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

  -- 2. Criar perfil vinculado à empresa (ADMIN atribuído somente durante o provisionamento controlado do proprietário inicial)
  INSERT INTO public.profiles (id, company_id, email, full_name, role, avatar_url, created_at, updated_at)
  VALUES (
    new.id,
    v_company_id,
    new.email,
    v_user_name,
    CASE 
      WHEN new.raw_app_meta_data->>'role' IS NOT NULL AND (new.raw_app_meta_data->>'role') <> '' 
        THEN new.raw_app_meta_data->>'role'
      WHEN EXISTS (SELECT 1 FROM public.companies c WHERE c.id = v_company_id AND c.owner_uid = new.id::text)
        THEN 'ADMIN' -- Provisionamento controlado do proprietário inicial
      ELSE NULL -- Rejeitar role padrão não provisionado
    END,
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

-- COMPANIES: Políticas granulares com isolamento estrito de tenant
DROP POLICY IF EXISTS "Companies Isolation" ON public.companies;
DROP POLICY IF EXISTS "Companies Select" ON public.companies;
DROP POLICY IF EXISTS "Companies Insert" ON public.companies;
DROP POLICY IF EXISTS "Companies Update" ON public.companies;
DROP POLICY IF EXISTS "Companies Delete" ON public.companies;

CREATE POLICY "Companies Select" ON public.companies
  FOR SELECT TO authenticated
  USING (
    public.get_my_company_id() IS NOT NULL AND 
    (id = public.get_my_company_id() OR owner_uid = auth.uid()::text)
  );

CREATE POLICY "Companies Insert" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_uid = auth.uid()::text OR 
    (public.get_my_company_id() IS NOT NULL AND id = public.get_my_company_id())
  );

CREATE POLICY "Companies Update" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    public.get_my_company_id() IS NOT NULL AND 
    (id = public.get_my_company_id() OR owner_uid = auth.uid()::text)
  )
  WITH CHECK (
    public.get_my_company_id() IS NOT NULL AND 
    (id = public.get_my_company_id() OR owner_uid = auth.uid()::text)
  );

-- PROFILES: Políticas granulares e seguras contra Escalada de Privilégios e Manipulação de Tenant
DROP POLICY IF EXISTS "Profiles Isolation" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Select" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Update Self" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Update Admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Delete" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Delete Admin" ON public.profiles;

-- Leitura: Utilizador lê o seu próprio perfil ou os perfis da mesma empresa
CREATE POLICY "Profiles Select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR 
    (public.get_my_company_id() IS NOT NULL AND company_id = public.get_my_company_id())
  );

-- Inserção: Criado pelo próprio utilizador (via trigger OAuth/Signup com validação estrita) ou por Admin da empresa
CREATE POLICY "Profiles Insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (id = auth.uid() AND (role IS NULL OR role NOT IN ('ADMIN', 'OWNER', 'SUPER_ADMIN') OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND owner_uid = auth.uid()::text))) OR 
    (public.get_my_company_id() IS NOT NULL AND company_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'OWNER'))
  );

-- Atualização Própria: Utilizador comum só pode alterar dados pessoais (full_name, avatar_url, phone), NUNCA role ou company_id
CREATE POLICY "Profiles Update Self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    company_id IS NOT DISTINCT FROM (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()) AND
    (public.get_my_role() IN ('ADMIN', 'OWNER') OR role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
  );

-- Atualização Administrativa: Apenas Administrador da empresa pode atualizar membros da sua empresa
CREATE POLICY "Profiles Update Admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.get_my_company_id() IS NOT NULL AND 
    company_id = public.get_my_company_id() AND 
    public.get_my_role() IN ('ADMIN', 'OWNER')
  )
  WITH CHECK (
    public.get_my_company_id() IS NOT NULL AND 
    company_id = public.get_my_company_id() AND 
    public.get_my_role() IN ('ADMIN', 'OWNER')
  );

-- Eliminação: Apenas Administrador da empresa pode remover perfis de outros colaboradores (nunca o próprio proprietário)
CREATE POLICY "Profiles Delete Admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    id <> auth.uid() AND
    public.get_my_company_id() IS NOT NULL AND 
    company_id = public.get_my_company_id() AND 
    public.get_my_role() IN ('ADMIN', 'OWNER')
  );

-- Trigger de Segurança: Bloqueio estrito de escalada de privilégios e evasão de tenant a nível de banco
CREATE OR REPLACE FUNCTION public.check_profile_security_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se a operação for acionada por um utilizador autenticado regular
  IF auth.uid() IS NOT NULL THEN
    -- Impedir alteração de company_id para prevenir tenant-hopping
    IF OLD.company_id IS NOT NULL AND NEW.company_id <> OLD.company_id THEN
      RAISE EXCEPTION 'Manipulação de Tenant Bloqueada: Não é permitido transferir contas entre empresas.';
    END IF;

    -- Impedir utilizador comum de auto-promover para ADMIN ou outro cargo superior
    IF auth.uid() = OLD.id AND NEW.role <> OLD.role AND public.get_my_role() NOT IN ('ADMIN', 'OWNER') THEN
      RAISE EXCEPTION 'Escalada de Privilégios Bloqueada: Não possui permissão para alterar o seu próprio papel de acesso.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_security_guard ON public.profiles;
CREATE TRIGGER trg_profiles_security_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_security_guard();

-- Helper para verificar papel do utilizador corrente de forma autoritativa (Profiles ou app_metadata, nunca user_metadata)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Consultar tabela profiles de forma autoritativa
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  -- 2. Fallback para app_metadata (gerido exclusivamente pelo servidor / admin)
  v_role := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role');
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  RETURN 'GUEST';
END;
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
DROP POLICY IF EXISTS "Categories Insert" ON public.categories;
DROP POLICY IF EXISTS "Categories Update" ON public.categories;
DROP POLICY IF EXISTS "Categories Delete" ON public.categories;

CREATE POLICY "Categories Select" ON public.categories
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Categories Insert" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'));

CREATE POLICY "Categories Update" ON public.categories
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'))
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'));

CREATE POLICY "Categories Delete" ON public.categories
  FOR DELETE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'));

DROP POLICY IF EXISTS "Suppliers Tenant Isolation" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers Select" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers Modify" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers Insert" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers Update" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers Delete" ON public.suppliers;

CREATE POLICY "Suppliers Select" ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id());

CREATE POLICY "Suppliers Insert" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'));

CREATE POLICY "Suppliers Update" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'))
  WITH CHECK (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'));

CREATE POLICY "Suppliers Delete" ON public.suppliers
  FOR DELETE TO authenticated
  USING (public.get_my_company_id() IS NOT NULL AND tenant_id = public.get_my_company_id() AND public.get_my_role() IN ('ADMIN', 'SUPERVISOR', 'STOCK_MANAGER'));

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

-- RPC 1: PROCESS SALE ATOMIC (Idempotent, Transactional, Authoritative Financial Calculation & Tenant-Hardened)
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
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
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
  v_official_sale_price NUMERIC;
  v_official_cost_price NUMERIC;
  v_prod_vat_rate NUMERIC;
  v_curr_stock NUMERIC;
  v_new_stock NUMERIC;
  v_item_discount NUMERIC;
  v_item_subtotal NUMERIC;
  v_item_net NUMERIC;
  v_item_vat NUMERIC;
  v_item_total NUMERIC;
  
  -- Valores financeiros autoritativos calculados exclusivamente no PostgreSQL
  v_calc_subtotal NUMERIC(14,2) := 0.00;
  v_calc_cost_total NUMERIC(14,2) := 0.00;
  v_calc_vat_total NUMERIC(14,2) := 0.00;
  v_calc_item_discount_total NUMERIC(14,2) := 0.00;
  v_calc_total_discount NUMERIC(14,2) := 0.00;
  v_calc_grand_total NUMERIC(14,2) := 0.00;
  v_calc_amount_paid NUMERIC(14,2) := 0.00;
  v_calc_change NUMERIC(14,2) := 0.00;
  v_remaining_debt NUMERIC(14,2) := 0.00;
  v_is_credit BOOLEAN;
  v_authoritative_items JSONB := '[]'::JSONB;

  v_cached_response JSONB;
  v_final_response JSONB;
BEGIN
  -- 0. SEGURANÇA ESTATUTÁRIA: Determinar e validar autoritativamente o tenant da sessão.
  -- NUNCA aceitar chamadas anónimas/não autenticadas que passem p_tenant_id arbitrário.
  IF auth.uid() IS NOT NULL THEN
    v_tenant_id := public.get_my_company_id();
    IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Utilizador autenticado sem empresa/tenant associado.');
    END IF;
    -- Se fornecido p_tenant_id pelo cliente, verificar estritamente que não há spoofing de tenant
    IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Violação de segurança: Tentativa de operação em tenant diferente do autorizado.');
    END IF;
  ELSIF current_user IN ('service_role', 'postgres', 'supabase_admin') 
     OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role' THEN
    v_tenant_id := p_tenant_id;
    IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Identificador de tenant não fornecido pela chamada autorizada de backend.');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado: Operação atómica requer utilizador autenticado ou token service_role.');
  END IF;

  -- 0.1 Verificação de Idempotência Persistente via Chave de Idempotência
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT response_payload INTO v_cached_response
    FROM public.idempotency_keys
    WHERE key = p_idempotency_key AND tenant_id = v_tenant_id;

    IF FOUND THEN
      RETURN v_cached_response;
    END IF;
  END IF;

  -- 0.2 Verificação de Idempotência por ID de Venda Existente
  IF EXISTS (SELECT 1 FROM public.vendas WHERE id = p_sale_id AND tenant_id = v_tenant_id) THEN
    SELECT jsonb_build_object(
      'success', true,
      'sale_id', id,
      'invoice_number', invoice_number,
      'subtotal', subtotal,
      'discount_total', discount_total,
      'vat_total', vat_total,
      'grand_total', grand_total,
      'amount_paid', amount_paid,
      'change_amount', change_amount,
      'message', 'Venda já processada anteriormente (idempotente).'
    ) INTO v_final_response
    FROM public.vendas
    WHERE id = p_sale_id AND tenant_id = v_tenant_id;

    RETURN v_final_response;
  END IF;

  -- 0.3 Validação de cliente (se fornecido, deve pertencer ao mesmo tenant)
  IF p_customer_id IS NOT NULL AND p_customer_id <> '' AND p_customer_id <> 'WALK_IN' THEN
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_customer_id AND tenant_id = v_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cliente especificado não existe ou pertence a outra organização.');
    END IF;
  END IF;

  -- 0.4 Validação e Pré-Cálculo Autoritativo de Itens e Stock
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A venda deve conter pelo menos um artigo.');
  END IF;

  -- FASE 1: VALIDAÇÃO, BLOQUEIO DE REGISTOS E CÁLCULO FINANCEIRO AUTORITATIVO NO POSTGRESQL
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := COALESCE(v_item->>'productId', v_item->>'id');
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'quantidade')::NUMERIC, 0.00);
    v_item_discount := GREATEST(0.00, COALESCE((v_item->>'discountAmount')::NUMERIC, (v_item->>'discount')::NUMERIC, 0.00));

    IF v_prod_id IS NULL OR v_prod_id = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Identificador de produto não especificado num dos itens.');
    END IF;

    IF v_qty <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Quantidade inválida para o artigo.');
    END IF;

    -- BLOQUEIO EXCLUSIVO E CONSULTA DE PREÇO AUTORITATIVO (USANDO sale_price, NUNCA price INEXISTENTE)
    SELECT name, stock, sale_price, cost_price, COALESCE(vat_rate, 16.00)
    INTO v_prod_name, v_curr_stock, v_official_sale_price, v_official_cost_price, v_prod_vat_rate
    FROM public.produtos
    WHERE id = v_prod_id AND tenant_id = v_tenant_id AND is_active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Artigo (' || v_prod_id || ') não existe, está desativado ou pertence a outra organização.');
    END IF;

    IF v_curr_stock < v_qty THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente para o artigo "' || v_prod_name || '". Stock atual: ' || v_curr_stock || ', Solicitado: ' || v_qty);
    END IF;

    -- Preços Oficiais de Catálogo e Custo (Autoritativos do PostgreSQL, imunes a adulteração de cliente)
    v_unit_price := v_official_sale_price;
    v_cost_price := v_official_cost_price;

    v_item_subtotal := ROUND(v_qty * v_unit_price, 2);
    v_item_discount := LEAST(v_item_discount, v_item_subtotal);
    v_item_net := v_item_subtotal - v_item_discount;

    -- Cálculo de IVA Autoritativo por Artigo (16% padrão de Moçambique ou taxa cadastrada no produto)
    IF COALESCE(p_vat_total, -1.00) = 0.00 OR v_prod_vat_rate <= 0 THEN
      v_item_vat := 0.00;
    ELSE
      v_item_vat := ROUND(v_item_net * (v_prod_vat_rate / 100.0), 2);
    END IF;

    v_item_total := ROUND(v_item_net + v_item_vat, 2);

    -- Acumular totais financeiros calculados
    v_calc_subtotal := v_calc_subtotal + v_item_subtotal;
    v_calc_cost_total := v_calc_cost_total + ROUND(v_qty * v_cost_price, 2);
    v_calc_item_discount_total := v_calc_item_discount_total + v_item_discount;
    v_calc_vat_total := v_calc_vat_total + v_item_vat;

    -- Construir lista autoritativa de itens para persistência
    v_authoritative_items := v_authoritative_items || jsonb_build_object(
      'productId', v_prod_id,
      'productName', v_prod_name,
      'quantity', v_qty,
      'price', v_unit_price,
      'salePrice', v_unit_price,
      'unitPrice', v_unit_price,
      'costPrice', v_cost_price,
      'vatRate', v_prod_vat_rate,
      'vatAmount', v_item_vat,
      'discountAmount', v_item_discount,
      'subtotal', v_item_subtotal,
      'totalPrice', v_item_total
    );
  END LOOP;

  -- FASE 2: CONSOLIDAÇÃO FINANCEIRA AUTORITATIVA
  -- Desconto total: validar se o cliente solicitou desconto global superior aos descontos por item
  v_calc_total_discount := GREATEST(v_calc_item_discount_total, GREATEST(0.00, LEAST(COALESCE(p_discount_total, 0.00), v_calc_subtotal)));
  v_calc_grand_total := GREATEST(0.00, ROUND(v_calc_subtotal - v_calc_total_discount + v_calc_vat_total, 2));

  v_is_credit := p_payment_method IN ('A Prazo / Dívida', 'Crédito', 'CREDITO', 'DEBT');
  IF v_is_credit THEN
    v_calc_amount_paid := LEAST(GREATEST(0.00, COALESCE(p_amount_paid, 0.00)), v_calc_grand_total);
    v_calc_change := 0.00;
    v_remaining_debt := GREATEST(0.00, v_calc_grand_total - v_calc_amount_paid);
  ELSE
    v_calc_amount_paid := GREATEST(0.00, COALESCE(p_amount_paid, v_calc_grand_total));
    v_calc_change := GREATEST(0.00, v_calc_amount_paid - v_calc_grand_total);
    v_remaining_debt := 0.00;
  END IF;

  -- FASE 3: INSERIR REGISTO MESTRE COM VALORES AUTORITATIVOS
  INSERT INTO public.vendas (
    id, tenant_id, invoice_number, customer_id, customer_name, customer_nuit,
    seller_id, seller_name, operator_name, payment_method, payment_status,
    subtotal, discount_total, vat_total, grand_total, amount_paid, change_amount,
    status, items, notes, timestamp, created_at
  ) VALUES (
    p_sale_id, v_tenant_id, p_invoice_number, p_customer_id, p_customer_name, p_customer_nuit,
    p_seller_id, p_seller_name, p_seller_name, p_payment_method,
    CASE WHEN v_is_credit AND v_remaining_debt > 0 THEN 'PENDING_DEBT' ELSE 'PAID' END,
    v_calc_subtotal, v_calc_total_discount, v_calc_vat_total, v_calc_grand_total, v_calc_amount_paid, v_calc_change,
    'COMPLETED', v_authoritative_items, p_notes, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    subtotal = EXCLUDED.subtotal,
    discount_total = EXCLUDED.discount_total,
    vat_total = EXCLUDED.vat_total,
    grand_total = EXCLUDED.grand_total,
    amount_paid = EXCLUDED.amount_paid,
    change_amount = EXCLUDED.change_amount,
    payment_status = EXCLUDED.payment_status,
    items = EXCLUDED.items;

  -- FASE 4: INSERIR ITENS INDIVIDUAIS, ATUALIZAR STOCK E REGISTAR KARDEX
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_authoritative_items)
  LOOP
    v_prod_id := v_item->>'productId';
    v_prod_name := v_item->>'productName';
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unitPrice')::NUMERIC;
    v_cost_price := (v_item->>'costPrice')::NUMERIC;
    v_item_total := (v_item->>'totalPrice')::NUMERIC;

    -- Obter stock atualizado para movimentação no Kardex
    SELECT stock INTO v_curr_stock FROM public.produtos WHERE id = v_prod_id AND tenant_id = v_tenant_id FOR UPDATE;
    v_new_stock := GREATEST(0.00, v_curr_stock - v_qty);

    -- Inserir item da venda
    INSERT INTO public.venda_itens (
      id, tenant_id, sale_id, product_id, product_name,
      unit_price, quantity, cost_price, total_price, created_at
    ) VALUES (
      uuid_generate_v4()::TEXT, v_tenant_id, p_sale_id, v_prod_id, v_prod_name,
      v_unit_price, v_qty, v_cost_price, v_item_total, NOW()
    );

    -- Decrementar stock com garantia de não negatividade
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

  -- FASE 5: GESTÃO AUTORITATIVA DE DÍVIDAS
  IF v_is_credit AND p_customer_id IS NOT NULL AND p_customer_id <> '' AND p_customer_id <> 'WALK_IN' THEN
    INSERT INTO public.customer_debts (
      id, tenant_id, customer_id, sale_id, total_amount, paid_amount,
      remaining_balance, due_date, status, created_at
    ) VALUES (
      uuid_generate_v4()::TEXT, v_tenant_id, p_customer_id, p_sale_id, v_calc_grand_total, v_calc_amount_paid,
      v_remaining_debt, NOW() + INTERVAL '30 days',
      CASE WHEN v_remaining_debt <= 0 THEN 'SETTLED' ELSE 'PENDING' END,
      NOW()
    );

    -- Atualizar saldo devedor do cliente
    UPDATE public.clientes 
    SET balance = balance + v_remaining_debt, updated_at = NOW()
    WHERE id = p_customer_id AND tenant_id = v_tenant_id;
  END IF;

  -- FASE 6: REGISTO NO FLUXO DE CAIXA SE PAGO EM NUMERÁRIO
  IF p_payment_method IN ('Dinheiro', 'Cash', 'Numerário', 'CASH') AND (v_calc_amount_paid - v_calc_change) > 0 THEN
    INSERT INTO public.caixa (
      id, tenant_id, type, amount, reason, responsible_user, reference_id, timestamp
    ) VALUES (
      uuid_generate_v4()::TEXT, v_tenant_id, 'INPUT', (v_calc_amount_paid - v_calc_change), 'Recebimento Venda ' || p_invoice_number, p_seller_name, p_sale_id, NOW()
    );
  END IF;

  -- FASE 7: AUDITORIA OFICIAL DENTRO DA TRANSAÇÃO ATÓMICA
  INSERT INTO public.audit_logs (
    id, tenant_id, action, module, details, user_name, user_role, ip_address, timestamp, created_at
  ) VALUES (
    uuid_generate_v4()::TEXT,
    v_tenant_id,
    'VENDA_PROCESSADA',
    'POS',
    'Fatura ' || p_invoice_number || ' emitida no valor autoritativo de ' || v_calc_grand_total || ' MT. Pagamento: ' || p_payment_method || '. Vendedor: ' || p_seller_name,
    p_seller_name,
    'OPERATOR',
    '127.0.0.1',
    NOW(),
    NOW()
  );

  -- RESPOSTA FINAL AUTORITATIVA
  v_final_response := jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'invoice_number', p_invoice_number,
    'subtotal', v_calc_subtotal,
    'discount_total', v_calc_total_discount,
    'vat_total', v_calc_vat_total,
    'grand_total', v_calc_grand_total,
    'amount_paid', v_calc_amount_paid,
    'change_amount', v_calc_change,
    'remaining_debt', v_remaining_debt,
    'items', v_authoritative_items,
    'message', 'Venda autoritativa e inventário processados com sucesso no PostgreSQL.'
  );

  -- Armazenar Chave de Idempotência Persistente
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    INSERT INTO public.idempotency_keys (
      key, tenant_id, resource_type, resource_id, response_payload, created_at
    ) VALUES (
      p_idempotency_key, v_tenant_id, 'SALE', p_sale_id, v_final_response, NOW()
    ) ON CONFLICT (key) DO NOTHING;
  END IF;

  RETURN v_final_response;
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
  -- SEGURANÇA ESTATUTÁRIA: Determinar e validar autoritativamente o tenant da sessão.
  -- NUNCA aceitar chamadas anónimas/não autenticadas que passem p_tenant_id arbitrário.
  IF auth.uid() IS NOT NULL THEN
    v_tenant_id := public.get_my_company_id();
    IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Utilizador autenticado sem empresa/tenant associado.');
    END IF;
    IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Violação de segurança: Tentativa de operação em tenant diferente do autorizado.');
    END IF;
  ELSIF current_user IN ('service_role', 'postgres', 'supabase_admin') 
     OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role' THEN
    v_tenant_id := p_tenant_id;
    IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Identificador de tenant não fornecido pela chamada autorizada de backend.');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado: Operação atómica requer utilizador autenticado ou token service_role.');
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
  -- SEGURANÇA ESTATUTÁRIA: Determinar e validar autoritativamente o tenant da sessão.
  -- NUNCA aceitar chamadas anónimas/não autenticadas que passem p_tenant_id arbitrário.
  IF auth.uid() IS NOT NULL THEN
    v_tenant_id := public.get_my_company_id();
    IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Utilizador autenticado sem empresa/tenant associado.');
    END IF;
    IF p_tenant_id IS NOT NULL AND p_tenant_id <> '' AND p_tenant_id <> v_tenant_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Violação de segurança: Tentativa de operação em tenant diferente do autorizado.');
    END IF;
  ELSIF current_user IN ('service_role', 'postgres', 'supabase_admin') 
     OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role' THEN
    v_tenant_id := p_tenant_id;
    IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Identificador de tenant não fornecido pela chamada autorizada de backend.');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado: Operação atómica requer utilizador autenticado ou token service_role.');
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
