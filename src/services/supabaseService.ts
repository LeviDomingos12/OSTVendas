/**
 * @file supabaseService.ts
 * Fachada Oficial de Backend, Diagnósticos, Autenticação e Persistência Relacional (Supabase PostgreSQL).
 *
 * Arquitetura Modular por Domínios:
 * - supabaseConfigService: Configuração, conexão, testes de latência e validação de sessão
 * - supabaseAuthService: Autenticação de utilizadores, gestão de sessões e mapeamento de perfis
 * - supabaseProductService: Catálogo de artigos, inventário e reabastecimento atómico
 * - supabaseCustomerService: Clientes, contas correntes e fidelidade
 * - supabaseTransactionService: Vendas, liquidação de dívidas e operações atómicas de POS
 * - supabaseCashService: Fluxo de caixa diário, balancetes e turnos
 * - supabaseEmployeeService: Gestão de colaboradores, PINs criptográficos e recuperação
 * - supabaseAuditSettingsService: Logs imutáveis de auditoria, definições e backups na Cloud
 */

export * from "./supabase/supabaseConfigService";
export * from "./supabase/supabaseAuthService";
export * from "./supabase/supabaseProductService";
export * from "./supabase/supabaseCustomerService";
export * from "./supabase/supabaseTransactionService";
export * from "./supabase/supabaseCashService";
export * from "./supabase/supabaseEmployeeService";
export * from "./supabase/supabaseAuditSettingsService";

import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  getSupabaseClient, 
  measureSupabaseLatency, 
  validateSupabaseSession, 
  testSupabaseConnection 
} from "./supabase/supabaseConfigService";

import { SupabaseAuthService } from "./supabase/supabaseAuthService";
import { SupabaseProductService } from "./supabase/supabaseProductService";
import { SupabaseCustomerService } from "./supabase/supabaseCustomerService";
import { SupabaseTransactionService } from "./supabase/supabaseTransactionService";
import { SupabaseCashService } from "./supabase/supabaseCashService";
import { SupabaseEmployeeService } from "./supabase/supabaseEmployeeService";
import { SupabaseAuditSettingsService } from "./supabase/supabaseAuditSettingsService";

/**
 * Fachada unificada SupabaseSyncService para compatibilidade total com os módulos existentes.
 */
export const SupabaseSyncService = {
  // Configurações e Utilitários de Conexão
  getConfig: getSupabaseConfig,
  saveConfig: saveSupabaseConfig,
  getClient: getSupabaseClient,
  measureLatency: measureSupabaseLatency,
  validateSession: validateSupabaseSession,
  testConnection: testSupabaseConnection,

  // Autenticação e Sessão
  signUpWithEmail: SupabaseAuthService.signUpWithEmail,
  signInWithEmail: SupabaseAuthService.signInWithEmail,
  signInWithGoogle: SupabaseAuthService.signInWithGoogle,
  recoverPassword: SupabaseAuthService.recoverPassword,
  signOut: SupabaseAuthService.signOut,
  mergeRecordsById: SupabaseAuthService.mergeRecordsById,
  syncUserProfileFromAuth: SupabaseAuthService.syncUserProfileFromAuth,
  onAuthStateChange: SupabaseAuthService.onAuthStateChange,

  // Catálogo & Produtos
  fetchProducts: SupabaseProductService.fetchProducts,
  saveProduct: SupabaseProductService.saveProduct,
  syncProducts: SupabaseProductService.syncProducts,
  deleteProduct: SupabaseProductService.deleteProduct,
  replenishStockAtomic: SupabaseProductService.replenishStockAtomic,

  // Clientes
  fetchCustomers: SupabaseCustomerService.fetchCustomers,
  saveCustomer: SupabaseCustomerService.saveCustomer,
  syncCustomers: SupabaseCustomerService.syncCustomers,
  deleteCustomer: SupabaseCustomerService.deleteCustomer,

  // Transações & POS
  fetchTransactions: SupabaseTransactionService.fetchTransactions,
  fetchRecentTransactions24h: SupabaseTransactionService.fetchRecentTransactions24h,
  processSaleAtomic: SupabaseTransactionService.processSaleAtomic,
  settleDebtPaymentAtomic: SupabaseTransactionService.settleDebtPaymentAtomic,
  saveTransactionDirect: SupabaseTransactionService.saveTransactionDirect,
  syncTransactions: SupabaseTransactionService.syncTransactions,

  // Caixa & Balancetes
  fetchCashFlow: SupabaseCashService.fetchCashFlow,
  saveCashFlowEntry: SupabaseCashService.saveCashFlowEntry,
  syncCashFlow: SupabaseCashService.syncCashFlow,
  fetchCashClosures: SupabaseCashService.fetchCashClosures,
  saveCashClosure: SupabaseCashService.saveCashClosure,
  syncCashClosures: SupabaseCashService.syncCashClosures,
  fetchActiveCashShift: SupabaseCashService.fetchActiveCashShift,
  saveActiveCashShift: SupabaseCashService.saveActiveCashShift,

  // Colaboradores & Segurança
  fetchEmployees: SupabaseEmployeeService.fetchEmployees,
  saveEmployee: SupabaseEmployeeService.saveEmployee,
  syncEmployees: SupabaseEmployeeService.syncEmployees,
  getRecoveryRequests: SupabaseEmployeeService.getRecoveryRequests,
  createRecoveryRequest: SupabaseEmployeeService.createRecoveryRequest,
  resolveRecoveryRequest: SupabaseEmployeeService.resolveRecoveryRequest,

  // Auditoria, Definições & Backups
  fetchAuditLogs: SupabaseAuditSettingsService.fetchAuditLogs,
  saveAuditLog: SupabaseAuditSettingsService.saveAuditLog,
  syncAuditLogs: SupabaseAuditSettingsService.syncAuditLogs,
  fetchSettings: SupabaseAuditSettingsService.fetchSettings,
  saveSettings: SupabaseAuditSettingsService.saveSettings,
  uploadBackupToStorage: SupabaseAuditSettingsService.uploadBackupToStorage,
  listBackupsFromStorage: SupabaseAuditSettingsService.listBackupsFromStorage,
  deleteBackupFromStorage: SupabaseAuditSettingsService.deleteBackupFromStorage,
  subscribeToTableChanges: SupabaseAuditSettingsService.subscribeToTableChanges,
  syncAll: SupabaseAuditSettingsService.syncAll
};
