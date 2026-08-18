/**
 * @file supabase.ts
 * Inicialização Centralizada do Cliente Supabase (@supabase/supabase-js).
 * 
 * Cria e exporta o cliente singleton 'supabase' para toda a aplicação OST Vendas,
 * utilizando as variáveis de ambiente 'VITE_SUPABASE_URL' e 'VITE_SUPABASE_ANON_KEY'.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Carregamento resiliente das variáveis de ambiente
const env = (import.meta as any).env || {};
export const SUPABASE_URL: string = 
  env.VITE_SUPABASE_URL || 
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) || 
  "https://ost-vendas-db.supabase.co";

export const SUPABASE_ANON_KEY: string = 
  env.VITE_SUPABASE_ANON_KEY || 
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.anon-key";

/**
 * Instância Singleton do cliente Supabase para toda a aplicação.
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

/**
 * Retorna o cliente Supabase singleton
 */
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

export default supabase;
