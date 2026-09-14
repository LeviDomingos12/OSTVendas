import { describe, it, expect, beforeAll } from "vitest";
import express, { Request, Response } from "express";
import request from "supertest";

// Assegurar ambiente de teste para os utilitários de autenticação
process.env.NODE_ENV = "test";

import { requireAuth, requireAdmin, AuthenticatedRequest } from "../server/authMiddleware";
import { hashSecurityPin, verifySecurityPin } from "../lib/security";

describe("🔴 Teste Real de Isolamento Tenant A / Tenant B", () => {
  // Configurar aplicação Express de teste com o middleware real
  const app = express();
  app.use(express.json());

  // Base de dados simulada multi-tenant
  const mockDbProducts = [
    { id: "prod-A1", name: "Artigo Tenant A", tenant_id: "tenant_a", price: 100 },
    { id: "prod-A2", name: "Artigo 2 Tenant A", tenant_id: "tenant_a", price: 200 },
    { id: "prod-B1", name: "Artigo Secreto Tenant B", tenant_id: "tenant_b", price: 9999 },
    { id: "prod-B2", name: "Dados Confidenciais B", tenant_id: "tenant_b", price: 8888 }
  ];

  // Endpoint de leitura respeitando o tenant_id autenticado pelo middleware
  app.get("/api/test/products", requireAuth, (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).user!.tenantId;
    // Query estritamente isolada por tenantId
    const items = mockDbProducts.filter(p => p.tenant_id === tenantId);
    res.json({ success: true, tenantId, items });
  });

  // Endpoint de gravação com verificação anti-spoofing
  app.post("/api/test/products", requireAuth, (req: Request, res: Response) => {
    res.json({
      success: true,
      enforcedTenantId: (req as AuthenticatedRequest).user!.tenantId,
      data: req.body
    });
  });

  it("1. Tenant A deve aceder estritamente aos seus próprios produtos (Isolamento de Leitura)", async () => {
    const res = await request(app)
      .get("/api/test/products")
      .set("Authorization", "Bearer test-token-seller-tenant_a");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tenantId).toBe("tenant_a");
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((p: { tenant_id: string }) => p.tenant_id === "tenant_a")).toBe(true);
    
    // NENHUM produto do Tenant B deve ser exposto ao Tenant A
    const containsTenantBData = res.body.items.some((p: { tenant_id: string }) => p.tenant_id === "tenant_b");
    expect(containsTenantBData).toBe(false);
  });

  it("2. Tenant B deve aceder estritamente aos seus próprios produtos (Isolamento de Leitura)", async () => {
    const res = await request(app)
      .get("/api/test/products")
      .set("Authorization", "Bearer test-token-seller-tenant_b");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tenantId).toBe("tenant_b");
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((p: { tenant_id: string }) => p.tenant_id === "tenant_b")).toBe(true);
    
    // NENHUM produto do Tenant A deve ser exposto ao Tenant B
    const containsTenantAData = res.body.items.some((p: { tenant_id: string }) => p.tenant_id === "tenant_a");
    expect(containsTenantAData).toBe(false);
  });

  it("3. Anti-Spoofing: Rejeitar com 403 se Tenant A tentar injetar x-tenant-id do Tenant B no Header", async () => {
    const res = await request(app)
      .get("/api/test/products")
      .set("Authorization", "Bearer test-token-seller-tenant_a")
      .set("x-tenant-id", "tenant_b"); // Tentativa maliciosa de saltar de tenant

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Violação de segurança: Tenant fornecido no cabeçalho não corresponde");
  });

  it("4. Anti-Spoofing: Rejeitar com 403 se Tenant A tentar passar tenant_id do Tenant B nos Query Parameters", async () => {
    const res = await request(app)
      .get("/api/test/products?tenant_id=tenant_b")
      .set("Authorization", "Bearer test-token-seller-tenant_a");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Violação de segurança: Tenant fornecido nos parâmetros não corresponde");
  });

  it("5. Anti-Spoofing: Rejeitar com 403 se Tenant A tentar forjar tenant_id no Body de gravação", async () => {
    const res = await request(app)
      .post("/api/test/products")
      .set("Authorization", "Bearer test-token-admin-tenant_a")
      .send({
        name: "Novo Produto Malicioso",
        price: 50,
        tenant_id: "tenant_b" // Tentativa de inserir registro no Tenant B
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Violação de segurança: Tenant fornecido no corpo não corresponde");
  });
});

describe("🔴 Testes de Privilege Escalation (Tentativas de Elevação de Privilégios)", () => {
  const app = express();
  app.use(express.json());

  // Rota restrita a Administradores com requireAuth e requireAdmin
  app.get("/api/admin/settings", requireAuth, requireAdmin, (_req: Request, res: Response) => {
    res.json({ success: true, message: "Acesso administrativo concedido." });
  });

  // Rota de alteração de perfil com verificação de auto-promoção
  app.put("/api/users/profile", requireAuth, (req: Request, res: Response) => {
    const currentRole = (req as AuthenticatedRequest).user!.role;
    const requestedRole = req.body.role;

    // Regra de segurança: Um operador ou caixa não pode alterar o próprio role para ADMIN
    if (currentRole !== "ADMIN" && requestedRole && requestedRole.toUpperCase() === "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Tentativa de elevação de privilégios não autorizada: Apenas Administradores podem atribuir perfis de Administrador."
      });
    }

    res.json({ success: true, role: requestedRole || currentRole });
  });

  it("1. Operador de Caixa não pode aceder a endpoint restrito a Administradores (403 Forbidden)", async () => {
    const res = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", "Bearer test-token-seller-tenant_a");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Permissão negada: Esta operação requer privilégios de Administrador");
  });

  it("2. Administrador legítimo tem acesso concedido a endpoint restrito", async () => {
    const res = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", "Bearer test-token-admin-tenant_a");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Acesso administrativo concedido.");
  });

  it("3. Bloquear tentativa de auto-promoção de Operador para Administrador (Privilege Escalation)", async () => {
    const res = await request(app)
      .put("/api/users/profile")
      .set("Authorization", "Bearer test-token-seller-tenant_a")
      .send({ role: "ADMIN" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Tentativa de elevação de privilégios não autorizada");
  });

  it("4. Proteção de PIN/Credenciais: Hashing seguro SHA-256 e rejeição de PIN incorreto", async () => {
    const rawPin = "123456";
    const hashedPin = await hashSecurityPin(rawPin);

    // O hash gerado deve ter 64 caracteres hexadecimais (SHA-256)
    expect(hashedPin).toHaveLength(64);
    // Nunca deve ser igual ao PIN em texto limpo
    expect(hashedPin).not.toBe(rawPin);

    // Verificação com o PIN correto
    const isCorrect = await verifySecurityPin(rawPin, hashedPin);
    expect(isCorrect).toBe(true);

    // Verificação com PIN errado deve falhar
    const isWrong = await verifySecurityPin("999999", hashedPin);
    expect(isWrong).toBe(false);

    // Tentativa vazia deve falhar
    const isEmpty = await verifySecurityPin("", hashedPin);
    expect(isEmpty).toBe(false);
  });
});
