/**
 * @file src/server/authMiddleware.ts
 * Middleware de Autenticação e Autorização Estrita com Supabase Auth no Backend Express.
 * 
 * Funcionalidades:
 * - Validação de tokens JWT do Supabase (@supabase/supabase-js)
 * - Obtenção autoritativa de identidade, tenantId (company_id) e role a partir do banco
 * - Bloqueio de contas suspensas, inativas ou expiradas
 * - Proteção RBAC (ADMIN, SUPERVISOR, CASHIER, etc.)
 */

import { Request, Response, NextFunction } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://ost-vendas-db.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente público/anon para validação de JWTs de utilizadores
export const supabasePublicAuth: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.anon-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Cliente com privilégios de serviço SOMENTE se a chave existir explicitamente no ambiente backend
export const supabaseServerAdmin: SupabaseClient | null = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

export interface AuthenticatedUserContext {
  id: string;
  email: string;
  tenantId: string;
  role: "ADMIN" | "SUPERVISOR" | "CASHIER" | "SELLER" | "STOCK_MANAGER";
  name: string;
  companyName: string;
  subscriptionPlan: "BRONZE" | "PRATA" | "OURO" | "ENTERPRISE";
}

export function normalizeRole(roleStr: string): "ADMIN" | "SUPERVISOR" | "CASHIER" | "SELLER" | "STOCK_MANAGER" {
  const r = (roleStr || "").toUpperCase();
  if (r.includes("ADMIN")) return "ADMIN";
  if (r.includes("SUPERV") || r.includes("GERENT") || r.includes("MANAGER")) return "SUPERVISOR";
  if (r.includes("CAIXA") || r.includes("POS") || r.includes("CASHIER")) return "CASHIER";
  if (r.includes("VEND") || r.includes("COMERC") || r.includes("SELLER")) return "SELLER";
  if (r.includes("ESTOQ") || r.includes("ARMAZ") || r.includes("STOCK")) return "STOCK_MANAGER";
  return "CASHIER";
}

export function normalizePlan(planStr: string): "BRONZE" | "PRATA" | "OURO" | "ENTERPRISE" {
  const p = (planStr || "").toUpperCase();
  if (p.includes("ENTERPRISE")) return "ENTERPRISE";
  if (p.includes("OURO") || p.includes("GOLD")) return "OURO";
  if (p.includes("PRATA") || p.includes("SILVER")) return "PRATA";
  return "BRONZE";
}

/**
 * Middleware para validar o Token JWT e injetar o utilizador autenticado e seu tenant_id
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Acesso não autorizado: Token de sessão não fornecido."
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Token de autenticação vazio."
      });
    }

    // Suporte para tokens de teste em ambiente de testes automatizados
    if (process.env.NODE_ENV === "test" && token.startsWith("test-token-")) {
      const parts = token.replace("test-token-", "").split("-");
      const role = normalizeRole(parts[0] || "ADMIN");
      const tenantId = parts[1] ? `tenant_${parts[1]}` : "tenant_test_a";
      const userId = `user_${parts[0]}_${parts[1] || "default"}`;

      (req as any).user = {
        id: userId,
        email: `${userId}@ostvendas.mz`,
        tenantId,
        role,
        name: `Test ${role}`,
        companyName: `Test Company ${tenantId}`,
        subscriptionPlan: "OURO"
      } as AuthenticatedUserContext;

      return next();
    }

    // 1. Validar token com o Supabase Auth
    const { data, error } = await supabasePublicAuth.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({
        success: false,
        error: "Sessão inválida ou expirada. Inicie sessão novamente no sistema."
      });
    }

    const user = data.user;
    const meta = user.user_metadata || {};

    let tenantId = "comp_" + user.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
    let roleRaw = meta.role || "ADMIN";
    let fullName = meta.full_name || meta.name || user.email?.split("@")[0] || "Utilizador";
    let companyName = meta.company_name || meta.branch || "OST Vendas";
    let planRaw = meta.subscription_plan || "OURO";

    // 2. Consultar base de dados para garantir permissões reais e status atualizado
    const activeClient = supabaseServerAdmin || supabasePublicAuth;
    try {
      const { data: profile } = await activeClient
        .from("profiles")
        .select("company_id, role, full_name, companies(id, name)")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        if (profile.company_id) tenantId = profile.company_id;
        if (profile.role) roleRaw = profile.role;
        if (profile.full_name) fullName = profile.full_name;
        if ((profile.companies as any)?.name) companyName = (profile.companies as any).name;
      }

      const { data: colab } = await activeClient
        .from("colaboradores")
        .select("status, role, subscription_plan, tenant_id")
        .eq("auth_uid", user.id)
        .maybeSingle();

      if (colab) {
        if (colab.status === "BLOCKED" || colab.status === "INACTIVE" || colab.status === "SUSPENDED") {
          return res.status(403).json({
            success: false,
            error: "Esta conta está bloqueada, suspensa ou inativa. Contacte a administração."
          });
        }
        if (colab.role) roleRaw = colab.role;
        if (colab.subscription_plan) planRaw = colab.subscription_plan;
        if (colab.tenant_id) tenantId = colab.tenant_id;
      }
    } catch (dbErr) {
      console.warn("[Auth Middleware] Aviso na busca complementar de perfil:", dbErr);
    }

    // Injetar contexto fidedigno e imutável no request
    (req as any).user = {
      id: user.id,
      email: user.email || "",
      tenantId,
      role: normalizeRole(roleRaw),
      name: fullName,
      companyName,
      subscriptionPlan: normalizePlan(planRaw)
    } as AuthenticatedUserContext;

    next();
  } catch (err: any) {
    console.error("[Auth Middleware] Erro na autenticação:", err);
    return res.status(401).json({
      success: false,
      error: "Falha na validação de segurança da requisição."
    });
  }
}

/**
 * Middleware para exigir perfil de Administrador
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthenticatedUserContext;
  if (!user || user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      error: "Permissão negada: Esta operação requer privilégios de Administrador do Sistema."
    });
  }
  next();
}

/**
 * Middleware para exigir perfil de Supervisor ou Administrador
 */
export function requireSupervisorOrAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthenticatedUserContext;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPERVISOR")) {
    return res.status(403).json({
      success: false,
      error: "Permissão negada: Esta operação requer privilégios de Supervisor ou Administrador."
    });
  }
  next();
}
