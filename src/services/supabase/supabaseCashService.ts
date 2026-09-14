/**
 * @file supabaseCashService.ts
 * Gestão de movimentos de caixa, balancetes de encerramento e turno ativo via Supabase PostgreSQL.
 */

import { CashClosure, CashFlowEntry } from "../../types";
import { getSupabaseClient, getSupabaseConfig } from "./supabaseConfigService";

interface CashFlowDbRow {
  id: string;
  type?: CashFlowEntry["type"];
  amount?: number | string;
  reason?: string;
  responsible_user?: string;
  timestamp?: string;
}

interface CashClosureDbRow {
  id: string;
  shift_id?: string;
  opened_at: string;
  closed_at?: string;
  opened_by: string;
  closed_by?: string;
  opening_supervisor?: string;
  closing_supervisor?: string;
  opening_balance?: number | string;
  theoretical_balance?: number | string;
  physical_balance?: number | string;
  difference?: number | string;
  difference_type?: "EXACT" | "SURPLUS" | "SHORTAGE";
  reconciliation?: Record<string, number>;
  denominations?: Record<string, number>;
  closing_notes?: string;
}

export const SupabaseCashService = {
  // --- FLUXO DE CAIXA ---
  async fetchCashFlow(): Promise<CashFlowEntry[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("caixa")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error || !data) return [];

      return (data as CashFlowDbRow[]).map(row => ({
        id: row.id,
        type: row.type || "INPUT",
        amount: Number(row.amount || 0),
        reason: row.reason || "",
        responsibleUser: row.responsible_user || "",
        timestamp: row.timestamp || new Date().toISOString()
      }));
    } catch {
      return [];
    }
  },

  async saveCashFlowEntry(entry: CashFlowEntry): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: entry.id,
        tenant_id: tenantId,
        type: entry.type,
        amount: entry.amount,
        reason: entry.reason || "",
        responsible_user: entry.responsibleUser || "",
        timestamp: entry.timestamp || new Date().toISOString()
      };

      const { error } = await client.from("caixa").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async syncCashFlow(movements: CashFlowEntry[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || movements.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = movements.map((m) => ({
        id: m.id,
        tenant_id: tenantId,
        type: m.type,
        amount: m.amount,
        reason: m.reason || "",
        responsible_user: m.responsibleUser || "",
        timestamp: m.timestamp || new Date().toISOString()
      }));

      const { error } = await client.from("caixa").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  // --- FECHAMENTOS DE CAIXA / BALANCETES ---
  async fetchCashClosures(): Promise<CashClosure[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("cash_closures")
        .select("*")
        .order("closed_at", { ascending: false });

      if (error || !data) return [];

      return (data as CashClosureDbRow[]).map(row => ({
        id: row.id,
        shiftId: row.shift_id || row.id,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        openedBy: row.opened_by,
        closedBy: row.closed_by,
        openingSupervisor: row.opening_supervisor || "",
        closingSupervisor: row.closing_supervisor || "",
        openingBalance: Number(row.opening_balance || 0),
        theoreticalBalance: Number(row.theoretical_balance || 0),
        physicalBalance: Number(row.physical_balance || 0),
        difference: Number(row.difference || 0),
        differenceType: row.difference_type || (Number(row.difference || 0) === 0 ? "EXACT" : Number(row.difference || 0) > 0 ? "SURPLUS" : "SHORTAGE"),
        reconciliation: typeof row.reconciliation === "object" && row.reconciliation !== null ? row.reconciliation : {},
        denominations: typeof row.denominations === "object" && row.denominations !== null ? row.denominations : {},
        closingNotes: row.closing_notes || ""
      })) as CashClosure[];
    } catch {
      return [];
    }
  },

  async saveCashClosure(closure: CashClosure): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: closure.id,
        tenant_id: tenantId,
        shift_id: closure.shiftId || closure.id,
        opened_at: closure.openedAt,
        closed_at: closure.closedAt,
        opened_by: closure.openedBy,
        closed_by: closure.closedBy,
        opening_supervisor: closure.openingSupervisor || "",
        closing_supervisor: closure.closingSupervisor || "",
        opening_balance: closure.openingBalance,
        theoretical_balance: closure.theoreticalBalance,
        physical_balance: closure.physicalBalance,
        difference: closure.difference,
        difference_type: closure.differenceType || "EXACT",
        reconciliation: closure.reconciliation || {},
        denominations: closure.denominations || {},
        closing_notes: closure.closingNotes || "",
        created_at: new Date().toISOString()
      };

      const { error } = await client.from("cash_closures").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async syncCashClosures(closures: CashClosure[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || closures.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = closures.map((c) => ({
        id: c.id,
        tenant_id: tenantId,
        shift_id: c.shiftId || c.id,
        opened_at: c.openedAt,
        closed_at: c.closedAt,
        opened_by: c.openedBy,
        closed_by: c.closedBy,
        opening_supervisor: c.openingSupervisor || "",
        closing_supervisor: c.closingSupervisor || "",
        opening_balance: c.openingBalance,
        theoretical_balance: c.theoreticalBalance,
        physical_balance: c.physicalBalance,
        difference: c.difference,
        difference_type: c.differenceType || "EXACT",
        reconciliation: c.reconciliation || {},
        denominations: c.denominations || {},
        closing_notes: c.closingNotes || "",
        created_at: new Date().toISOString()
      }));

      const { error } = await client.from("cash_closures").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  // --- ESTADO DO TURNO ATIVO ---
  async fetchActiveCashShift(): Promise<{
    status: "OPEN" | "CLOSED";
    openingBalance: number;
    openedAt: string;
    openedBy: string;
    openingSupervisor?: string;
    openingNotes?: string;
  } | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from("cash_shifts")
        .select("*")
        .eq("id", "current_shift")
        .single();

      if (error || !data) return null;

      return {
        status: data.status === "CLOSED" ? "CLOSED" : "OPEN",
        openingBalance: Number(data.opening_balance || 0),
        openedAt: data.opened_at || new Date().toISOString(),
        openedBy: data.opened_by || "Admin",
        openingSupervisor: data.opening_supervisor || "",
        openingNotes: data.opening_notes || ""
      };
    } catch {
      return null;
    }
  },

  async saveActiveCashShift(shiftData: {
    status: "OPEN" | "CLOSED";
    openingBalance: number;
    openedAt: string;
    openedBy: string;
    openingSupervisor?: string;
    openingNotes?: string;
  }): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const record = {
        id: "current_shift",
        tenant_id: tenantId,
        status: shiftData.status,
        opening_balance: shiftData.openingBalance,
        opened_at: shiftData.openedAt,
        opened_by: shiftData.openedBy,
        opening_supervisor: shiftData.openingSupervisor || "",
        opening_notes: shiftData.openingNotes || "",
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("cash_shifts").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  }
};
