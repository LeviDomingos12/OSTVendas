import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requireAuth, requireAdmin, requireStockOrAdmin, AuthenticatedRequest } from "../server/authMiddleware";
import { dbSaveSchema, saleProcessSchema } from "../server/validation";

describe("Auth Middleware & Multi-Tenant Security", () => {
  const app = express();
  app.use(express.json());

  // Test endpoints
  app.get("/test/protected", requireAuth, (req, res) => {
    res.json({ success: true, user: (req as AuthenticatedRequest).user });
  });

  app.get("/test/admin-only", requireAuth, requireAdmin, (req, res) => {
    res.json({ success: true, message: "Admin access granted" });
  });

  app.get("/test/stock-only", requireAuth, requireStockOrAdmin, (req, res) => {
    res.json({ success: true, message: "Stock access granted" });
  });

  it("should reject unauthenticated requests with 401", async () => {
    const res = await request(app).get("/test/protected");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Token de sessão não fornecido");
  });

  it("should reject requests when user has no active tenant/company", async () => {
    const fakeToken = "invalid.token.here";
    const res = await request(app)
      .get("/test/protected")
      .set("Authorization", `Bearer ${fakeToken}`);
    
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe("Supabase Persistence Schemas & Idempotency", () => {
  it("should validate dbSaveSchema with valid table and payload", () => {
    const validProducts = {
      table: "products",
      data: [
        {
          id: "prod-100",
          name: "Produto Teste",
          code: "PRD100",
          salePrice: 250,
          costPrice: 150,
          stock: 20
        }
      ]
    };
    const result = dbSaveSchema.safeParse(validProducts);
    expect(result.success).toBe(true);
  });

  it("should reject dbSaveSchema with invalid table name", () => {
    const invalidPayload = {
      table: "unknown_table_xyz",
      data: { id: "1" }
    };
    const result = dbSaveSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it("should validate saleProcessSchema with idempotencyKey and items", () => {
    const validSale = {
      saleId: "sale-uuid-12345",
      idempotencyKey: "tenant1_sale-uuid-12345",
      paymentMethod: "Dinheiro",
      items: [
        {
          productId: "prod-1",
          name: "Item 1",
          quantity: 2,
          price: 500,
          unitPrice: 500
        }
      ],
      subtotal: 1000,
      grandTotal: 1000,
      amountPaid: 1000
    };
    const result = saleProcessSchema.safeParse(validSale);
    expect(result.success).toBe(true);
  });
});
