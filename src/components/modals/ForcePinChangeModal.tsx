import React from "react";
import { motion } from "motion/react";
import { ShieldAlert } from "lucide-react";
import { Employee } from "../../types";

interface ForcePinChangeModalProps {
  isOpen: boolean;
  targetEmployee: Employee | null;
  theme: string;
  newPin: string;
  confirmNewPin: string;
  error: string;
  onNewPinChange: (val: string) => void;
  onConfirmNewPinChange: (val: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export const ForcePinChangeModal: React.FC<ForcePinChangeModalProps> = ({
  isOpen,
  targetEmployee,
  theme,
  newPin,
  confirmNewPin,
  error,
  onNewPinChange,
  onConfirmNewPinChange,
  onSubmit,
  onClose
}) => {
  if (!isOpen || !targetEmployee) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          theme === "night"
            ? "bg-zinc-950 text-slate-100 border-zinc-850"
            : "bg-white text-slate-800 border-slate-100"
        }`}
      >
        <div className="p-6 border-b border-slate-100 dark:border-zinc-850 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shadow-inner">
              <ShieldAlert className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">Atualização de Segurança Obrigatória</h3>
              <p className="text-[10px] text-amber-600 font-extrabold font-mono uppercase">Definir Senha Definitiva de Acesso</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 text-left">
          <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl space-y-1 text-xs">
            <p className="font-bold text-amber-800">Olá {targetEmployee.name},</p>
            <p className="text-amber-700 leading-relaxed text-[11px]">
              De acordo com a política de segurança, a sua senha inicial é temporária ou expirou. Defina uma senha de acesso forte de pelo menos 6 caracteres.
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nova Senha de Acesso</label>
              <input
                type="password"
                maxLength={32}
                placeholder="Mínimo 6 caracteres"
                value={newPin}
                onChange={(e) => onNewPinChange(e.target.value)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-xs font-medium ${
                  theme === "night"
                    ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:ring-orange-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-orange-500/20 focus:bg-white"
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Confirmar Nova Senha</label>
              <input
                type="password"
                maxLength={32}
                placeholder="Repita a nova senha de acesso"
                value={confirmNewPin}
                onChange={(e) => onConfirmNewPinChange(e.target.value)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-xs font-medium ${
                  theme === "night"
                    ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:ring-orange-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-orange-500/20 focus:bg-white"
                }`}
              />
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-zinc-850 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={newPin.length < 6 || confirmNewPin.length < 6}
            className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer ${
              newPin.length >= 6 && confirmNewPin.length >= 6
                ? "bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            Ativar Conta & Aceder
          </button>
        </div>
      </motion.div>
    </div>
  );
};
