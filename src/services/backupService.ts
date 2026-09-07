import { operationalCache } from "../lib/indexedDbStorage";
import { generateEntityId } from "../lib/deterministic";
import { DatabaseState, BackupLogEntry, Employee } from "../types";

export interface CreateBackupResult {
  success: boolean;
  backupId?: string;
  log?: BackupLogEntry;
}

export async function createLocalBackup(
  currentData: DatabaseState,
  type: "manual" | "automatic",
  activeUser: Employee | null,
  systemVersion: string
): Promise<CreateBackupResult> {
  try {
    const dbPayload = {
      app: "OST Vendas",
      exportDate: new Date().toISOString(),
      version: systemVersion,
      operator: type === "manual" ? (activeUser?.name || "ADMIN") : "Agendador Automático Redundante",
      data: {
        settings: currentData.settings,
        products: currentData.products,
        customers: currentData.customers,
        transactions: currentData.transactions,
        cashFlow: currentData.cashFlow,
        employees: currentData.employees,
        auditLogs: currentData.auditLogs.slice(-50)
      }
    };

    const dataStr = JSON.stringify(dbPayload);
    const backupId = generateEntityId("bkp");

    // Save full backup payload to IndexedDB via operationalCache (no quota restrictions)
    await operationalCache.setItem(`erp_backup_slot_${backupId}`, dbPayload);
    await operationalCache.setItem("erp_auto_backup_local_db", dbPayload);
    try {
      localStorage.setItem("erp_last_auto_backup_time", new Date().toISOString());
    } catch (e) {}

    // Update backup logs list in IndexedDB
    let logs: BackupLogEntry[] = (await operationalCache.getItem<BackupLogEntry[]>("erp_local_backups_log")) || [];
    if (!Array.isArray(logs)) logs = [];

    const frequency = currentData.settings?.backupFrequency || "daily";

    const newLog: BackupLogEntry = {
      id: backupId,
      date: new Date().toISOString(),
      type: type === "manual" ? "Manual" : "Automático",
      frequency: type === "manual" ? "N/A" : (frequency === "daily" ? "Diária" : frequency === "weekly" ? "Semanal" : frequency === "monthly" ? "Mensal" : "12 Horas"),
      size: dataStr.length,
      itemCount: (currentData.products.length || 0) + (currentData.customers.length || 0) + (currentData.transactions.length || 0),
      status: "Sucesso"
    };

    logs.unshift(newLog);
    logs = logs.slice(0, 5); // Keep last 5 backups
    await operationalCache.setItem("erp_local_backups_log", logs);

    return {
      success: true,
      backupId,
      log: newLog
    };
  } catch (error) {
    console.error("Erro ao realizar backup local:", error);
    return { success: false };
  }
}

export function shouldRunAutoBackup(lastBackupTimeStr: string | null, frequency: string = "daily"): boolean {
  const lastBackupTime = lastBackupTimeStr ? new Date(lastBackupTimeStr).getTime() : 0;
  const now = Date.now();

  let intervalMs = 24 * 60 * 60 * 1000; // default 1 day (daily)
  if (frequency === "weekly") {
    intervalMs = 7 * 24 * 60 * 60 * 1000;
  } else if (frequency === "monthly") {
    intervalMs = 30 * 24 * 60 * 60 * 1000;
  } else if (frequency === "12h") {
    intervalMs = 12 * 60 * 60 * 1000;
  }

  return now - lastBackupTime >= intervalMs;
}
