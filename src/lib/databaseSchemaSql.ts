/**
 * @file src/lib/databaseSchemaSql.ts
 * Definições SQL DDL completas para o banco de dados PostgreSQL / Supabase,
 * alinhadas rigorosamente com a interface TypeScript 'Product' (src/types.ts),
 * permissões e políticas de segurança RLS (Row Level Security).
 */

export const PRODUCTS_SQL_SCHEMA = `-- ==============================================================================
-- 1. Habilitar extensões UUID
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. Tabela Principal de Produtos (public.products)
-- Estrutura exata baseada na interface TypeScript 'Product' (src/types.ts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  company_id TEXT,
  owner_id TEXT,
  created_by TEXT,
  name TEXT NOT NULL,
  code TEXT,
  barcode TEXT,
  category TEXT NOT NULL DEFAULT 'Geral',
  supplier TEXT,
  supplier_id TEXT,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  cost NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  min_stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
  expiry_date TEXT,
  image TEXT,
  image_url TEXT,
  emoji TEXT,
  promotion TEXT,
  is_favorite BOOLEAN DEFAULT false,
  brand TEXT,
  weight_based BOOLEAN DEFAULT false,
  unit TEXT NOT NULL DEFAULT 'un',
  branch_stocks JSONB DEFAULT '{}'::jsonb,
  batches JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. Tabela Compatível em Português (public.produtos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.produtos (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  company_id TEXT,
  owner_id TEXT,
  created_by TEXT,
  name TEXT NOT NULL,
  code TEXT,
  barcode TEXT,
  category TEXT NOT NULL DEFAULT 'Geral',
  category_id TEXT,
  supplier TEXT,
  supplier_id TEXT,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  cost NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  min_stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
  expiry_date TEXT,
  image TEXT,
  image_url TEXT,
  emoji TEXT,
  promotion TEXT,
  is_favorite BOOLEAN DEFAULT false,
  brand TEXT,
  weight_based BOOLEAN DEFAULT false,
  unit TEXT NOT NULL DEFAULT 'un',
  branch_stocks JSONB DEFAULT '{}'::jsonb,
  batches JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. Índices de Alta Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products (code);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode);
CREATE INDEX IF NOT EXISTS idx_produtos_tenant ON public.produtos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_active ON public.produtos (is_active);

-- ==============================================================================
-- 5. Políticas de Segurança (Row Level Security) e Concessão de Permissões
-- ==============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_products ON public.products;
CREATE POLICY allow_all_products ON public.products FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_produtos ON public.produtos;
CREATE POLICY allow_all_produtos ON public.produtos FOR ALL TO public USING (true) WITH CHECK (true);

GRANT ALL ON public.products TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.produtos TO postgres, authenticated, anon, service_role;

-- ==============================================================================
-- 6. View de Compatibilidade para variações de digitação (public.produts)
-- ==============================================================================
CREATE OR REPLACE VIEW public.produts AS SELECT * FROM public.products;
GRANT ALL ON public.produts TO postgres, authenticated, anon, service_role;

-- ==============================================================================
-- 7. Recarregar o cache de esquemas do PostgREST imediatamente
-- ==============================================================================
NOTIFY pgrst, 'reload schema';`;

export const SALES_SQL_SCHEMA = `-- ==============================================================================
-- 1. Habilitar extensões UUID se necessário
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Tabela Principal de Vendas (public.vendas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vendas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  idempotency_key TEXT,
  invoice_number TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT DEFAULT 'Consumidor Final',
  customer_nuit TEXT,
  customer_phone TEXT,
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
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendas_tenant ON public.vendas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_invoice ON public.vendas (tenant_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_vendas_created ON public.vendas (created_at);

-- ==============================================================================
-- 3. Tabela de Itens da Venda (public.venda_itens)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.venda_itens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 1.00,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venda_itens_sale ON public.venda_itens (sale_id);
CREATE INDEX IF NOT EXISTS idx_venda_itens_prod ON public.venda_itens (product_id);

-- ==============================================================================
-- 4. Movimentos de Stock (public.stock_movements)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  product_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'EXIT_SALE',
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  previous_stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  new_stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  cost_price NUMERIC(14,2) DEFAULT 0.00,
  reason TEXT,
  reference_id TEXT,
  user_id TEXT,
  user_name TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON public.stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON public.stock_movements (tenant_id);

-- ==============================================================================
-- 5. Movimentos de Caixa (public.caixa)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.caixa (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  cash_register_id TEXT,
  type TEXT NOT NULL DEFAULT 'INPUT',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  reason TEXT NOT NULL,
  responsible_user TEXT,
  reference_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caixa_tenant ON public.caixa (tenant_id);

-- ==============================================================================
-- 6. Logs de Auditoria (public.audit_logs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. Clientes e Dívidas (public.clientes e public.customer_debts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  name TEXT NOT NULL,
  nuit TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  credit_limit NUMERIC(14,2) DEFAULT 0.00,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  debt NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_spent NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  credit_blocked BOOLEAN NOT NULL DEFAULT false,
  preferred_payment_method TEXT,
  one_click_checkout_enabled BOOLEAN DEFAULT false,
  settlements JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7.1 Devoluções e Notas de Crédito (public.returns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.returns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  credit_note_number TEXT NOT NULL,
  sale_id TEXT,
  original_invoice_number TEXT NOT NULL,
  customer_name TEXT DEFAULT 'Consumidor Final',
  customer_nuit TEXT,
  reason TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_refund NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  refund_method TEXT NOT NULL DEFAULT 'CASH',
  operator_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_debts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  customer_id TEXT NOT NULL,
  sale_id TEXT,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  remaining_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- ==============================================================================
-- 8. Permissões e RLS para Todas as Tabelas de Vendas
-- ==============================================================================
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_vendas ON public.vendas;
CREATE POLICY allow_all_vendas ON public.vendas FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_venda_itens ON public.venda_itens;
CREATE POLICY allow_all_venda_itens ON public.venda_itens FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_stock_movements ON public.stock_movements;
CREATE POLICY allow_all_stock_movements ON public.stock_movements FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_caixa ON public.caixa;
CREATE POLICY allow_all_caixa ON public.caixa FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_audit_logs ON public.audit_logs;
CREATE POLICY allow_all_audit_logs ON public.audit_logs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_clientes ON public.clientes;
CREATE POLICY allow_all_clientes ON public.clientes FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_customer_debts ON public.customer_debts;
CREATE POLICY allow_all_customer_debts ON public.customer_debts FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_returns ON public.returns;
CREATE POLICY allow_all_returns ON public.returns FOR ALL TO public USING (true) WITH CHECK (true);

GRANT ALL ON public.vendas TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.venda_itens TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.stock_movements TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.caixa TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.audit_logs TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.clientes TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.customer_debts TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.returns TO postgres, authenticated, anon, service_role;

-- ==============================================================================
-- 9. FUNÇÃO ATÓMICA OFICIAL: public.process_sale_atomic
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_sale_atomic(
  p_sale_id TEXT,
  p_company_id TEXT,
  p_user_id TEXT,
  p_items JSONB,
  p_payment_method TEXT,
  p_total NUMERIC,
  p_idempotency_key TEXT DEFAULT NULL,
  p_invoice_number TEXT DEFAULT NULL,
  p_customer_id TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT 'Consumidor Final',
  p_customer_nuit TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT 'Operador',
  p_subtotal NUMERIC DEFAULT NULL,
  p_discount_total NUMERIC DEFAULT 0.00,
  p_vat_total NUMERIC DEFAULT 0.00,
  p_amount_paid NUMERIC DEFAULT NULL,
  p_change_amount NUMERIC DEFAULT 0.00,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id TEXT;
  v_invoice_number TEXT;
  v_subtotal NUMERIC;
  v_total NUMERIC;
  v_amount_paid NUMERIC;
  v_user_name TEXT;
  v_idempotency_key TEXT;
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
  v_existing_sale_id TEXT;
  v_existing_invoice_number TEXT;
  v_existing_total NUMERIC;
  v_prod_found BOOLEAN;
BEGIN
  -- 0. Determinar empresa/tenant
  v_tenant_id := COALESCE(NULLIF(p_company_id, ''), 'ost-tenant-001');

  -- 0.1 Normalização de campos derivados
  v_total := COALESCE(p_total, 0.00);
  v_subtotal := COALESCE(p_subtotal, v_total);
  v_amount_paid := COALESCE(p_amount_paid, v_total);
  v_invoice_number := COALESCE(NULLIF(p_invoice_number, ''), p_sale_id);
  v_user_name := COALESCE(NULLIF(p_user_name, ''), 'Operador');
  v_idempotency_key := COALESCE(NULLIF(p_idempotency_key, ''), p_sale_id);

  -- 0.2 Verificação de Idempotência
  SELECT id, invoice_number, grand_total INTO v_existing_sale_id, v_existing_invoice_number, v_existing_total
  FROM public.vendas 
  WHERE (tenant_id = v_tenant_id OR tenant_id = 'ost-tenant-001')
    AND (
      id = p_sale_id 
      OR (v_idempotency_key IS NOT NULL AND (id = v_idempotency_key OR idempotency_key = v_idempotency_key))
    )
  LIMIT 1;

  IF v_existing_sale_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'sale_id', v_existing_sale_id,
      'invoice_number', v_existing_invoice_number,
      'grand_total', v_existing_total,
      'idempotent', true,
      'message', 'Venda já processada anteriormente (idempotente). Nenhuma alteração efetuada.'
    );
  END IF;

  -- 0.3 Validação de itens
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A venda deve conter pelo menos um artigo.');
  END IF;

  -- 1. Inserir registo mestre de venda
  INSERT INTO public.vendas (
    id, tenant_id, idempotency_key, invoice_number, customer_id, customer_name, customer_nuit,
    seller_id, seller_name, operator_name, payment_method, payment_status,
    subtotal, discount_total, vat_total, grand_total, amount_paid, change_amount,
    total_amount, tax_amount, status, items, notes, timestamp, created_at, updated_at
  ) VALUES (
    p_sale_id, v_tenant_id, v_idempotency_key, v_invoice_number, p_customer_id, p_customer_name, p_customer_nuit,
    p_user_id, v_user_name, v_user_name, p_payment_method,
    CASE WHEN p_payment_method IN ('A Prazo / Dívida', 'Crédito', 'CREDITO', 'DEBT') THEN 'PENDING_DEBT' ELSE 'PAID' END,
    v_subtotal, p_discount_total, p_vat_total, v_total, v_amount_paid, p_change_amount,
    v_total, p_vat_total, 'COMPLETED', p_items, p_notes, NOW(), NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Processar itens da venda e abater stock atomicamente
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := COALESCE(v_item->>'productId', v_item->>'id');
    v_prod_name := COALESCE(v_item->>'productName', v_item->>'name', v_item->>'nome', 'Artigo');
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'quantidade')::NUMERIC, 1.00);
    v_unit_price := COALESCE((v_item->>'salePrice')::NUMERIC, (v_item->>'unitPrice')::NUMERIC, (v_item->>'price')::NUMERIC, 0.00);
    v_cost_price := COALESCE((v_item->>'costPrice')::NUMERIC, (v_item->>'cost')::NUMERIC, 0.00);
    v_total_item := COALESCE((v_item->>'totalPrice')::NUMERIC, (v_item->>'total')::NUMERIC, v_qty * v_unit_price);

    -- Inserir item detalhado da venda
    INSERT INTO public.venda_itens (
      id, tenant_id, sale_id, product_id, product_name,
      unit_price, quantity, cost_price, total_price, created_at
    ) VALUES (
      COALESCE(gen_random_uuid()::TEXT, p_sale_id || '-' || v_prod_id), v_tenant_id, p_sale_id, v_prod_id, v_prod_name,
      v_unit_price, v_qty, v_cost_price, v_total_item, NOW()
    );

    -- Localizar produto em public.produtos ou public.products
    v_prod_found := FALSE;
    v_curr_stock := 0.00;

    BEGIN
      SELECT stock, name INTO v_curr_stock, v_prod_name 
      FROM public.produtos 
      WHERE id = v_prod_id 
      LIMIT 1 
      FOR UPDATE;
      IF FOUND THEN
        v_prod_found := TRUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_prod_found := FALSE;
    END;

    IF NOT v_prod_found THEN
      BEGIN
        SELECT stock, name INTO v_curr_stock, v_prod_name 
        FROM public.products 
        WHERE id = v_prod_id 
        LIMIT 1 
        FOR UPDATE;
        IF FOUND THEN
          v_prod_found := TRUE;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_prod_found := FALSE;
      END;
    END IF;

    -- Calcular novo saldo de stock
    v_new_stock := GREATEST(0.00, COALESCE(v_curr_stock, 0.00) - v_qty);

    -- Abater stock nas duas tabelas para consistência plena
    UPDATE public.produtos 
    SET stock = v_new_stock, updated_at = NOW() 
    WHERE id = v_prod_id;

    UPDATE public.products 
    SET stock = v_new_stock, updated_at = NOW() 
    WHERE id = v_prod_id;

    -- Registar movimento no Kardex (stock_movements)
    INSERT INTO public.stock_movements (
      id, tenant_id, product_id, type, quantity,
      previous_stock, new_stock, cost_price, reason, reference_id, user_id, user_name, timestamp
    ) VALUES (
      COALESCE(gen_random_uuid()::TEXT, p_sale_id || '-mov-' || v_prod_id), v_tenant_id, v_prod_id, 'EXIT_SALE', v_qty,
      COALESCE(v_curr_stock, 0.00), v_new_stock, v_cost_price, 'Venda ' || v_invoice_number, p_sale_id, p_user_id, v_user_name, NOW()
    );
  END LOOP;

  -- 3. Gestão de Dívida se venda a crédito/prazo
  v_is_credit := p_payment_method IN ('A Prazo / Dívida', 'Crédito', 'CREDITO', 'DEBT');
  IF v_is_credit AND p_customer_id IS NOT NULL AND p_customer_id <> '' THEN
    v_remaining_debt := GREATEST(0.00, v_total - v_amount_paid);
    
    INSERT INTO public.customer_debts (
      id, tenant_id, customer_id, sale_id, total_amount, paid_amount,
      remaining_balance, due_date, status, created_at
    ) VALUES (
      COALESCE(gen_random_uuid()::TEXT, p_sale_id || '-debt'), v_tenant_id, p_customer_id, p_sale_id, v_total, v_amount_paid,
      v_remaining_debt, NOW() + INTERVAL '30 days',
      CASE WHEN v_remaining_debt <= 0 THEN 'SETTLED' ELSE 'PENDING' END,
      NOW()
    );

    UPDATE public.clientes 
    SET balance = balance + v_remaining_debt, updated_at = NOW()
    WHERE id = p_customer_id;
  END IF;

  -- 4. Registar entrada de caixa se pago em dinheiro
  IF (UPPER(p_payment_method) LIKE '%DINHEIRO%' OR UPPER(p_payment_method) LIKE '%CASH%' OR UPPER(p_payment_method) LIKE '%NUMER%') AND v_amount_paid > 0 THEN
    INSERT INTO public.caixa (
      id, tenant_id, type, amount, reason, responsible_user, reference_id, timestamp
    ) VALUES (
      COALESCE(gen_random_uuid()::TEXT, p_sale_id || '-cash'), v_tenant_id, 'INPUT', v_amount_paid, 'Recebimento Venda ' || v_invoice_number, v_user_name, p_sale_id, NOW()
    );
  END IF;

  -- 5. Registar log de auditoria
  INSERT INTO public.audit_logs (
    id, tenant_id, user_id, user_name, action, module, details, timestamp
  ) VALUES (
    COALESCE(gen_random_uuid()::TEXT, p_sale_id || '-audit'), v_tenant_id, p_user_id, v_user_name,
    'VENDA_CONCLUIDA', 'POS',
    'Venda ' || v_invoice_number || ' no valor de ' || v_total || ' MT concluída via ' || p_payment_method || '.',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'invoice_number', v_invoice_number,
    'grand_total', v_total,
    'message', 'Venda e movimentações processadas com sucesso.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Concessão de permissões de execução
GRANT EXECUTE ON FUNCTION public.process_sale_atomic TO postgres, authenticated, anon, service_role;

-- ==============================================================================
-- 9.1 FUNÇÃO ATÓMICA DE DEVOLUÇÃO: public.record_sale_return_atomic
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_sale_return_atomic(
  p_tenant_id TEXT,
  p_sale_id TEXT,
  p_original_invoice TEXT,
  p_credit_note_number TEXT,
  p_customer_name TEXT,
  p_customer_nuit TEXT,
  p_reason TEXT,
  p_returned_items JSONB,
  p_total_refund NUMERIC,
  p_refund_method TEXT,
  p_operator_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id TEXT;
  v_item JSONB;
  v_prod_id TEXT;
  v_qty NUMERIC;
  v_curr_stock NUMERIC;
  v_new_stock NUMERIC;
  v_price NUMERIC;
BEGIN
  v_tenant_id := COALESCE(NULLIF(p_tenant_id, ''), 'ost-tenant-001');

  -- 1. Registar a Nota de Crédito / Devolução
  INSERT INTO public.returns (
    id, tenant_id, credit_note_number, sale_id, original_invoice_number,
    customer_name, customer_nuit, reason, items, total_refund, refund_method, operator_name, created_at
  ) VALUES (
    gen_random_uuid()::TEXT, v_tenant_id, p_credit_note_number, p_sale_id, p_original_invoice,
    p_customer_name, p_customer_nuit, p_reason, p_returned_items, p_total_refund, p_refund_method, p_operator_name, NOW()
  );

  -- 2. Restaurar o stock de cada artigo devolvido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_returned_items)
  LOOP
    v_prod_id := COALESCE(v_item->>'productId', v_item->>'id');
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, 1.00);
    v_price := COALESCE((v_item->>'price')::NUMERIC, 0.00);

    SELECT stock INTO v_curr_stock FROM public.produtos WHERE id = v_prod_id LIMIT 1;
    IF v_curr_stock IS NULL THEN
      SELECT stock INTO v_curr_stock FROM public.products WHERE id = v_prod_id LIMIT 1;
    END IF;

    v_new_stock := COALESCE(v_curr_stock, 0.00) + v_qty;

    UPDATE public.produtos SET stock = v_new_stock, updated_at = NOW() WHERE id = v_prod_id;
    UPDATE public.products SET stock = v_new_stock, updated_at = NOW() WHERE id = v_prod_id;

    INSERT INTO public.stock_movements (
      id, tenant_id, product_id, type, quantity, previous_stock, new_stock,
      cost_price, reason, reference_id, user_name, timestamp
    ) VALUES (
      gen_random_uuid()::TEXT, v_tenant_id, v_prod_id, 'RETURN', v_qty,
      COALESCE(v_curr_stock, 0.00), v_new_stock, v_price, 'Devolução Ref ' || p_credit_note_number, p_sale_id, p_operator_name, NOW()
    );
  END LOOP;

  -- 3. Saída de caixa se reembolso efetuado em dinheiro
  IF p_refund_method = 'CASH' AND p_total_refund > 0 THEN
    INSERT INTO public.caixa (
      id, tenant_id, type, amount, reason, responsible_user, reference_id, timestamp
    ) VALUES (
      gen_random_uuid()::TEXT, v_tenant_id, 'DEVOLUTION', p_total_refund,
      'Reembolso Devolução NC ' || p_credit_note_number || ' (Fatura ' || p_original_invoice || ')',
      p_operator_name, p_sale_id, NOW()
    );
  END IF;

  -- 4. Atualizar o estado da venda se aplicável
  IF p_sale_id IS NOT NULL AND p_sale_id <> '' THEN
    UPDATE public.vendas SET status = 'REFUNDED', updated_at = NOW() WHERE id = p_sale_id;
  END IF;

  -- 5. Registar auditoria
  INSERT INTO public.audit_logs (
    id, tenant_id, user_name, action, module, details, timestamp
  ) VALUES (
    gen_random_uuid()::TEXT, v_tenant_id, p_operator_name, 'DEVOLUCAO_CONCLUIDA', 'POS',
    'Nota de Crédito ' || p_credit_note_number || ' emitida para fatura ' || p_original_invoice || ' no valor de ' || p_total_refund || ' MT.',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'credit_note_number', p_credit_note_number,
    'total_refund', p_total_refund
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sale_return_atomic TO postgres, authenticated, anon, service_role;

-- ==============================================================================
-- 10. Recarregar o cache do PostgREST imediatamente
-- ==============================================================================
NOTIFY pgrst, 'reload schema';`;

export const SETTINGS_SQL_SCHEMA = `-- ==============================================================================
-- DEFINIÇÕES DO SISTEMA E EMPRESA (public.settings e public.companies)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY DEFAULT ('comp_' || substr(uuid_generate_v4()::TEXT, 1, 8)),
  name TEXT NOT NULL DEFAULT 'OST Comércio Geral, Lda',
  owner_uid TEXT NOT NULL DEFAULT 'system',
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  currency TEXT DEFAULT 'MT',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'config',
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  company_name TEXT NOT NULL DEFAULT 'OST Comércio Geral, Lda',
  company_address TEXT DEFAULT '',
  company_nuit TEXT DEFAULT '',
  company_phone TEXT DEFAULT '',
  company_email TEXT DEFAULT '',
  receipt_footer_message TEXT DEFAULT '',
  enable_vat BOOLEAN DEFAULT true,
  vat_percentage NUMERIC(5,2) DEFAULT 16.00,
  currency TEXT NOT NULL DEFAULT 'MT',
  low_stock_threshold NUMERIC(14,2) DEFAULT 5.00,
  default_printer TEXT DEFAULT 'thermal_80mm',
  cloud_backup_enabled BOOLEAN DEFAULT true,
  backup_frequency TEXT DEFAULT 'daily',
  backup_time TEXT DEFAULT '18:00',
  logo_url TEXT DEFAULT '',
  theme TEXT DEFAULT 'laranja',
  smtp_host TEXT DEFAULT '',
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT DEFAULT '',
  smtp_password TEXT DEFAULT '',
  smtp_secure BOOLEAN DEFAULT false,
  smtp_enabled BOOLEAN DEFAULT true,
  smtp_sender_name TEXT DEFAULT '',
  smtp_from_email TEXT DEFAULT '',
  val_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_tenant ON public.settings (tenant_id);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_settings ON public.settings;
CREATE POLICY allow_all_settings ON public.settings FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_companies ON public.companies;
CREATE POLICY allow_all_companies ON public.companies FOR ALL TO public USING (true) WITH CHECK (true);
GRANT ALL ON public.settings TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.companies TO postgres, authenticated, anon, service_role;
NOTIFY pgrst, 'reload schema';`;

export const STAFF_SQL_SCHEMA = `-- ==============================================================================
-- COLABORADORES E PERFIS (public.colaboradores e public.profiles)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.colaboradores (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  auth_uid TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'VENDEDOR',
  contact TEXT DEFAULT '',
  salary NUMERIC(14,2) DEFAULT 0.00,
  admission_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  branch TEXT DEFAULT '',
  subscription_plan TEXT DEFAULT 'OURO',
  foto_perfil TEXT DEFAULT '',
  pin TEXT DEFAULT '',
  theme TEXT DEFAULT 'laranja',
  two_factor_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'ADMIN',
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colaboradores_tenant ON public.colaboradores (tenant_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_email ON public.colaboradores (email);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_colaboradores ON public.colaboradores;
CREATE POLICY allow_all_colaboradores ON public.colaboradores FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_profiles ON public.profiles;
CREATE POLICY allow_all_profiles ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);
GRANT ALL ON public.colaboradores TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.profiles TO postgres, authenticated, anon, service_role;
NOTIFY pgrst, 'reload schema';`;

export const CUSTOMERS_SQL_SCHEMA = `-- ==============================================================================
-- CLIENTES E CRÉDITO (public.clientes, public.customers e customer_debts)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.clientes (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  name TEXT NOT NULL,
  nuit TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  credit_limit NUMERIC(14,2) DEFAULT 0.00,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  debt NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_spent NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  credit_blocked BOOLEAN NOT NULL DEFAULT false,
  preferred_payment_method TEXT,
  one_click_checkout_enabled BOOLEAN DEFAULT false,
  settlements JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  name TEXT NOT NULL,
  nuit TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  credit_limit NUMERIC(14,2) DEFAULT 0.00,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  debt NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_spent NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  credit_blocked BOOLEAN NOT NULL DEFAULT false,
  preferred_payment_method TEXT,
  one_click_checkout_enabled BOOLEAN DEFAULT false,
  settlements JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_debts (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  customer_id TEXT NOT NULL,
  sale_id TEXT,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  remaining_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  debt_id TEXT,
  customer_id TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'CASH',
  receipt_number TEXT,
  operator_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON public.clientes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_phone ON public.clientes (phone);
CREATE INDEX IF NOT EXISTS idx_customer_debts_cust ON public.customer_debts (customer_id);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_clientes ON public.clientes;
CREATE POLICY allow_all_clientes ON public.clientes FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_customers ON public.customers;
CREATE POLICY allow_all_customers ON public.customers FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_customer_debts ON public.customer_debts;
CREATE POLICY allow_all_customer_debts ON public.customer_debts FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_debt_payments ON public.debt_payments;
CREATE POLICY allow_all_debt_payments ON public.debt_payments FOR ALL TO public USING (true) WITH CHECK (true);
GRANT ALL ON public.clientes TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.customers TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.customer_debts TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.debt_payments TO postgres, authenticated, anon, service_role;
NOTIFY pgrst, 'reload schema';`;

export const CAIXA_AUDIT_SQL_SCHEMA = `-- ==============================================================================
-- CAIXA, TURNOS, FECHAMENTOS E AUDITORIA (public.caixa, cash_closures, audit_logs)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.cash_closures (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  date TEXT NOT NULL,
  opening_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_sales NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_cash NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_mpesa NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_emola NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_card NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_credit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  total_expenses NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  expected_in_drawer NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  actual_in_drawer NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  difference NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  closed_by TEXT NOT NULL DEFAULT 'Operador',
  closed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  operator_id TEXT,
  operator_name TEXT NOT NULL,
  initial_cash NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  final_cash NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'ost-tenant-001',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  details TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Sistema',
  user_role TEXT DEFAULT 'ADMIN',
  ip_address TEXT,
  device TEXT
);

CREATE TABLE IF NOT EXISTS public.recovery_requests (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_tenant ON public.cash_closures (tenant_id);

ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_cash_closures ON public.cash_closures;
CREATE POLICY allow_all_cash_closures ON public.cash_closures FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_cash_shifts ON public.cash_shifts;
CREATE POLICY allow_all_cash_shifts ON public.cash_shifts FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_audit_logs ON public.audit_logs;
CREATE POLICY allow_all_audit_logs ON public.audit_logs FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_recovery_requests ON public.recovery_requests;
CREATE POLICY allow_all_recovery_requests ON public.recovery_requests FOR ALL TO public USING (true) WITH CHECK (true);
GRANT ALL ON public.cash_closures TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.cash_shifts TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.audit_logs TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.recovery_requests TO postgres, authenticated, anon, service_role;
NOTIFY pgrst, 'reload schema';`;

export const FULL_DATABASE_SCHEMA_SQL =
  SETTINGS_SQL_SCHEMA +
  "\n\n" +
  STAFF_SQL_SCHEMA +
  "\n\n" +
  CUSTOMERS_SQL_SCHEMA +
  "\n\n" +
  PRODUCTS_SQL_SCHEMA +
  "\n\n" +
  SALES_SQL_SCHEMA +
  "\n\n" +
  CAIXA_AUDIT_SQL_SCHEMA;
