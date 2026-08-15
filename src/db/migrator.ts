import { getDb, isCloudSqlAvailable } from "./index";
import * as schema from "./schema";
import { eq } from "drizzle-orm";
import type { Firestore } from "firebase-admin/firestore";

export interface MigrationSummary {
  tenantUid: string;
  productsMigrated: number;
  customersMigrated: number;
  salesMigrated: number;
  debtsMigrated: number;
  cashMigrated: number;
  logsMigrated: number;
  errors: string[];
  divergences: string[];
}

/**
 * Robust, idempotent migration engine from Firestore (Tenant Partition) to PostgreSQL / Cloud SQL.
 */
export async function migrateTenantFromFirestoreToSql(
  tenantUid: string,
  firebaseDb: Firestore
): Promise<MigrationSummary> {
  if (!isCloudSqlAvailable()) {
    throw new Error("Cloud SQL configuration (DATABASE_URL or SQL_HOST) is not available.");
  }

  const db = getDb();
  const summary: MigrationSummary = {
    tenantUid,
    productsMigrated: 0,
    customersMigrated: 0,
    salesMigrated: 0,
    debtsMigrated: 0,
    cashMigrated: 0,
    logsMigrated: 0,
    errors: [],
    divergences: [],
  };

  const tenantRef = firebaseDb.collection("admins").doc(tenantUid);

  // 1. Ensure Tenant Company exists
  try {
    await db.insert(schema.companies).values({
      id: `company-${tenantUid}`,
      name: `Empresa ${tenantUid}`,
      ownerUid: tenantUid,
      currency: "AOA",
    }).onConflictDoNothing();
  } catch (err: any) {
    summary.errors.push(`Company init error: ${err.message}`);
  }

  // 2. Migrate Products
  try {
    const productsSnap = await tenantRef.collection("products").get();
    if (!productsSnap.empty) {
      for (const doc of productsSnap.docs) {
        const p = doc.data();
        const prodId = doc.id;
        await db.insert(schema.products).values({
          id: prodId,
          tenantId: tenantUid,
          name: p.name || p.nome || "Sem Nome",
          code: p.code || p.codigo || "",
          barcode: p.barcode || p.codigoBarras || "",
          category: p.category || p.categoria || "Geral",
          price: (Number(p.price || p.preco) || 0).toFixed(2),
          cost: (Number(p.cost || p.custo) || 0).toFixed(2),
          stock: (Number(p.stock || p.estoque) || 0).toFixed(2),
          minStock: (Number(p.minStock || p.estoqueMinimo) || 0).toFixed(2),
          unit: p.unit || p.unidade || "un",
          imageUrl: p.imageUrl || p.imagem || null,
          isActive: p.isActive !== false,
        }).onConflictDoUpdate({
          target: schema.products.id,
          set: {
            name: p.name || p.nome || "Sem Nome",
            code: p.code || p.codigo || "",
            barcode: p.barcode || p.codigoBarras || "",
            category: p.category || p.categoria || "Geral",
            price: (Number(p.price || p.preco) || 0).toFixed(2),
            cost: (Number(p.cost || p.custo) || 0).toFixed(2),
            stock: (Number(p.stock || p.estoque) || 0).toFixed(2),
            unit: p.unit || p.unidade || "un",
            imageUrl: p.imageUrl || p.imagem || null,
            isActive: p.isActive !== false,
            updatedAt: new Date(),
          },
        });
        summary.productsMigrated++;
      }
    }
  } catch (err: any) {
    summary.errors.push(`Products migration error: ${err.message}`);
  }

  // 3. Migrate Customers & Credit
  try {
    const customersSnap = await tenantRef.collection("customers").get();
    if (!customersSnap.empty) {
      for (const doc of customersSnap.docs) {
        const c = doc.data();
        const custId = doc.id;
        await db.insert(schema.customers).values({
          id: custId,
          tenantId: tenantUid,
          name: c.name || c.nome || "Sem Nome",
          email: c.email || null,
          phone: c.phone || c.telefone || null,
          address: c.address || c.endereco || null,
          nif: c.nif || null,
          creditLimit: (Number(c.creditLimit || c.limiteCredito) || 0).toFixed(2),
          currentDebt: (Number(c.currentDebt || c.dividaAtual) || 0).toFixed(2),
          notes: c.notes || c.observacoes || null,
        }).onConflictDoUpdate({
          target: schema.customers.id,
          set: {
            name: c.name || c.nome || "Sem Nome",
            email: c.email || null,
            phone: c.phone || c.telefone || null,
            address: c.address || c.endereco || null,
            nif: c.nif || null,
            creditLimit: (Number(c.creditLimit || c.limiteCredito) || 0).toFixed(2),
            currentDebt: (Number(c.currentDebt || c.dividaAtual) || 0).toFixed(2),
            notes: c.notes || c.observacoes || null,
          },
        });
        summary.customersMigrated++;
      }
    }
  } catch (err: any) {
    summary.errors.push(`Customers migration error: ${err.message}`);
  }

  // 4. Migrate Sales & Sale Items
  try {
    const salesSnap = await tenantRef.collection("transactions").get();
    if (!salesSnap.empty) {
      for (const doc of salesSnap.docs) {
        const s = doc.data();
        const saleId = doc.id;
        const subtotal = Number(s.subtotal) || 0;
        const discountTotal = Number(s.discountTotal || s.desconto) || 0;
        const vatTotal = Number(s.vatTotal || s.imposto) || 0;
        const grandTotal = Number(s.grandTotal || s.total) || (subtotal - discountTotal + vatTotal);

        await db.insert(schema.sales).values({
          id: saleId,
          tenantId: tenantUid,
          invoiceNumber: s.invoiceNumber || s.faturaNumero || saleId,
          customerId: s.customerId || s.clienteId || null,
          customerName: s.customerName || s.clienteNome || null,
          sellerId: s.sellerId || s.vendedorId || null,
          sellerName: s.sellerName || s.vendedorNome || null,
          paymentMethod: s.paymentMethod || s.metodoPagamento || "Dinheiro",
          subtotal: subtotal.toFixed(2),
          discountTotal: discountTotal.toFixed(2),
          vatTotal: vatTotal.toFixed(2),
          grandTotal: grandTotal.toFixed(2),
          status: s.status || "COMPLETED",
          itemsJson: JSON.stringify(s.items || s.itens || []),
          notes: s.notes || s.observacoes || null,
        }).onConflictDoNothing();

        // Migrate individual relational items
        const rawItems = Array.isArray(s.items) ? s.items : (Array.isArray(s.itens) ? s.itens : []);
        for (let i = 0; i < rawItems.length; i++) {
          const item = rawItems[i];
          const itemId = `item-${saleId}-${i}`;
          const unitPrice = Number(item.price || item.preco || item.unitPrice) || 0;
          const qty = Number(item.quantity || item.qtd || item.quantidade) || 1;
          const total = Number(item.total) || (unitPrice * qty);

          await db.insert(schema.saleItems).values({
            id: itemId,
            tenantId: tenantUid,
            saleId: saleId,
            productId: item.productId || item.id || `p-${i}`,
            productName: item.name || item.nome || item.productName || "Item",
            unitPrice: unitPrice.toFixed(2),
            quantity: qty.toFixed(2),
            discount: (Number(item.discount || item.desconto) || 0).toFixed(2),
            vatAmount: (Number(item.vatAmount || item.imposto) || 0).toFixed(2),
            totalPrice: total.toFixed(2),
          }).onConflictDoNothing();
        }

        summary.salesMigrated++;
      }
    }
  } catch (err: any) {
    summary.errors.push(`Sales migration error: ${err.message}`);
  }

  // 5. Migrate Audit Logs
  try {
    const logsSnap = await tenantRef.collection("auditlogs").limit(500).get();
    if (!logsSnap.empty) {
      for (const doc of logsSnap.docs) {
        const l = doc.data();
        await db.insert(schema.auditlogs).values({
          id: doc.id,
          tenantId: tenantUid,
          userId: l.userId || l.usuarioId || null,
          userName: l.userName || l.usuarioNome || "Sistema",
          action: l.action || l.acao || "Operação",
          module: l.module || l.modulo || "SISTEMA",
          details: l.details || l.detalhes || null,
        }).onConflictDoNothing();
        summary.logsMigrated++;
      }
    }
  } catch (err: any) {
    summary.errors.push(`Logs migration error: ${err.message}`);
  }

  return summary;
}
