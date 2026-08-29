import { describe, it, expect } from "vitest";
import { hashSecurityPin, verifySecurityPin, sanitizeUserSession } from "../lib/security";
import { canRoleAccessModule, normalizeUserRole, getDefaultModuleForRole, getRoleDisplayName } from "../lib/rolePermissions";
import { Employee } from "../types";

describe("Fase 2 - Segurança & Arquitetura", () => {
  describe("Criptografia e Hashing Seguro de PINs", () => {
    it("deve gerar um hash SHA-256 consistente para um PIN fornecido", async () => {
      const pin = "123456";
      const hash1 = await hashSecurityPin(pin);
      const hash2 = await hashSecurityPin(pin);

      expect(hash1).toBeDefined();
      expect(hash1.length).toBeGreaterThan(10);
      expect(hash1).toBe(hash2);
    });

    it("deve retornar vazio se o PIN for nulo ou vazio", async () => {
      const emptyHash = await hashSecurityPin("");
      expect(emptyHash).toBe("");
    });

    it("deve verificar corretamente PIN coincidente com o hash armazenado", async () => {
      const pin = "889900";
      const hash = await hashSecurityPin(pin);

      const isValid = await verifySecurityPin("889900", hash);
      const isInvalid = await verifySecurityPin("112233", hash);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it("deve suportar PINs legados durante o período de transição/migração", async () => {
      const plainPin = "4321";
      const isValid = await verifySecurityPin("4321", plainPin);
      expect(isValid).toBe(true);
    });
  });

  describe("Higienização de Sessão do Utilizador (Proteção de Storage)", () => {
    it("deve remover PIN, password e dados sensíveis antes de persistir a sessão", () => {
      const rawUser: Employee = {
        id: "emp-101",
        name: "Carlos Silva",
        role: "Operador de Caixa",
        contact: "841234567",
        salary: 18000,
        admissionDate: "2026-01-01",
        status: "ACTIVE",
        pin: "secret_pin_123",
        password: "secret_password_456"
      };

      const safeUser = sanitizeUserSession(rawUser);

      expect(safeUser).not.toBeNull();
      expect(safeUser?.id).toBe("emp-101");
      expect(safeUser?.name).toBe("Carlos Silva");
      expect((safeUser as any).pin).toBeUndefined();
      expect((safeUser as any).password).toBeUndefined();
    });

    it("deve lidar de forma segura com utilizador nulo ou indefinido", () => {
      expect(sanitizeUserSession(null)).toBeNull();
      expect(sanitizeUserSession(undefined)).toBeNull();
    });
  });

  describe("Matriz de Permissões e RBAC", () => {
    it("deve normalizar corretamente funções de utilizador", () => {
      expect(normalizeUserRole({ role: "Administrador Geral" } as any)).toBe("ADMIN");
      expect(normalizeUserRole({ role: "Supervisor de Loja" } as any)).toBe("SUPERVISOR");
      expect(normalizeUserRole({ role: "Operador de Caixa" } as any)).toBe("CASHIER");
      expect(normalizeUserRole({ role: "Gestor de Recursos Humanos" } as any)).toBe("RH");
      expect(normalizeUserRole({ role: "Contabilista Financeiro" } as any)).toBe("FINANCEIRO");
      expect(normalizeUserRole({ role: "Auditor Fiscal" } as any)).toBe("AUDITOR");
    });

    it("deve restringir acesso a módulos confidenciais a operadores de caixa", () => {
      const posAccess = canRoleAccessModule("CASHIER", "pos");
      const cashAccess = canRoleAccessModule("CASHIER", "cash");
      const settingsAccess = canRoleAccessModule("CASHIER", "settings");
      const staffAccess = canRoleAccessModule("CASHIER", "staff");
      const dashboardAccess = canRoleAccessModule("CASHIER", "dashboard");

      expect(posAccess.allowed).toBe(true);
      expect(cashAccess.allowed).toBe(true);
      expect(settingsAccess.allowed).toBe(false);
      expect(staffAccess.allowed).toBe(false);
      expect(dashboardAccess.allowed).toBe(false);
    });

    it("deve conceder acesso total a administradores", () => {
      const modules = ["dashboard", "pos", "stock", "cash", "customers", "reports", "settings", "staff", "gateway", "plans"];
      for (const mod of modules) {
        const check = canRoleAccessModule("ADMIN", mod);
        expect(check.allowed).toBe(true);
      }
    });

    it("deve retornar o módulo padrão apropriado para cada cargo", () => {
      expect(getDefaultModuleForRole("CASHIER")).toBe("POS");
      expect(getDefaultModuleForRole("ADMIN")).toBe("DASHBOARD");
      expect(getDefaultModuleForRole("RH")).toBe("STAFF");
    });
  });
});
