import { operationalCache } from "../lib/indexedDbStorage";
import { authenticatedFetch } from "../lib/apiClient";
import { CommercialDataService } from "../services/dataService";
import { Product, Transaction, Customer, CashFlowEntry } from "../types";

export interface SyncQueueItem {
  table: string;
  data: unknown;
  timestamp: string;
}

export type SyncQueue = Record<string, unknown>;

export async function loadSyncQueue(): Promise<SyncQueue> {
  const q = await operationalCache.getItem<SyncQueue>("pos_sync_queue");
  if (q && typeof q === "object") {
    return q;
  }
  return {};
}

export async function processSyncQueue(
  queue: SyncQueue
): Promise<{ remainingQueue: SyncQueue; hasChanges: boolean }> {
  const currentQueue = { ...queue };
  const tableNames = Object.keys(currentQueue);
  if (tableNames.length === 0) {
    return { remainingQueue: currentQueue, hasChanges: false };
  }

  let hasChanges = false;

  for (const tableName of tableNames) {
    const data = currentQueue[tableName];
    let success = false;

    if (tableName === "products") {
      try {
        await CommercialDataService.saveProductsBatch(data as Product[]);
        success = true;
        try {
          await authenticatedFetch("/api/db/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "products", data })
          });
        } catch (err) {
          console.warn("[SYNC QUEUE] Erro ao atualizar produtos no servidor:", err);
        }
      } catch (pErr) {
        console.warn("[SYNC QUEUE] Erro ao ressincronizar produtos:", pErr);
      }
    } else if (tableName === "transactions") {
      try {
        await CommercialDataService.saveTransactionsBatch(data as Transaction[]);
        success = true;
        try {
          await authenticatedFetch("/api/db/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "transactions", data })
          });
        } catch (err) {
          console.warn("[SYNC QUEUE] Erro ao atualizar transações no servidor:", err);
        }
      } catch (fsErr) {
        console.warn("[SYNC QUEUE] Erro ao ressincronizar transações:", fsErr);
      }
    } else if (tableName === "customers") {
      try {
        await CommercialDataService.saveCustomersBatch(data as Customer[]);
        success = true;
        try {
          await authenticatedFetch("/api/db/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "customers", data })
          });
        } catch (err) {
          console.warn("[SYNC QUEUE] Erro ao atualizar clientes no servidor:", err);
        }
      } catch (cErr) {
        console.warn("[SYNC QUEUE] Erro ao ressincronizar clientes:", cErr);
      }
    } else if (tableName === "cashflow") {
      try {
        await CommercialDataService.saveCashFlowBatch(data as CashFlowEntry[]);
        success = true;
        try {
          await authenticatedFetch("/api/db/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "cashflow", data })
          });
        } catch (err) {
          console.warn("[SYNC QUEUE] Erro ao atualizar caixa no servidor:", err);
        }
      } catch (cfErr) {
        console.warn("[SYNC QUEUE] Erro ao ressincronizar caixa:", cfErr);
      }
    } else {
      try {
        const response = await authenticatedFetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: tableName, data })
        });
        success = response.ok;
      } catch (fetchErr) {
        console.warn(`[SYNC QUEUE] Erro de rede ao ressincronizar tabela ${tableName}:`, fetchErr);
      }
    }

    if (success) {
      delete currentQueue[tableName];
      hasChanges = true;
    }
  }

  if (Object.keys(currentQueue).length === 0) {
    await operationalCache.removeItem("pos_sync_queue");
  } else {
    await operationalCache.setItem("pos_sync_queue", currentQueue);
  }

  return { remainingQueue: currentQueue, hasChanges };
}
