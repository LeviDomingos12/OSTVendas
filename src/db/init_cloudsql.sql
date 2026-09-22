-- ==============================================================================
-- OST VENDAS ERP - Cloud SQL PostgreSQL Initialization Script
-- Target Database: ostvendas-db (europe-west2)
-- ==============================================================================

-- 1. Create Database & Dedicated Application User
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ostvendas_app') THEN
      CREATE ROLE ostvendas_app WITH LOGIN PASSWORD 'YOUR_SECURE_PASSWORD_HERE';
   END IF;
END
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE postgres TO ostvendas_app;
ALTER ROLE ostvendas_app SET client_encoding TO 'utf8';
ALTER ROLE ostvendas_app SET default_transaction_isolation TO 'read committed';
ALTER ROLE ostvendas_app SET timezone TO 'UTC';

-- 2. Companies / Multi-Tenant Table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_uid TEXT NOT NULL,
    tax_id TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    currency TEXT DEFAULT 'AOA',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 3. Categories & Suppliers
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    nif TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 4. Products & Stock Movements
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    barcode TEXT,
    category_id TEXT,
    category TEXT NOT NULL,
    price NUMERIC(14,2) NOT NULL,
    cost NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    stock NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    min_stock NUMERIC(14,2) DEFAULT 0.00,
    unit TEXT NOT NULL DEFAULT 'un',
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity NUMERIC(14,2) NOT NULL,
    previous_stock NUMERIC(14,2) NOT NULL,
    new_stock NUMERIC(14,2) NOT NULL,
    reason TEXT,
    document_ref TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_prod ON stock_movements(tenant_id, product_id);

-- 5. Customers & Debts
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    nif TEXT,
    credit_limit NUMERIC(14,2) DEFAULT 0.00,
    current_debt NUMERIC(14,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);

CREATE TABLE IF NOT EXISTS customer_debts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    sale_id TEXT,
    amount NUMERIC(14,2) NOT NULL,
    paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    remaining_amount NUMERIC(14,2) NOT NULL,
    due_date TIMESTAMP WITHOUT TIME ZONE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debt_payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    debt_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    payment_method TEXT NOT NULL,
    receipt_number TEXT,
    received_by TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 6. Sales & Relational Items
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    seller_id TEXT,
    seller_name TEXT,
    payment_method TEXT NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    discount_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    vat_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(14,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    items_json TEXT,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON sales(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    sale_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL,
    quantity NUMERIC(14,2) NOT NULL,
    discount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_tenant_sale ON sale_items(tenant_id, sale_id);

CREATE TABLE IF NOT EXISTS sale_payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    sale_id TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    received_amount NUMERIC(14,2),
    change_amount NUMERIC(14,2),
    transaction_ref TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 7. Cash Registers & Movements
CREATE TABLE IF NOT EXISTS cash_registers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    closing_balance NUMERIC(14,2),
    expected_balance NUMERIC(14,2),
    difference NUMERIC(14,2),
    status TEXT NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS cash_movements (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    cash_register_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 8. Audit Logs & System Settings
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Grant privileges to application user
GRANT ALL ON ALL TABLES IN SCHEMA public TO ostvendas_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ostvendas_app;
