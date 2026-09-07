import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("🔴 Segurança e Autoridade Financeira nos RPCs PostgreSQL", () => {
  const schemaPath = path.resolve(__dirname, "../lib/supabaseSchema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  it("1. produtos deve conter sale_price e a coluna gerada price para compatibilidade total", () => {
    expect(schemaSql).toContain("sale_price NUMERIC(14,2) NOT NULL DEFAULT 0.00");
    expect(schemaSql).toContain("price NUMERIC(14,2) GENERATED ALWAYS AS (sale_price) STORED");
  });

  it("2. RPCs SECURITY DEFINER não devem aceitar p_tenant_id de chamadas anónimas/não autenticadas", () => {
    // Verificar process_sale_atomic
    expect(schemaSql).toContain("FUNCTION public.process_sale_atomic(");
    // Verificar que não existe o padrão inseguro 'ELSE v_tenant_id := p_tenant_id' sem verificar service_role
    const insecureFallback = "ELSE\n    v_tenant_id := p_tenant_id;\n  END IF;";
    expect(schemaSql.includes(insecureFallback)).toBe(false);

    // Deve conter validação estrita de segurança em cada RPC
    expect(schemaSql).toContain("Acesso negado: Operação atómica requer utilizador autenticado ou token service_role.");
    expect(schemaSql).toContain("Violação de segurança: Tentativa de operação em tenant diferente do autorizado.");
  });

  it("3. replenish_stock_atomic e settle_debt_payment_atomic devem validar estritamente a autenticação", () => {
    // replenish_stock_atomic
    expect(schemaSql).toContain("FUNCTION public.replenish_stock_atomic(");
    // settle_debt_payment_atomic
    expect(schemaSql).toContain("FUNCTION public.settle_debt_payment_atomic(");

    // Ambas devem verificar auth.uid() e service_role
    const replenishSection = schemaSql.substring(
      schemaSql.indexOf("CREATE OR REPLACE FUNCTION public.replenish_stock_atomic"),
      schemaSql.indexOf("CREATE OR REPLACE FUNCTION public.settle_debt_payment_atomic")
    );
    expect(replenishSection).toContain("Acesso negado: Operação atómica requer utilizador autenticado ou token service_role.");
    expect(replenishSection).toContain("Violação de segurança: Tentativa de operação em tenant diferente do autorizado.");

    const settleSection = schemaSql.substring(
      schemaSql.indexOf("CREATE OR REPLACE FUNCTION public.settle_debt_payment_atomic")
    );
    expect(settleSection).toContain("Acesso negado: Operação atómica requer utilizador autenticado ou token service_role.");
    expect(settleSection).toContain("Violação de segurança: Tentativa de operação em tenant diferente do autorizado.");
  });

  it("4. process_sale_atomic deve realizar cálculos financeiros autoritativos no PostgreSQL", () => {
    // Deve consultar sale_price da tabela produtos para cada item com FOR UPDATE
    expect(schemaSql).toContain("SELECT name, stock, sale_price, cost_price, COALESCE(vat_rate, 16.00)");
    expect(schemaSql).toContain("v_calc_subtotal := v_calc_subtotal + v_item_subtotal;");
    expect(schemaSql).toContain("v_calc_grand_total := GREATEST(0.00, ROUND(v_calc_subtotal - v_calc_total_discount + v_calc_vat_total, 2));");
    
    // Inserir na tabela vendas com v_calc_subtotal e v_calc_grand_total
    expect(schemaSql).toContain("v_calc_subtotal, v_calc_total_discount, v_calc_vat_total, v_calc_grand_total");
  });

  it("5. safeEndpoints.ts deve retornar valores financeiros autoritativos calculados no PostgreSQL", () => {
    const safeEndpointsPath = path.resolve(__dirname, "../server/safeEndpoints.ts");
    const safeEndpointsContent = fs.readFileSync(safeEndpointsPath, "utf-8");

    expect(safeEndpointsContent).toContain("grandTotal: rpcData?.grand_total != null ? Number(rpcData.grand_total) : computedGrandTotal");
    expect(safeEndpointsContent).toContain("subtotal: rpcData?.subtotal != null ? Number(rpcData.subtotal) : computedSubtotal");
    expect(safeEndpointsContent).toContain("sale_price");
  });
});
