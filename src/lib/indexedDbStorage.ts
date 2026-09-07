/**
 * @file src/lib/indexedDbStorage.ts
 * Gestor de Cache e Armazenamento Local de Alta Capacidade via IndexedDB.
 * 
 * Substitui o uso de localStorage para coleções operacionais grandes (produtos, vendas, clientes, etc.),
 * prevenindo erros de QuotaExceeded e assegurando integridade offline.
 */

import { Product, Customer, Transaction, CashFlowEntry, Employee, AuditLog, SystemSettings } from "../types";

export interface ErpSnapshotData {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  cashflow: CashFlowEntry[];
  employees: Employee[];
  auditlogs: AuditLog[];
  settings: SystemSettings | null;
  cachedAt: string;
}

const DB_NAME = "ost_vendas_operational_cache";
const DB_VERSION = 1;
const STORE_NAME = "operational_data";

class OperationalIndexedDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return Promise.reject(new Error("IndexedDB não disponível no ambiente atual"));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "key" });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    return this.dbPromise;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ key, value, updatedAt: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[IndexedDB] Falha ao guardar chave ${key}:`, err);
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.value !== undefined) {
            resolve(req.result.value as T);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[IndexedDB] Falha ao ler chave ${key}:`, err);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[IndexedDB] Falha ao remover chave ${key}:`, err);
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[IndexedDB] Falha ao limpar base de dados:", err);
    }
  }

  /**
   * Armazena snapshot completo com segurança e alta performance
   */
  async saveSnapshot(key: string, data: ErpSnapshotData): Promise<void> {
    await this.setItem<ErpSnapshotData>(key, data);
  }

  /**
   * Recupera snapshot completo do IndexedDB
   */
  async loadSnapshot(key: string): Promise<ErpSnapshotData | null> {
    return this.getItem<ErpSnapshotData>(key);
  }
}

export const operationalCache = new OperationalIndexedDB();
