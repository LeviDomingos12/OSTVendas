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
 * Retorna o URI de redirecionamento dinâmico e exato para a aplicação cliente,
 * alinhado com as configurações do Google Cloud Console e Supabase Auth.
 */
export function getAuthRedirectUrl(): string {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin;
  }
  return env.APP_URL || "http://localhost:3000";
}

/**
 * Retorna o URI de callback OAuth do Supabase correspondente ao projeto.
 * Este URI DEVE ser adicionado nos 'URIs de redirecionamento autorizados' do Google Cloud Console.
 * Formato: https://<project-ref>.supabase.co/auth/v1/callback
 */
export function getSupabaseOAuthCallbackUrl(): string {
  try {
    const urlObj = new URL(SUPABASE_URL);
    return `${urlObj.origin}/auth/v1/callback`;
  } catch {
    return `${SUPABASE_URL}/auth/v1/callback`;
  }
}

/**
 * Cliente Singleton do Supabase para uso em toda a aplicação.
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    flowType: "pkce"
  }
});

/**
 * Retorna a instância singleton do cliente Supabase.
 */
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

/**
 * Inicia o fluxo de autenticação com Google no Supabase com os URIs de redirecionamento corretos.
 */
export async function signInWithGoogleOAuth(customRedirect?: string) {
  const targetRedirect = customRedirect || getAuthRedirectUrl();
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: targetRedirect,
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    }
  });
}

export default supabase;

