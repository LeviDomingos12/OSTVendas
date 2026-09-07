import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock } from "lucide-react";
import { Employee } from "../../types";

interface PinVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  loginMethod: "select" | "type";
  onLoginMethodChange: (m: "select" | "type") => void;
  pinTargetEmployee: Employee | null;
  onPinTargetEmployeeChange: (emp: Employee) => void;
  employees: Employee[];
  enteredUsername: string;
  onEnteredUsernameChange: (u: string) => void;
  enteredPin: string;
  onEnteredPinChange: (p: string) => void;
  pinError: string;
  onVerify: () => void;
}

export const PinVerificationModal: React.FC<PinVerificationModalProps> = ({
  isOpen,
  onClose,
  theme,
  loginMethod,
  onLoginMethodChange,
  pinTargetEmployee,
  onPinTargetEmployeeChange,
  employees,
  enteredUsername,
  onEnteredUsernameChange,
  enteredPin,
  onEnteredPinChange,
  pinError,
  onVerify
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
            theme === "night"
              ? "bg-zinc-950 text-slate-100 border-zinc-850"
              : "bg-white text-slate-800 border-slate-100"
          }`}
          id="profile-pin-verification-modal"
        >
          {/* Modal Header */}
          <div className={`p-6 border-b flex items-center justify-between ${
            theme === "night" ? "bg-zinc-900 border-zinc-850" : "bg-slate-50 border-slate-100"
          }`}>
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shadow-inner">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm">Autenticação Requerida</h3>
                <p className="text-[11px] text-slate-400 font-medium font-mono">Terminal POS de Segurança</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition cursor-pointer text-xs font-bold ${
                theme === "night"
                  ? "bg-zinc-900 border-zinc-850 text-slate-400 hover:text-white"
                  : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
              }`}
            >
              ✕
            </button>
          </div>

          {/* Login Method Tabs */}
          <div className="flex border-b border-slate-100 dark:border-zinc-850">
            <button
              type="button"
              onClick={() => onLoginMethodChange("select")}
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                loginMethod === "select"
                  ? "border-orange-500 text-orange-600 font-extrabold"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              👥 Selecionar Operador
            </button>
            <button
              type="button"
              onClick={() => onLoginMethodChange("type")}
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                loginMethod === "type"
                  ? "border-orange-500 text-orange-600 font-extrabold"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              🔑 Introduzir Username
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 flex flex-col items-center">
            {loginMethod === "select" && (
              <div className="w-full space-y-3 mb-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                  Escolha o Colaborador
                </label>
                <select
                  value={pinTargetEmployee ? pinTargetEmployee.id : ""}
                  onChange={(e) => {
                    const emp = employees.find(empItem => empItem.id === e.target.value);
                    if (emp) {
                      onPinTargetEmployeeChange(emp);
                      onEnteredPinChange("");
                    }
                  }}
                  className={`w-full p-2.5 rounded-xl border font-semibold outline-none text-xs cursor-pointer ${
                    theme === "night"
                      ? "bg-zinc-900 border-zinc-800 text-slate-100"
                      : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-500 shadow-sm"
                  }`}
                >
                  <option value="" disabled>-- Escolha um Operador do Quadro --</option>
                  {employees.filter(e => e.status !== "INACTIVE" && e.status !== "SUSPENDED").map(empItem => (
                    <option key={empItem.id} value={empItem.id}>
                      {empItem.role.toUpperCase().includes("ADMIN") ? "👨‍💼" : empItem.role.toUpperCase().includes("SUPERVISOR") ? "👨‍💻" : "👩‍💼"}{" "}
                      {empItem.name} ({empItem.username || "sem username"})
                    </option>
                  ))}
                </select>

                {pinTargetEmployee && (
                  <div className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
                    theme === "night"
                      ? "bg-zinc-900/60 border-zinc-850"
                      : "bg-orange-50/55 border-orange-100/50"
                  }`}>
                    <div className="text-2xl mt-0.5">
                      {pinTargetEmployee.role.toUpperCase().includes("ADMIN") ? "👨‍💼" : pinTargetEmployee.role.toUpperCase().includes("SUPERVISOR") ? "👨‍💻" : "👩‍💼"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{pinTargetEmployee.name}</h4>
                      <p className="text-[10px] text-slate-400 font-semibold">{pinTargetEmployee.role}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 dark:bg-zinc-850 dark:text-slate-400">
                          @{pinTargetEmployee.username}
                        </span>
                        {(pinTargetEmployee.pinChanged === false || pinTargetEmployee.pinChanged === undefined) ? (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 animate-pulse">
                            Senha Temporária
                          </span>
                        ) : (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            Senha Definida
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {loginMethod === "type" && (
              <div className="w-full space-y-1.5 mb-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                  Username do Operador
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">@</span>
                  <input
                    type="text"
                    placeholder="Iniciais + Apelido (Ex: ldomingos)"
                    value={enteredUsername}
                    onChange={(e) => onEnteredUsernameChange(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    className={`w-full pl-8 pr-4 py-2.5 rounded-xl border font-mono font-bold text-xs outline-none ${
                      theme === "night"
                        ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:border-orange-500"
                        : "bg-slate-50 border-slate-200 text-slate-850 focus:border-orange-500 focus:bg-white shadow-sm"
                    }`}
                    autoFocus={loginMethod === "type"}
                  />
                </div>
              </div>
            )}

            <div className="w-full space-y-1.5 mb-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                Digite a sua Senha de Acesso
              </label>
              <input
                type="password"
                maxLength={32}
                value={enteredPin}
                onChange={(e) => onEnteredPinChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onVerify();
                  }
                }}
                placeholder="Sua senha secreta"
                className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all text-xs font-medium ${
                  theme === "night"
                    ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:border-orange-500 focus:ring-orange-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-500 focus:ring-orange-500/20 shadow-sm"
                }`}
              />
              {pinError && (
                <p className="text-xs text-rose-500 font-extrabold text-left animate-pulse mt-1.5">
                  ⚠️ {pinError}
                </p>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className={`p-4 border-t flex items-center justify-between gap-3 ${
            theme === "night" ? "bg-zinc-900 border-zinc-850" : "bg-slate-50 border-slate-100"
          }`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                theme === "night"
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onVerify}
              className="px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105"
            >
              Autenticar Perfil
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
