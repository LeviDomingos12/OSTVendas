/**
 * @file supabaseAuditSettingsService.ts
 * Gestão de logs de auditoria imutáveis, definições da empresa, realtime e backups no Supabase Storage.
 */

import { AuditLog, CashClosure, CashFlowEntry, Customer, Employee, Product, SystemSettings, Transaction, UserRole } from "../../types";
import { generateEntityId } from "../../lib/deterministic";
import { 
  CloudBackupItem, 
  getSupabaseClient, 
  getSupabaseConfig 
} from "./supabaseConfigService";
import { SupabaseProductService } from "./supabaseProductService";
import { SupabaseCustomerService } from "./supabaseCustomerService";
import { SupabaseTransactionService } from "./supabaseTransactionService";
import { SupabaseCashService } from "./supabaseCashService";
import { SupabaseEmployeeService } from "./supabaseEmployeeService";

interface AuditLogDbRow {
  id: string;
  user_name?: string;
  user_role?: string;
  user_id?: string;
  action: string;
  module: string;
  details?: string;
  ip_address?: string;
  device?: string;
  timestamp?: string;
}

export const SupabaseAuditSettingsService = {
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

      return (data as AuditLogDbRow[]).map(row => ({
        id: row.id,
        user: row.user_name || "Sistema",
        userRole: (row.user_role as UserRole) || "AUDITOR",
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
        id: log.id || generateEntityId("log"),
        tenant_id: tenantId,
        user_id: log.userId || log.user || null,
        user_name: log.user || "Sistema",
        user_role: log.userRole || "AUDITOR",
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
        user_id: l.userId || l.user || null,
        user_name: l.user || "Sistema",
        user_role: l.userRole || "AUDITOR",
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
      const tenantId = getSupabaseConfig().tenantId;
      const configId = tenantId && tenantId.trim() ? `config_${tenantId}` : "config";

      let data: Record<string, unknown> | null = null;

      // 1. Tentar carregar a configuração específica deste tenant
      const resSpecific = await client
        .from("settings")
        .select("*")
        .eq("id", configId)
        .maybeSingle();

      if (resSpecific.data) {
        data = resSpecific.data;
      } else if (tenantId && tenantId.trim()) {
        const resTenant = await client
          .from("settings")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (resTenant.data) data = resTenant.data;
      }

      // 2. Fallback para id global 'config' se ainda não existirem dados específicos
      if (!data) {
        const resGlobal = await client
          .from("settings")
          .select("*")
          .eq("id", "config")
          .maybeSingle();
        if (resGlobal.data) data = resGlobal.data;
      }

      if (!data) return null;

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
        ...(typeof data.val_json === "object" && data.val_json !== null ? (data.val_json as Record<string, unknown>) : {})
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
      const configId = tenantId && tenantId.trim() ? `config_${tenantId}` : "config";
      const record = {
        id: configId,
        tenant_id: tenantId,
        company_name: settings.companyName,
        company_address: settings.companyAddress || settings.storeAddress || "",
        company_nuit: settings.companyNuit || settings.nuit || "",
        company_phone: settings.companyPhone || settings.storeContact || "",
        company_email: settings.email || settings.storeEmail || settings.companyEmail || "",
        receipt_footer_message: settings.receiptFooterMessage || settings.slogan || "",
        enable_vat: settings.enableVat ?? true,
        vat_percentage: settings.defaultVat ?? settings.vatDefaultRate ?? 16,
        currency: settings.currency || "MT",
        low_stock_threshold: settings.smsStockThreshold ?? settings.lowStockThreshold ?? 5,
        default_printer: settings.printerName || settings.defaultPrinter || "thermal_80mm",
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

      const { error } = await client.storage
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
          filename: item.name,
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
  subscribeToTableChanges(table: string, onUpdate: (payload: Record<string, unknown>) => void): { unsubscribe: () => void } {
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
    cashClosures?: CashClosure[];
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
        const ok = await SupabaseProductService.syncProducts(data.products);
        if (ok) synced += data.products.length;
      }
      if (data.customers && data.customers.length > 0) {
        const ok = await SupabaseCustomerService.syncCustomers(data.customers);
        if (ok) synced += data.customers.length;
      }
      if (data.transactions && data.transactions.length > 0) {
        const ok = await SupabaseTransactionService.syncTransactions(data.transactions);
        if (ok) synced += data.transactions.length;
      }
      if (data.cashFlow && data.cashFlow.length > 0) {
        const ok = await SupabaseCashService.syncCashFlow(data.cashFlow);
        if (ok) synced += data.cashFlow.length;
      }
      if (data.cashClosures && data.cashClosures.length > 0) {
        const ok = await SupabaseCashService.syncCashClosures(data.cashClosures);
        if (ok) synced += data.cashClosures.length;
      }
      if (data.employees && data.employees.length > 0) {
        const ok = await SupabaseEmployeeService.syncEmployees(data.employees);
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, count: synced, error: errMsg };
    }
  }
};
