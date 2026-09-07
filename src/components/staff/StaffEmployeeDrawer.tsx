import React from "react";
import { DollarSign, Printer } from "lucide-react";
import { Employee } from "../../types";

interface StaffEmployeeDrawerProps {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  selectedEmp: Employee | null;
  drawerTab: "RESUMO" | "PERMISSOES" | "ATENCION" | "FERIAS" | "SALARIO" | "HISTORICO";
  setDrawerTab: (tab: "RESUMO" | "PERMISSOES" | "ATENCION" | "FERIAS" | "SALARIO" | "HISTORICO") => void;
  onPaySalary: (emp: Employee) => void;
  onPrintPayslip: (emp: Employee) => void;
}

export const StaffEmployeeDrawer: React.FC<StaffEmployeeDrawerProps> = ({
  isDrawerOpen,
  setIsDrawerOpen,
  selectedEmp,
  drawerTab,
  setDrawerTab,
  onPaySalary,
  onPrintPayslip,
}) => {
  if (!isDrawerOpen || !selectedEmp) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-end">
      {/* Backdrop close area */}
      <div className="flex-1" onClick={() => setIsDrawerOpen(false)}></div>
      
      {/* Drawer sheet container */}
      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-150 flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-extrabold text-xs border border-orange-200 uppercase">
              {selectedEmp.name.substring(0, 2).toUpperCase()}
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm leading-none">{selectedEmp.name}</h3>
              <span className="text-[10px] text-slate-400 font-medium font-mono block mt-1">{selectedEmp.role}</span>
            </div>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-650 flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>

        {/* Drawer Tab Selectors */}
        <div className="flex border-b border-slate-150 bg-slate-50 overflow-x-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">
          {(["RESUMO", "PERMISSOES", "FERIAS", "SALARIO", "HISTORICO"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setDrawerTab(tab)}
              className={`px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer transition ${
                drawerTab === tab 
                  ? "border-orange-500 text-orange-600 bg-white" 
                  : "border-transparent hover:text-slate-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4 font-sans text-slate-600">
          
          {drawerTab === "RESUMO" && (
            <div className="space-y-4">
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-3">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Dados do Colaborador</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[9.5px]">CÓDIGO ID</span>
                    <span className="font-mono text-slate-700 block font-bold mt-0.5">{selectedEmp.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9.5px]">CARGO OPERACIONAL</span>
                    <span className="text-slate-700 block font-bold mt-0.5">{selectedEmp.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9.5px]">TELEFONE CENTRAL</span>
                    <span className="text-slate-700 block font-bold mt-0.5">{selectedEmp.contact}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9.5px]">DATA ADMISSÃO</span>
                    <span className="font-mono text-slate-700 block font-bold mt-0.5">{selectedEmp.admissionDate || "2024-01-10"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9.5px]">SENHA DE ACESSO</span>
                    <span className="font-mono text-emerald-600 block font-extrabold mt-0.5">{selectedEmp.pin ? "•••••••• (Ativa)" : "Não definida"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9.5px]">E-MAIL (GMAIL)</span>
                    <span className="text-slate-700 block font-semibold mt-0.5 truncate" title={selectedEmp.email || "Não registado"}>{selectedEmp.email || "Não registado"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-3">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Dados Fiscais e Tributação</h4>
                
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9.5px] font-sans">INSS REFERÊNCIA</span>
                    <span className="text-slate-700 block font-bold mt-0.5">3.0% (Inscrição Activa)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9.5px] font-sans">IRPS GRUPO</span>
                    <span className="text-slate-700 block font-bold mt-0.5">Retenção na Fonte A</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {drawerTab === "PERMISSOES" && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Módulos de Acesso Ativos</h4>
              
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-150">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span><strong>Caixa POS Comercial</strong> — Lançamento de faturas e pagamentos ativa.</span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-150">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span><strong>Gestão de Stock</strong> — Visualização e entrada de produtos autorizada.</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 text-slate-500 p-2.5 rounded-xl border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span><strong>Relatórios Administrativos</strong> — Acesso restrito apenas a supervisores.</span>
                </div>
              </div>
            </div>
          )}

          {drawerTab === "FERIAS" && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Histórico de Férias e Licenças</h4>
              
              <div className="space-y-2 font-mono text-[11px]">
                <div className="bg-slate-50 p-2.5 rounded-lg flex justify-between">
                  <div>
                    <span className="font-bold block text-slate-700">Férias Gozadas (Ano 2025)</span>
                    <span className="text-[10px] text-slate-400">15 de Março ➔ 15 de Abril</span>
                  </div>
                  <span className="text-emerald-600 font-bold">Concluído</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg flex justify-between">
                  <div>
                    <span className="font-bold block text-slate-700">Férias Solicitadas (Ano 2026)</span>
                    <span className="text-[10px] text-slate-400">10 de Dezembro ➔ 10 de Janeiro</span>
                  </div>
                  <span className="text-amber-600 font-bold">Aprovado</span>
                </div>
              </div>
            </div>
          )}

          {drawerTab === "SALARIO" && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Controle de Pagamentos de Vencimento</h4>
              
              {/* Pagar Salario + Imprimir Vencimento widgets */}
              <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 space-y-3 text-center">
                <span className="block text-orange-800 font-bold text-xs">Vencimento Mensal Base</span>
                <span className="text-2xl font-black text-orange-600 block leading-none">{(selectedEmp.salary).toLocaleString()} MT</span>
                
                <div className="flex gap-2.5 pt-2.5">
                  <button 
                    onClick={() => onPaySalary(selectedEmp)}
                    className="w-1/2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1 shadow-sm transition"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Pagar Salário
                  </button>
                  <button 
                    onClick={() => onPrintPayslip(selectedEmp)}
                    className="w-1/2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1 shadow-sm transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir Recibo
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-700 block">Últimos Depósitos Concluídos</span>
                <div className="divide-y divide-slate-100 font-mono text-[10.5px]">
                  <div className="py-2 flex justify-between items-center">
                    <span>Maio de 2026</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Pago ({(selectedEmp.salary).toLocaleString()} MT)</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span>Abril de 2026</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Pago ({(selectedEmp.salary).toLocaleString()} MT)</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span>Março de 2026</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Pago ({(selectedEmp.salary).toLocaleString()} MT)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {drawerTab === "HISTORICO" && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Histórico de Atividades do Colaborador</h4>
              
              <div className="space-y-2 font-mono text-[10.5px]">
                <div className="bg-slate-50 p-2 rounded border border-slate-150">
                  <span className="text-[9px] text-slate-400 block">2026-06-25 14:12</span>
                  <span className="font-semibold text-slate-700 block">Caixa POS: Fecho de Turno concluído</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-150">
                  <span className="text-[9px] text-slate-400 block">2026-06-25 08:00</span>
                  <span className="font-semibold text-slate-700 block">Início de sessão no POS autorizado</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-150">
                  <span className="text-[9px] text-slate-400 block">2026-06-24 18:32</span>
                  <span className="font-semibold text-slate-700 block">Venda de stock consolidada via POS</span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
