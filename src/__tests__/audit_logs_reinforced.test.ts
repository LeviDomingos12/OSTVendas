import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

process.env.NODE_ENV = "test";

import { securityRouter } from "../server/securityRouter";

describe("🟡 Reforço de Audit Logs (Authoritative Server-side Audit Logging)", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/security", securityRouter);

  it("1. Rejeita tentativa de registo de audit log sem autenticação válida (401)", async () => {
    const res = await request(app)
      .post("/api/security/audit-logs")
      .send({
        action: "Tentativa Não Autorizada",
        module: "SISTEMA",
        details: "Tentativa de escrever log sem token."
      });

    expect(res.status).toBe(401);
  });

  it("2. Rejeita audit log sem ação ou módulo obrigatório (400)", async () => {
    const res = await request(app)
      .post("/api/security/audit-logs")
      .set("Authorization", "Bearer test-token-admin-empresa_alpha")
      .send({
        details: "Detalhe sem ação especificada"
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("3. Regista com sucesso um log de auditoria com IP, utilizador e tenant autoritativo", async () => {
    const res = await request(app)
      .post("/api/security/audit-logs")
      .set("Authorization", "Bearer test-token-admin-tenant_alpha")
      .set("User-Agent", "Mozilla/5.0 Test Suite")
      .send({
        action: "ALTERAR_PRECO_PRODUTO",
        module: "STOCK",
        details: "Preço do produto P-100 alterado de 250 MT para 300 MT",
        severity: "WARNING"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.log).toBeDefined();
    expect(res.body.log.tenantId).toBe("tenant_alpha");
    expect(res.body.log.action).toBe("ALTERAR_PRECO_PRODUTO");
    expect(res.body.log.module).toBe("STOCK");
    expect(res.body.log.severity).toBe("WARNING");
    expect(res.body.log.timestamp).toBeDefined();
    expect(res.body.log.userAgent).toContain("Test Suite");
  });

  it("4. Garante estrito isolamento multi-tenant: Tenant B não consegue ver logs do Tenant A", async () => {
    // 1. Criar log para Tenant Alpha
    await request(app)
      .post("/api/security/audit-logs")
      .set("Authorization", "Bearer test-token-admin-tenant_alpha")
      .send({
        action: "VENDA_ANULADA",
        module: "POS",
        details: "Fatura FAT-2026/001 anulada pelo supervisor",
        severity: "CRITICAL"
      });

    // 2. Criar log para Tenant Beta
    await request(app)
      .post("/api/security/audit-logs")
      .set("Authorization", "Bearer test-token-admin-tenant_beta")
      .send({
        action: "FECHO_DE_CAIXA",
        module: "CAIXA",
        details: "Caixa fechado com 50.000 MT",
        severity: "INFO"
      });

    // 3. Consultar logs como Tenant Alpha
    const resAlpha = await request(app)
      .get("/api/security/audit-logs")
      .set("Authorization", "Bearer test-token-admin-tenant_alpha");

    expect(resAlpha.status).toBe(200);
    expect(resAlpha.body.success).toBe(true);
    expect(resAlpha.body.logs.length).toBeGreaterThan(0);
    expect(resAlpha.body.logs.every((l: { tenantId: string }) => l.tenantId === "tenant_alpha")).toBe(true);
    // Não pode conter nenhum log do Tenant Beta
    expect(resAlpha.body.logs.some((l: { tenantId: string }) => l.tenantId === "tenant_beta")).toBe(false);

    // 4. Consultar logs como Tenant Beta
    const resBeta = await request(app)
      .get("/api/security/audit-logs")
      .set("Authorization", "Bearer test-token-admin-tenant_beta");

    expect(resBeta.status).toBe(200);
    expect(resBeta.body.success).toBe(true);
    expect(resBeta.body.logs.length).toBeGreaterThan(0);
    expect(resBeta.body.logs.every((l: { tenantId: string }) => l.tenantId === "tenant_beta")).toBe(true);
    // Não pode conter nenhum log do Tenant Alpha
    expect(resBeta.body.logs.some((l: { tenantId: string }) => l.tenantId === "tenant_alpha")).toBe(false);
  });
});
