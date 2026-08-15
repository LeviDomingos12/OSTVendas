import { pgTable, text, timestamp, numeric, boolean, integer } from "drizzle-orm/pg-core";

// --- Companies & Multi-Tenant Boundaries ---
export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerUid: text("owner_uid").notNull(), // Firebase UID of account owner
  taxId: text("tax_id"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  currency: text("currency").default("AOA"),
  createdAt: timestamp("created_at").defaultNow()
});

// --- Categories & Suppliers ---
export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow()
});

export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  nif: text("nif"),
  createdAt: timestamp("created_at").defaultNow()
});

// --- Products & Inventory ---
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(), // Multi-tenant isolation
  name: text("name").notNull(),
  code: text("code"),
  barcode: text("barcode"),
  categoryId: text("category_id"),
  category: text("category").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  cost: numeric("cost", { precision: 14, scale: 2 }).notNull().default("0.00"),
  stock: numeric("stock", { precision: 14, scale: 2 }).notNull().default("0.00"),
  minStock: numeric("min_stock", { precision: 14, scale: 2 }).default("0.00"),
  unit: text("unit").notNull().default("un"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  productId: text("product_id").notNull(),
  type: text("type").notNull(), // 'ENTRY', 'EXIT_SALE', 'LOSS', 'ADJUSTMENT', 'TRANSFER'
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
  previousStock: numeric("previous_stock", { precision: 14, scale: 2 }).notNull(),
  newStock: numeric("new_stock", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason"),
  referenceId: text("reference_id"), // saleId, purchaseId, etc.
  userId: text("user_id"),
  timestamp: timestamp("timestamp").defaultNow()
});

// --- Customers & Credit / Debts ---
export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  nif: text("nif"),
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).default("0.00"),
  currentDebt: numeric("current_debt", { precision: 14, scale: 2 }).default("0.00"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow()
});

export const customerDebts = pgTable("customer_debts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  customerId: text("customer_id").notNull(),
  saleId: text("sale_id"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  remainingBalance: numeric("remaining_balance", { precision: 14, scale: 2 }).notNull(),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("PENDING"), // 'PENDING', 'PARTIAL', 'SETTLED', 'CANCELLED'
  createdAt: timestamp("created_at").defaultNow(),
  settledAt: timestamp("settled_at")
});

export const debtPayments = pgTable("debt_payments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  debtId: text("debt_id").notNull(),
  customerId: text("customer_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  receivedBy: text("received_by"),
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow()
});

// --- Sales, Items & Payments ---
export const sales = pgTable("sales", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: text("customer_id"),
  customerName: text("customer_name"),
  sellerId: text("seller_id"),
  sellerName: text("seller_name"),
  paymentMethod: text("payment_method").notNull(),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
  vatTotal: numeric("vat_total", { precision: 14, scale: 2 }).notNull().default("0.00"),
  grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull().default("COMPLETED"), // 'COMPLETED', 'CANCELLED', 'REFUNDED'
  itemsJson: text("items_json"), // Backward compatibility cached JSON
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  timestamp: timestamp("timestamp").defaultNow()
});

export const saleItems = pgTable("sale_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  saleId: text("sale_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const salePayments = pgTable("sale_payments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  saleId: text("sale_id").notNull(),
  paymentMethod: text("payment_method").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  cashRegisterId: text("cash_register_id"),
  timestamp: timestamp("timestamp").defaultNow()
});

// Backward compatibility alias for transactions
export const transactions = sales;

// --- Cash Register & Cash Movements ---
export const cashRegisters = pgTable("cash_registers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  openedBy: text("opened_by").notNull(),
  openerName: text("opener_name"),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull(),
  closingBalance: numeric("closing_balance", { precision: 14, scale: 2 }),
  actualClosingBalance: numeric("actual_closing_balance", { precision: 14, scale: 2 }),
  difference: numeric("difference", { precision: 14, scale: 2 }).default("0.00"),
  status: text("status").notNull().default("OPEN"), // 'OPEN', 'CLOSED'
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at")
});

export const cashMovements = pgTable("cash_movements", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  cashRegisterId: text("cash_register_id").notNull(),
  type: text("type").notNull(), // 'SALE_IN', 'PAYMENT_IN', 'EXPENSE_OUT', 'MANUAL_ENTRY', 'MANUAL_EXIT'
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  referenceId: text("reference_id"),
  performedBy: text("performed_by"),
  timestamp: timestamp("timestamp").defaultNow()
});

// --- Audit Logs ---
export const auditlogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  userId: text("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),
  module: text("module").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow()
});

// --- Settings ---
export const settings = pgTable("settings", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  valJson: text("val_json").notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
});
