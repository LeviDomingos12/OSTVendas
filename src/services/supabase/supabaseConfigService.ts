/**
 * @file supabaseConfigService.ts
 * Gestão de configuração, inicialização do cliente Supabase e diagnóstico de rede/sessão.
 */

import { createClient, SupabaseClient, Session, User } from "@supabase/supabase-js";
import { supabase as singletonClient } from "../../lib/supabase";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
  autoSync: boolean;
  tenantId: string;
}

export interface LatencyResult {
  latencyMs: number;
  status: "optimal" | "good" | "slow" | "error";
  message: string;
  timestamp: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  user: User | null;
  session: Session | null;
  expiresAt: string | null;
  email: string | null;
  role: string | null;
  message: string;
}

export interface CloudBackupItem {
  name: string;
  filename: string;
  fullPath: string;
  size: number;
  updated: string;
  downloadUrl: string;
}

export interface RecoveryRequestEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  email?: string;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  timestamp: string;
}

export const STORAGE_KEY_CONFIG = "ostvendas_supabase_config";
export const DEFAULT_TENANT_ID = "ost-tenant-001";

/**
 * Obtém a configuração ativa do Supabase (lê de variáveis de ambiente ou do armazenamento local)
 */
export function getSupabaseConfig(): SupabaseConfig {
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || "";
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || "";

  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
    const activeTenant = localStorage.getItem("erp_current_tenant_id");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        url: parsed.url || envUrl,
        anonKey: parsed.anonKey || envKey,
        enabled: parsed.enabled ?? Boolean(envUrl && envKey),
        autoSync: parsed.autoSync ?? true,
        tenantId: activeTenant || parsed.tenantId || DEFAULT_TENANT_ID
      };
    }
    if (activeTenant) {
      return {
        url: envUrl,
        anonKey: envKey,
        enabled: Boolean(envUrl && envKey),
        autoSync: true,
        tenantId: activeTenant
      };
    }
  } catch (e) {
    console.error("Erro ao ler configuração do Supabase", e);
  }

  return {
    url: envUrl,
    anonKey: envKey,
    enabled: Boolean(envUrl && envKey),
    autoSync: true,
    tenantId: DEFAULT_TENANT_ID
  };
}

let cachedClient: SupabaseClient | null = null;

/**
 * Salva a configuração do Supabase
 */
export function saveSupabaseConfig(config: Partial<SupabaseConfig>): void {
  const current = getSupabaseConfig();
  const updated: SupabaseConfig = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
  if (config.tenantId) {
    localStorage.setItem("erp_current_tenant_id", config.tenantId);
  }
  cachedClient = null;
}

/**
 * Obtém ou instancia o cliente Supabase de forma lazy
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || !config.enabled) {
    return singletonClient;
  }

  if (!cachedClient) {
    try {
      cachedClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (err) {
      console.warn("Falha ao inicializar cliente Supabase personalizado, usando singleton:", err);
      return singletonClient;
    }
  }

  return cachedClient || singletonClient;
}

/**
 * Mede a latência real da rede com o Supabase (Ping em milissegundos)
 */
export async function measureSupabaseLatency(customUrl?: string, customKey?: string): Promise<LatencyResult> {
  const url = customUrl || getSupabaseConfig().url;
  const key = customKey || getSupabaseConfig().anonKey;

  if (!url || !key) {
    return {
      latencyMs: 0,
      status: "error",
      message: "Credenciais do servidor de dados não configuradas.",
      timestamp: new Date().toISOString()
    };
  }

  const startTime = performance.now();
  try {
    const client = createClient(url, key);
    const { error } = await client.from("produtos").select("id").limit(1);
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    if (error && error.code !== "PGRST116" && error.code !== "42P01") {
      return {
        latencyMs,
        status: "error",
        message: `Falha na resposta: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }

    let status: "optimal" | "good" | "slow" = "optimal";
    let message = `Excelente conexão com o Servidor Backend (${latencyMs}ms)`;
    if (latencyMs > 350) {
      status = "slow";
      message = `Latência elevada (${latencyMs}ms) - Verifique a sua ligação de rede.`;
    } else if (latencyMs > 150) {
      status = "good";
      message = `Boa conexão estável com o Servidor Backend (${latencyMs}ms)`;
    }

    return {
      latencyMs,
      status,
      message,
      timestamp: new Date().toISOString()
    };
  } catch (err: unknown) {
    const endTime = performance.now();
    const errMsg = err instanceof Error ? err.message : "Sem resposta do servidor remoto.";
    return {
      latencyMs: Math.round(endTime - startTime),
      status: "error",
      message: errMsg,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Validação em tempo real da sessão do utilizador com o Supabase Auth
 */
export async function validateSupabaseSession(): Promise<SessionValidationResult> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      isValid: false,
      user: null,
      session: null,
      expiresAt: null,
      email: null,
      role: null,
      message: "Servidor de dados inativo ou não configurado."
    };
  }

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      return {
        isValid: false,
        user: null,
        session: null,
        expiresAt: null,
        email: null,
        role: null,
        message: `Erro na sessão: ${error.message}`
      };
    }

    if (!session || !session.user) {
      return {
        isValid: false,
        user: null,
        session: null,
        expiresAt: null,
        email: null,
        role: null,
        message: "Nenhuma sessão ativa encontrada."
      };
    }

    return {
      isValid: true,
      user: session.user,
      session,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      email: session.user.email || null,
      role: session.user.role || (session.user.user_metadata as Record<string, string>)?.role || "Utilizador Autenticado",
      message: `Sessão ativa e válida para ${session.user.email || "Utilizador"}`
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Falha ao validar sessão.";
    return {
      isValid: false,
      user: null,
      session: null,
      expiresAt: null,
      email: null,
      role: null,
      message: errMsg
    };
  }
}

/**
 * Testa a conexão com o Supabase
 */
export async function testSupabaseConnection(url?: string, key?: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const targetUrl = url || getSupabaseConfig().url;
  const targetKey = key || getSupabaseConfig().anonKey;

  if (!targetUrl || !targetKey) {
    return { success: false, message: "URL ou Chave do Supabase não fornecidas." };
  }

  try {
    const latency = await measureSupabaseLatency(targetUrl, targetKey);
    if (latency.status === "error") {
      return { success: false, message: latency.message, latencyMs: latency.latencyMs };
    }
    return { 
      success: true, 
      message: `Conexão estabelecida com sucesso! (${latency.latencyMs}ms)`, 
      latencyMs: latency.latencyMs 
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Erro desconhecido ao conectar ao Supabase.";
    return { success: false, message: errMsg };
  }
}
