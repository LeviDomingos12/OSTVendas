/**
 * @file src/lib/indexedDbStorage.ts
 * Gestor Centralizado de Armazenamento Assíncrono em IndexedDB para OST Vendas.
 * 
 * Substitui o uso arriscado de localStorage para:
 * 1. Fila de Sincronização POS Offline (pos_sync_queue)
 * 2. Snapshots volumosos do ERP (catálogo de produtos, vendas, clientes, auditoria)
 * 
 * Vantagens:
 * - Não bloqueia a thread principal da UI (assíncrono)
 * - Capacidade de centenas de megabytes (sem o limite de 5MB do localStorage)
 * - Transações atómicas ACID e integridade de dados garantida
 */

export interface SyncQueueItem {
  id: string;
  type: string;
  payload: any;
  timestamp: string;
  userId?: string;
  retryCount: number;
  lastError?: string;
  status: "PENDING" | "PROCESSING" | "FAILED";
}

const DB_NAME = "ost_vendas_enterprise_idb";
const DB_VERSION = 2;

const STORES = {
  SYNC_QUEUE: "pos_sync_queue",
  SNAPSHOTS: "erp_large_snapshots",
  KEY_VAL: "system_key_val"
} as const;

class EnterpriseIndexedDb {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private isSupported(): boolean {
    return typeof window !== "undefined" && Boolean(window.indexedDB);
  }

  private getDB(): Promise<IDBDatabase> {
    if (!this.isSupported()) {
      return Promise.reject(new Error("IndexedDB não está disponível neste ambiente."));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;

          // 1. Fila de sincronização POS
          if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
            const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: "id" });
            store.createIndex("timestamp", "timestamp", { unique: false });
            store.createIndex("status", "status", { unique: false });
            store.createIndex("type", "type", { unique: false });
          }

          // 2. Snapshots grandes de dados empresariais
          if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
            const snapStore = db.createObjectStore(STORES.SNAPSHOTS, { keyPath: "key" });
            snapStore.createIndex("updatedAt", "updatedAt", { unique: false });
          }

          // 3. Store genérico chave-valor indexado
          if (!db.objectStoreNames.contains(STORES.KEY_VAL)) {
            db.createObjectStore(STORES.KEY_VAL, { keyPath: "key" });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    return this.dbPromise;
  }

  // ==========================================================================
  // 1. POS SYNC QUEUE OPERATIONS (IndexedDB)
  // ==========================================================================

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    if (!this.isSupported()) return [];
    try {
      const db = await this.getDB();
      return new Promise<SyncQueueItem[]>((resolve, reject) => {
        const tx = db.transaction(STORES.SYNC_QUEUE, "readonly");
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const req = store.getAll();

        req.onsuccess = () => {
          const list: SyncQueueItem[] = req.result || [];
          list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[IndexedDB] Falha ao ler pos_sync_queue:", err);
      return [];
    }
  }

  async addSyncQueueItem(item: SyncQueueItem): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.SYNC_QUEUE, "readwrite");
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const req = store.put(item);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error("[IndexedDB] Erro ao adicionar item à fila POS:", err);
      throw err;
    }
  }

  async removeSyncQueueItem(id: string): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.SYNC_QUEUE, "readwrite");
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error("[IndexedDB] Erro ao remover item da fila POS:", err);
    }
  }

  async updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.SYNC_QUEUE, "readwrite");
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          if (getReq.result) {
            const updated = { ...getReq.result, ...updates };
            const putReq = store.put(updated);
            putReq.onsuccess = () => resolve();
            putReq.onerror = () => reject(putReq.error);
          } else {
            resolve();
          }
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } catch (err) {
      console.error("[IndexedDB] Erro ao atualizar item da fila POS:", err);
    }
  }

  async clearSyncQueue(): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.SYNC_QUEUE, "readwrite");
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error("[IndexedDB] Erro ao limpar fila de sincronização:", err);
    }
  }

  // ==========================================================================
  // 2. LARGE DATA SNAPSHOTS OPERATIONS (IndexedDB)
  // ==========================================================================

  async saveSnapshot<T = any>(key: string, data: T): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.SNAPSHOTS, "readwrite");
        const store = tx.objectStore(STORES.SNAPSHOTS);
        const record = {
          key,
          data,
          updatedAt: new Date().toISOString(),
          byteSizeApprox: JSON.stringify(data).length
        };
        const req = store.put(record);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[IndexedDB] Falha ao persistir snapshot (${key}):`, err);
    }
  }

  async getSnapshot<T = any>(key: string): Promise<T | null> {
    if (!this.isSupported()) return null;
    try {
      const db = await this.getDB();
      return new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORES.SNAPSHOTS, "readonly");
        const store = tx.objectStore(STORES.SNAPSHOTS);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result && req.result.data !== undefined) {
            resolve(req.result.data as T);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[IndexedDB] Falha ao recuperar snapshot (${key}):`, err);
      return null;
    }
  }

  async deleteSnapshot(key: string): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.SNAPSHOTS, "readwrite");
        const store = tx.objectStore(STORES.SNAPSHOTS);
        const req = store.delete(key);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[IndexedDB] Falha ao apagar snapshot (${key}):`, err);
    }
  }
}

export const indexedDbStorage = new EnterpriseIndexedDb();
