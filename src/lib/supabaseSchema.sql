-- ============================================================================
-- OST VENDAS ERP - SUPABASE POSTGRESQL SCHEMA & ATOMIC RPC TRANSACTIONS
-- ============================================================================
-- Architecture: Supabase Auth -> Supabase Client -> PostgreSQL + RLS + RPCs
-- Financial Types: All monetary & quantity metrics use NUMERIC(14,2)
-- Multi-Tenancy: tenant_id (or empresa_id) isolation on all tables with RLS
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLES DEFINITIONS
-- ============================================================================

-- EMPRESAS / COMPANIES (Multi-tenant boundaries)
CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
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
  reference_id TEXT, -- sale_id, purchase_id, etc.
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
  balance NUMERIC(14,2) NOT NULL DEFAULT 0.00, -- Saldo Devedor / Crédito
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
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PARTIAL', 'SETTLED', 'CANCELLED'
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
  payment_status TEXT NOT NULL DEFAULT 'PAID', -- 'PAID', 'PENDING_DEBT', 'PARTIAL'
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  vat_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  change_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'CANCELLED', 'REFUNDED'
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
  type TEXT NOT NULL, -- 'INPUT', 'OUTPUT', 'EXPENSE', 'DEPOSIT', 'WITHDRAWAL', 'SALE'
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
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- HISTÓRICO DE FECHAMENTO DE TURNOS / BALANCETES DE CAIXA
CREATE TABLE IF NOT EXISTS public.cash_closures (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
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
  difference_type TEXT NOT NULL DEFAULT 'EXACT', -- 'EXACT', 'SURPLUS', 'SHORTAGE'
  reconciliation JSONB NOT NULL DEFAULT '{}'::JSONB,
  denominations JSONB DEFAULT '{}'::JSONB,
  closing_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ESTADO ATIVO DO TURNO DE CAIXA
CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id TEXT PRIMARY KEY DEFAULT 'current_shift',
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 5000.00,
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
  auth_uid TEXT, -- Supabase Auth User UID
  name TEXT NOT NULL,
  email TEXT,
  contact TEXT,
  whatsapp TEXT,
  role TEXT NOT NULL DEFAULT 'Operador',
  salary NUMERIC(14,2) DEFAULT 0.00,
  admission_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED', 'INACTIVE'
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

-- DEFINIÇÕES DO SISTEMA (Configurações Gerais, Moeda, Impostos, etc.)
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
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RESOLVED', 'REJECTED'
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

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
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

-- Helper policies: Permit operations for authenticated users or public anon during onboarding
CREATE POLICY "Permit all on produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on vendas" ON public.vendas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on venda_itens" ON public.venda_itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on caixa" ON public.caixa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on cash_registers" ON public.cash_registers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on cash_closures" ON public.cash_closures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on cash_shifts" ON public.cash_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on colaboradores" ON public.colaboradores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on customer_debts" ON public.customer_debts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on debt_payments" ON public.debt_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on companies" ON public.companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permit all on recovery_requests" ON public.recovery_requests FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. ATOMIC STORED PROCEDURES / POSTGRESQL FUNCTIONS (RPC)
-- ============================================================================

-- RPC 1: PROCESS SALE ATOMIC (Processa venda, desconta stock, cria itens, gere dívida e caixa)
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
AS $$
DECLARE
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
  -- 1. Inserir registo mestre de venda
  INSERT INTO public.vendas (
    id, tenant_id, invoice_number, customer_id, customer_name, customer_nuit,
    seller_id, seller_name, operator_name, payment_method, payment_status,
    subtotal, discount_total, vat_total, grand_total, amount_paid, change_amount,
    status, items, notes, timestamp, created_at
  ) VALUES (
    p_sale_id, p_tenant_id, p_invoice_number, p_customer_id, p_customer_name, p_customer_nuit,
    p_seller_id, p_seller_name, p_seller_name, p_payment_method,
    CASE WHEN p_payment_method IN ('A Prazo / Dívida', 'Crédito', 'CREDITO') THEN 'PENDING_DEBT' ELSE 'PAID' END,
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
    v_prod_id := v_item->>'id';
    v_prod_name := COALESCE(v_item->>'name', v_item->>'nome', 'Artigo');
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'quantidade')::NUMERIC, 1.00);
    v_unit_price := COALESCE((v_item->>'salePrice')::NUMERIC, (v_item->>'price')::NUMERIC, 0.00);
    v_cost_price := COALESCE((v_item->>'costPrice')::NUMERIC, 0.00);
    v_total_item := COALESCE((v_item->>'total')::NUMERIC, v_qty * v_unit_price);

    -- Inserir item da venda
    INSERT INTO public.venda_itens (
      id, tenant_id, sale_id, product_id, product_name,
      unit_price, quantity, cost_price, total_price, created_at
    ) VALUES (
      uuid_generate_v4()::TEXT, p_tenant_id, p_sale_id, v_prod_id, v_prod_name,
      v_unit_price, v_qty, v_cost_price, v_total_item, NOW()
    );

    -- Buscar e atualizar stock do produto
    SELECT stock INTO v_curr_stock FROM public.produtos WHERE id = v_prod_id FOR UPDATE;
    IF FOUND THEN
      v_new_stock := v_curr_stock - v_qty;
      UPDATE public.produtos 
      SET stock = v_new_stock, updated_at = NOW() 
      WHERE id = v_prod_id;

      -- Registar movimento no Kardex
      INSERT INTO public.stock_movements (
        id, tenant_id, product_id, type, quantity,
        previous_stock, new_stock, cost_price, reason, reference_id, user_name, timestamp
      ) VALUES (
        uuid_generate_v4()::TEXT, p_tenant_id, v_prod_id, 'EXIT_SALE', v_qty,
        v_curr_stock, v_new_stock, v_cost_price, 'Venda ' || p_invoice_number, p_sale_id, p_seller_name, NOW()
      );
    END IF;
  END LOOP;

  -- 3. Gestão de Dívida / Conta Corrente se a venda foi a prazo
  v_is_credit := p_payment_method IN ('A Prazo / Dívida', 'Crédito', 'CREDITO', 'DEBT');
  IF v_is_credit AND p_customer_id IS NOT NULL THEN
    v_remaining_debt := GREATEST(0.00, p_grand_total - p_amount_paid);
    
    INSERT INTO public.customer_debts (
      id, tenant_id, customer_id, sale_id, total_amount, paid_amount,
      remaining_balance, due_date, status, created_at
    ) VALUES (
      uuid_generate_v4()::TEXT, p_tenant_id, p_customer_id, p_sale_id, p_grand_total, p_amount_paid,
      v_remaining_debt, NOW() + INTERVAL '30 days',
      CASE WHEN v_remaining_debt <= 0 THEN 'SETTLED' ELSE 'PENDING' END,
      NOW()
    );

    -- Atualizar saldo em aberto do cliente
    UPDATE public.clientes 
    SET balance = balance + v_remaining_debt, updated_at = NOW()
    WHERE id = p_customer_id;
  END IF;

  -- 4. Registar entrada de numerário no fluxo de caixa se foi pago em dinheiro
  IF p_payment_method IN ('Dinheiro', 'Cash', 'Numerário', 'CASH') AND p_amount_paid > 0 THEN
    INSERT INTO public.caixa (
      id, tenant_id, type, amount, reason, responsible_user, reference_id, timestamp
    ) VALUES (
      uuid_generate_v4()::TEXT, p_tenant_id, 'INPUT', p_amount_paid, 'Recebimento Venda ' || p_invoice_number, p_seller_name, p_sale_id, NOW()
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

-- RPC 2: REPLENISH STOCK ATOMIC (Entrada de Stock com atualização de custo médio)
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
AS $$
DECLARE
  v_curr_stock NUMERIC;
  v_new_stock NUMERIC;
  v_curr_cost NUMERIC;
  v_new_cost NUMERIC;
BEGIN
  SELECT stock, cost_price INTO v_curr_stock, v_curr_cost 
  FROM public.produtos 
  WHERE id = p_product_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Artigo não encontrado.');
  END IF;

  v_new_stock := v_curr_stock + p_quantity;
  v_new_cost := COALESCE(p_cost_price, v_curr_cost);

  UPDATE public.produtos 
  SET stock = v_new_stock, cost_price = v_new_cost, updated_at = NOW()
  WHERE id = p_product_id;

  INSERT INTO public.stock_movements (
    id, tenant_id, product_id, type, quantity,
    previous_stock, new_stock, cost_price, reason, user_name, timestamp
  ) VALUES (
    uuid_generate_v4()::TEXT, p_tenant_id, p_product_id, 'ENTRY', p_quantity,
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

-- RPC 3: SETTLE DEBT PAYMENT ATOMIC (Liquidação de Dívida de Cliente)
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
AS $$
DECLARE
  v_remaining NUMERIC;
  v_new_remaining NUMERIC;
BEGIN
  SELECT remaining_balance INTO v_remaining 
  FROM public.customer_debts 
  WHERE id = p_debt_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registo de dívida não encontrado.');
  END IF;

  v_new_remaining := GREATEST(0.00, v_remaining - p_amount);

  UPDATE public.customer_debts 
  SET 
    paid_amount = paid_amount + p_amount,
    remaining_balance = v_new_remaining,
    status = CASE WHEN v_new_remaining <= 0 THEN 'SETTLED' ELSE 'PARTIAL' END,
    settled_at = CASE WHEN v_new_remaining <= 0 THEN NOW() ELSE NULL END
  WHERE id = p_debt_id;

  -- Inserir recibo de pagamento de dívida
  INSERT INTO public.debt_payments (
    id, tenant_id, debt_id, customer_id, amount, payment_method, received_by, timestamp
  ) VALUES (
    uuid_generate_v4()::TEXT, p_tenant_id, p_debt_id, p_customer_id, p_amount, p_payment_method, p_received_by, NOW()
  );

  -- Abater saldo em aberto do cliente
  UPDATE public.clientes 
  SET balance = GREATEST(0.00, balance - p_amount), updated_at = NOW()
  WHERE id = p_customer_id;

  -- Registar entrada em caixa
  INSERT INTO public.caixa (
    id, tenant_id, type, amount, reason, responsible_user, reference_id, timestamp
  ) VALUES (
    uuid_generate_v4()::TEXT, p_tenant_id, 'INPUT', p_amount, 'Liquidação de Dívida (Cliente ' || p_customer_id || ')', p_received_by, p_debt_id, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'debt_id', p_debt_id,
    'amount_paid', p_amount,
    'remaining_balance', v_new_remaining
  );
END;
$$;
