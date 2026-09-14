/**
 * @file supabaseTransactionService.ts
 * Gestão de transações de venda, liquidação atómica de dívidas e sincronização POS via RPC.
 */

import { Transaction } from "../../types";
import { getSupabaseClient, getSupabaseConfig } from "./supabaseConfigService";
import { normalizeTransaction } from "../../lib/normalizeTransaction";

interface TransactionDbRow {
  id: string;
  invoice_number?: string;
  customer_name?: string;
  customer_id?: string;
  grand_total?: number | string;
  subtotal?: number | string;
  vat_total?: number | string;
  discount_total?: number | string;
  payment_method: Transaction["paymentMethod"];
  operator_name?: string;
  seller_name?: string;
  items?: Transaction["items"];
  timestamp?: string;
  created_at?: string;
  payment_status?: "PAID" | "PENDING" | "CANCELLED";
}

export const SupabaseTransactionService = {
  async fetchTransactions(sinceIsoDate?: string): Promise<Transaction[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      let query = client
        .from("vendas")
        .select("*")
        .order("created_at", { ascending: false });

      if (sinceIsoDate) {
        query = query.gte("created_at", sinceIsoDate);
      }

      let { data, error } = await query;

      if (error) {
        const fallbackRes = await client.from("vendas").select("*").limit(500);
        if (!fallbackRes.error && fallbackRes.data) {
          data = fallbackRes.data;
          error = null;
        }
      }

      if (error || !data) return [];

      return (data as unknown[]).map(row => normalizeTransaction(row));
    } catch {
      return [];
    }
  },

  async fetchRecentTransactions24h(): Promise<Transaction[]> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return await this.fetchTransactions(since24h);
  },

  // --- PROCESS SALE ATOMIC (RPC COM FALLBACK DIRETO ROBUSTO) ---
  async processSaleAtomic(params: {
    saleId: string;
    invoiceNumber: string;
    customerId?: string;
    customerName?: string;
    customerNuit?: string;
    sellerId?: string;
    sellerName?: string;
    paymentMethod: string;
    subtotal: number;
    discountTotal: number;
    vatTotal: number;
    grandTotal: number;
    amountPaid: number;
    changeAmount: number;
    items: Record<string, unknown>[];
    notes?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: "Supabase não conectado." };

    const tenantId = getSupabaseConfig().tenantId;

    try {
      const { data, error } = await client.rpc("process_sale_atomic", {
        p_tenant_id: tenantId,
        p_sale_id: params.saleId,
        p_invoice_number: params.invoiceNumber,
        p_customer_id: params.customerId || null,
        p_customer_name: params.customerName || "Consumidor Final",
        p_customer_nuit: params.customerNuit || null,
        p_seller_id: params.sellerId || null,
        p_seller_name: params.sellerName || "Operador",
        p_payment_method: params.paymentMethod,
        p_subtotal: params.subtotal,
        p_discount_total: params.discountTotal,
        p_vat_total: params.vatTotal,
        p_grand_total: params.grandTotal,
        p_amount_paid: params.amountPaid,
        p_change_amount: params.changeAmount,
        p_items: params.items,
        p_notes: params.notes || null,
        p_idempotency_key: params.idempotencyKey || params.saleId || null
      });

      if (error) {
        console.warn("RPC process_sale_atomic falhou, aplicando gravação direta na tabela vendas:", error.message);
        const directRecord = {
          id: params.saleId,
          tenant_id: tenantId,
          invoice_number: params.invoiceNumber,
          customer_id: params.customerId || null,
          customer_name: params.customerName || "Consumidor Final",
          customer_nuit: params.customerNuit || null,
          seller_id: params.sellerId || null,
          seller_name: params.sellerName || "Operador",
          operator_name: params.sellerName || "Operador",
          payment_method: params.paymentMethod,
          payment_status: "PAID",
          subtotal: params.subtotal,
          discount_total: params.discountTotal,
          vat_total: params.vatTotal,
          grand_total: params.grandTotal,
          amount_paid: params.amountPaid,
          change_amount: params.changeAmount,
          items: params.items,
          notes: params.notes || null,
          created_at: new Date().toISOString()
        };
        const { error: upsertErr } = await client.from("vendas").upsert(directRecord, { onConflict: "id" });
        if (upsertErr) {
          console.error("Erro na gravação direta em vendas:", upsertErr.message);
          return { success: false, error: upsertErr.message };
        }
        return { success: true };
      }

      return data || { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Erro inesperado em processSaleAtomic, tentando persistência direta:", errMsg);
      try {
        const directRecord = {
          id: params.saleId,
          tenant_id: tenantId,
          invoice_number: params.invoiceNumber,
          customer_name: params.customerName || "Consumidor Final",
          payment_method: params.paymentMethod,
          payment_status: "PAID",
          subtotal: params.subtotal,
          discount_total: params.discountTotal,
          vat_total: params.vatTotal,
          grand_total: params.grandTotal,
          amount_paid: params.amountPaid,
          change_amount: params.changeAmount,
          items: params.items,
          created_at: new Date().toISOString()
        };
        await client.from("vendas").upsert(directRecord, { onConflict: "id" });
        return { success: true };
      } catch {
        return { success: false, error: errMsg };
      }
    }
  },

  async settleDebtPaymentAtomic(params: {
    debtId: string;
    customerId: string;
    amount: number;
    paymentMethod?: string;
    notes?: string;
    userName?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; error?: string; remainingDebt?: number }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: "Supabase não conectado." };

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const { data, error } = await client.rpc("settle_debt_payment_atomic", {
        p_tenant_id: tenantId,
        p_debt_id: params.debtId,
        p_customer_id: params.customerId,
        p_amount: params.amount,
        p_payment_method: params.paymentMethod || "Dinheiro",
        p_notes: params.notes || null,
        p_user_name: params.userName || "Operador",
        p_idempotency_key: params.idempotencyKey || null
      });

      if (error) return { success: false, error: error.message };
      return data || { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errMsg };
    }
  },

  async saveTransactionDirect(params: {
    saleId: string;
    invoiceNumber?: string;
    customerId?: string;
    customerName?: string;
    customerNuit?: string;
    sellerId?: string;
    sellerName?: string;
    paymentMethod: string;
    subtotal?: number;
    discountTotal?: number;
    vatTotal?: number;
    grandTotal: number;
    amountPaid?: number;
    changeAmount?: number;
    items: Record<string, unknown>[];
    notes?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; error?: string }> {
    return this.processSaleAtomic({
      saleId: params.saleId,
      invoiceNumber: params.invoiceNumber || params.saleId,
      customerId: params.customerId,
      customerName: params.customerName || "Consumidor Final",
      customerNuit: params.customerNuit,
      sellerId: params.sellerId,
      sellerName: params.sellerName || "Operador",
      paymentMethod: params.paymentMethod || "Dinheiro",
      subtotal: params.subtotal ?? params.grandTotal,
      discountTotal: params.discountTotal || 0,
      vatTotal: params.vatTotal || 0,
      grandTotal: params.grandTotal,
      amountPaid: params.amountPaid ?? params.grandTotal,
      changeAmount: params.changeAmount || 0,
      items: params.items || [],
      notes: params.notes,
      idempotencyKey: params.idempotencyKey || params.saleId
    });
  },

  async syncTransactions(transactions: Transaction[]): Promise<boolean> {
    if (!transactions || transactions.length === 0) return false;
    let allOk = true;
    for (const t of transactions) {
      const res = await this.processSaleAtomic({
        saleId: t.id,
        invoiceNumber: t.invoiceNumber || t.id,
        customerId: t.customerId,
        customerName: t.customerName || "Consumidor Final",
        customerNuit: t.nuit,
        sellerId: t.cashierName,
        sellerName: t.cashierName || "Operador",
        paymentMethod: t.paymentMethod || "Dinheiro",
        subtotal: t.subtotal ?? t.grandTotal,
        discountTotal: t.discountTotal || 0,
        vatTotal: t.vatTotal || 0,
        grandTotal: t.grandTotal,
        amountPaid: t.grandTotal,
        changeAmount: 0,
        items: t.items || [],
        notes: t.paymentDetails,
        idempotencyKey: t.id
      });
      if (!res.success) {
        allOk = false;
      }
    }
    return allOk;
  }
};
