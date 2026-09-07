import React from "react";
import { Lock } from "lucide-react";
import { Employee } from "../../types";

interface StaffEditEmployeeModalProps {
  isEditModalOpen: boolean;
  setIsEditModalOpen: (open: boolean) => void;
  selectedEmp: Employee | null;
  onEditEmployee: (e: React.FormEvent) => void;
  name: string;
  setName: (name: string) => void;
  role: string;
  setRole: (role: string) => void;
  contact: string;
  setContact: (contact: string) => void;
  salary: number;
  setSalary: (salary: number) => void;
  username: string;
  setUsername: (username: string) => void;
  pin: string;
  setPin: (pin: string) => void;
  email: string;
  setEmail: (email: string) => void;
  employeeStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED";
  setEmployeeStatus: (status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED") => void;
}

export const StaffEditEmployeeModal: React.FC<StaffEditEmployeeModalProps> = ({
  isEditModalOpen,
  setIsEditModalOpen,
  selectedEmp,
  onEditEmployee,
  name,
  setName,
  role,
  setRole,
  contact,
  setContact,
  salary,
  setSalary,
  username,
  setUsername,
  pin,
  setPin,
  email,
  setEmail,
  employeeStatus,
  setEmployeeStatus,
}) => {
  if (!isEditModalOpen || !selectedEmp) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-150 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-slate-900 text-sm">Editar Cadastro de Colaborador</h3>
          <button 
            onClick={() => setIsEditModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 font-bold text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onEditEmployee} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Completo</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Cargo / Função</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer"
            >
              <option value="Administrador">Administrador</option>
              <option value="Supervisor de Vendas">Supervisor de Vendas</option>
              <option value="Operador de Caixa">Operador de Caixa</option>
              <option value="Gestor de Stock">Gestor de Stock</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Contacto Telefónico</label>
              <input
                type="tel"
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Salário Bruto (MT)</label>
              <input
                type="number"
                required
                value={salary || ""}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3">
            <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Credenciais de Acesso
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block text-left">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none focus:border-orange-500 text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block text-left">Senha de Acesso</label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  placeholder="Mínimo 6 caracteres"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none focus:border-orange-500 text-slate-800"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block text-left">E-mail (Gmail)</label>
              <input
                type="email"
                placeholder="Ex: levi@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-800"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block text-left">Estado Operacional</label>
            <select
              value={employeeStatus}
              onChange={(e) => setEmployeeStatus(e.target.value as Employee["status"])}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer"
            >
              <option value="ACTIVE">🟢 Ativo (Acesso autorizado)</option>
              <option value="SUSPENDED">🟡 Suspenso (Acesso temporariamente retido)</option>
              <option value="INACTIVE">🔴 Desativado (Acesso rescindido)</option>
              <option value="BLOCKED">🔒 Bloqueado (Senha Expirada ou Segurança)</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
