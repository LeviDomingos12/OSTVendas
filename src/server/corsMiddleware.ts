import { Request, Response, NextFunction } from "express";
import { getFirewallConfig } from "./securityRouter";

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const allowedEnvOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);

  const defaultOrigins = [
    process.env.APP_URL,
    process.env.VITE_APP_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
  ].filter(Boolean) as string[];

  const allowedOrigins = [...defaultOrigins, ...allowedEnvOrigins];

  const isOriginAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.endsWith(".run.app") ||
    origin.endsWith(".aistudio-build.goog")
  );

  if (isOriginAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Tenant-Id");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const fwConfig = getFirewallConfig();
  if (fwConfig.securityHeadersEnabled !== false) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  }
  next();
}

export function ipFirewallMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fwConfig = getFirewallConfig();
  if (!fwConfig.enabled) return next();

  const rawIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1") as string;
  const clientIp = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).replace("::ffff:", "").trim();

  if (clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost") {
    return next();
  }

  if (fwConfig.blacklistedIps && fwConfig.blacklistedIps.includes(clientIp)) {
    res.status(403).json({
      error: `Acesso bloqueado. O seu endereço IP (${clientIp}) foi inserido na lista negra de segurança.`,
      code: "IP_BLACKLISTED",
      ip: clientIp
    });
    return;
  }

  if (fwConfig.whitelistOnlyMode && fwConfig.whitelistedIps && fwConfig.whitelistedIps.length > 0) {
    if (!fwConfig.whitelistedIps.includes(clientIp)) {
      res.status(403).json({
        error: `Acesso restrito. O endereço IP (${clientIp}) não consta da lista de permissões autorizadas.`,
        code: "IP_NOT_WHITELISTED",
        ip: clientIp
      });
      return;
    }
  }

  next();
}
