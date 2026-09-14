import { useSyncExternalStore } from "react";

const VERSION_STORAGE_KEY = "ost_system_version";
const VERSION_CHANGE_EVENT = "ost_version_changed";

// Versão padrão do sistema alinhada com os serviços de produção (OST Vendas v34.0)
export const DEFAULT_SYSTEM_VERSION = "34.0";

let cachedVersion: string = DEFAULT_SYSTEM_VERSION;
if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem(VERSION_STORAGE_KEY);
    if (saved && saved.trim()) {
      const parsedMajor = parseInt(saved.trim().replace(/^v/i, "").split(".")[0] || "0", 10);
      if (parsedMajor < 34) {
        cachedVersion = DEFAULT_SYSTEM_VERSION;
        localStorage.setItem(VERSION_STORAGE_KEY, DEFAULT_SYSTEM_VERSION);
      } else {
        cachedVersion = saved.trim().replace(/^v/i, "");
      }
    } else {
      localStorage.setItem(VERSION_STORAGE_KEY, DEFAULT_SYSTEM_VERSION);
    }
  } catch (e) {}
}

const listeners = new Set<() => void>();

function notifyListeners(): void {
  setTimeout(() => {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error("Error in version listener:", e);
      }
    });
  }, 0);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const handleStorageOrCustomEvent = () => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(VERSION_STORAGE_KEY);
        if (saved && saved.trim()) {
          cachedVersion = saved.trim();
        }
      } catch (e) {}
    }
    listener();
  };

  if (typeof window !== "undefined") {
    window.addEventListener(VERSION_CHANGE_EVENT, handleStorageOrCustomEvent);
    window.addEventListener("storage", handleStorageOrCustomEvent);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener(VERSION_CHANGE_EVENT, handleStorageOrCustomEvent);
      window.removeEventListener("storage", handleStorageOrCustomEvent);
    }
  };
}

/**
 * Computes next system version following strict sequence:
 * 1.0 → 1.1 → 1.2 → ... → 1.9 → 2.0 → 2.1 → ... → 2.9 → 3.0
 */
export function getNextVersion(currentVersion: string): string {
  const clean = currentVersion.trim().replace(/^v/i, "");
  const parts = clean.split(".");
  let major = parseInt(parts[0] || "1", 10);
  let minor = parseInt(parts[1] || "0", 10);

  if (isNaN(major) || major < 1) major = 1;
  if (isNaN(minor) || minor < 0) minor = 0;

  minor += 1;
  if (minor >= 10) {
    major += 1;
    minor = 0;
  }

  return `${major}.${minor}`;
}

/**
 * Gets the current persisted system version or initializes to '1.0'
 */
export function getSystemVersion(): string {
  return cachedVersion;
}

/**
 * Gets the current formatted version string (e.g. 'v1.0')
 */
export function getFormattedSystemVersion(): string {
  return `v${cachedVersion}`;
}

/**
 * Sets and persists the system version
 */
export function setSystemVersion(version: string): void {
  if (typeof window === "undefined") return;
  try {
    const clean = version.trim().replace(/^v/i, "");
    if (cachedVersion === clean) return;
    cachedVersion = clean;
    localStorage.setItem(VERSION_STORAGE_KEY, clean);
    notifyListeners();
    window.dispatchEvent(new CustomEvent(VERSION_CHANGE_EVENT, { detail: clean }));
  } catch (e) {
    console.error("Failed to save system version:", e);
  }
}

/**
 * Increments the system version to the next iteration (e.g., 1.0 -> 1.1)
 */
export function incrementSystemVersion(): string {
  const current = getSystemVersion();
  const next = getNextVersion(current);
  setSystemVersion(next);
  return next;
}

const getSnapshot = () => cachedVersion;
const getServerSnapshot = () => DEFAULT_SYSTEM_VERSION;

let isSyncingVersion = false;

/**
 * Sincroniza ativamente a versão oficial do sistema a partir da API do servidor
 */
export async function syncSystemVersionFromServer(): Promise<string> {
  if (typeof window === "undefined" || isSyncingVersion) return cachedVersion;
  isSyncingVersion = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const endpoints = ["/api/system/version", "/api/health"];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          cache: "no-store",
          headers: {
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
          },
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          const serverVer = data.version ? String(data.version).trim().replace(/^v/i, "") : null;
          if (serverVer) {
            clearTimeout(timeoutId);
            setSystemVersion(serverVer);
            return serverVer;
          }
        }
      } catch {}
    }
    clearTimeout(timeoutId);
  } catch (err) {
    console.debug("[VersionManager] Sincronização em segundo plano concluída.");
  } finally {
    isSyncingVersion = false;
  }

  return cachedVersion;
}

// Inicia verificação imediata e nos eventos de foco/online da janela
if (typeof window !== "undefined") {
  setTimeout(() => {
    syncSystemVersionFromServer();
  }, 100);

  window.addEventListener("focus", () => {
    syncSystemVersionFromServer();
  });
  window.addEventListener("online", () => {
    syncSystemVersionFromServer();
  });
}

/**
 * React hook to access and subscribe to real-time system version updates safely without setState-in-render side effects
 */
export function useSystemVersion(): {
  version: string;
  formattedVersion: string;
  incrementVersion: () => string;
  setVersion: (v: string) => void;
  syncWithServer: () => Promise<string>;
} {
  const version = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    version,
    formattedVersion: `v${version}`,
    incrementVersion: incrementSystemVersion,
    setVersion: setSystemVersion,
    syncWithServer: syncSystemVersionFromServer
  };
}

