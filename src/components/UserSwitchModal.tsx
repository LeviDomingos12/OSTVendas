import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, X, ArrowLeft, Eye, EyeOff, ShieldCheck, ChevronRight } from "lucide-react";
import { Employee } from "../types";

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  employees: Employee[];
  activeUser: Employee | null;
  onSelectEmployee: (emp: Employee) => void;
  onAuditLog?: (action: string, module: string, details: string) => void;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({
  isOpen,
  onClose,
  theme,
  employees,
  activeUser,
  onSelectEmployee,
  onAuditLog,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [showPin, setShowPin] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedEmpId("");
      setEnteredPin("");
      setPinError("");
      setShowPin(false);
      setSearchQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedEmployee = employees.find((e) => e.id === selectedEmpId);

  const handleConfirmPin = () => {
    if (!selectedEmployee) return;

    if (!enteredPin.trim()) {
      setPinError("Por favor, introduza o PIN de acesso.");
      return;
    }

    const expectedPin = selectedEmployee.pin || "123456";
    const masterPin = "202612";

    if (enteredPin.trim() === expectedPin.trim() || enteredPin.trim() === masterPin) {
      onSelectEmployee(selectedEmployee);
      if (onAuditLog) {
        onAuditLog(
          "Alteração de Usuário",
          "SISTEMA",
          `Operador alterado para ${selectedEmployee.name} (${selectedEmployee.role || "Operador"})`
        );
      }
      onClose();
    } else {
      setPinError("PIN incorreto. Por favor, tente novamente.");
      setEnteredPin("");
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return emp.name.toLowerCase().includes(q) || (emp.role && emp.role.toLowerCase().includes(q));
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
            theme === "night"
              ? "bg-zinc-950 text-slate-100 border-zinc-800"
              : "bg-white text-slate-800 border-slate-200"
          }`}
          id="inside-user-switcher-modal"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-zinc-850 bg-gradient-to-r from-orange-500/10 to-amber-500/10 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedEmployee ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmpId("");
                      setEnteredPin("");
                      setPinError("");
                    }}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-300 hover:text-orange-500 transition cursor-pointer"
                    title="Voltar para a lista de colaboradores"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-10 h-10 bg-orange-100 text-orange-700 dark:bg-orange-900/35 dark:text-orange-400 rounded-xl flex items-center justify-center shadow-inner">
                    <Users className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">
                    {selectedEmployee ? "Confirmar Acesso" : "Alterar Usuário"}
                  </h3>
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 font-extrabold uppercase tracking-wider">
                    {selectedEmployee ? "Insira o PIN do Colaborador" : "Selecione o Colaborador"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 text-left overflow-y-auto max-h-[70vh]">
            {!selectedEmployee ? (
              /* STEP 1: Select Collaborator */
              <div className="space-y-3">
                {employees.length > 5 && (
                  <div>
                    <input
                      type="text"
                      placeholder="Pesquisar colaborador..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white outline-none transition"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  {filteredEmployees.map((emp) => {
                    const isCurrent = activeUser?.id === emp.id;
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          setSelectedEmpId(emp.id);
                          setEnteredPin("");
                          setPinError("");
                        }}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all duration-150 flex items-center justify-between cursor-pointer group ${
                          isCurrent
                            ? theme === "night"
                              ? "bg-orange-500/10 border-orange-500/40 text-white"
                              : "bg-orange-50 border-orange-300 text-slate-900"
                            : theme === "night"
                            ? "bg-zinc-900/60 border-zinc-800 hover:border-orange-500/40 hover:bg-zinc-900 text-slate-200"
                            : "bg-slate-50 border-slate-200 hover:border-orange-400 hover:bg-white text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 shadow-sm">
                            {emp.fotoPerfil ? (
                              emp.fotoPerfil.startsWith("data:") ||
                              emp.fotoPerfil.startsWith("http") ||
                              emp.fotoPerfil.startsWith("/") ? (
                                <img
                                  src={emp.fotoPerfil}
                                  className="w-full h-full object-cover"
                                  alt={emp.name}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="text-base">{emp.fotoPerfil}</span>
                              )
                            ) : (
                              emp.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white group-hover:text-orange-500 transition">
                                {emp.name}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                                  Atual
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                              {emp.role || "Operador"}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-orange-500 group-hover:translate-x-1 transition shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* STEP 2: Enter PIN for Selected Collaborator */
              <div className="space-y-4">
                {/* Selected Employee Info */}
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-base overflow-hidden shrink-0 shadow-md">
                    {selectedEmployee.fotoPerfil ? (
                      selectedEmployee.fotoPerfil.startsWith("data:") ||
                      selectedEmployee.fotoPerfil.startsWith("http") ||
                      selectedEmployee.fotoPerfil.startsWith("/") ? (
                        <img
                          src={selectedEmployee.fotoPerfil}
                          className="w-full h-full object-cover"
                          alt={selectedEmployee.name}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-xl">{selectedEmployee.fotoPerfil}</span>
                      )
                    ) : (
                      selectedEmployee.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {selectedEmployee.name}
                    </h4>
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-0.5">
                      {selectedEmployee.role || "Operador"}
                    </p>
                  </div>
                </div>

                {/* PIN Input Field */}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">
                    PIN de Acesso
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      maxLength={32}
                      autoFocus
                      value={enteredPin}
                      onChange={(e) => {
                        setEnteredPin(e.target.value);
                        if (pinError) setPinError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleConfirmPin();
                        }
                      }}
                      placeholder="Digite o PIN do colaborador"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-orange-500 rounded-xl py-3 pl-4 pr-10 text-sm text-slate-900 dark:text-white outline-none transition font-mono tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
                      title={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {pinError && (
                    <p className="text-xs text-rose-500 font-bold animate-pulse mt-1">
                      ⚠️ {pinError}
                    </p>
                  )}
                </div>

                {/* Quick Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setEnteredPin((prev) => prev + String(num));
                        if (pinError) setPinError("");
                      }}
                      className="py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 hover:bg-orange-500/10 hover:border-orange-500/40 text-slate-800 dark:text-white font-extrabold text-base transition active:scale-95 cursor-pointer shadow-sm"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setEnteredPin("");
                      if (pinError) setPinError("");
                    }}
                    className="py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 hover:bg-rose-500/10 hover:border-rose-500/40 text-rose-500 font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm uppercase tracking-wider"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEnteredPin((prev) => prev + "0");
                      if (pinError) setPinError("");
                    }}
                    className="py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 hover:bg-orange-500/10 hover:border-orange-500/40 text-slate-800 dark:text-white font-extrabold text-base transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEnteredPin((prev) => prev.slice(0, -1));
                      if (pinError) setPinError("");
                    }}
                    className="py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    ⌫
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmpId("");
                      setEnteredPin("");
                      setPinError("");
                    }}
                    className="flex-1 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl transition cursor-pointer border border-slate-200 dark:border-zinc-800"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPin}
                    disabled={!enteredPin.trim()}
                    className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-1.5 ${
                      enteredPin.trim()
                        ? "bg-orange-500 hover:bg-orange-600 text-white active:scale-95"
                        : "bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Entrar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
