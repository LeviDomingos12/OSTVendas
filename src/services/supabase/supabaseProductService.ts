/**
 * @file supabaseProductService.ts
 * Gestão de artigos, catálogo de produtos e reabastecimento atómico via Supabase PostgreSQL.
 */

import { Product } from "../../types";
import { getSupabaseClient, getSupabaseConfig } from "./supabaseConfigService";

interface ProductDbRow {
  id: string;
  name: string;
  code?: string;
  category?: string;
  cost_price?: number | string;
  sale_price?: number | string;
  stock?: number | string;
  min_stock?: number | string;
  vat_rate?: number | string;
  unit?: string;
  barcode?: string;
  supplier?: string;
  image_url?: string;
}

export const SupabaseProductService = {
  async fetchProducts(): Promise<Product[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("produtos")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error || !data) return [];

      return (data as ProductDbRow[]).map(row => ({
        id: row.id,
        name: row.name,
        code: row.code || row.id,
        category: row.category || "Geral",
        costPrice: Number(row.cost_price || 0),
        salePrice: Number(row.sale_price || 0),
        stock: Number(row.stock || 0),
        minStock: Number(row.min_stock !== undefined ? row.min_stock : 5),
        vatRate: Number(row.vat_rate !== undefined ? row.vat_rate : 16),
        unit: row.unit || "un",
        barcode: row.barcode || row.code || "",
        supplier: row.supplier || "Geral",
        image: row.image_url || "",
        imageUrl: row.image_url || "",
        emoji: "📦"
      }));
    } catch {
      return [];
    }
  },

  async saveProduct(product: Product): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: product.id,
        tenant_id: tenantId,
        name: product.name,
        code: product.code || product.id,
        barcode: product.barcode || product.code || "",
        category: product.category || "Geral",
        supplier: product.supplier || "",
        cost_price: product.costPrice || 0,
        sale_price: product.salePrice || 0,
        stock: product.stock || 0,
        min_stock: product.minStock || 0,
        vat_rate: product.vatRate ?? 16,
        unit: product.unit || "un",
        image_url: product.image || product.imageUrl || "",
        is_active: true,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("produtos").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async syncProducts(products: Product[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || products.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = products.map((p) => ({
        id: p.id,
        tenant_id: tenantId,
        name: p.name,
        code: p.code || p.id,
        barcode: p.barcode || p.code || "",
        category: p.category || "Geral",
        supplier: p.supplier || "",
        cost_price: p.costPrice || 0,
        sale_price: p.salePrice || 0,
        stock: p.stock || 0,
        min_stock: p.minStock || 0,
        vat_rate: p.vatRate ?? 16,
        unit: p.unit || "un",
        image_url: p.image || p.imageUrl || "",
        is_active: true,
        updated_at: new Date().toISOString()
      }));

      const { error } = await client.from("produtos").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async deleteProduct(productId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client.from("produtos").update({ is_active: false }).eq("id", productId);
      return !error;
    } catch {
      return false;
    }
  },

  // --- REPLENISH STOCK ATOMIC (RPC) ---
  async replenishStockAtomic(params: {
    productId: string;
    quantity: number;
    costPrice?: number;
    reason?: string;
    userName?: string;
  }): Promise<{ success: boolean; error?: string; newStock?: number }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: "Supabase não conectado." };

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const { data, error } = await client.rpc("replenish_stock_atomic", {
        p_tenant_id: tenantId,
        p_product_id: params.productId,
        p_quantity: params.quantity,
        p_cost_price: params.costPrice || null,
        p_reason: params.reason || "Reabastecimento de Stock",
        p_user_name: params.userName || "Sistema"
      });

      if (error) return { success: false, error: error.message };
      return data || { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errMsg };
    }
  }
};
