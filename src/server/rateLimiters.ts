import express from "express";
import rateLimit from "express-rate-limit";
import { AuthenticatedUserContext } from "./authMiddleware";
import { getRateLimitConfig, recordRateLimitViolation } from "./securityRouter";

export interface AuthenticatedRequest extends express.Request {
  user?: AuthenticatedUserContext;
  rateLimit?: { resetTime?: Date };
}

// Key generator for multi-tenant authenticated and proxy environments
export const getClientIpKey = (req: express.Request): string => {
  const rawIp = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "127.0.0.1";
  const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(",")[0].trim();
  const user = (req as AuthenticatedRequest).user;
  if (user && user.tenantId && user.id) {
    return `${ip}:${user.tenantId}:${user.id}`;
  }
  const tenantHeader = (req.headers["x-tenant-id"] as string) || "";
  if (tenantHeader && tenantHeader.trim()) {
    return `${ip}:${tenantHeader.trim()}`;
  }
  const authHeader = (req.headers["authorization"] as string) || "";
  if (authHeader.startsWith("Bearer ")) {
    return `${ip}:${authHeader.slice(-16)}`;
  }
  return ip;
};

// Safe diagnostic and system check paths that should never be rate limited
export const isSafeExemptPath = (path: string): boolean => {
  return (
    path === "/health" ||
    path === "/api/health" ||
    path === "/api/system/version" ||
    path === "/system/version" ||
    path === "/api/security/firewall-status" ||
    path === "/api/security/storage-health" ||
    path === "/api/security/rate-limit-status"
  );
};

// Generic 429 limiter handler
export const handleLimitExceeded = (category: "general" | "ai" | "email" | "db" | "financial") => {
  return (req: express.Request, res: express.Response): void => {
    const authReq = req as AuthenticatedRequest;
    const retryAfterSeconds = Math.ceil(
      authReq.rateLimit?.resetTime 
        ? (authReq.rateLimit.resetTime.getTime() - Date.now()) / 1000 
        : 60
    );

    // Record violation for real-time observability in the Security dashboard
    try {
      recordRateLimitViolation({
        ip: getClientIpKey(req),
        endpoint: req.originalUrl || req.url || req.path,
        method: req.method,
        category: category === "financial" ? "general" : category
      });
    } catch {}

    res.status(429).json({
      error: "Muitas requisições enviadas em um curto intervalo. O sistema de proteção Rate Limit foi ativado.",
      code: "RATE_LIMIT_EXCEEDED",
      category,
      retryAfter: retryAfterSeconds > 0 ? retryAfterSeconds : 60,
      message: `Limite de segurança excedido para ${category}. Por favor, aguarde ${retryAfterSeconds > 0 ? retryAfterSeconds : 60} segundos antes de tentar novamente.`
    });
  };
};

// Rate Limiters
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => getRateLimitConfig().generalMax || 30000,
  standardHeaders: true,
  legacyHeaders: true,
  validate: false,
  keyGenerator: getClientIpKey,
  skip: (req) => {
    const cfg = getRateLimitConfig();
    if (!cfg.enabled) return true;
    if (isSafeExemptPath(req.path)) return true;
    return false;
  },
  handler: handleLimitExceeded("general")
});

export const financialLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => getRateLimitConfig().financialMax || 5000,
  standardHeaders: true,
  legacyHeaders: true,
  validate: false,
  keyGenerator: getClientIpKey,
  skip: (req) => {
    const cfg = getRateLimitConfig();
    if (!cfg.enabled) return true;
    if (isSafeExemptPath(req.path)) return true;
    return false;
  },
  handler: handleLimitExceeded("financial")
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => getRateLimitConfig().aiMax || 600,
  standardHeaders: true,
  legacyHeaders: true,
  validate: false,
  keyGenerator: getClientIpKey,
  skip: (req) => {
    const cfg = getRateLimitConfig();
    if (!cfg.enabled) return true;
    if (isSafeExemptPath(req.path)) return true;
    return false;
  },
  handler: handleLimitExceeded("ai")
});

export const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => getRateLimitConfig().emailMax || 1000,
  standardHeaders: true,
  legacyHeaders: true,
  validate: false,
  keyGenerator: getClientIpKey,
  skip: (req) => {
    const cfg = getRateLimitConfig();
    if (!cfg.enabled) return true;
    if (isSafeExemptPath(req.path)) return true;
    return false;
  },
  handler: handleLimitExceeded("email")
});

export const dbLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => getRateLimitConfig().dbMax || 15000,
  standardHeaders: true,
  legacyHeaders: true,
  validate: false,
  keyGenerator: getClientIpKey,
  skip: (req) => {
    const cfg = getRateLimitConfig();
    if (!cfg.enabled) return true;
    if (isSafeExemptPath(req.path)) return true;
    return false;
  },
  handler: handleLimitExceeded("db")
});
