import React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Employee } from "../../types";

interface StaffDeleteModalProps {
  employeeToDelete: Employee | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const StaffDeleteModal: React.FC<StaffDeleteModalProps> = ({
  employeeToDelete,
  onCancel,
  onConfirm,
}) => {
  if (!employeeToDelete) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 text-left">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Remover Registro de Colaborador</h3>
              <p className="text-[10px] text-slate-500">Esta ação desliga permanentemente o funcionário</p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-extrabold text-xs uppercase">
                {employeeToDelete.name.substring(0, 2).toUpperCase()}
              </span>
              <div>
                <h4 className="font-bold text-slate-800 text-xs">{employeeToDelete.name}</h4>
                <span className="text-[10px] text-slate-400 block font-mono">{employeeToDelete.role}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
              Tem certeza absoluta de que deseja remover permanentemente o registro de <strong className="text-slate-800">{employeeToDelete.name}</strong>? Esta ação é irreversível e removerá o acesso dele ao sistema.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs transition shadow-lg shadow-red-950/20 flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Confirmar Remoção</span>
          </button>
        </div>
      </div>
    </div>
  );
};
