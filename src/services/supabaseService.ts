/**
 * @file supabaseService.ts
 * Driver Oficial de Backend, Diagnósticos, Autenticação e Persistência Relacional (Supabase PostgreSQL).
 * 
 * Arquitetura:
 * OST Vendas Frontend -> Supabase Auth -> Supabase Client -> PostgreSQL + RLS + RPCs -> Supabase Storage
 */

import { createClient, SupabaseClient, Session, User, RealtimeChannel } from "@supabase/supabase-js";
import { supabase as singletonClient } from "../lib/supabase";
import { 
  Product, 
  Customer, 
  Transaction, 
  CashFlowEntry, 
  Employee, 
  AuditLog, 
  SystemSettings,
  UserRole
} from "../types";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
  autoSync: boolean;
  tenantId: string;
}

export interface LatencyResult {
  latencyMs: number;
  status: "optimal" | "good" | "slow" | "error";
  message: string;
  timestamp: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  user: User | null;
  session: Session | null;
  expiresAt: string | null;
  email: string | null;
  role: string | null;
  message: string;
}

export interface CloudBackupItem {
  name: string;
  fullPath: string;
  size: number;
  updated: string;
  downloadUrl: string;
}

const STORAGE_KEY_CONFIG = "ostvendas_supabase_config";
const DEFAULT_TENANT_ID = "ost-tenant-001";

/**
 * Obtém a configuração ativa do Supabase (lê de variáveis de ambiente ou do armazenamento local)
 */
export function getSupabaseConfig(): SupabaseConfig {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = (metaEnv.VITE_SUPABASE_URL as string) || "";
  const envKey = (metaEnv.VITE_SUPABASE_ANON_KEY as string) || "";

  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        url: parsed.url || envUrl,
        anonKey: parsed.anonKey || envKey,
        enabled: parsed.enabled ?? Boolean(envUrl && envKey),
        autoSync: parsed.autoSync ?? true,
        tenantId: parsed.tenantId || DEFAULT_TENANT_ID
      };
    }
  } catch (e) {
    console.error("Erro ao ler configuração do Supabase", e);
  }

  return {
    url: envUrl,
    anonKey: envKey,
    enabled: Boolean(envUrl && envKey),
    autoSync: true,
    tenantId: DEFAULT_TENANT_ID
  };
}

/**
 * Salva a configuração do Supabase
 */
export function saveSupabaseConfig(config: Partial<SupabaseConfig>): void {
  const current = getSupabaseConfig();
  const updated: SupabaseConfig = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
  cachedClient = null;
}

let cachedClient: SupabaseClient | null = null;

/**
 * Obtém ou instancia o cliente Supabase de forma lazy
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || !config.enabled) {
    return singletonClient;
  }

  if (!cachedClient) {
    try {
      cachedClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (err) {
      console.warn("Falha ao inicializar cliente Supabase personalizado, usando singleton:", err);
      return singletonClient;
    }
  }

  return cachedClient || singletonClient;
}

/**
 * Mede a latência real da rede com o Supabase (Ping em milissegundos)
 */
export async function measureSupabaseLatency(customUrl?: string, customKey?: string): Promise<LatencyResult> {
  const url = customUrl || getSupabaseConfig().url;
  const key = customKey || getSupabaseConfig().anonKey;

  if (!url || !key) {
    return {
      latencyMs: 0,
      status: "error",
      message: "Credenciais do servidor de dados não configuradas.",
      timestamp: new Date().toISOString()
    };
  }

  const startTime = performance.now();
  try {
    const client = createClient(url, key);
    const { error } = await client.from("produtos").select("id").limit(1);
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    if (error && error.code !== "PGRST116" && error.code !== "42P01") {
      return {
        latencyMs,
        status: "error",
        message: `Falha na resposta: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }

    let status: "optimal" | "good" | "slow" = "optimal";
    let message = `Excelente conexão com o Servidor Backend (${latencyMs}ms)`;
    if (latencyMs > 350) {
      status = "slow";
      message = `Latência elevada (${latencyMs}ms) - Verifique a sua ligação de rede.`;
    } else if (latencyMs > 150) {
      status = "good";
      message = `Boa conexão estável com o Servidor Backend (${latencyMs}ms)`;
    }

    return {
      latencyMs,
      status,
      message,
      timestamp: new Date().toISOString()
    };
  } catch (err: any) {
    const endTime = performance.now();
    return {
      latencyMs: Math.round(endTime - startTime),
      status: "error",
      message: err?.message || "Sem resposta do servidor remoto.",
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Validação em tempo real da sessão do utilizador com o Supabase Auth
 */
export async function validateSupabaseSession(): Promise<SessionValidationResult> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      isValid: false,
      user: null,
      session: null,
      expiresAt: null,
      email: null,
      role: null,
      message: "Servidor de dados inativo ou não configurado."
    };
  }

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      return {
        isValid: false,
        user: null,
        session: null,
        expiresAt: null,
        email: null,
        role: null,
        message: `Erro na sessão: ${error.message}`
      };
    }

    if (!session || !session.user) {
      return {
        isValid: false,
        user: null,
        session: null,
        expiresAt: null,
        email: null,
        role: null,
        message: "Nenhuma sessão ativa encontrada."
      };
    }

    return {
      isValid: true,
      user: session.user,
      session,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      email: session.user.email || null,
      role: session.user.role || (session.user.user_metadata as any)?.role || "Utilizador Autenticado",
      message: `Sessão ativa e válida para ${session.user.email || "Utilizador"}`
    };
  } catch (err: any) {
    return {
      isValid: false,
      user: null,
      session: null,
      expiresAt: null,
      email: null,
      role: null,
      message: err?.message || "Falha ao validar sessão."
    };
  }
}

/**
 * Testa a conexão com o Supabase
 */
export async function testSupabaseConnection(url?: string, key?: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const targetUrl = url || getSupabaseConfig().url;
  const targetKey = key || getSupabaseConfig().anonKey;

  if (!targetUrl || !targetKey) {
    return { success: false, message: "URL ou Chave do Supabase não fornecidas." };
  }

  try {
    const latency = await measureSupabaseLatency(targetUrl, targetKey);
    if (latency.status === "error") {
      return { success: false, message: latency.message, latencyMs: latency.latencyMs };
    }
    return { 
      success: true, 
      message: `Conexão estabelecida com sucesso! (${latency.latencyMs}ms)`, 
      latencyMs: latency.latencyMs 
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Erro desconhecido ao conectar ao Supabase." };
  }
}

/**
 * ============================================================================
 * SERVIÇO PRINCIPAL SUPABASE (CRUD, TRANSAÇÕES ATÓMICAS, AUTH & STORAGE)
 * ============================================================================
 */
export const SupabaseSyncService = {

  // --- AUTENTICAÇÃO SUPABASE ---
  async signUpWithEmail(email: string, password: string, name: string, branch: string, role: string = "Administrador", plan: string = "OURO") {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase não configurado.");

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          branch,
          role,
          subscription_plan: plan
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      // Cria registo correspondente na tabela colaboradores
      const tenantId = getSupabaseConfig().tenantId;
      const empRecord = {
        id: `emp_${data.user.id.slice(0, 8)}`,
        tenant_id: tenantId,
        auth_uid: data.user.id,
        name,
        email,
        role,
        status: "ACTIVE",
        branch,
        subscription_plan: plan,
        created_at: new Date().toISOString()
      };
      await client.from("colaboradores").upsert(empRecord, { onConflict: "email" });
    }

    return data;
  },

  async signInWithEmail(email: string, password: string) {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase não configurado.");

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  },

  async signInWithGoogle() {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase não configurado.");

    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    return data;
  },

  async recoverPassword(email: string) {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase não configurado.");

    const { data, error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const client = getSupabaseClient();
    if (!client) return { unsubscribe: () => {} };

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return {
      unsubscribe: () => subscription.unsubscribe()
    };
  },

  // --- PRODUTOS / CATÁLOGO & INVENTÁRIO ---
  async fetchProducts(): Promise<Product[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("produtos")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        code: row.code || row.id,
        category: row.category || "Geral",
        costPrice: Number(row.cost_price || 0),
        salePrice: Number(row.sale_price || 0),
        stock: Number(row.stock || 0),
        minStock: Number(row.min_stock || 0),
        vatRate: Number(row.vat_rate || 16),
        unit: row.unit || "un",
        barcode: row.barcode || row.code || "",
        supplier: row.supplier || "",
        imageUrl: row.image_url || ""
      }));
    } catch {
      return [];
    }
  },

  async saveProduct(product: Product): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: product.id,
        tenant_id: tenantId,
        name: product.name,
        code: product.code || product.id,
        barcode: product.barcode || product.code || "",
        category: product.category || "Geral",
        supplier: product.supplier || "",
        cost_price: product.costPrice || 0,
        sale_price: product.salePrice || 0,
        stock: product.stock || 0,
        min_stock: product.minStock || 0,
        vat_rate: product.vatRate ?? 16,
        unit: (product as any).unit || "un",
        image_url: product.image || (product as any).imageUrl || "",
        is_active: true,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("produtos").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async syncProducts(products: Product[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || products.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = products.map((p) => ({
        id: p.id,
        tenant_id: tenantId,
        name: p.name,
        code: p.code || p.id,
        barcode: p.barcode || p.code || "",
        category: p.category || "Geral",
        supplier: p.supplier || "",
        cost_price: p.costPrice || 0,
        sale_price: p.salePrice || 0,
        stock: p.stock || 0,
        min_stock: p.minStock || 0,
        vat_rate: p.vatRate ?? 16,
        unit: (p as any).unit || "un",
        image_url: p.image || (p as any).imageUrl || "",
        is_active: true,
        updated_at: new Date().toISOString()
      }));

      const { error } = await client.from("produtos").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async deleteProduct(productId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client.from("produtos").update({ is_active: false }).eq("id", productId);
      return !error;
    } catch {
      return false;
    }
  },

  // --- REPLENISH STOCK ATOMIC (RPC) ---
  async replenishStockAtomic(params: {
    productId: string;
    quantity: number;
    costPrice?: number;
    reason?: string;
    userName?: string;
  }): Promise<{ success: boolean; error?: string; newStock?: number }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: "Supabase não conectado." };

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const { data, error } = await client.rpc("replenish_stock_atomic", {
        p_tenant_id: tenantId,
        p_product_id: params.productId,
        p_quantity: params.quantity,
        p_cost_price: params.costPrice || null,
        p_reason: params.reason || "Reabastecimento de Stock",
        p_user_name: params.userName || "Sistema"
      });

      if (error) return { success: false, error: error.message };
      return data || { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // --- CLIENTES ---
  async fetchCustomers(): Promise<Customer[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("clientes")
        .select("*")
        .order("name", { ascending: true });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        nuit: row.nuit || "",
        email: row.email || "",
        phone: row.phone || "",
        address: row.address || "",
        totalSpent: Number(row.total_spent || 0),
        purchaseCount: Number(row.purchase_count || 0),
        debt: Number(row.debt || row.balance || 0),
        loyaltyPoints: Number(row.loyalty_points || 0),
        notes: row.notes || ""
      })) as Customer[];
    } catch {
      return [];
    }
  },

  async saveCustomer(customer: Customer): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: customer.id,
        tenant_id: tenantId,
        name: customer.name,
        nuit: customer.nuit || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        debt: customer.debt || (customer as any).balance || 0,
        balance: (customer as any).balance || customer.debt || 0,
        total_spent: customer.totalSpent || 0,
        purchase_count: customer.purchaseCount || 0,
        loyalty_points: customer.loyaltyPoints || 0,
        credit_limit: (customer as any).creditLimit || 0,
        notes: (customer as any).notes || "",
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("clientes").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async syncCustomers(customers: Customer[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || customers.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = customers.map((c) => ({
        id: c.id,
        tenant_id: tenantId,
        name: c.name,
        nuit: c.nuit || "",
        email: c.email || "",
        phone: c.phone || "",
        address: c.address || "",
        debt: c.debt || (c as any).balance || 0,
        balance: (c as any).balance || c.debt || 0,
        total_spent: c.totalSpent || 0,
        purchase_count: c.purchaseCount || 0,
        loyalty_points: c.loyaltyPoints || 0,
        credit_limit: (c as any).creditLimit || 0,
        notes: (c as any).notes || "",
        updated_at: new Date().toISOString()
      }));

      const { error } = await client.from("clientes").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async deleteCustomer(customerId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client.from("clientes").delete().eq("id", customerId);
      return !error;
    } catch {
      return false;
    }
  },

  // --- VENDAS / TRANSAÇÕES ---
  async fetchTransactions(): Promise<Transaction[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("vendas")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_number || row.id,
        customerName: row.customer_name || "Consumidor Final",
        customerId: row.customer_id || undefined,
        grandTotal: Number(row.grand_total || 0),
        subtotal: Number(row.subtotal || row.grand_total || 0),
        vatTotal: Number(row.vat_total || 0),
        discountTotal: Number(row.discount_total || 0),
        paymentMethod: row.payment_method,
        cashierName: row.operator_name || row.seller_name || "",
        items: Array.isArray(row.items) ? row.items : [],
        timestamp: row.timestamp || row.created_at || new Date().toISOString(),
        paymentStatus: row.payment_status || "PAID"
      }));
    } catch {
      return [];
    }
  },

  // --- PROCESS SALE ATOMIC (RPC) ---
  async processSaleAtomic(params: {
    saleId: string;
    invoiceNumber: string;
    customerId?: string;
    customerName?: string;
    customerNuit?: string;
    sellerId?: string;
    sellerName?: string;
    paymentMethod: string;
    subtotal: number;
    discountTotal: number;
    vatTotal: number;
    grandTotal: number;
    amountPaid: number;
    changeAmount: number;
    items: any[];
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: "Supabase não conectado." };

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const { data, error } = await client.rpc("process_sale_atomic", {
        p_tenant_id: tenantId,
        p_sale_id: params.saleId,
        p_invoice_number: params.invoiceNumber,
        p_customer_id: params.customerId || null,
        p_customer_name: params.customerName || "Consumidor Final",
        p_customer_nuit: params.customerNuit || null,
        p_seller_id: params.sellerId || null,
        p_seller_name: params.sellerName || "Operador",
        p_payment_method: params.paymentMethod,
        p_subtotal: params.subtotal,
        p_discount_total: params.discountTotal,
        p_vat_total: params.vatTotal,
        p_grand_total: params.grandTotal,
        p_amount_paid: params.amountPaid,
        p_change_amount: params.changeAmount,
        p_items: params.items,
        p_notes: params.notes || null
      });

      if (error) {
        // Fallback: direct table insert if RPC function isn't yet deployed
        console.warn("RPC process_sale_atomic falhou, executando upsert direto:", error.message);
        return await this.saveTransactionDirect(params);
      }

      return data || { success: true };
    } catch (err: any) {
      return await this.saveTransactionDirect(params);
    }
  },

  async saveTransactionDirect(params: any): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: "Supabase não configurado." };

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: params.saleId,
        tenant_id: tenantId,
        invoice_number: params.invoiceNumber || params.saleId,
        customer_name: params.customerName || "Consumidor Final",
        customer_id: params.customerId || null,
        grand_total: params.grandTotal || 0,
        subtotal: params.subtotal || params.grandTotal || 0,
        vat_total: params.vatTotal || 0,
        discount_total: params.discountTotal || 0,
        payment_method: params.paymentMethod,
        operator_name: params.sellerName || "",
        items: params.items || [],
        timestamp: new Date().toISOString()
      };

      const { error } = await client.from("vendas").upsert(record, { onConflict: "id" });
      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async syncTransactions(transactions: Transaction[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || transactions.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = transactions.map((t) => ({
        id: t.id,
        tenant_id: tenantId,
        invoice_number: t.invoiceNumber || t.id,
        customer_name: t.customerName || "Consumidor Final",
        customer_id: t.customerId || null,
        grand_total: t.grandTotal || t.subtotal || 0,
        subtotal: t.subtotal || t.grandTotal || 0,
        vat_total: t.vatTotal || 0,
        discount_total: t.discountTotal || 0,
        payment_method: t.paymentMethod,
        operator_name: t.cashierName || "",
        items: t.items || [],
        created_at: t.timestamp || new Date().toISOString(),
        timestamp: t.timestamp || new Date().toISOString()
      }));

      const { error } = await client.from("vendas").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  // --- FLUXO DE CAIXA ---
  async fetchCashFlow(): Promise<CashFlowEntry[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("caixa")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        type: row.type || "INPUT",
        amount: Number(row.amount || 0),
        reason: row.reason || "",
        responsibleUser: row.responsible_user || "",
        timestamp: row.timestamp || new Date().toISOString()
      }));
    } catch {
      return [];
    }
  },

  async saveCashFlowEntry(entry: CashFlowEntry): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: entry.id,
        tenant_id: tenantId,
        type: entry.type,
        amount: entry.amount,
        reason: entry.reason || "",
        responsible_user: entry.responsibleUser || "",
        timestamp: entry.timestamp || new Date().toISOString()
      };

      const { error } = await client.from("caixa").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async syncCashFlow(movements: CashFlowEntry[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || movements.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = movements.map((m) => ({
        id: m.id,
        tenant_id: tenantId,
        type: m.type,
        amount: m.amount,
        reason: m.reason || "",
        responsible_user: m.responsibleUser || "",
        timestamp: m.timestamp || new Date().toISOString()
      }));

      const { error } = await client.from("caixa").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  // --- COLABORADORES / STAFF ---
  async fetchEmployees(): Promise<Employee[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("colaboradores")
        .select("*")
        .order("name", { ascending: true });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email || "",
        contact: row.contact || "",
        whatsapp: row.whatsapp || "",
        role: row.role || "Operador",
        salary: Number(row.salary || 0),
        admissionDate: row.admission_date || new Date().toISOString().split("T")[0],
        status: row.status || "ACTIVE",
        pin: row.pin || "",
        pinCreatedAt: row.pin_created_at || "",
        pinChanged: row.pin_changed ?? true,
        fotoPerfil: row.foto_perfil || "",
        subscriptionPlan: row.subscription_plan || "OURO",
        branch: row.branch || "Sede Principal"
      }));
    } catch {
      return [];
    }
  },

  async saveEmployee(employee: Employee): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: employee.id,
        tenant_id: tenantId,
        name: employee.name,
        email: employee.email || "",
        contact: employee.contact || "",
        whatsapp: (employee as any).whatsapp || "",
        role: employee.role || "Operador",
        salary: employee.salary || 0,
        admission_date: employee.admissionDate || new Date().toISOString().split("T")[0],
        status: employee.status || "ACTIVE",
        pin: employee.pin || "",
        pin_created_at: (employee as any).pinCreatedAt || new Date().toISOString(),
        pin_changed: (employee as any).pinChanged ?? true,
        foto_perfil: (employee as any).fotoPerfil || "",
        subscription_plan: (employee as any).subscriptionPlan || "OURO",
        branch: (employee as any).branch || "Sede Principal",
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("colaboradores").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async syncEmployees(employees: Employee[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || employees.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = employees.map((emp) => ({
        id: emp.id,
        tenant_id: tenantId,
        name: emp.name,
        email: emp.email || "",
        contact: emp.contact || "",
        whatsapp: (emp as any).whatsapp || "",
        role: emp.role || "Operador",
        salary: emp.salary || 0,
        admission_date: emp.admissionDate || new Date().toISOString().split("T")[0],
        status: emp.status || "ACTIVE",
        pin: emp.pin || "",
        pin_created_at: (emp as any).pinCreatedAt || new Date().toISOString(),
        pin_changed: (emp as any).pinChanged ?? true,
        foto_perfil: (emp as any).fotoPerfil || "",
        subscription_plan: (emp as any).subscriptionPlan || "OURO",
        branch: (emp as any).branch || "Sede Principal",
        updated_at: new Date().toISOString()
      }));

      const { error } = await client.from("colaboradores").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  // --- PEDIDOS DE RECUPERAÇÃO DE ACESSO ---
  async getRecoveryRequests(): Promise<any[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("recovery_requests")
        .select("*")
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });

      if (error || !data) return [];
      return data.map((r: any) => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeName: r.employee_name,
        email: r.email,
        status: r.status,
        timestamp: r.created_at
      }));
    } catch {
      return [];
    }
  },

  async createRecoveryRequest(empId: string, empName: string, email?: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const { error } = await client.from("recovery_requests").insert({
        tenant_id: tenantId,
        employee_id: empId,
        employee_name: empName,
        email: email || "",
        status: "PENDING",
        created_at: new Date().toISOString()
      });
      return !error;
    } catch {
      return false;
    }
  },

  async resolveRecoveryRequest(requestId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from("recovery_requests")
        .update({ status: "RESOLVED", resolved_at: new Date().toISOString() })
        .eq("id", requestId);
      return !error;
    } catch {
      return false;
    }
  },

  // --- AUDIT LOGS ---
  async fetchAuditLogs(): Promise<AuditLog[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(300);

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        user: row.user_name || "Sistema",
        userRole: (row.user_role as UserRole) || "ADMIN",
        userId: row.user_id || undefined,
        action: row.action,
        module: row.module,
        details: row.details || "",
        ip: row.ip_address || undefined,
        device: row.device || undefined,
        timestamp: row.timestamp || new Date().toISOString()
      })) as AuditLog[];
    } catch {
      return [];
    }
  },

  async saveAuditLog(log: AuditLog): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: log.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        tenant_id: tenantId,
        user_id: (log as any).userId || (log as any).user || null,
        user_name: log.user || "Sistema",
        user_role: log.userRole || "ADMIN",
        action: log.action,
        module: log.module,
        details: log.details || "",
        ip_address: log.ip || null,
        device: log.device || null,
        timestamp: log.timestamp || new Date().toISOString()
      };

      const { error } = await client.from("audit_logs").insert(record);
      return !error;
    } catch {
      return false;
    }
  },

  async syncAuditLogs(logs: AuditLog[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || logs.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = logs.map((l) => ({
        id: l.id,
        tenant_id: tenantId,
        user_id: (l as any).userId || (l as any).user || null,
        user_name: l.user || "Sistema",
        user_role: l.userRole || "ADMIN",
        action: l.action,
        module: l.module,
        details: l.details || "",
        ip_address: l.ip || null,
        device: l.device || null,
        timestamp: l.timestamp || new Date().toISOString()
      }));

      const { error } = await client.from("audit_logs").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  // --- DEFINIÇÕES DO SISTEMA (SETTINGS) ---
  async fetchSettings(): Promise<SystemSettings | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from("settings")
        .select("*")
        .eq("id", "config")
        .single();

      if (error || !data) return null;

      return {
        companyName: data.company_name,
        companyAddress: data.company_address,
        companyNuit: data.company_nuit,
        companyPhone: data.company_phone,
        companyEmail: data.company_email,
        receiptFooterMessage: data.receipt_footer_message,
        enableVat: data.enable_vat ?? true,
        vatPercentage: Number(data.vat_percentage || 16),
        vatDefaultRate: Number(data.vat_percentage || 16),
        defaultVat: Number(data.vat_percentage || 16),
        currency: data.currency || "MT",
        lowStockThreshold: Number(data.low_stock_threshold || 5),
        smsStockThreshold: Number(data.low_stock_threshold || 5),
        defaultPrinter: data.default_printer || "thermal_80mm",
        printerName: data.default_printer || "thermal_80mm",
        cloudBackupEnabled: data.cloud_backup_enabled ?? true,
        backupFrequency: data.backup_frequency || "daily",
        backupTime: data.backup_time || "18:00",
        logoUrl: data.logo_url || "",
        theme: data.theme || "laranja",
        autoBackup: data.cloud_backup_enabled ?? true,
        smsGateway: "",
        smtpServer: "",
        reportRecipientEmail: "",
        reportHour: "18:00",
        reportFrequency: "daily",
        ...(data.val_json || {})
      } as SystemSettings;
    } catch {
      return null;
    }
  },

  async saveSettings(settings: SystemSettings): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: "config",
        tenant_id: tenantId,
        company_name: settings.companyName,
        company_address: settings.companyAddress || settings.storeAddress || "",
        company_nuit: settings.companyNuit || settings.nuit || "",
        company_phone: (settings as any).companyPhone || settings.storeContact || "",
        company_email: settings.email || settings.storeEmail || (settings as any).companyEmail || "",
        receipt_footer_message: (settings as any).receiptFooterMessage || settings.slogan || "",
        enable_vat: (settings as any).enableVat ?? true,
        vat_percentage: settings.defaultVat ?? settings.vatDefaultRate ?? 16,
        currency: settings.currency || "MT",
        low_stock_threshold: settings.smsStockThreshold ?? (settings as any).lowStockThreshold ?? 5,
        default_printer: settings.printerName || (settings as any).defaultPrinter || "thermal_80mm",
        cloud_backup_enabled: settings.cloudBackupEnabled ?? true,
        backup_frequency: settings.backupFrequency || "daily",
        backup_time: settings.backupTime || "18:00",
        logo_url: settings.logoUrl || "",
        theme: settings.theme || "laranja",
        val_json: settings,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("settings").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  // --- SUPABASE STORAGE (BACKUPS & ARQUIVOS) ---
  async uploadBackupToStorage(fileName: string, jsonString: string): Promise<string | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const bucketName = "ostvendas-backups";
      const blob = new Blob([jsonString], { type: "application/json" });
      const filePath = `backups/${fileName}`;

      const { data, error } = await client.storage
        .from(bucketName)
        .upload(filePath, blob, {
          contentType: "application/json",
          upsert: true
        });

      if (error) {
        console.warn("Falha no upload para o Supabase Storage:", error.message);
        return null;
      }

      const { data: publicUrlData } = client.storage.from(bucketName).getPublicUrl(filePath);
      return publicUrlData.publicUrl || filePath;
    } catch (err) {
      console.warn("Erro ao fazer upload de backup no Storage:", err);
      return null;
    }
  },

  async listBackupsFromStorage(): Promise<CloudBackupItem[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const bucketName = "ostvendas-backups";
      const { data, error } = await client.storage.from(bucketName).list("backups");
      if (error || !data) return [];

      return data.map((item) => {
        const { data: publicUrlData } = client.storage.from(bucketName).getPublicUrl(`backups/${item.name}`);
        return {
          name: item.name,
          fullPath: `backups/${item.name}`,
          size: item.metadata?.size || 0,
          updated: item.updated_at || item.created_at || new Date().toISOString(),
          downloadUrl: publicUrlData.publicUrl
        };
      });
    } catch {
      return [];
    }
  },

  async deleteBackupFromStorage(fileName: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const bucketName = "ostvendas-backups";
      const { error } = await client.storage.from(bucketName).remove([`backups/${fileName}`]);
      return !error;
    } catch {
      return false;
    }
  },

  // --- REALTIME CHANNEL SUBSCRIPTIONS ---
  subscribeToTableChanges(table: string, onUpdate: (payload: any) => void): { unsubscribe: () => void } {
    const client = getSupabaseClient();
    if (!client) return { unsubscribe: () => {} };

    try {
      const channel = client
        .channel(`public:${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload) => {
            onUpdate(payload);
          }
        )
        .subscribe();

      return {
        unsubscribe: () => {
          client.removeChannel(channel);
        }
      };
    } catch {
      return { unsubscribe: () => {} };
    }
  },

  // --- SINCRONIZAÇÃO COMPLETA (ALL DATA) ---
  async syncAll(data: {
    products: Product[];
    customers: Customer[];
    transactions: Transaction[];
    cashFlow: CashFlowEntry[];
    employees?: Employee[];
    auditLogs?: AuditLog[];
    settings?: SystemSettings;
  }): Promise<{ success: boolean; count: number; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, count: 0, error: "Supabase não está configurado ou ativo." };
    }

    let synced = 0;
    try {
      if (data.products && data.products.length > 0) {
        const ok = await this.syncProducts(data.products);
        if (ok) synced += data.products.length;
      }
      if (data.customers && data.customers.length > 0) {
        const ok = await this.syncCustomers(data.customers);
        if (ok) synced += data.customers.length;
      }
      if (data.transactions && data.transactions.length > 0) {
        const ok = await this.syncTransactions(data.transactions);
        if (ok) synced += data.transactions.length;
      }
      if (data.cashFlow && data.cashFlow.length > 0) {
        const ok = await this.syncCashFlow(data.cashFlow);
        if (ok) synced += data.cashFlow.length;
      }
      if (data.employees && data.employees.length > 0) {
        const ok = await this.syncEmployees(data.employees);
        if (ok) synced += data.employees.length;
      }
      if (data.auditLogs && data.auditLogs.length > 0) {
        const ok = await this.syncAuditLogs(data.auditLogs);
        if (ok) synced += data.auditLogs.length;
      }
      if (data.settings) {
        await this.saveSettings(data.settings);
        synced += 1;
      }

      return { success: true, count: synced };
    } catch (err: any) {
      return { success: false, count: synced, error: err.message };
    }
  }
};
