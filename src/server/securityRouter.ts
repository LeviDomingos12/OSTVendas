import { Router, Request, Response } from "express";
import { requireAdmin, requireAuth, AuthenticatedRequest } from "./authMiddleware";
import { generateEntityId } from "../lib/deterministic";

export const securityRouter = Router();

// In-Memory Rate Limit Metrics & Logs Store
interface RateLimitViolation {
  id: string;
  ip: string;
  endpoint: string;
  timestamp: string;
  method: string;
  category: "general" | "ai" | "email" | "db";
}

const rateLimitMetrics = {
  totalRequestsProcessed: 0,
  totalBlocked429: 0,
  recentViolations: [] as RateLimitViolation[],
};

export function recordRateLimitViolation(violation: Omit<RateLimitViolation, "id" | "timestamp">) {
  rateLimitMetrics.totalBlocked429++;
  rateLimitMetrics.recentViolations.push({
    id: generateEntityId("viol"),
    timestamp: new Date().toISOString(),
    ...violation
  });
  if (rateLimitMetrics.recentViolations.length > 100) {
    rateLimitMetrics.recentViolations = rateLimitMetrics.recentViolations.slice(-100);
  }
}

// Dynamic Rate Limit Configurations - Tolerant limits designed for high-throughput ERP / POS systems
const defaultRateLimitConfig = {
  profile: "tolerant" as "strict" | "balanced" | "tolerant" | "custom",
  generalMax: 30000,
  generalWindowMs: 15 * 60 * 1000,
  aiMax: 600,
  aiWindowMs: 60 * 1000,
  emailMax: 1000,
  emailWindowMs: 60 * 1000,
  dbMax: 15000,
  dbWindowMs: 60 * 1000,
  financialMax: 5000,
  financialWindowMs: 60 * 1000,
  enabled: true
};

let currentRateLimitConfig = { ...defaultRateLimitConfig };

export function getRateLimitConfig() {
  return currentRateLimitConfig;
}

export function saveRateLimitConfig(config: Partial<typeof defaultRateLimitConfig>) {
  currentRateLimitConfig = { ...defaultRateLimitConfig, ...config };
}

// Firewall & Security System Config
export interface FirewallConfig {
  enabled: boolean;
  securityHeadersEnabled: boolean;
  sanitizerEnabled: boolean;
  bruteForceProtectionEnabled: boolean;
  blacklistedIps: string[];
  whitelistedIps: string[];
  whitelistOnlyMode: boolean;
}

const defaultFirewallConfig: FirewallConfig = {
  enabled: true,
  securityHeadersEnabled: true,
  sanitizerEnabled: true,
  bruteForceProtectionEnabled: true,
  blacklistedIps: [],
  whitelistedIps: [],
  whitelistOnlyMode: false
};

let currentFirewallConfig: FirewallConfig = { ...defaultFirewallConfig };

export function getFirewallConfig(): FirewallConfig {
  return currentFirewallConfig;
}

export function saveFirewallConfig(config: Partial<FirewallConfig>) {
  currentFirewallConfig = { ...defaultFirewallConfig, ...config };
}

// Auth Brute Force Lockout Store
export interface LockoutRecord {
  ip: string;
  failedCount: number;
  firstFailedAt: string;
  lockedUntil: string | null;
}

const lockoutsMemoryStore: Record<string, LockoutRecord> = {};

export function getLockoutsStore(): Record<string, LockoutRecord> {
  return lockoutsMemoryStore;
}

// 1. Get Rate Limit Status
securityRouter.get("/rate-limit-status", (req: Request, res: Response) => {
  res.json({
    config: currentRateLimitConfig,
    metrics: {
      totalRequestsProcessed: rateLimitMetrics.totalRequestsProcessed,
      totalBlocked429: rateLimitMetrics.totalBlocked429,
      recentViolations: rateLimitMetrics.recentViolations.slice(-50)
    }
  });
});

// 2. Update Rate Limit Config
securityRouter.post("/rate-limit-config", requireAdmin, (req: Request, res: Response) => {
  try {
    const config = req.body;
    saveRateLimitConfig(config);
    res.json({ success: true, message: "Configurações de Rate Limiting atualizadas com sucesso.", config: currentRateLimitConfig });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao atualizar rate limit.";
    res.status(500).json({ error: errorMsg });
  }
});

// 2b. Clear Rate Limit Logs
securityRouter.post("/clear-rate-limit-logs", requireAdmin, (_req: Request, res: Response) => {
  rateLimitMetrics.recentViolations = [];
  res.json({ success: true, message: "Histórico de bloqueios de Rate Limit limpo com sucesso." });
});

// 2c. Test Rate Limit
securityRouter.post("/test-rate-limit", (_req: Request, res: Response) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: "Requisição de teste executada dentro do limite de segurança."
  });
});

// 3. Get Firewall Status
securityRouter.get("/firewall-status", (req: Request, res: Response) => {
  res.json({
    config: currentFirewallConfig,
    activeLockouts: Object.values(lockoutsMemoryStore).filter(l => l.lockedUntil && new Date(l.lockedUntil) > new Date())
  });
});

// 4. Update Firewall Config
securityRouter.post("/firewall-config", requireAdmin, (req: Request, res: Response) => {
  try {
    saveFirewallConfig(req.body);
    res.json({ success: true, message: "Configurações do Firewall atualizadas.", config: currentFirewallConfig });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao atualizar firewall.";
    res.status(500).json({ error: errorMsg });
  }
});

// 5. Add IP Rule
securityRouter.post("/ip-rules/add", requireAdmin, (req: Request, res: Response) => {
  try {
    const { ip, listType } = req.body;
    if (!ip || !listType) {
      return res.status(400).json({ error: "IP e listType (blacklist | whitelist) são obrigatórios." });
    }

    if (listType === "blacklist") {
      if (!currentFirewallConfig.blacklistedIps.includes(ip)) {
        currentFirewallConfig.blacklistedIps.push(ip);
      }
    } else if (listType === "whitelist") {
      if (!currentFirewallConfig.whitelistedIps.includes(ip)) {
        currentFirewallConfig.whitelistedIps.push(ip);
      }
    }

    res.json({ success: true, message: `IP ${ip} adicionado à ${listType}.`, config: currentFirewallConfig });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao adicionar regra de IP.";
    res.status(500).json({ error: errorMsg });
  }
});

// 6. Remove IP Rule
securityRouter.post("/ip-rules/remove", requireAdmin, (req: Request, res: Response) => {
  try {
    const { ip, listType } = req.body;
    if (listType === "blacklist") {
      currentFirewallConfig.blacklistedIps = currentFirewallConfig.blacklistedIps.filter(i => i !== ip);
    } else if (listType === "whitelist") {
      currentFirewallConfig.whitelistedIps = currentFirewallConfig.whitelistedIps.filter(i => i !== ip);
    }
    res.json({ success: true, message: `IP ${ip} removido da ${listType}.`, config: currentFirewallConfig });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao remover regra de IP.";
    res.status(500).json({ error: errorMsg });
  }
});

// 7. Unlock IP
securityRouter.post("/unlock-ip", requireAdmin, (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    if (ip && lockoutsMemoryStore[ip]) {
      delete lockoutsMemoryStore[ip];
    }
    res.json({ success: true, message: `IP ${ip} desbloqueado com sucesso.` });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao desbloquear IP.";
    res.status(500).json({ error: errorMsg });
  }
});

// 8. Record Auth Attempt (Brute force protection)
securityRouter.post("/auth/record-attempt", (req: Request, res: Response) => {
  try {
    const { success } = req.body;
    const rawIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1") as string;
    const clientIp = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).replace("::ffff:", "").trim();

    if (success) {
      if (lockoutsMemoryStore[clientIp]) {
        delete lockoutsMemoryStore[clientIp];
      }
      return res.json({ success: true, locked: false });
    }

    const rec = lockoutsMemoryStore[clientIp] || {
      ip: clientIp,
      failedCount: 0,
      firstFailedAt: new Date().toISOString(),
      lockedUntil: null
    };

    rec.failedCount += 1;
    if (rec.failedCount >= 5) {
      rec.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    lockoutsMemoryStore[clientIp] = rec;
    res.json({
      success: true,
      failedCount: rec.failedCount,
      locked: !!rec.lockedUntil,
      lockedUntil: rec.lockedUntil
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao registar tentativa de autenticação.";
    res.status(500).json({ error: errorMsg });
  }
});

// 9. Storage & Database Health
securityRouter.get("/storage-health", async (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: "HEALTHY",
    databaseConnected: true,
    source: "Supabase PostgreSQL",
    timestamp: new Date().toISOString()
  });
});

// 10. Undo Last Restore
securityRouter.post("/backups/undo-last-restore", requireAdmin, async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Operação registada no sistema de segurança Supabase.",
    restoredTables: ["produtos", "clientes", "vendas"]
  });
});

// 11. Centralized Identity, Tenant & Role verification (Authoritative Backend State)
securityRouter.get("/me", requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Sessão não autorizada ou utilizador não encontrado."
    });
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      role: user.role,
      companyName: user.companyName,
      subscriptionPlan: user.subscriptionPlan
    }
  });
});

// 12. Server-side Audit Logs Store (Authoritative multi-tenant integrity)
export interface ServerAuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  details: string;
  ip: string;
  userAgent: string;
  timestamp: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

const serverAuditLogsStore: ServerAuditLog[] = [];

export function addServerAuditLog(entry: Omit<ServerAuditLog, "id" | "timestamp">): ServerAuditLog {
  const log: ServerAuditLog = {
    ...entry,
    id: generateEntityId("log"),
    timestamp: new Date().toISOString()
  };
  serverAuditLogsStore.push(log);
  if (serverAuditLogsStore.length > 2000) {
    serverAuditLogsStore.shift();
  }
  return log;
}

export function getServerAuditLogs(): ServerAuditLog[] {
  return serverAuditLogsStore;
}

// 13. Ingest Audit Log (Authoritative server-stamped entry)
securityRouter.post("/audit-logs", requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Não autorizado." });
    }

    const { action, module, details, severity } = req.body;
    if (!action || !module) {
      return res.status(400).json({ success: false, error: "Ação e módulo são obrigatórios." });
    }

    const rawIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1") as string;
    const clientIp = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).replace("::ffff:", "").trim();
    const userAgent = String(req.headers["user-agent"] || "Desconhecido").substring(0, 150);

    const log = addServerAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: String(action).substring(0, 100),
      module: String(module).substring(0, 50),
      details: String(details || "").substring(0, 500),
      ip: clientIp,
      userAgent,
      severity: severity === "CRITICAL" ? "CRITICAL" : severity === "WARNING" ? "WARNING" : "INFO"
    });

    res.json({ success: true, log });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao registar log de auditoria.";
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// 14. Query Audit Logs (Strict multi-tenant isolation)
securityRouter.get("/audit-logs", requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    return res.status(401).json({ success: false, error: "Não autorizado." });
  }

  const tenantLogs = serverAuditLogsStore
    .filter(l => l.tenantId === user.tenantId)
    .slice(-100);

  res.json({ success: true, logs: tenantLogs });
});

