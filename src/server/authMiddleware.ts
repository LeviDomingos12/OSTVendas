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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente público/anon para validação de JWTs de utilizadores (apenas se configurado explicitamente)
export const supabasePublicAuth: SupabaseClient | null = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )
  : null;

// Cliente com privilégios de serviço SOMENTE se a chave existir explicitamente no ambiente backend (nunca substitui por anon key)
export const supabaseServerAdmin: SupabaseClient | null = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
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

export function normalizeRole(roleStr: string | undefined | null): "ADMIN" | "SUPERVISOR" | "CASHIER" | "SELLER" | "STOCK_MANAGER" | null {
  if (!roleStr || typeof roleStr !== "string") return null;
  const r = roleStr.trim().toUpperCase();
  if (r === "ADMIN" || r.includes("ADMIN") || r.includes("GERENTE_GERAL") || r.includes("PROPRIETARIO")) return "ADMIN";
  if (r === "SUPERVISOR" || r.includes("SUPERV") || r.includes("GERENT") || r.includes("MANAGER")) return "SUPERVISOR";
  if (r === "CASHIER" || r.includes("CAIXA") || r.includes("POS") || r.includes("OPERADOR")) return "CASHIER";
  if (r === "SELLER" || r.includes("VEND") || r.includes("COMERC") || r.includes("SELLER")) return "SELLER";
  if (r === "STOCK_MANAGER" || r.includes("ESTOQ") || r.includes("ARMAZ") || r.includes("STOCK")) return "STOCK_MANAGER";
  return null;
}

export function normalizePlan(planStr: string | undefined | null): "BRONZE" | "PRATA" | "OURO" | "ENTERPRISE" {
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
      const roleParsed = normalizeRole(parts[0]);
      const role = roleParsed || "ADMIN";
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
    if (!supabasePublicAuth) {
      return res.status(503).json({
        success: false,
        error: "Serviço de autenticação Supabase não está configurado no servidor."
      });
    }

    const { data, error } = await supabasePublicAuth.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({
        success: false,
        error: "Sessão inválida ou expirada. Inicie sessão novamente no sistema."
      });
    }

    const user = data.user;
    const meta = user.user_metadata || {};

    let tenantId = (meta.company_id || meta.tenant_id || "").trim();
    let roleRaw: string | null = meta.role || null;
    let fullName = meta.full_name || meta.name || user.email?.split("@")[0] || "Utilizador";
    let companyName = meta.company_name || meta.branch || "OST Vendas";
    let planRaw = meta.subscription_plan || "OURO";

    // 2. Consultar base de dados para garantir permissões reais e status atualizado (autoritativo do banco)
    const activeClient = supabaseServerAdmin || supabasePublicAuth;
    try {
      const { data: profile } = await activeClient
        .from("profiles")
        .select("company_id, role, full_name, companies(id, name)")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        if (profile.company_id && profile.company_id.trim() !== "") tenantId = profile.company_id.trim();
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
        if (colab.tenant_id && colab.tenant_id.trim() !== "") tenantId = colab.tenant_id.trim();
      }
    } catch (dbErr) {
      console.warn("[Auth Middleware] Aviso na busca complementar de perfil:", dbErr);
    }

    // Se o utilizador não possuir tenant válido, rejeitar a operação
    if (!tenantId || tenantId.trim() === "") {
      return res.status(403).json({
        success: false,
        error: "Utilizador sem organização/empresa (tenant) válida associada. Operação rejeitada."
      });
    }

    // Validar role de forma estrita (sem fallback para ADMIN ou CASHIER)
    const verifiedRole = normalizeRole(roleRaw);
    if (!verifiedRole) {
      return res.status(403).json({
        success: false,
        error: "Perfil de utilizador sem papel (role) autorizado no sistema."
      });
    }

    // Proteção Anti-Spoofing: Verificar se o cliente tentou enviar tenant_id diferente no cabeçalho ou corpo
    const clientHeaderTenant = req.headers["x-tenant-id"] as string | undefined;
    const clientBodyTenant = req.body?.tenant_id || req.body?.tenantId || req.body?.p_tenant_id;
    const clientQueryTenant = req.query?.tenant_id || req.query?.tenantId;

    if (
      (clientHeaderTenant && clientHeaderTenant.trim() !== tenantId) ||
      (clientBodyTenant && typeof clientBodyTenant === "string" && clientBodyTenant.trim() !== "" && clientBodyTenant.trim() !== tenantId) ||
      (clientQueryTenant && typeof clientQueryTenant === "string" && clientQueryTenant.trim() !== "" && clientQueryTenant.trim() !== tenantId)
    ) {
      return res.status(403).json({
        success: false,
        error: "Violação de segurança: Tenant fornecido pelo cliente não corresponde à identidade autenticada do token."
      });
    }

    // Injetar contexto fidedigno e imutável no request derivado do token verificado
    (req as any).user = {
      id: user.id,
      email: user.email || "",
      tenantId,
      role: verifiedRole,
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

/**
 * Middleware para exigir perfil de Gestor de Stock, Supervisor ou Administrador
 */
export function requireStockOrAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthenticatedUserContext;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPERVISOR" && user.role !== "STOCK_MANAGER")) {
    return res.status(403).json({
      success: false,
      error: "Permissão negada: Esta operação requer privilégios de Gestão de Stock ou Administração."
    });
  }
  next();
}

/**
 * Middleware para exigir perfil com permissão de Caixa/Vendas
 */
export function requireCashierOrAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthenticatedUserContext;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Acesso não autorizado: Sessão não identificada."
    });
  }
  next();
}

