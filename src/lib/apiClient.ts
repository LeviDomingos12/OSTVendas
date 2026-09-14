/**
 * @file src/lib/apiClient.ts
 * Cliente HTTP Seguro com Injeção Automática de Token JWT do Supabase Auth.
 * 
 * Garante que todas as chamadas à API do backend (/api/*) incluem
 * a identidade autenticada do utilizador e previnem escalada de privilégios.
 */

import { supabase } from "./supabase";

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

type RateLimitCallback = (message: string) => void;
let rateLimitCallback: RateLimitCallback | null = null;
let lastRateLimitToastTime = 0;

export function setRateLimitCallback(cb: RateLimitCallback | null): () => void {
  rateLimitCallback = cb;
  return () => {
    if (rateLimitCallback === cb) {
      rateLimitCallback = null;
    }
  };
}

/**
 * Executa uma requisição HTTP incluindo automaticamente o cabeçalho Authorization com o Bearer Token do Supabase.
 */
export async function authenticatedFetch(input: string | URL, init: ApiFetchOptions = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  } catch (err) {
    console.warn("[ApiClient] Não foi possível obter o token de sessão do Supabase:", err);
  }

  // Anexar Tenant ID ativo da sessão para validação no backend
  try {
    const storedTenant = typeof window !== "undefined" ? (localStorage.getItem("erp_current_tenant_id") || localStorage.getItem("supabase_config")) : null;
    let tenantId = "";
    if (storedTenant) {
      try {
        const parsed = JSON.parse(storedTenant);
        if (typeof parsed === "string") tenantId = parsed;
        else if (parsed.tenantId) tenantId = parsed.tenantId;
      } catch {
        tenantId = storedTenant;
      }
    }
    if (tenantId && tenantId.trim() && !headers.has("X-Tenant-Id")) {
      headers.set("X-Tenant-Id", tenantId.trim());
    }
  } catch {}

  // Prevenir caching de respostas de dados sensíveis
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  }

  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const timeoutMs = init.timeoutMs || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      headers,
      signal: init.signal || controller.signal
    });

    if (response.status === 429 && rateLimitCallback) {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request)?.url || "";
      const isBackgroundCall =
        rawUrl.includes("/api/db/save") ||
        rawUrl.includes("/api/db/load") ||
        rawUrl.includes("/api/health") ||
        rawUrl.includes("/api/system/version") ||
        rawUrl.includes("/api/security/storage-health") ||
        rawUrl.includes("/api/security/firewall-status") ||
        rawUrl.includes("/api/security/rate-limit-status");

      const now = Date.now();
      if (!isBackgroundCall && now - lastRateLimitToastTime > 30000) {
        lastRateLimitToastTime = now;
        response
          .clone()
          .json()
          .then((data: Record<string, unknown>) => {
            const msg = (typeof data?.message === "string" ? data.message : undefined) || 
                        (typeof data?.error === "string" ? data.error : undefined) || 
                        "Limite de requisições ao servidor atingido (429). Aguarde alguns segundos.";
            rateLimitCallback?.(msg);
          })
          .catch(() => {
            rateLimitCallback?.("Limite de requisições ao servidor atingido (429). Aguarde alguns segundos.");
          });
      }
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Wrapper conveniente para chamadas JSON autenticadas
 */
export async function apiPost<T = unknown>(endpoint: string, bodyData: unknown): Promise<T> {
  const res = await authenticatedFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyData)
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errBody.message || `Erro HTTP ${res.status}`);
  }

  return res.json();
}

export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  const res = await authenticatedFetch(endpoint, {
    method: "GET"
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errBody.message || `Erro HTTP ${res.status}`);
  }

  return res.json();
}
