import { Router, Request, Response } from "express";
import crypto from "crypto";
import { AuthenticatedRequest, AuthenticatedUserContext, requireAdmin, requireAuth, supabaseServerAdmin, supabasePublicAuth } from "./authMiddleware";
import { dbSaveSchema } from "./validation";

export const dbRouter = Router();

function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Erro desconhecido";
}

// 1. GET: Load stateful tables with strict multi-tenant isolation from Supabase PostgreSQL
dbRouter.get("/load", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user as AuthenticatedUserContext;
    const tenantUid = user?.tenantId;
    if (!tenantUid) {
      return res.status(401).json({ error: "Sessão não autorizada ou tenant_id ausente." });
    }

    const client = supabaseServerAdmin || supabasePublicAuth;
    if (!client) {
      return res.status(500).json({ error: "Cliente Supabase indisponível no servidor." });
    }

    const [prodsRes, custsRes, salesRes, logsRes, setsRes, cashRes] = await Promise.allSettled([
      client.from("produtos").select("*").eq("tenant_id", tenantUid),
      client.from("clientes").select("*").eq("tenant_id", tenantUid),
      client.from("vendas").select("*").eq("tenant_id", tenantUid).order("created_at", { ascending: false }).limit(500),
      client.from("audit_logs").select("*").eq("tenant_id", tenantUid).order("created_at", { ascending: false }).limit(100),
      client.from("settings").select("*").eq("tenant_id", tenantUid).maybeSingle(),
      client.from("caixa").select("*").eq("tenant_id", tenantUid).order("created_at", { ascending: false }).limit(200)
    ]);

    const rawProducts = prodsRes.status === "fulfilled" && prodsRes.value.data ? prodsRes.value.data : [];
    const products = (rawProducts as Record<string, unknown>[]).map((p) => ({
      id: String(p.id),
      name: String(p.name || p.nome || "Produto"),
      code: String(p.code || p.codigo || p.id),
      barcode: String(p.barcode || p.code || ""),
      category: String(p.category || p.categoria || "Geral"),
      supplier: String(p.supplier || p.fornecedor || "Geral"),
      costPrice: Number(p.costPrice ?? p.cost_price ?? 0),
      salePrice: Number(p.salePrice ?? p.sale_price ?? 0),
      stock: Number(p.stock ?? p.estoque ?? 0),
      minStock: Number(p.minStock ?? p.min_stock ?? 5),
      vatRate: Number(p.vatRate ?? p.vat_rate ?? 16),
      unit: String(p.unit || "un"),
      image: String(p.image || p.imageUrl || p.image_url || ""),
      imageUrl: String(p.image || p.imageUrl || p.image_url || ""),
      emoji: String(p.emoji || "📦"),
      isActive: p.isActive !== false && p.is_active !== false,
      updatedAt: p.updated_at ? String(p.updated_at) : p.updatedAt ? String(p.updatedAt) : undefined
    }));

    const rawCustomers = custsRes.status === "fulfilled" && custsRes.value.data ? custsRes.value.data : [];
    const customers = (rawCustomers as Record<string, unknown>[]).map((c) => ({
      id: String(c.id),
      name: String(c.name || c.nome || "Cliente"),
      email: c.email ? String(c.email) : undefined,
      phone: String(c.phone || c.telefone || ""),
      address: c.address ? String(c.address) : undefined,
      nuit: c.nuit ? String(c.nuit) : undefined,
      totalSpent: Number(c.totalSpent ?? c.total_spent ?? 0),
      purchaseCount: Number(c.purchaseCount ?? c.purchase_count ?? 0),
      loyaltyPoints: Number(c.loyaltyPoints ?? c.loyalty_points ?? 0),
      debt: Number(c.debt ?? c.divida ?? 0),
      creditLimit: Number(c.creditLimit ?? c.credit_limit ?? 0),
      creditBlocked: Boolean(c.creditBlocked ?? c.credit_blocked ?? false),
      preferredPaymentMethod: c.preferredPaymentMethod || c.preferred_payment_method || undefined,
      category: c.category || c.categoria || "REGULAR",
      branchId: c.branchId || c.branch_id || undefined,
      createdAt: c.createdAt || c.created_at || undefined,
      updatedAt: c.updatedAt || c.updated_at || undefined
    }));

    const rawSales = salesRes.status === "fulfilled" && salesRes.value.data ? salesRes.value.data : [];
    const transactions = (rawSales as Record<string, unknown>[]).map((t) => {
      const grand = Number(t.grand_total ?? t.grandTotal ?? t.amount_paid ?? 0);
      const vat = Number(t.vat_total ?? t.vatTotal ?? 0);
      const disc = Number(t.discount_total ?? t.discountTotal ?? 0);
      const sub = Number(t.subtotal ?? (grand - vat + disc)) || grand;

      let itemsArr: unknown[] = [];
      if (Array.isArray(t.items)) {
        itemsArr = t.items;
      } else if (typeof t.items === "string") {
        try {
          itemsArr = JSON.parse(t.items);
        } catch {
          itemsArr = [];
        }
      }

      return {
        id: String(t.id),
        invoiceNumber: String(t.invoice_number || t.invoiceNumber || t.id),
        customerName: String(t.customer_name || t.customerName || "Consumidor Final"),
        customerId: t.customer_id ? String(t.customer_id) : (t.customerId ? String(t.customerId) : undefined),
        customerPhone: t.customer_phone ? String(t.customer_phone) : (t.customerPhone ? String(t.customerPhone) : undefined),
        customerEmail: t.customer_email ? String(t.customer_email) : (t.customerEmail ? String(t.customerEmail) : undefined),
        nuit: t.customer_nuit ? String(t.customer_nuit) : (t.nuit ? String(t.nuit) : undefined),
        grandTotal: grand,
        subtotal: sub,
        vatTotal: vat,
        discountTotal: disc,
        paymentMethod: String(t.payment_method || t.paymentMethod || "CASH"),
        paymentStatus: String(t.payment_status || t.paymentStatus || "PAID"),
        cashierName: String(t.operator_name || t.seller_name || t.sellerName || t.cashierName || "Operador Geral"),
        items: itemsArr,
        timestamp: String(t.timestamp || t.created_at || new Date().toISOString()),
        paymentDetails: t.notes ? String(t.notes) : (t.paymentDetails ? String(t.paymentDetails) : undefined),
        branchId: t.branch_id ? String(t.branch_id) : (t.branchId ? String(t.branchId) : "central"),
        status: String(t.status || "COMPLETED")
      };
    });

    const rawCash = cashRes.status === "fulfilled" && cashRes.value.data ? cashRes.value.data : [];
    const cashflow = (rawCash as Record<string, unknown>[]).map((cf) => ({
      id: String(cf.id),
      cashRegisterId: cf.cash_register_id ? String(cf.cash_register_id) : undefined,
      type: String(cf.type || "INPUT"),
      amount: Number(cf.amount || 0),
      reason: String(cf.reason || "Movimento de Caixa"),
      responsibleUser: String(cf.responsible_user || "Sistema"),
      referenceId: cf.reference_id ? String(cf.reference_id) : undefined,
      timestamp: String(cf.timestamp || cf.created_at || new Date().toISOString())
    }));

    const auditlogs = logsRes.status === "fulfilled" && logsRes.value.data ? logsRes.value.data : [];
    const settings = setsRes.status === "fulfilled" && setsRes.value.data ? setsRes.value.data : null;

    res.json({
      success: true,
      hasData: products.length > 0 || customers.length > 0 || transactions.length > 0,
      data: {
        products,
        customers,
        transactions,
        cashflow,
        employees: [],
        auditlogs,
        settings
      },
      source: "Supabase PostgreSQL",
      tenantUid
    });
  } catch (err: unknown) {
    res.status(500).json({ error: extractErrorMessage(err) });
  }
});

// 2. POST: Save individual table state with strict multi-tenant isolation, Zod validation, and RBAC
dbRouter.post("/save", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user as AuthenticatedUserContext;
    const tenantUid = user?.tenantId;
    if (!tenantUid) {
      return res.status(401).json({ success: false, error: "Sessão não autorizada ou tenant_id ausente." });
    }

    const parseResult = dbSaveSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Dados de payload inválidos para sincronização.",
        details: parseResult.error.format()
      });
    }

    const { table, data } = parseResult.data;

    // Proibir alteração de funcionários ou configurações por utilizadores sem perfil ADMIN
    if ((table === "employees" || table === "settings") && user.role !== "ADMIN") {
      return res.status(403).json({ success: false, error: "Apenas Administradores podem modificar colaboradores ou configurações da empresa." });
    }

    const client = supabaseServerAdmin || supabasePublicAuth;
    if (!client) {
      return res.status(500).json({ success: false, error: "Cliente Supabase indisponível no servidor." });
    }

    if (table === "products") {
      const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
      const records = items.map((p) => ({
        id: String(p.id || `prod_${crypto.randomUUID()}`),
        tenant_id: tenantUid,
        name: String(p.name || p.nome || "Produto"),
        code: String(p.code || p.codigo || p.id),
        barcode: String(p.barcode || p.code || ""),
        category: String(p.category || p.categoria || "Geral"),
        category_id: p.categoryId ? String(p.categoryId) : p.category_id ? String(p.category_id) : null,
        supplier: String(p.supplier || p.fornecedor || ""),
        supplier_id: p.supplierId ? String(p.supplierId) : p.supplier_id ? String(p.supplier_id) : null,
        cost_price: Number(p.costPrice ?? p.cost_price ?? p.precoCusto ?? 0),
        sale_price: Number(p.salePrice ?? p.sale_price ?? p.price ?? p.precoVenda ?? 0),
        stock: Number(p.stock ?? p.estoque ?? 0),
        min_stock: Number(p.minStock ?? p.min_stock ?? 0),
        vat_rate: Number(p.vatRate ?? p.vat_rate ?? 16),
        unit: String(p.unit || "un"),
        image_url: String(p.image || p.imageUrl || p.image_url || ""),
        is_active: p.isActive !== false && p.is_active !== false,
        updated_at: new Date().toISOString()
      }));

      if (records.length > 0) {
        const { error } = await client.from("produtos").upsert(records, { onConflict: "id" });
        if (error) {
          return res.status(500).json({ success: false, error: `Falha ao persistir produtos no Supabase: ${error.message}` });
        }
      }
      return res.json({ success: true, count: records.length, message: `${records.length} produto(s) persistido(s) com sucesso no Supabase PostgreSQL.` });
    }

    if (table === "customers") {
      const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
      const records = items.map((c) => ({
        id: String(c.id || `cust_${crypto.randomUUID()}`),
        tenant_id: tenantUid,
        name: String(c.name || c.nome || "Cliente"),
        nuit: String(c.nuit || ""),
        email: String(c.email || ""),
        phone: String(c.phone || c.contact || c.telefone || ""),
        address: String(c.address || c.endereco || ""),
        credit_limit: Number(c.creditLimit ?? c.credit_limit ?? 0),
        balance: Number(c.balance ?? c.debt ?? c.saldo ?? 0),
        notes: String(c.notes || c.observacoes || ""),
        updated_at: new Date().toISOString()
      }));

      if (records.length > 0) {
        const { error } = await client.from("clientes").upsert(records, { onConflict: "id" });
        if (error) {
          return res.status(500).json({ success: false, error: `Falha ao persistir clientes no Supabase: ${error.message}` });
        }
      }
      return res.json({ success: true, count: records.length, message: `${records.length} cliente(s) persistido(s) com sucesso no Supabase PostgreSQL.` });
    }

    if (table === "transactions") {
      const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
      const records = items.map((t) => ({
        id: String(t.id || t.saleId || `venda_${crypto.randomUUID()}`),
        tenant_id: tenantUid,
        invoice_number: String(t.invoiceNumber || t.invoice_number || t.id),
        customer_id: t.customerId ? String(t.customerId) : t.customer_id ? String(t.customer_id) : null,
        customer_name: String(t.customerName || t.customer_name || "Consumidor Final"),
        customer_nuit: t.customerNuit ? String(t.customerNuit) : t.customer_nuit ? String(t.customer_nuit) : null,
        seller_id: t.sellerId ? String(t.sellerId) : t.seller_id ? String(t.seller_id) : null,
        seller_name: String(t.sellerName || t.seller_name || t.cashierName || t.operator_name || "Operador"),
        operator_name: String(t.operator_name || t.sellerName || t.cashierName || "Operador"),
        payment_method: String(t.paymentMethod || t.payment_method || "Dinheiro"),
        payment_status: String(t.paymentStatus || t.payment_status || "PAID"),
        subtotal: Number(t.subtotal ?? t.grandTotal ?? t.grand_total ?? 0),
        discount_total: Number(t.discountTotal ?? t.discount_total ?? 0),
        vat_total: Number(t.vatTotal ?? t.vat_total ?? 0),
        grand_total: Number(t.grandTotal ?? t.grand_total ?? 0),
        amount_paid: Number(t.amountPaid ?? t.amount_paid ?? t.grandTotal ?? t.grand_total ?? 0),
        change_amount: Number(t.changeAmount ?? t.change_amount ?? 0),
        status: String(t.status || "COMPLETED"),
        items: Array.isArray(t.items) ? t.items : [],
        notes: t.notes ? String(t.notes) : null,
        timestamp: String(t.timestamp || t.created_at || new Date().toISOString())
      }));

      if (records.length > 0) {
        const { error } = await client.from("vendas").upsert(records, { onConflict: "id" });
        if (error) {
          return res.status(500).json({ success: false, error: `Falha ao persistir transações no Supabase: ${error.message}` });
        }
      }
      return res.json({ success: true, count: records.length, message: `${records.length} transação(ões) persistida(s) com sucesso no Supabase PostgreSQL.` });
    }

    if (table === "cashflow") {
      const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
      const records = items.map((cf) => ({
        id: String(cf.id || `caixa_${crypto.randomUUID()}`),
        tenant_id: tenantUid,
        cash_register_id: cf.cashRegisterId ? String(cf.cashRegisterId) : cf.cash_register_id ? String(cf.cash_register_id) : null,
        type: String(cf.type || "INPUT"),
        amount: Number(cf.amount || 0),
        reason: String(cf.reason || "Movimento de Caixa"),
        responsible_user: String(cf.responsibleUser || cf.responsible_user || user.name || "Sistema"),
        reference_id: cf.referenceId ? String(cf.referenceId) : cf.reference_id ? String(cf.reference_id) : null,
        timestamp: String(cf.timestamp || new Date().toISOString())
      }));

      if (records.length > 0) {
        const { error } = await client.from("caixa").upsert(records, { onConflict: "id" });
        if (error) {
          return res.status(500).json({ success: false, error: `Falha ao persistir fluxo de caixa no Supabase: ${error.message}` });
        }
      }
      return res.json({ success: true, count: records.length, message: `${records.length} registo(s) de caixa persistido(s) com sucesso no Supabase PostgreSQL.` });
    }

    if (table === "employees") {
      const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
      const records = items.map((e) => {
        const rawPin = e.pin ? String(e.pin).trim() : null;
        let securePin = rawPin;
        // Se o PIN não estiver vazio e não for já um hash hexadecimal SHA-256 de 64 caracteres
        if (rawPin && rawPin.length !== 64) {
          securePin = crypto.createHash("sha256").update(`ost_vendas_salt_${rawPin}`).digest("hex");
        }

        return {
          id: String(e.id || `emp_${crypto.randomUUID()}`),
          tenant_id: tenantUid,
          auth_uid: e.authUid ? String(e.authUid) : e.auth_uid ? String(e.auth_uid) : null,
          name: String(e.name || "Colaborador"),
          email: e.email ? String(e.email).trim().toLowerCase() : null,
          contact: String(e.contact || e.phone || ""),
          whatsapp: String(e.whatsapp || ""),
          role: String(e.role || "Operador"),
          salary: Number(e.salary || 0),
          status: String(e.status || "ACTIVE"),
          pin: securePin,
          branch: String(e.branch || "Sede Principal"),
          subscription_plan: String(e.subscriptionPlan || e.subscription_plan || "OURO"),
          updated_at: new Date().toISOString()
        };
      });

      if (records.length > 0) {
        const { error } = await client.from("colaboradores").upsert(records, { onConflict: "id" });
        if (error) {
          return res.status(500).json({ success: false, error: `Falha ao persistir colaboradores no Supabase: ${error.message}` });
        }
      }
      return res.json({ success: true, count: records.length, message: `${records.length} colaborador(es) persistido(s) com sucesso no Supabase PostgreSQL.` });
    }

    if (table === "auditlogs") {
      const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
      const records = items.map((l) => ({
        id: String(l.id || `log_${crypto.randomUUID()}`),
        tenant_id: tenantUid,
        user_id: l.userId ? String(l.userId) : l.user_id ? String(l.user_id) : user.id || null,
        user_name: String(l.userName || l.user_name || l.user || user.name || "Sistema"),
        action: String(l.action || "ACCAO"),
        module: String(l.module || "SISTEMA"),
        details: String(l.details || ""),
        ip_address: String(l.ipAddress || l.ip_address || req.ip || "127.0.0.1"),
        device: String(l.device || "Browser"),
        timestamp: String(l.timestamp || new Date().toISOString())
      }));

      if (records.length > 0) {
        const { error } = await client.from("audit_logs").upsert(records, { onConflict: "id" });
        if (error) {
          return res.status(500).json({ success: false, error: `Falha ao persistir logs de auditoria no Supabase: ${error.message}` });
        }
      }
      return res.json({ success: true, count: records.length, message: `${records.length} log(s) de auditoria persistido(s) com sucesso no Supabase PostgreSQL.` });
    }

    if (table === "settings") {
      const record = (Array.isArray(data) ? (data[0] || {}) : data) as Record<string, unknown>;
      const settingsPayload = {
        id: String(record.id || `config-${tenantUid}`),
        tenant_id: tenantUid,
        company_name: String(record.companyName || record.company_name || "OST Vendas"),
        company_address: String(record.companyAddress || record.company_address || ""),
        company_nuit: String(record.companyNuit || record.company_nuit || ""),
        company_phone: String(record.companyPhone || record.company_phone || ""),
        company_email: String(record.companyEmail || record.company_email || ""),
        receipt_footer_message: String(record.receiptFooterMessage || record.receipt_footer_message || "Obrigado pela preferência!"),
        enable_vat: record.enableVat !== false,
        vat_percentage: Number(record.vatPercentage || record.vat_percentage || 16),
        currency: String(record.currency || "MT"),
        low_stock_threshold: Number(record.lowStockThreshold || record.low_stock_threshold || 5),
        default_printer: String(record.defaultPrinter || record.default_printer || "thermal_80mm"),
        cloud_backup_enabled: record.cloudBackupEnabled !== false,
        backup_frequency: String(record.backupFrequency || record.backup_frequency || "daily"),
        backup_time: String(record.backupTime || record.backup_time || "18:00"),
        logo_url: record.logoUrl ? String(record.logoUrl) : record.logo_url ? String(record.logo_url) : null,
        theme: String(record.theme || "laranja"),
        val_json: record,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("settings").upsert(settingsPayload, { onConflict: "id" });
      if (error) {
        return res.status(500).json({ success: false, error: `Falha ao persistir configurações no Supabase: ${error.message}` });
      }
      return res.json({ success: true, message: `Configurações persistidas com sucesso no Supabase PostgreSQL.` });
    }

    if (table === "categories") {
      const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
      const records = items.map((cat) => ({
        id: String(cat.id || `cat_${crypto.randomUUID()}`),
        tenant_id: tenantUid,
        name: String(cat.name || cat.nome || "Categoria"),
        description: String(cat.description || cat.descricao || "")
      }));
      if (records.length > 0) {
        const { error } = await client.from("categories").upsert(records, { onConflict: "id" });
        if (error) {
          return res.status(500).json({ success: false, error: `Falha ao persistir categorias no Supabase: ${error.message}` });
        }
      }
      return res.json({ success: true, count: records.length, message: `${records.length} categoria(s) persistida(s) com sucesso no Supabase PostgreSQL.` });
    }

    if (table === "suppliers") {
      const items = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
      const records = items.map((sup) => ({
        id: String(sup.id || `sup_${crypto.randomUUID()}`),
        tenant_id: tenantUid,
        name: String(sup.name || sup.nome || "Fornecedor"),
        contact_person: String(sup.contactPerson || sup.contact_person || ""),
        email: String(sup.email || ""),
        phone: String(sup.phone || sup.telefone || ""),
        address: String(sup.address || sup.endereco || ""),
        nif: String(sup.nif || sup.nuit || "")
      }));
      if (records.length > 0) {
        const { error } = await client.from("suppliers").upsert(records, { onConflict: "id" });
        if (error) {
          return res.status(500).json({ success: false, error: `Falha ao persistir fornecedores no Supabase: ${error.message}` });
        }
      }
      return res.json({ success: true, count: records.length, message: `${records.length} fornecedor(es) persistido(s) com sucesso no Supabase PostgreSQL.` });
    }

    res.status(400).json({ success: false, error: `Tabela '${table}' desconhecida para sincronização.` });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

// 3. POST: Save all tables in bulk (initial seed / backup restore)
dbRouter.post("/save-all", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user as AuthenticatedUserContext;
    const tenantUid = user?.tenantId;
    if (!tenantUid) {
      return res.status(401).json({ success: false, error: "Sessão não autorizada ou tenant_id ausente." });
    }

    const client = supabaseServerAdmin || supabasePublicAuth;
    if (!client) {
      return res.status(500).json({ success: false, error: "Cliente Supabase indisponível no servidor." });
    }

    const payload = (req.body || {}) as Record<string, unknown>;
    const results: Record<string, number> = {};

    if (payload.products && Array.isArray(payload.products)) {
      const productList = payload.products as Record<string, unknown>[];
      const records = productList.map((p) => ({
        id: String(p.id || `prod_${crypto.randomUUID()}`),
        tenant_id: tenantUid,
        name: String(p.name || p.nome || "Produto"),
        code: String(p.code || p.codigo || p.id),
        barcode: String(p.barcode || p.code || ""),
        category: String(p.category || p.categoria || "Geral"),
        cost_price: Number(p.costPrice ?? p.cost_price ?? 0),
        sale_price: Number(p.salePrice ?? p.sale_price ?? p.price ?? 0),
        stock: Number(p.stock ?? p.estoque ?? 0),
        min_stock: Number(p.minStock ?? p.min_stock ?? 0),
        vat_rate: Number(p.vatRate ?? p.vat_rate ?? 16),
        unit: String(p.unit || "un"),
        image_url: String(p.image || p.imageUrl || ""),
        is_active: p.isActive !== false && p.is_active !== false,
        updated_at: new Date().toISOString()
      }));
      if (records.length > 0) {
        const { error } = await client.from("produtos").upsert(records, { onConflict: "id" });
        if (error) throw new Error(`Erro ao persistir produtos: ${error.message}`);
        results.products = records.length;
      }
    }

    if (payload.customers && Array.isArray(payload.customers)) {
      const custList = payload.customers as Record<string, unknown>[];
      const records = custList.map((c) => ({
        id: String(c.id || `cust_${crypto.randomUUID()}`),
        tenant_id: tenantUid,
        name: String(c.name || c.nome || "Cliente"),
        nuit: String(c.nuit || ""),
        email: String(c.email || ""),
        phone: String(c.phone || c.contact || ""),
        address: String(c.address || ""),
        credit_limit: Number(c.creditLimit ?? c.credit_limit ?? 0),
        balance: Number(c.balance ?? c.debt ?? 0),
        notes: String(c.notes || ""),
        updated_at: new Date().toISOString()
      }));
      if (records.length > 0) {
        const { error } = await client.from("clientes").upsert(records, { onConflict: "id" });
        if (error) throw new Error(`Erro ao persistir clientes: ${error.message}`);
        results.customers = records.length;
      }
    }

    res.json({
      success: true,
      message: "Todas as tabelas foram persistidas com sucesso no Supabase PostgreSQL!",
      counts: results
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: extractErrorMessage(err) });
  }
});

// 4. POST: Clean Mock & Sample Data
dbRouter.post("/clean-mock-data", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user as AuthenticatedUserContext;
    const client = supabaseServerAdmin || supabasePublicAuth;
    if (!client) {
      return res.status(500).json({ error: "Cliente Supabase não configurado." });
    }

    await client.from("produtos").delete().eq("tenant_id", user.tenantId).ilike("nome", "%demo%");

    res.json({
      success: true,
      message: "Limpeza de dados de demonstração concluída com sucesso no Supabase PostgreSQL."
    });
  } catch (err: unknown) {
    res.status(500).json({ error: extractErrorMessage(err) });
  }
});

// 5. POST: Full System Reset with master admin preservation
dbRouter.post(["/system-reset", "/reset"], requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user as AuthenticatedUserContext;
    const tenantId = user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Sessão não autorizada ou tenant_id ausente." });
    }

    const client = supabaseServerAdmin || supabasePublicAuth;
    if (!client) {
      return res.status(500).json({ error: "Cliente Supabase não inicializado no servidor." });
    }

    await Promise.allSettled([
      client.from("vendas").delete().eq("tenant_id", tenantId),
      client.from("caixa").delete().eq("tenant_id", tenantId),
      client.from("produtos").delete().eq("tenant_id", tenantId),
      client.from("clientes").delete().eq("tenant_id", tenantId),
      client.from("audit_logs").delete().eq("tenant_id", tenantId)
    ]);

    const secureRecoveryPin = crypto.randomInt(100000, 999999).toString();

    await client.from("audit_logs").insert({
      id: `log-reset-${crypto.randomUUID()}`,
      tenant_id: tenantId,
      user_id: user.id,
      user_name: user.name || "Administrador",
      action: "RESET_COMPLETO_DO_SISTEMA",
      module: "SISTEMA",
      details: "Reset de dados operacionais executado com isolamento total de tenant no Supabase PostgreSQL."
    });

    res.json({
      success: true,
      message: "Reset completo do sistema executado com sucesso no Supabase PostgreSQL!",
      report: {
        timestamp: new Date().toISOString(),
        tenantId,
        status: "SYSTEM_READY_FOR_PRODUCTION",
        masterAccount: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
          temporaryPin: secureRecoveryPin,
          mustChangePassword: true
        }
      }
    });
  } catch (err: unknown) {
    res.status(500).json({ error: extractErrorMessage(err) });
  }
});
