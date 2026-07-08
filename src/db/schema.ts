import { pgTable, text, timestamp, doublePrecision, boolean } from "drizzle-orm/pg-core";

// Define the 'products' table for Google Cloud SQL relational storage
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  category: text("category").notNull(),
  price: doublePrecision("price").notNull(),
  cost: doublePrecision("cost").notNull(),
  stock: doublePrecision("stock").notNull(),
  unit: text("unit").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

// Define the 'customers' table
export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow()
});

// Define the 'transactions' table
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: text("customer_id"),
  customerName: text("customer_name"),
  paymentMethod: text("payment_method").notNull(),
  subtotal: doublePrecision("subtotal").notNull(),
  discountTotal: doublePrecision("discount_total").notNull(),
  vatTotal: doublePrecision("vat_total").notNull(),
  grandTotal: doublePrecision("grand_total").notNull(),
  itemsJson: text("items_json").notNull(), // Raw JSON string representing items bought
  timestamp: timestamp("timestamp").defaultNow()
});

// Define the 'auditlogs' table
export const auditlogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),
  module: text("module").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp").defaultNow()
});

// Define the 'settings' table
export const settings = pgTable("settings", {
  id: text("id").primaryKey(), // Usually "config"
  valJson: text("val_json").notNull() // Raw JSON string representing configuration
});
