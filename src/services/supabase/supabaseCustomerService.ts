/**
 * @file supabaseCustomerService.ts
 * Gestão de clientes, histórico de contas correntes e fidelidade via Supabase PostgreSQL.
 */

import { Customer } from "../../types";
import { getSupabaseClient, getSupabaseConfig } from "./supabaseConfigService";

interface CustomerDbRow {
  id: string;
  name: string;
  nuit?: string;
  email?: string;
  phone?: string;
  address?: string;
  total_spent?: number | string;
  purchase_count?: number | string;
  debt?: number | string;
  balance?: number | string;
  loyalty_points?: number | string;
  notes?: string;
}

export const SupabaseCustomerService = {
  async fetchCustomers(): Promise<Customer[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("clientes")
        .select("*")
        .order("name", { ascending: true });

      if (error || !data) return [];

      return (data as CustomerDbRow[]).map(row => ({
        id: row.id,
        name: row.name,
        nuit: row.nuit || "",
        email: row.email || "",
        phone: row.phone || "",
        address: row.address || "",
        totalSpent: Number(row.total_spent || 0),
        purchaseCount: Number(row.purchase_count || 0),
        debt: Number(row.debt || row.balance || 0),
        loyaltyPoints: Number(row.loyalty_points || 0),
        notes: row.notes || ""
      })) as Customer[];
    } catch {
      return [];
    }
  },

  async saveCustomer(customer: Customer): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: customer.id,
        tenant_id: tenantId,
        name: customer.name,
        nuit: customer.nuit || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        debt: customer.debt || customer.balance || 0,
        balance: customer.balance || customer.debt || 0,
        total_spent: customer.totalSpent || 0,
        purchase_count: customer.purchaseCount || 0,
        loyalty_points: customer.loyaltyPoints || 0,
        credit_limit: customer.creditLimit || 0,
        notes: customer.notes || "",
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("clientes").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async syncCustomers(customers: Customer[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || customers.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = customers.map((c) => ({
        id: c.id,
        tenant_id: tenantId,
        name: c.name,
        nuit: c.nuit || "",
        email: c.email || "",
        phone: c.phone || "",
        address: c.address || "",
        debt: c.debt || c.balance || 0,
        balance: c.balance || c.debt || 0,
        total_spent: c.totalSpent || 0,
        purchase_count: c.purchaseCount || 0,
        loyalty_points: c.loyaltyPoints || 0,
        credit_limit: c.creditLimit || 0,
        notes: c.notes || "",
        updated_at: new Date().toISOString()
      }));

      const { error } = await client.from("clientes").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async deleteCustomer(customerId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client.from("clientes").delete().eq("id", customerId);
      return !error;
    } catch {
      return false;
    }
  }
};
