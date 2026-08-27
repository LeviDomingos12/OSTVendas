/**
 * @file dataService.ts
 * Camada de Serviço Unificada e Fachada de Dados Centralizada (@supabase/supabase-js).
 * 
 * Centraliza a inicialização do cliente Supabase a partir das variáveis de ambiente
 * 'VITE_SUPABASE_URL' e 'VITE_SUPABASE_ANON_KEY', eliminando quaisquer dependências diretas do Firebase.
 * 
 * Providencia serviços estruturados para:
 * - Autenticação e Sessões (AuthService)
 * - Operações Comerciais Atómicas e CRUD (CommercialDataService)
 * - Fila de Sincronização Offline Resiliente (OfflineQueueService)
 * - Diagnósticos e Medição de Latência de Rede (ConnectionService)
 * - Armazenamento de Backups em Nuvem (StorageService)
 */

import { Session, User } from "@supabase/supabase-js";
import { supabase as supabaseClient, getSupabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
export { supabaseClient, getSupabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY };
import {
  SupabaseSyncService,
  getSupabaseConfig,
  saveSupabaseConfig,
  measureSupabaseLatency,
  validateSupabaseSession,
  CloudBackupItem,
  LatencyResult,
  SessionValidationResult
} from "./supabaseService";
import { 
  Product, 
  Customer, 
  Transaction, 
  CashFlowEntry, 
  Employee, 
  AuditLog, 
  SystemSettings,
  CashClosure,
  CashShift
} from "../types";

/**
 * Sanitização e normalização de mensagens de erro para proteção de dados e logs amigáveis.
 */
export function sanitizeServiceError(error: unknown): string {
  if (!error) return "Operação concluída.";
  const rawMsg = error instanceof Error ? error.message : String(error);
  const lower = rawMsg.toLowerCase();

  if (lower.includes("network") || lower.includes("offline") || lower.includes("failed to fetch")) {
    return "Sem ligação à rede no momento. As alterações foram colocadas na fila de sincronização local.";
  }
  if (lower.includes("permission") || lower.includes("unauthorized") || lower.includes("jwt") || lower.includes("denied")) {
    return "Acesso restrito: permissões insuficientes ou sessão expirada.";
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Credenciais de acesso incorretas. Verifique o seu e-mail e palavra-passe.";
  }

  return rawMsg || "Falha na comunicação com o servidor de dados.";
}

/**
 * Gestor de Backend e Estado de Operação
 */
export const BackendManager = {
  isSupabaseActive(): boolean {
    return true;
  },

  getMode(): string {
    return "SUPABASE";
  },

  setMode(_mode: string): void {
    // Supabase é o backend oficial e central
  }
};

/**
 * Serviço de Conexão e Diagnósticos de Rede
 */
export const ConnectionService = {
  /**
   * Valida se a ligação com o Supabase está operacional
   */
  async test(): Promise<boolean> {
    try {
      const latency = await measureSupabaseLatency(SUPABASE_URL, SUPABASE_ANON_KEY);
      return latency.status !== "error";
    } catch {
      return false;
    }
  },

  /**
   * Diagnóstico em tempo real da conectividade e latência
   */
  async getDiagnostics(): Promise<{
    activeMode: string;
    supabaseOnline: boolean;
    supabaseLatency: LatencyResult;
    supabaseSession: SessionValidationResult;
    timestamp: string;
  }> {
    const [sbLatency, sbSession] = await Promise.all([
      measureSupabaseLatency(SUPABASE_URL, SUPABASE_ANON_KEY).catch(() => ({
        latencyMs: 0,
        status: "error" as const,
        message: "Falha de comunicação com o Supabase",
        timestamp: new Date().toISOString()
      })),
      validateSupabaseSession().catch(() => ({
        isValid: false,
        user: null,
        session: null,
        expiresAt: null,
        email: null,
        role: null,
        message: "Falha ao validar sessão"
      }))
    ]);

    return {
      activeMode: "SUPABASE",
      supabaseOnline: sbLatency.status !== "error",
      supabaseLatency: sbLatency,
      supabaseSession: sbSession,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Serviço de Autenticação Supabase
 */
export const AuthService = {
  async signInWithEmail(email: string, pass: string) {
    return await SupabaseSyncService.signInWithEmail(email, pass);
  },

  async signUpWithEmail(email: string, pass: string, name: string, branch: string, role: string = "Administrador", plan: string = "OURO") {
    return await SupabaseSyncService.signUpWithEmail(email, pass, name, branch, role, plan);
  },

  async signInWithGoogle() {
    return await SupabaseSyncService.signInWithGoogle();
  },

  async recoverPassword(email: string) {
    return await SupabaseSyncService.recoverPassword(email);
  },

  async signOut() {
    return await SupabaseSyncService.signOut();
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return SupabaseSyncService.onAuthStateChange(callback);
  },

  async getSession(): Promise<Session | null> {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  },

  async getCurrentUser(): Promise<User | null> {
    const { data } = await supabaseClient.auth.getUser();
    return data.user;
  }
};

import { SyncService, OfflineQueueService, SyncOperationType, SyncQueueItem } from "./syncService";
export { SyncService, OfflineQueueService };
export type { SyncOperationType, SyncQueueItem };

/**
 * Serviço Comercial Unificado (Produtos, Vendas, Clientes, Caixa, Staff, Auditoria, Definições)
 */
export const CommercialDataService = {

  // --- PRODUTOS ---
  async fetchProducts(): Promise<Product[]> {
    try {
      return await SupabaseSyncService.fetchProducts();
    } catch (err) {
      console.warn("Erro ao buscar produtos do Supabase:", err);
      return [];
    }
  },

  async saveProduct(product: Product): Promise<void> {
    try {
      const ok = await SupabaseSyncService.saveProduct(product);
      if (!ok) {
        OfflineQueueService.enqueue({ type: "PRODUCT", payload: product, timestamp: new Date().toISOString() });
      }
    } catch {
      OfflineQueueService.enqueue({ type: "PRODUCT", payload: product, timestamp: new Date().toISOString() });
    }
  },

  async saveProductsBatch(products: Product[]): Promise<void> {
    try {
      await SupabaseSyncService.syncProducts(products);
    } catch (err) {
      console.warn("Aviso ao sincronizar lote de produtos:", err);
    }
  },

  async updateProduct(productId: string, updatedFields: Partial<Product>): Promise<void> {
    try {
      const full = { id: productId, ...updatedFields } as Product;
      await SupabaseSyncService.saveProduct(full);
    } catch (err) {
      console.warn("Erro ao atualizar produto no Supabase:", err);
    }
  },

  async removeProduct(productId: string): Promise<void> {
    try {
      await SupabaseSyncService.deleteProduct(productId);
    } catch (err) {
      console.warn("Erro ao remover produto no Supabase:", err);
    }
  },

  async replenishStock(params: {
    productId: string;
    quantity: number;
    costPrice?: number;
    reason?: string;
    userName?: string;
  }) {
    return await SupabaseSyncService.replenishStockAtomic(params);
  },

  subscribeProducts(onUpdate: () => void) {
    return SupabaseSyncService.subscribeToTableChanges("produtos", onUpdate);
  },

  // --- CLIENTES ---
  async fetchCustomers(): Promise<Customer[]> {
    try {
      return await SupabaseSyncService.fetchCustomers();
    } catch (err) {
      console.warn("Erro ao buscar clientes:", err);
      return [];
    }
  },

  async saveCustomer(customer: Customer): Promise<void> {
    try {
      const ok = await SupabaseSyncService.saveCustomer(customer);
      if (!ok) {
        OfflineQueueService.enqueue({ type: "CUSTOMER", payload: customer, timestamp: new Date().toISOString() });
      }
    } catch {
      OfflineQueueService.enqueue({ type: "CUSTOMER", payload: customer, timestamp: new Date().toISOString() });
    }
  },

  async saveCustomersBatch(customers: Customer[]): Promise<void> {
    try {
      await SupabaseSyncService.syncCustomers(customers);
    } catch (err) {
      console.warn("Aviso ao salvar lote de clientes:", err);
    }
  },

  async removeCustomer(customerId: string): Promise<void> {
    try {
      await SupabaseSyncService.deleteCustomer(customerId);
    } catch (err) {
      console.warn("Erro ao remover cliente:", err);
    }
  },

  // --- TRANSAÇÕES / VENDAS ---
  async fetchTransactions(): Promise<Transaction[]> {
    try {
      return await SupabaseSyncService.fetchTransactions();
    } catch (err) {
      console.warn("Erro ao buscar vendas:", err);
      return [];
    }
  },

  async fetchRecentTransactions24h(): Promise<Transaction[]> {
    try {
      return await SyncService.prefetchRecentTransactions24h();
    } catch (err) {
      console.warn("Erro ao buscar transações das últimas 24h:", err);
      return [];
    }
  },

  async saveTransaction(transaction: Transaction): Promise<void> {
    try {
      const params = {
        saleId: transaction.id,
        invoiceNumber: transaction.invoiceNumber || transaction.id,
        customerId: transaction.customerId,
        customerName: transaction.customerName || "Consumidor Final",
        sellerName: transaction.cashierName || "Operador",
        paymentMethod: transaction.paymentMethod,
        subtotal: transaction.subtotal || transaction.grandTotal,
        discountTotal: transaction.discountTotal || 0,
        vatTotal: transaction.vatTotal || 0,
        grandTotal: transaction.grandTotal,
        amountPaid: transaction.grandTotal,
        changeAmount: 0,
        items: transaction.items || []
      };

      const res = await SupabaseSyncService.processSaleAtomic(params);
      if (!res.success) {
        OfflineQueueService.enqueue({ type: "TRANSACTION", payload: params, timestamp: new Date().toISOString() });
      }
    } catch {
      OfflineQueueService.enqueue({
        type: "TRANSACTION",
        payload: {
          saleId: transaction.id,
          invoiceNumber: transaction.invoiceNumber || transaction.id,
          customerId: transaction.customerId,
          customerName: transaction.customerName,
          sellerName: transaction.cashierName,
          paymentMethod: transaction.paymentMethod,
          subtotal: transaction.subtotal || transaction.grandTotal,
          discountTotal: transaction.discountTotal || 0,
          vatTotal: transaction.vatTotal || 0,
          grandTotal: transaction.grandTotal,
          amountPaid: transaction.grandTotal,
          changeAmount: 0,
          items: transaction.items || []
        },
        timestamp: new Date().toISOString()
      });
    }
  },

  async saveTransactionsBatch(transactions: Transaction[]): Promise<void> {
    try {
      await SupabaseSyncService.syncTransactions(transactions);
    } catch (err) {
      console.warn("Erro ao salvar lote de transações:", err);
    }
  },

  // --- FLUXO DE CAIXA ---
  async fetchCashFlow(): Promise<CashFlowEntry[]> {
    try {
      return await SupabaseSyncService.fetchCashFlow();
    } catch {
      return [];
    }
  },

  async saveCashFlowEntry(entry: CashFlowEntry): Promise<void> {
    try {
      const ok = await SupabaseSyncService.saveCashFlowEntry(entry);
      if (!ok) {
        OfflineQueueService.enqueue({ type: "CASHFLOW", payload: entry, timestamp: new Date().toISOString() });
      }
    } catch {
      OfflineQueueService.enqueue({ type: "CASHFLOW", payload: entry, timestamp: new Date().toISOString() });
    }
  },

  async saveCashFlowBatch(movements: CashFlowEntry[]): Promise<void> {
    try {
      await SupabaseSyncService.syncCashFlow(movements);
    } catch (err) {
      console.warn("Erro ao salvar lote de movimentos de caixa:", err);
    }
  },

  // --- FECHAMENTOS DE CAIXA / BALANCETES ---
  async fetchCashClosures(): Promise<CashClosure[]> {
    try {
      return await SupabaseSyncService.fetchCashClosures();
    } catch (err) {
      console.warn("Erro ao buscar fechamentos de caixa do Supabase:", err);
      return [];
    }
  },

  async saveCashClosure(closure: CashClosure): Promise<void> {
    try {
      const ok = await SupabaseSyncService.saveCashClosure(closure);
      if (!ok) {
        OfflineQueueService.enqueue({ type: "CASH_CLOSURE", payload: closure, timestamp: new Date().toISOString() });
      }
    } catch {
      OfflineQueueService.enqueue({ type: "CASH_CLOSURE", payload: closure, timestamp: new Date().toISOString() });
    }
  },

  async saveCashClosuresBatch(closures: CashClosure[]): Promise<void> {
    try {
      await SupabaseSyncService.syncCashClosures(closures);
    } catch (err) {
      console.warn("Erro ao salvar lote de fechamentos de caixa:", err);
    }
  },

  async fetchActiveCashShift() {
    try {
      return await SupabaseSyncService.fetchActiveCashShift();
    } catch (err) {
      console.warn("Erro ao buscar turno ativo do Supabase:", err);
      return null;
    }
  },

  async saveActiveCashShift(shiftData: {
    status: "OPEN" | "CLOSED";
    openingBalance: number;
    openedAt: string;
    openedBy: string;
    openingSupervisor?: string;
    openingNotes?: string;
  }): Promise<void> {
    try {
      await SupabaseSyncService.saveActiveCashShift(shiftData);
    } catch (err) {
      console.warn("Erro ao salvar turno ativo no Supabase:", err);
    }
  },

  subscribeCashClosures(onUpdate: () => void) {
    return SupabaseSyncService.subscribeToTableChanges("cash_closures", onUpdate);
  },

  // --- COLABORADORES / STAFF ---
  async fetchEmployees(): Promise<Employee[]> {
    try {
      return await SupabaseSyncService.fetchEmployees();
    } catch {
      return [];
    }
  },

  async saveEmployee(employee: Employee): Promise<void> {
    try {
      await SupabaseSyncService.saveEmployee(employee);
    } catch (err) {
      console.warn("Erro ao salvar colaborador:", err);
    }
  },

  async saveEmployeesBatch(employees: Employee[]): Promise<void> {
    try {
      await SupabaseSyncService.syncEmployees(employees);
    } catch (err) {
      console.warn("Erro ao salvar lote de colaboradores:", err);
    }
  },

  async getRecoveryRequests() {
    return await SupabaseSyncService.getRecoveryRequests();
  },

  async createRecoveryRequest(empId: string, empName: string, email?: string) {
    return await SupabaseSyncService.createRecoveryRequest(empId, empName, email);
  },

  async resolveRecoveryRequest(id: string) {
    return await SupabaseSyncService.resolveRecoveryRequest(id);
  },

  // --- AUDITORIA ---
  async fetchAuditLogs(): Promise<AuditLog[]> {
    try {
      return await SupabaseSyncService.fetchAuditLogs();
    } catch {
      return [];
    }
  },

  async saveAuditLog(log: AuditLog): Promise<void> {
    try {
      await SupabaseSyncService.saveAuditLog(log);
    } catch (err) {
      console.warn("Erro ao gravar log de auditoria:", err);
    }
  },

  // --- DEFINIÇÕES (SETTINGS) ---
  async fetchSettings(): Promise<SystemSettings | null> {
    try {
      return await SupabaseSyncService.fetchSettings();
    } catch {
      return null;
    }
  },

  async saveSettings(settings: SystemSettings): Promise<void> {
    try {
      await SupabaseSyncService.saveSettings(settings);
    } catch (err) {
      console.warn("Erro ao salvar configurações:", err);
    }
  }
};

/**
 * Serviço de Armazenamento e Backups em Nuvem (Supabase Storage)
 */
export const StorageService = {
  async uploadBackup(fileName: string, jsonString: string): Promise<string | null> {
    return await SupabaseSyncService.uploadBackupToStorage(fileName, jsonString);
  },

  async listBackups(): Promise<CloudBackupItem[]> {
    return await SupabaseSyncService.listBackupsFromStorage();
  },

  async deleteBackup(fileName: string): Promise<boolean> {
    return await SupabaseSyncService.deleteBackupFromStorage(fileName);
  }
};
