import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { isSafeExemptPath, getClientIpKey, emailLimiter, dbLimiter } from "../server/rateLimiters";
import { getRateLimitConfig } from "../server/securityRouter";

describe("Rate Limiting Resilience & Scoping", () => {
  it("exempts diagnostic and health check endpoints from rate limiting", () => {
    expect(isSafeExemptPath("/health")).toBe(true);
    expect(isSafeExemptPath("/api/health")).toBe(true);
    expect(isSafeExemptPath("/api/system/version")).toBe(true);
    expect(isSafeExemptPath("/api/security/firewall-status")).toBe(true);
    expect(isSafeExemptPath("/api/security/storage-health")).toBe(true);
    expect(isSafeExemptPath("/api/security/rate-limit-status")).toBe(true);
    expect(isSafeExemptPath("/api/v1/sales")).toBe(false);
  });

  it("discriminates client keys by tenant ID and authorization token", () => {
    const reqWithTenant = {
      headers: { "x-tenant-id": "tenant_123" },
      ip: "127.0.0.1",
    } as unknown as express.Request;

    const key1 = getClientIpKey(reqWithTenant);
    expect(key1).toBe("127.0.0.1:tenant_123");

    const reqWithAuth = {
      headers: { authorization: "Bearer secret-token-abcdef123456" },
      ip: "127.0.0.1",
    } as unknown as express.Request;

    const key2 = getClientIpKey(reqWithAuth);
    expect(key2).toContain("127.0.0.1");
    expect(key2).not.toBe("127.0.0.1");
  });

  it("verifies dynamic configuration thresholds are set generously for high-throughput ERP use", () => {
    const config = getRateLimitConfig();
    expect(config.enabled).toBe(true);
    expect(config.generalMax).toBeGreaterThanOrEqual(10000);
    expect(config.dbMax).toBeGreaterThanOrEqual(10000);
    expect(config.emailMax).toBeGreaterThanOrEqual(500);
  });

  it("ensures db endpoints are isolated from email limiter", async () => {
    const app = express();
    app.use(express.json());

    // Mount communications limiter only on /api/email
    app.use("/api/email", emailLimiter);
    // Mount db limiter on /api/db
    app.use("/api/db", dbLimiter);

    app.get("/api/db/test", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get("/api/db/test");
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});
