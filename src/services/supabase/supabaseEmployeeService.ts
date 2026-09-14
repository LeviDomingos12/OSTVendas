/**
 * @file supabaseEmployeeService.ts
 * Gestão de colaboradores, credenciais PIN criptográficas e recuperação de acesso via Supabase PostgreSQL.
 */

import { Employee } from "../../types";
import { hashSecurityPin } from "../../lib/security";
import { 
  getSupabaseClient, 
  getSupabaseConfig, 
  RecoveryRequestEntry 
} from "./supabaseConfigService";

interface EmployeeDbRow {
  id: string;
  name: string;
  email?: string;
  contact?: string;
  whatsapp?: string;
  role?: string;
  salary?: number | string;
  admission_date?: string;
  status?: Employee["status"];
  pin?: string;
  pin_created_at?: string;
  pin_changed?: boolean;
  foto_perfil?: string;
  subscription_plan?: Employee["subscriptionPlan"];
  branch?: string;
}

interface RecoveryRequestDbRow {
  id: string;
  employee_id: string;
  employee_name: string;
  email?: string;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  created_at: string;
}

export const SupabaseEmployeeService = {
  async fetchEmployees(): Promise<Employee[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const tenantId = getSupabaseConfig().tenantId;
      let query = client.from("colaboradores").select("*");
      if (tenantId && tenantId.trim()) {
        query = query.eq("tenant_id", tenantId);
      }
      const { data, error } = await query.order("name", { ascending: true });

      if (error || !data) return [];

      return (data as EmployeeDbRow[]).map(row => ({
        id: row.id,
        name: row.name,
        email: row.email || "",
        contact: row.contact || "",
        whatsapp: row.whatsapp || "",
        role: row.role || "Operador",
        salary: Number(row.salary || 0),
        admissionDate: row.admission_date || new Date().toISOString().split("T")[0],
        status: row.status || "ACTIVE",
        pin: row.pin || "",
        pinCreatedAt: row.pin_created_at || "",
        pinChanged: row.pin_changed ?? true,
        fotoPerfil: row.foto_perfil || "",
        subscriptionPlan: row.subscription_plan || "OURO",
        branch: row.branch || "Sede Principal"
      }));
    } catch {
      return [];
    }
  },

  async saveEmployee(employee: Employee): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      let safePin = employee.pin || "";
      if (safePin && safePin.length !== 64) {
        safePin = await hashSecurityPin(safePin);
      }

      const record = {
        id: employee.id,
        tenant_id: tenantId,
        name: employee.name,
        email: employee.email || "",
        contact: employee.contact || "",
        whatsapp: employee.whatsapp || "",
        role: employee.role || "Operador",
        salary: employee.salary || 0,
        admission_date: employee.admissionDate || new Date().toISOString().split("T")[0],
        status: employee.status || "ACTIVE",
        pin: safePin,
        pin_created_at: employee.pinCreatedAt || new Date().toISOString(),
        pin_changed: employee.pinChanged ?? true,
        foto_perfil: employee.fotoPerfil || "",
        subscription_plan: employee.subscriptionPlan || "OURO",
        branch: employee.branch || "Sede Principal",
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from("colaboradores").upsert(record, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  async syncEmployees(employees: Employee[]): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client || employees.length === 0) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const records = await Promise.all(employees.map(async (emp) => {
        let safePin = emp.pin || "";
        if (safePin && safePin.length !== 64) {
          safePin = await hashSecurityPin(safePin);
        }
        return {
          id: emp.id,
          tenant_id: tenantId,
          name: emp.name,
          email: emp.email || "",
          contact: emp.contact || "",
          whatsapp: emp.whatsapp || "",
          role: emp.role || "Operador",
          salary: emp.salary || 0,
          admission_date: emp.admissionDate || new Date().toISOString().split("T")[0],
          status: emp.status || "ACTIVE",
          pin: safePin,
          pin_created_at: emp.pinCreatedAt || new Date().toISOString(),
          pin_changed: emp.pinChanged ?? true,
          foto_perfil: emp.fotoPerfil || "",
          subscription_plan: emp.subscriptionPlan || "OURO",
          branch: emp.branch || "Sede Principal",
          updated_at: new Date().toISOString()
        };
      }));

      const { error } = await client.from("colaboradores").upsert(records, { onConflict: "id" });
      return !error;
    } catch {
      return false;
    }
  },

  // --- PEDIDOS DE RECUPERAÇÃO DE ACESSO ---
  async getRecoveryRequests(): Promise<RecoveryRequestEntry[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("recovery_requests")
        .select("*")
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });

      if (error || !data) return [];
      return (data as RecoveryRequestDbRow[]).map(r => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeName: r.employee_name,
        email: r.email,
        status: r.status,
        timestamp: r.created_at
      }));
    } catch {
      return [];
    }
  },

  async createRecoveryRequest(empId: string, empName: string, email?: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const tenantId = getSupabaseConfig().tenantId;
      const { error } = await client.from("recovery_requests").insert({
        tenant_id: tenantId,
        employee_id: empId,
        employee_name: empName,
        email: email || "",
        status: "PENDING",
        created_at: new Date().toISOString()
      });
      return !error;
    } catch {
      return false;
    }
  },

  async resolveRecoveryRequest(requestId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from("recovery_requests")
        .update({ status: "RESOLVED", resolved_at: new Date().toISOString() })
        .eq("id", requestId);
      return !error;
    } catch {
      return false;
    }
  }
};
