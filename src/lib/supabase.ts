/**
 * @file supabase.ts
 * Inicialização Centralizada do Cliente Supabase (@supabase/supabase-js) Singleton.
 * 
 * Utiliza as variáveis de ambiente 'VITE_SUPABASE_URL' e 'VITE_SUPABASE_ANON_KEY'
 * para autenticação e conexão com o banco de dados PostgreSQL relacional.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Resolução segura de variáveis de ambiente com fallbacks resilientes
const env = (import.meta as any).env || {};
export const SUPABASE_URL: string = env.VITE_SUPABASE_URL || "https://ost-vendas-db.supabase.co";
export const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.anon-key";

/**
 * Cliente Singleton do Supabase para uso em toda a aplicação.
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  }
});

/**
 * Retorna a instância singleton do cliente Supabase.
 */
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

export default supabase;
