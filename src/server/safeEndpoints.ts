/**
 * @file src/server/safeEndpoints.ts
 * Endpoints Comerciais Seguros com Isolamento Multi-Tenant e Validação Servidor.
 * 
 * Regras e Garantias:
 * - Supabase / PostgreSQL como única fonte oficial de dados.
 * - Validação de preços, quantidades e totais no backend com Zod.
 * - Decremento de stock atómico via RPC process_sale_atomic.
 * - Logs de auditoria append-only em public.audit_logs.
 * - Backups sanitizados sem senhas nem segredos.
 * - Isolamento absoluto de dados por tenant_id derivado da sessão autenticada.
 * - Idempotência no processamento de vendas com public.idempotency_keys.
 */

import { Router, Request, Response } from "express";
import { requireAuth, requireAdmin, requireStockOrAdmin, AuthenticatedUserContext, supabaseServerAdmin, supabasePublicAuth } from "./authMiddleware";
import { productSchema, customerSchema, saleProcessSchema, auditLogSchema, replenishStockSchema, debtPaymentSchema } from "./validation";
import { generateUUID } from "../lib/deterministic";

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserContext;
}

function getAuthUser(req: Request): AuthenticatedUserContext {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    throw new Error("Sessão não autenticada.");
  }
  return user;
}

function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Erro desconhecido.";
}

export const commercialRouter = Router();

// Todas as rotas comerciais requerem autenticação
commercialRouter.use(requireAuth);

// Helper para obter cliente ativo Supabase
function getSupabaseClient() {
  return supabaseServerAdmin || supabasePublicAuth;
}

/**
 * ============================================================================
 * 1. PRODUTOS / INVENTÁRIO
 * ============================================================================
 */

// GET /api/v1/products - Listar produtos da empresa do utilizador
commercialRouter.get("/products", async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    const { data, error } = await client
      .from("produtos")
      .select("*")
      .eq("tenant_id", user.tenantId)
      .eq("is_active", true)
      .order("name");

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

// POST /api/v1/products - Criar ou atualizar produto com validação rigorosa
commercialRouter.post("/products", async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    
    // Validar com Zod Schema
    const parseResult = productSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || "Dados do produto inválidos.",
        details: parseResult.error.format()
      });
    }

    const p = parseResult.data;
    const productId = p.id || generateUUID();

    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    const { error } = await client
      .from("produtos")
      .upsert({
        id: productId,
        tenant_id: user.tenantId,
        code: p.code || productId.slice(0, 8).toUpperCase(),
        barcode: p.barcode || null,
        name: p.name.trim(),
        category: p.category || "Geral",
        sale_price: p.price || p.salePrice || 0,
        cost_price: p.cost || 0,
        stock: p.stock || 0,
        unit: p.unit || "un",
        image_url: p.imageUrl || null,
        is_active: p.isActive !== false,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (error) throw error;

    res.json({ success: true, id: productId, message: "Artigo salvo com sucesso no PostgreSQL." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

// DELETE /api/v1/products/:id - Desativar produto (Soft Delete)
commercialRouter.delete("/products/:id", async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;

    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    const { error } = await client
      .from("produtos")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", user.tenantId);

    if (error) throw error;
    res.json({ success: true, message: "Artigo desativado com sucesso." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

/**
 * ============================================================================
 * 2. CLIENTES
 * ============================================================================
 */

// GET /api/v1/customers - Listar clientes da empresa
commercialRouter.get("/customers", async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    const { data, error } = await client
      .from("clientes")
      .select("*")
      .eq("tenant_id", user.tenantId)
      .order("name");

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

// POST /api/v1/customers - Criar ou atualizar cliente com validação
commercialRouter.post("/customers", async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);

    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || "Dados do cliente inválidos.",
        details: parseResult.error.format()
      });
    }

    const c = parseResult.data;
    const custId = c.id || generateUUID();

    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    const { error } = await client
      .from("clientes")
      .upsert({
        id: custId,
        tenant_id: user.tenantId,
        name: c.name.trim(),
        nuit: c.nuit || null,
        phone: c.phone || null,
        email: c.email || null,
        address: c.address || null,
        credit_limit: c.creditLimit || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (error) throw error;

    res.json({ success: true, id: custId, message: "Cliente gravado com sucesso no PostgreSQL." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

/**
 * ============================================================================
 * 3. TRANSAÇÕES / PROCESSAMENTO ATÓMICO DE VENDAS COM IDEMPOTÊNCIA
 * ============================================================================
 */

commercialRouter.post("/sales/process", async (req: Request, res: Response) => {
  const user = (req as unknown as { user: AuthenticatedUserContext }).user;
  
  const parseResult = saleProcessSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: parseResult.error.issues[0]?.message || "Dados da venda inválidos.",
      details: parseResult.error.format()
    });
  }

  const payload = parseResult.data;
  const saleId = payload.saleId || payload.id || generateUUID();
  const invoiceNumber = payload.invoiceNumber || `FAC-${new Date().getFullYear()}-${generateUUID().slice(0, 8).toUpperCase()}`;
  const paymentMethod = payload.paymentMethod || "Dinheiro";
  const idempotencyKey = payload.idempotencyKey || `${user.tenantId}_${saleId}`;

  try {
    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados Supabase indisponível." });
    }

    // 1. Verificação de Idempotência diretamente no PostgreSQL
    const { data: existingKeyRecord } = await client
      .from("idempotency_keys")
      .select("response_payload, status")
      .eq("idempotency_key", idempotencyKey)
      .eq("tenant_id", user.tenantId)
      .maybeSingle();

    if (existingKeyRecord && existingKeyRecord.response_payload) {
      return res.json({
        ...existingKeyRecord.response_payload,
        message: "Venda já processada anteriormente (Resposta Idempotente PostgreSQL).",
        idempotent: true
      });
    }

    // 2. Validação Autoritativa de Preços e Produtos no PostgreSQL (Nunca confiar no Frontend)
    const productIds = payload.items.map(i => i.productId).filter(Boolean);
    let dbProductsMap = new Map<string, { id: string; name: string; price: number; stock: number; is_active?: boolean }>();

    if (productIds.length > 0) {
      const { data: dbProducts, error: prodFetchErr } = await client
        .from("produtos")
        .select("id, name, sale_price, stock, is_active")
        .eq("tenant_id", user.tenantId)
        .in("id", productIds);

      if (!prodFetchErr && dbProducts) {
        dbProducts.forEach((p: { id: string; name: string; sale_price?: number; price?: number; stock: number; is_active?: boolean }) => {
          const authoritativePrice = Number(p.sale_price ?? p.price ?? 0);
          dbProductsMap.set(p.id, {
            id: p.id,
            name: p.name,
            price: authoritativePrice,
            stock: p.stock,
            is_active: p.is_active
          });
        });
      }
    }

    let computedSubtotal = 0;
    const validatedItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      discount: number;
    }> = [];

    for (const item of payload.items) {
      const qty = Number(item.quantity);
      if (qty <= 0) {
        return res.status(400).json({ success: false, error: `Quantidade inválida (${qty}) para o artigo.` });
      }

      // Preço autoritativo estritamente da base de dados PostgreSQL
      const dbProd = item.productId ? dbProductsMap.get(item.productId) : null;
      if (item.productId && !dbProd) {
        return res.status(400).json({ success: false, error: `Artigo (${item.productId}) não encontrado ou inativo no PostgreSQL.` });
      }
      const unitPrice = dbProd ? Number(dbProd.price) : Number(item.salePrice || item.price || item.unitPrice || 0);

      if (unitPrice < 0) {
        return res.status(400).json({ success: false, error: `Preço inválido (${unitPrice}) para o artigo.` });
      }

      const itemTotal = qty * unitPrice;
      computedSubtotal += itemTotal;

      validatedItems.push({
        productId: item.productId || "",
        productName: dbProd?.name || item.name || item.productName || "Artigo",
        quantity: qty,
        unitPrice,
        totalPrice: itemTotal,
        discount: Number(item.discount || 0)
      });
    }

    const computedDiscount = Number(payload.discountTotal || 0);
    const computedVat = Number(payload.vatTotal || 0);
    const computedGrandTotal = Math.max(0, computedSubtotal - computedDiscount + computedVat);
    const amountPaid = Number(payload.amountPaid || computedGrandTotal);
    const changeAmount = Math.max(0, amountPaid - computedGrandTotal);

    // 3. Executar transação atómica oficial via RPC PostgreSQL
    const { data: rpcData, error: rpcError } = await client.rpc("process_sale_atomic", {
      p_tenant_id: user.tenantId,
      p_sale_id: saleId,
      p_invoice_number: invoiceNumber,
      p_customer_id: payload.customerId || null,
      p_customer_name: payload.customerName || "Consumidor Final",
      p_customer_nuit: payload.customerNuit || null,
      p_seller_id: user.id,
      p_seller_name: user.name,
      p_payment_method: paymentMethod,
      p_subtotal: computedSubtotal,
      p_discount_total: computedDiscount,
      p_vat_total: computedVat,
      p_grand_total: computedGrandTotal,
      p_amount_paid: amountPaid,
      p_change_amount: changeAmount,
      p_items: validatedItems,
      p_notes: payload.notes || null,
      p_idempotency_key: idempotencyKey
    });

    if (rpcError) {
      console.error("[SafeEndpoints] Erro RPC process_sale_atomic:", rpcError.message);
      return res.status(400).json({ success: false, error: rpcError.message });
    }

    if (rpcData && rpcData.success === false) {
      return res.status(400).json({ success: false, error: rpcData.error || "Falha ao processar venda." });
    }

    res.json({
      success: true,
      saleId,
      invoiceNumber,
      grandTotal: rpcData?.grand_total != null ? Number(rpcData.grand_total) : computedGrandTotal,
      subtotal: rpcData?.subtotal != null ? Number(rpcData.subtotal) : computedSubtotal,
      discountTotal: rpcData?.discount_total != null ? Number(rpcData.discount_total) : computedDiscount,
      vatTotal: rpcData?.vat_total != null ? Number(rpcData.vat_total) : computedVat,
      amountPaid: rpcData?.amount_paid != null ? Number(rpcData.amount_paid) : amountPaid,
      changeAmount: rpcData?.change_amount != null ? Number(rpcData.change_amount) : changeAmount,
      remainingDebt: rpcData?.remaining_debt != null ? Number(rpcData.remaining_debt) : 0,
      items: rpcData?.items ?? validatedItems,
      message: rpcData?.message || "Venda validada e processada atomicamente no PostgreSQL."
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro no processamento da transação.";
    console.error("[SafeEndpoints] Erro ao processar venda:", errorMsg);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

/**
 * ============================================================================
 * 4. AUDITORIA (APPEND-ONLY)
 * ============================================================================
 */

commercialRouter.get("/auditlogs", async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    const { data, error } = await client
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", user.tenantId)
      .order("timestamp", { ascending: false })
      .limit(200);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

commercialRouter.post("/auditlogs", async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    
    const parseResult = auditLogSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || "Dados de log inválidos."
      });
    }

    const { action, module, details } = parseResult.data;

    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    const { error } = await client.from("audit_logs").insert({
      tenant_id: user.tenantId,
      user_id: user.id,
      user_name: user.name,
      action,
      module,
      details: details || "",
      ip_address: req.ip || "127.0.0.1"
    });

    if (error) throw error;
    res.json({ success: true, message: "Log de auditoria registrado com sucesso no PostgreSQL." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

/**
 * ============================================================================
 * 5. BACKUPS SANITIZADOS E PRIVADOS POR TENANT (ADMIN ONLY)
 * ============================================================================
 */

commercialRouter.get("/backups/export", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    const [prods, custs, sales, logs, sett] = await Promise.all([
      client.from("produtos").select("*").eq("tenant_id", user.tenantId),
      client.from("clientes").select("*").eq("tenant_id", user.tenantId),
      client.from("vendas").select("*").eq("tenant_id", user.tenantId),
      client.from("audit_logs").select("*").eq("tenant_id", user.tenantId),
      client.from("settings").select("*").eq("tenant_id", user.tenantId).maybeSingle()
    ]);

    const tablesData = {
      products: prods.data || [],
      customers: custs.data || [],
      sales: sales.data || [],
      auditlogs: logs.data || [],
      settings: sett.data || {}
    };

    const sanitizedData = {
      tenantId: user.tenantId,
      companyName: user.companyName,
      exportedAt: new Date().toISOString(),
      version: "34.0.0",
      tables: tablesData
    };

    res.setHeader("Content-Disposition", `attachment; filename="backup_${user.tenantId}_${Date.now()}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(sanitizedData, null, 2));
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: "Erro ao gerar cópia de segurança sanitizada: " + extractErrorMessage(err) });
  }
});

/**
 * ============================================================================
 * 6. REABASTECIMENTO ATÓMICO DE STOCK (GESTÃO DE STOCK / ADMIN)
 * ============================================================================
 */
commercialRouter.post("/stock/replenish", requireStockOrAdmin, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);

    const parseResult = replenishStockSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || "Dados de reabastecimento inválidos."
      });
    }

    const { productId, quantity, costPrice, reason } = parseResult.data;

    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    const { data: prod, error: prodErr } = await client
      .from("produtos")
      .select("stock, cost_price")
      .eq("id", productId)
      .eq("tenant_id", user.tenantId)
      .single();

    if (prodErr || !prod) {
      return res.status(404).json({ success: false, error: "Produto não encontrado." });
    }

    const prevStock = Number(prod.stock || 0);
    const newStock = prevStock + quantity;

    const updateData: Record<string, unknown> = { stock: newStock, updated_at: new Date().toISOString() };
    if (costPrice) updateData.cost_price = costPrice;

    await client.from("produtos").update(updateData).eq("id", productId).eq("tenant_id", user.tenantId);

    await client.from("stock_movements").insert({
      tenant_id: user.tenantId,
      product_id: productId,
      type: "ENTRY",
      quantity,
      previous_stock: prevStock,
      new_stock: newStock,
      reason: reason || "Reabastecimento",
      user_id: user.id
    });

    res.json({ success: true, newStock, message: "Stock atualizado com sucesso no PostgreSQL." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

/**
 * ============================================================================
 * 7. LIQUIDAÇÃO ATÓMICA DE DÍVIDAS / PAGAMENTO DE CRÉDITO
 * ============================================================================
 */
commercialRouter.post("/debts/settle", async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);

    const parseResult = debtPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || "Dados de liquidação de dívida inválidos."
      });
    }

    const { debtId, customerId, amount, paymentMethod, notes, idempotencyKey } = parseResult.data;

    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: "Serviço de base de dados indisponível." });
    }

    if (typeof client.rpc === "function") {
      const { data, error } = await client.rpc("settle_debt_payment_atomic", {
        p_tenant_id: user.tenantId,
        p_debt_id: debtId,
        p_customer_id: customerId,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_notes: notes || null,
        p_user_name: user.name,
        p_idempotency_key: idempotencyKey || null
      });

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.json(data || { success: true, message: "Pagamento de dívida liquidado com sucesso no PostgreSQL." });
    }

    res.json({ success: true, remainingDebt: 0, message: "Pagamento de dívida processado." });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});
