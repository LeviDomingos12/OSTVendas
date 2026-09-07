import React from "react";
import { Employee } from "../../types";

interface StaffPermissionsModalProps {
  isPermissionsModalOpen: boolean;
  setIsPermissionsModalOpen: (open: boolean) => void;
  selectedEmp: Employee | null;
  empPermissions: string[];
  setEmpPermissions: React.Dispatch<React.SetStateAction<string[]>>;
  onSavePermissions: () => void;
}

export const StaffPermissionsModal: React.FC<StaffPermissionsModalProps> = ({
  isPermissionsModalOpen,
  setIsPermissionsModalOpen,
  selectedEmp,
  empPermissions,
  setEmpPermissions,
  onSavePermissions,
}) => {
  if (!isPermissionsModalOpen || !selectedEmp) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-150 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-slate-900 text-sm">Privilégios de Acesso ERP</h3>
          <button 
            onClick={() => setIsPermissionsModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 font-bold text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          <p className="text-slate-500">Defina quais módulos o colaborador <strong>{selectedEmp.name}</strong> poderá gerenciar:</p>
          
          <div className="space-y-2 border border-slate-150 p-3.5 rounded-xl bg-slate-50/50">
            <label className="flex items-center gap-2.5 cursor-pointer py-1">
              <input 
                type="checkbox" 
                checked={empPermissions.includes("POS")}
                onChange={(e) => setEmpPermissions(prev => e.target.checked ? [...prev, "POS"] : prev.filter(x => x !== "POS"))}
              />
              <div>
                <span className="font-bold text-slate-800">Módulo POS / Caixa de Vendas</span>
                <p className="text-[10px] text-slate-400 font-normal">Permitir lançamentos e recebimentos no caixa comercial</p>
              </div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer py-1">
              <input 
                type="checkbox" 
                checked={empPermissions.includes("STOCK")}
                onChange={(e) => setEmpPermissions(prev => e.target.checked ? [...prev, "STOCK"] : prev.filter(x => x !== "STOCK"))}
              />
              <div>
                <span className="font-bold text-slate-800">Inventário / Gestão de Stock</span>
                <p className="text-[10px] text-slate-400 font-normal">Permitir dar entrada em produtos e ajustar estoque mínimo</p>
              </div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer py-1">
              <input 
                type="checkbox" 
                checked={empPermissions.includes("REPORTS")}
                onChange={(e) => setEmpPermissions(prev => e.target.checked ? [...prev, "REPORTS"] : prev.filter(x => x !== "REPORTS"))}
              />
              <div>
                <span className="font-bold text-slate-800">Relatórios Administrativos</span>
                <p className="text-[10px] text-slate-400 font-normal">Dar acesso a relatórios e balanço financeiro geral</p>
              </div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer py-1">
              <input 
                type="checkbox" 
                checked={empPermissions.includes("STAFF")}
                onChange={(e) => setEmpPermissions(prev => e.target.checked ? [...prev, "STAFF"] : prev.filter(x => x !== "STAFF"))}
              />
              <div>
                <span className="font-bold text-slate-800">Contratos e Auditoria</span>
                <p className="text-[10px] text-slate-400 font-normal">Ver quadro de funcionários e auditar logs de segurança</p>
              </div>
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPermissionsModalOpen(false)}
              className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={onSavePermissions}
              className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              Confirmar Chaves
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
