/**
 * @file syncService.ts
 * Serviço de Sincronização Resiliente com Fila de Espera Persistente em IndexedDB.
 * 
 * Garante que operações de escrita críticas (vendas, cadastro de produtos, clientes,
 * movimentações de caixa, etc.) nunca sejam perdidas se a rede falhar ou a sessão
 * de autenticação expirar durante o estado offline.
 */

import { SupabaseSyncService } from "./supabaseService";
import { Transaction } from "../types";

export type SyncOperationType = 
  | "TRANSACTION" 
  | "PRODUCT" 
  | "CUSTOMER" 
  | "CASHFLOW" 
  | "CASH_CLOSURE" 
  | "EMPLOYEE" 
  | "SETTINGS" 
  | "AUDIT_LOG";

export interface SyncQueueItem {
  id: string;
  type: SyncOperationType;
  payload: any;
  timestamp: string;
  userId?: string;
  retryCount: number;
  lastError?: string;
  status: "PENDING" | "PROCESSING" | "FAILED";
}

const DB_NAME = "ost_vendas_sync_db";
const DB_VERSION = 1;
const STORE_NAME = "sync_queue";

class IndexedDBQueueManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return Promise.reject(new Error("IndexedDB não suportado neste ambiente"));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("timestamp", "timestamp", { unique: false });
            store.createIndex("status", "status", { unique: false });
            store.createIndex("type", "type", { unique: false });
            store.createIndex("userId", "userId", { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    return this.dbPromise;
  }

  async getAll(): Promise<SyncQueueItem[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const items: SyncQueueItem[] = req.result || [];
          // Ordenar cronologicamente
          items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback para localStorage
      try {
        const raw = localStorage.getItem("pos_sync_queue");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
  }

  async put(item: SyncQueueItem): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback de contingência
      try {
        const raw = localStorage.getItem("pos_sync_queue");
        const list: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(i => i.id === item.id);
        if (idx >= 0) list[idx] = item;
        else list.push(item);
        localStorage.setItem("pos_sync_queue", JSON.stringify(list));
      } catch (e) {
        console.warn("Falha no fallback de escrita:", e);
      }
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const raw = localStorage.getItem("pos_sync_queue");
        if (raw) {
          const list: SyncQueueItem[] = JSON.parse(raw);
          const filtered = list.filter(i => i.id !== id);
          localStorage.setItem("pos_sync_queue", JSON.stringify(filtered));
        }
      } catch {}
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
    try {
      localStorage.removeItem("pos_sync_queue");
    } catch {}
  }
}

const idbManager = new IndexedDBQueueManager();

type SyncSubscriber = (pendingCount: number, queue: SyncQueueItem[]) => void;
const subscribers: Set<SyncSubscriber> = new Set();

function notifySubscribers(count: number, queue: SyncQueueItem[]) {
  subscribers.forEach(sub => {
    try {
      sub(count, queue);
    } catch (e) {
      console.warn("Erro no listener de fila de sincronização:", e);
    }
  });
}

/**
 * Serviço Principal de Sincronização e Fila de Escrita Resiliente (SyncService)
 */
export const SyncService = {
  /**
   * Adiciona uma operação de escrita crítica à fila persistente no IndexedDB
   */
  async enqueue(operation: {
    type: SyncOperationType;
    payload: any;
    id?: string;
    timestamp?: string;
    userId?: string;
  }): Promise<string> {
    const itemId = operation.id || `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const queueItem: SyncQueueItem = {
      id: itemId,
      type: operation.type,
      payload: operation.payload,
      timestamp: operation.timestamp || new Date().toISOString(),
      userId: operation.userId,
      retryCount: 0,
      status: "PENDING"
    };

    await idbManager.put(queueItem);
    
    // Notifica subscribers com lista atualizada
    const queue = await idbManager.getAll();
    notifySubscribers(queue.length, queue);

    console.log(`[SyncService] Operação ${operation.type} (#${itemId}) armazenada na fila persistente do IndexedDB.`);
    return itemId;
  },

  /**
   * Obtém todos os itens pendentes na fila
   */
  async getQueue(): Promise<SyncQueueItem[]> {
    return await idbManager.getAll();
  },

  /**
   * Obtém a contagem de itens pendentes
   */
  async getPendingCount(): Promise<number> {
    const queue = await idbManager.getAll();
    return queue.filter(q => q.status !== "PROCESSING").length;
  },

  /**
   * Remove item individual da fila após sincronização bem-sucedida
   */
  async removeItem(id: string): Promise<void> {
    await idbManager.remove(id);
    const queue = await idbManager.getAll();
    notifySubscribers(queue.length, queue);
  },

  /**
   * Limpa todos os itens da fila
   */
  async clearQueue(): Promise<void> {
    await idbManager.clear();
    notifySubscribers(0, []);
  },

  /**
   * Pré-carrega de forma expressa as transações das últimas 24 horas para visualização imediata no POS
   */
  async prefetchRecentTransactions24h(): Promise<Transaction[]> {
    try {
      console.log("[SyncService] Pré-carregando transações das últimas 24h para prontidão imediata do POS...");
      const recent = await SupabaseSyncService.fetchRecentTransactions24h();
      console.log(`[SyncService] ${recent.length} transações recentes das últimas 24h obtidas com prioridade.`);
      return recent;
    } catch (err) {
      console.warn("[SyncService] Falha ao pré-carregar transações das últimas 24h:", err);
      return [];
    }
  },

  /**
   * Inscreve um ouvinte para alterações no estado da fila de sincronização
   */
  subscribe(callback: SyncSubscriber): () => void {
    subscribers.add(callback);
    // Dispara estado atual imediatamente
    idbManager.getAll().then(q => callback(q.length, q)).catch(() => callback(0, []));
    return () => {
      subscribers.delete(callback);
    };
  },

  /**
   * Executa a drenagem e sincronização atómica da fila persistente contra o Supabase
   */
  async flushQueue(): Promise<{ processed: number; failed: number; total: number }> {
    const queue = await idbManager.getAll();
    if (queue.length === 0) {
      return { processed: 0, failed: 0, total: 0 };
    }

    console.log(`[SyncService] Iniciando flush de ${queue.length} operações pendentes no IndexedDB...`);

    let processed = 0;
    let failed = 0;

    for (const item of queue) {
      item.status = "PROCESSING";
      await idbManager.put(item);

      let success = false;
      let errorMsg = "";

      try {
        switch (item.type) {
          case "TRANSACTION": {
            const res = await SupabaseSyncService.processSaleAtomic(item.payload);
            success = !!res.success;
            if (!res.success) errorMsg = res.error || "Falha ao processar venda no Supabase";
            break;
          }
          case "PRODUCT": {
            success = await SupabaseSyncService.saveProduct(item.payload);
            if (!success) errorMsg = "Falha ao gravar produto no Supabase";
            break;
          }
          case "CUSTOMER": {
            success = await SupabaseSyncService.saveCustomer(item.payload);
            if (!success) errorMsg = "Falha ao gravar cliente no Supabase";
            break;
          }
          case "CASHFLOW": {
            success = await SupabaseSyncService.saveCashFlowEntry(item.payload);
            if (!success) errorMsg = "Falha ao gravar fluxo de caixa";
            break;
          }
          case "CASH_CLOSURE": {
            success = await SupabaseSyncService.saveCashClosure(item.payload);
            if (!success) errorMsg = "Falha ao gravar fechamento de caixa";
            break;
          }
          case "EMPLOYEE": {
            success = await SupabaseSyncService.saveEmployee(item.payload);
            if (!success) errorMsg = "Falha ao sincronizar colaborador";
            break;
          }
          case "SETTINGS": {
            success = await SupabaseSyncService.saveSettings(item.payload);
            if (!success) errorMsg = "Falha ao sincronizar configurações";
            break;
          }
          case "AUDIT_LOG": {
            success = await SupabaseSyncService.saveAuditLog(item.payload);
            if (!success) errorMsg = "Falha ao sincronizar log de auditoria";
            break;
          }
          default:
            success = true;
        }
      } catch (err: any) {
        success = false;
        errorMsg = err?.message || String(err);
      }

      if (success) {
        processed++;
        await idbManager.remove(item.id);
        console.log(`[SyncService] Operação ${item.type} (#${item.id}) sincronizada com sucesso.`);
      } else {
        failed++;
        item.status = "FAILED";
        item.retryCount = (item.retryCount || 0) + 1;
        item.lastError = errorMsg;
        await idbManager.put(item);
        console.warn(`[SyncService] Falha ao sincronizar #${item.id} (${item.type}):`, errorMsg);
      }
    }

    const remaining = await idbManager.getAll();
    notifySubscribers(remaining.length, remaining);

    return { processed, failed, total: queue.length };
  }
};

/**
 * Alias de compatibilidade retroativa para módulos existentes
 */
export const OfflineQueueService = {
  getQueue: () => {
    try {
      const q = localStorage.getItem("pos_sync_queue");
      return q ? JSON.parse(q) : [];
    } catch {
      return [];
    }
  },
  enqueue: (item: { type: SyncOperationType; payload: any; timestamp?: string; id?: string; userId?: string }) => {
    SyncService.enqueue(operationMapper(item));
  },
  clearQueue: () => {
    SyncService.clearQueue();
  },
  flushQueue: () => {
    return SyncService.flushQueue();
  }
};

function operationMapper(item: any): { type: SyncOperationType; payload: any; id?: string; timestamp?: string; userId?: string } {
  return {
    type: item.type as SyncOperationType,
    payload: item.payload,
    id: item.id,
    timestamp: item.timestamp,
    userId: item.userId
  };
}

// Configuração de Auto-Flush ao restabelecer ligação à internet
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[SyncService] Ligação à Internet restabelecida. Executando sincronização de fila persistente...");
    SyncService.flushQueue().catch(err => {
      console.warn("[SyncService] Erro ao sincronizar automaticamente em evento online:", err);
    });
  });
}
