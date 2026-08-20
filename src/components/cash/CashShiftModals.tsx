import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Coins, 
  AlertTriangle, 
  Receipt,
  Scale,
  CheckCircle2,
  TrendingDown,
  RotateCcw
} from "lucide-react";
import { Employee, SystemSettings, CashFlowEntry, CashClosure } from "../../types";
import DenominationCounter, { DENOMINATIONS } from "../DenominationCounter";

interface CashShiftModalsProps {
  activeUsername: string;
  employees: Employee[];
  settings?: SystemSettings;
  currency: string;
  // Modals visibility
  showOpenModal: boolean;
  onCloseOpenModal: () => void;
  showCloseModal: boolean;
  onCloseCloseModal: () => void;
  showSangriaModal: boolean;
  onCloseSangriaModal: () => void;
  showEntryModal: boolean;
  entryModalType: "REINFORCEMENT" | "EXPENSE" | "INPUT" | "DEVOLUTION" | "QUEBRA";
  onCloseEntryModal: () => void;
  showDenomModal: boolean;
  onCloseDenomModal: () => void;
  // Calculations
  theoreticalBalance: number;
  physicalBalance: number;
  openingBalance: number;
  cashSalesAmount: number;
  digitalSalesAmount: number;
  reinforcements: number;
  inputs: number;
  sangrias: number;
  expenses: number;
  devolutions: number;
  quebras: number;
  // Denomination counts state
  denomCounts: { [key: string]: number };
  onChangeDenomCount: (val: number, count: number) => void;
  onResetDenomCounts: () => void;
  onApplyDenomToPhysical: (total: number) => void;
  // Handlers
  onConfirmOpenShift: (openingFloat: number, supervisor: string, notes: string) => void;
  onConfirmCloseShift: (physicalCount: number, supervisor: string, notes: string) => void;
  onConfirmSangria: (amount: number, destination: string, reason: string, supervisor: string) => void;
  onConfirmEntry: (type: "REINFORCEMENT" | "EXPENSE" | "INPUT" | "DEVOLUTION" | "QUEBRA", amount: number, reason: string, supplier: string) => void;
}

export const CashShiftModals: React.FC<CashShiftModalsProps> = ({
  activeUsername,
  employees = [],
  settings,
  currency,
  showOpenModal,
  onCloseOpenModal,
  showCloseModal,
  onCloseCloseModal,
  showSangriaModal,
  onCloseSangriaModal,
  showEntryModal,
  entryModalType,
  onCloseEntryModal,
  showDenomModal,
  onCloseDenomModal,
  theoreticalBalance,
  physicalBalance,
  openingBalance,
  cashSalesAmount,
  digitalSalesAmount,
  reinforcements,
  inputs,
  sangrias,
  expenses,
  devolutions,
  quebras,
  denomCounts,
  onChangeDenomCount,
  onResetDenomCounts,
  onApplyDenomToPhysical,
  onConfirmOpenShift,
  onConfirmCloseShift,
  onConfirmSangria,
  onConfirmEntry
}) => {
  // Available Supervisors (Dynamic from real registered employees)
  const availableSupervisors = useMemo(() => {
    const valid = employees.filter(e => {
      const r = (e.role || "").toUpperCase();
      return r === "ADMIN" || r === "ADMINISTRADOR" || r === "SUPERVISOR" || r === "GERENTE" || r === "FINANCEIRO" || r === "MANAGER";
    });
    if (valid.length > 0) return valid;
    return employees.length > 0 ? employees : [{ id: "emp-1", name: activeUsername, role: "SUPERVISOR", pin: "0000" } as Employee];
  }, [employees, activeUsername]);

  // Open Shift Form State
  const [openFloat, setOpenFloat] = useState<number>(openingBalance || 5000);
  const [openSupervisor, setOpenSupervisor] = useState<string>("");
  const [openPin, setOpenPin] = useState<string>("");
  const [openNotes, setOpenNotes] = useState<string>("");
  const [openError, setOpenError] = useState<string>("");

  // Close Shift Form State
  const [closePhysicalCount, setClosePhysicalCount] = useState<number>(physicalBalance);
  const [closeSupervisor, setCloseSupervisor] = useState<string>("");
  const [closePin, setClosePin] = useState<string>("");
  const [closeNotes, setCloseNotes] = useState<string>("");
  const [closeError, setCloseError] = useState<string>("");
  const [activeCloseTab, setActiveCloseTab] = useState<"summary" | "denoms">("summary");

  // Sangria Form State
  const [sangriaAmount, setSangriaAmount] = useState<number>(0);
  const [sangriaDestination, setSangriaDestination] = useState<string>("Cofre Central");
  const [sangriaReason, setSangriaReason] = useState<string>("");
  const [sangriaSupervisor, setSangriaSupervisor] = useState<string>("");
  const [sangriaPin, setSangriaPin] = useState<string>("");
  const [sangriaError, setSangriaError] = useState<string>("");

  // Generic Entry Form State
  const [entryAmount, setEntryAmount] = useState<number>(0);
  const [entryReason, setEntryReason] = useState<string>("");
  const [entrySupplier, setEntrySupplier] = useState<string>("");
  const [entryError, setEntryError] = useState<string>("");

  // Set default supervisor on init
  useEffect(() => {
    if (availableSupervisors.length > 0) {
      if (!openSupervisor) setOpenSupervisor(availableSupervisors[0].name);
      if (!closeSupervisor) setCloseSupervisor(availableSupervisors[0].name);
      if (!sangriaSupervisor) setSangriaSupervisor(availableSupervisors[0].name);
    }
  }, [availableSupervisors]);

  // Keep closePhysicalCount in sync
  useEffect(() => {
    setClosePhysicalCount(physicalBalance);
  }, [physicalBalance]);

  // Helper to validate supervisor PIN securely against database
  const validateSupervisorPin = (supervisorName: string, pinToTest: string): boolean => {
    if (!pinToTest || pinToTest.trim() === "") return false;
    const sup = employees.find(e => e.name === supervisorName);
    if (sup && sup.pin) {
      return sup.pin === pinToTest;
    }
    if (settings?.securityPin) {
      return settings.securityPin === pinToTest;
    }
    // Default fallback if no pin is configured
    return pinToTest.length >= 4;
  };

  // 1. Submit Open Shift
  const handleOpenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (openFloat < 0) {
      setOpenError("O fundo de maneio inicial não pode ser negativo.");
      return;
    }
    if (openPin) {
      const isValid = validateSupervisorPin(openSupervisor, openPin);
      if (!isValid) {
        setOpenError("PIN de homologação do Supervisor incorreto!");
        return;
      }
    }
    setOpenError("");
    onConfirmOpenShift(openFloat, openSupervisor || activeUsername, openNotes);
    onCloseOpenModal();
    setOpenPin("");
    setOpenNotes("");
  };

  // 2. Submit Close Shift
  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeSupervisor) {
      setCloseError("Selecione o supervisor homologador do fechamento.");
      return;
    }
    const isValid = validateSupervisorPin(closeSupervisor, closePin);
    if (!isValid) {
      setCloseError("PIN do Supervisor incorreto! Insira o PIN configurado do colaborador.");
      return;
    }
    setCloseError("");
    onConfirmCloseShift(closePhysicalCount, closeSupervisor, closeNotes);
    onCloseCloseModal();
    setClosePin("");
    setCloseNotes("");
  };

  // 3. Submit Sangria
  const handleSangriaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sangriaAmount <= 0) {
      setSangriaError("Introduza um valor válido para a sangria de caixa.");
      return;
    }
    if (sangriaAmount > theoreticalBalance) {
      setSangriaError(`O valor da sangria (${sangriaAmount} ${currency}) não pode exceder o saldo atual em caixa (${theoreticalBalance} ${currency}).`);
      return;
    }
    if (sangriaPin) {
      const isValid = validateSupervisorPin(sangriaSupervisor, sangriaPin);
      if (!isValid) {
        setSangriaError("PIN do supervisor incorreto.");
        return;
      }
    }
    setSangriaError("");
    onConfirmSangria(sangriaAmount, sangriaDestination, sangriaReason, sangriaSupervisor);
    onCloseSangriaModal();
    setSangriaAmount(0);
    setSangriaReason("");
    setSangriaPin("");
  };

  // 4. Submit Entry
  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entryAmount <= 0) {
      setEntryError("O valor da operação deve ser maior que zero.");
      return;
    }
    if (!entryReason.trim()) {
      setEntryError("Por favor, descreva a finalidade ou motivo do lançamento.");
      return;
    }
    setEntryError("");
    onConfirmEntry(entryModalType, entryAmount, entryReason, entrySupplier);
    onCloseEntryModal();
    setEntryAmount(0);
    setEntryReason("");
    setEntrySupplier("");
  };

  const calculatedFromDenoms = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => {
      const count = denomCounts[d.value.toString()] || 0;
      return sum + (d.value * count);
    }, 0);
  }, [denomCounts]);

  const diffVal = closePhysicalCount - theoreticalBalance;

  return (
    <>
      {/* 1. MODAL: ABERTURA DE TURNO */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  Abertura de Turno de Caixa
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseOpenModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Operador do Caixa
                </label>
                <input
                  type="text"
                  disabled
                  value={activeUsername}
                  className="w-full p-2.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-700 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fundo de Maneio Inicial (Trocos) ({currency}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={openFloat || ""}
                  onChange={(e) => setOpenFloat(Number(e.target.value))}
                  placeholder="Ex: 5000"
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-extrabold text-slate-900 dark:text-white text-sm outline-none focus:border-orange-500"
                />
                <span className="text-[10.5px] text-slate-400 mt-1 block">
                  Valor físico já presente na gaveta para iniciar as trocas do dia.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervisor Responsável *
                </label>
                <select
                  value={openSupervisor}
                  onChange={(e) => setOpenSupervisor(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                >
                  {availableSupervisors.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.role || "Supervisor"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  PIN do Supervisor (Opcional)
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={openPin}
                  onChange={(e) => setOpenPin(e.target.value)}
                  placeholder="PIN de autorização"
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono text-center tracking-widest outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Observações de Abertura
                </label>
                <textarea
                  rows={2}
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="Ex: Turno da manhã, gaveta com notas pequenas."
                  className="w-full p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none"
                />
              </div>

              {openError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-bold text-xs">
                  ⚠️ {openError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseOpenModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm transition cursor-pointer"
                >
                  Confirmar Abertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL: FECHAMENTO DE CAIXA E RECONCILIAÇÃO */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-orange-500" />
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                    Fechamento de Caixa & Homologação de Turno
                  </h3>
                  <span className="text-[10px] text-slate-400">Reconciliação e conferência física de valores</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseCloseModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tab */}
            <div className="flex gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveCloseTab("summary")}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  activeCloseTab === "summary"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                }`}
              >
                1. Resumo e Homologação
              </button>
              <button
                type="button"
                onClick={() => setActiveCloseTab("denoms")}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeCloseTab === "denoms"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>2. Contagem de Cédulas ({calculatedFromDenoms.toLocaleString()} {currency})</span>
              </button>
            </div>

            {activeCloseTab === "denoms" ? (
              <div className="space-y-4">
                <DenominationCounter
                  denomCounts={denomCounts}
                  onChangeCount={onChangeDenomCount}
                  onResetCounts={onResetDenomCounts}
                  currency={currency}
                  isInteractive={true}
                />
                <button
                  type="button"
                  onClick={() => {
                    setClosePhysicalCount(calculatedFromDenoms);
                    onApplyDenomToPhysical(calculatedFromDenoms);
                    setActiveCloseTab("summary");
                  }}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow-sm transition cursor-pointer"
                >
                  Aplicar Valor da Contagem ({calculatedFromDenoms.toLocaleString()} {currency}) ao Fecho
                </button>
              </div>
            ) : (
              <form onSubmit={handleCloseSubmit} className="space-y-4 text-xs">
                {/* Financial Overview in Modal */}
                <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Teórico</span>
                    <span className="font-mono font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                      {theoreticalBalance.toLocaleString()} {currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Físico</span>
                    <span className="font-mono font-extrabold text-orange-600 dark:text-orange-400 text-sm">
                      {closePhysicalCount.toLocaleString()} {currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Diferença</span>
                    <span className={`font-mono font-extrabold text-sm ${
                      diffVal === 0 ? "text-emerald-600" : diffVal > 0 ? "text-amber-600" : "text-rose-600"
                    }`}>
                      {diffVal > 0 ? "+" : ""}{diffVal.toLocaleString()} {currency}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Saldo Físico Contado na Gaveta ({currency}) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={closePhysicalCount}
                      onChange={(e) => setClosePhysicalCount(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-extrabold text-slate-900 dark:text-white text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Supervisor Homologador *
                    </label>
                    <select
                      value={closeSupervisor}
                      onChange={(e) => setCloseSupervisor(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                    >
                      {availableSupervisors.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.role || "Supervisor"})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    PIN do Supervisor para Validação e Fecho de Caixa *
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={8}
                    value={closePin}
                    onChange={(e) => setClosePin(e.target.value)}
                    placeholder="Insira o PIN de segurança do supervisor"
                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono text-center tracking-widest text-sm outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    A validação é efetuada contra a base de dados de colaboradores cadastrados.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Justificação / Observações de Fechamento
                  </label>
                  <textarea
                    rows={2}
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="Ex: Turno fechado sem divergências ou justificação de quebra/sobra."
                    className="w-full p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none"
                  />
                </div>

                {closeError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-bold text-xs">
                    ⚠️ {closeError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onCloseCloseModal}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-orange-500 dark:hover:bg-orange-600 text-white font-extrabold shadow-sm transition cursor-pointer"
                  >
                    Homologar e Fechar Turno
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. MODAL: SANGRIA RÁPIDA (COFRE) */}
      {showSangriaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  Sangria de Segurança (Retirada para Cofre)
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseSangriaModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSangriaSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor da Retirada ({currency}) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={sangriaAmount || ""}
                  onChange={(e) => setSangriaAmount(Number(e.target.value))}
                  placeholder="Ex: 10000"
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-extrabold text-slate-900 dark:text-white text-sm outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Disponível em gaveta: {theoreticalBalance.toLocaleString()} {currency}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Destino do Dinheiro *
                </label>
                <select
                  value={sangriaDestination}
                  onChange={(e) => setSangriaDestination(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="Cofre Central">Cofre Central</option>
                  <option value="Depósito Bancário BCI">Depósito Bancário BCI</option>
                  <option value="Depósito Bancário Millennium BIM">Depósito Bancário Millennium BIM</option>
                  <option value="Depósito Bancário Standard Bank">Depósito Bancário Standard Bank</option>
                  <option value="Tesouraria Geral">Tesouraria Geral</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervisor Autorizador *
                </label>
                <select
                  value={sangriaSupervisor}
                  onChange={(e) => setSangriaSupervisor(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                >
                  {availableSupervisors.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.role || "Supervisor"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  PIN do Supervisor (Opcional)
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={sangriaPin}
                  onChange={(e) => setSangriaPin(e.target.value)}
                  placeholder="PIN de autorização"
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono text-center tracking-widest outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo / Justificação
                </label>
                <textarea
                  rows={2}
                  value={sangriaReason}
                  onChange={(e) => setSangriaReason(e.target.value)}
                  placeholder="Ex: Excesso de saldo em dinheiro na gaveta recolhido para custódia."
                  className="w-full p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none"
                />
              </div>

              {sangriaError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-bold text-xs">
                  ⚠️ {sangriaError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseSangriaModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-sm transition cursor-pointer"
                >
                  Executar Sangria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: LANÇAMENTO GENÉRICO (REFORÇO / DESPESA / DEVOLUÇÃO / QUEBRA) */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                {entryModalType === "REINFORCEMENT" && <ArrowDownLeft className="w-5 h-5 text-blue-600" />}
                {entryModalType === "EXPENSE" && <TrendingDown className="w-5 h-5 text-rose-600" />}
                {entryModalType === "DEVOLUTION" && <RotateCcw className="w-5 h-5 text-orange-600" />}
                {entryModalType === "QUEBRA" && <AlertTriangle className="w-5 h-5 text-purple-600" />}
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  {entryModalType === "REINFORCEMENT" && "Reforço de Caixa (Trocos)"}
                  {entryModalType === "EXPENSE" && "Lançamento de Despesa Operacional"}
                  {entryModalType === "DEVOLUTION" && "Devolução / Reembolso a Cliente"}
                  {entryModalType === "QUEBRA" && "Registro de Quebra / Ajuste de Caixa"}
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseEntryModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEntrySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor do Movimento ({currency}) *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={entryAmount || ""}
                  onChange={(e) => setEntryAmount(Number(e.target.value))}
                  placeholder="Ex: 500"
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-extrabold text-slate-900 dark:text-white text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição / Finalidade / Motivo *
                </label>
                <input
                  type="text"
                  required
                  value={entryReason}
                  onChange={(e) => setEntryReason(e.target.value)}
                  placeholder={
                    entryModalType === "REINFORCEMENT" ? "Ex: Entrada de trocos em moedas de 5 e 10 MT" :
                    entryModalType === "EXPENSE" ? "Ex: Compra de papel para impressora térmica" :
                    entryModalType === "DEVOLUTION" ? "Ex: Reembolso referente à factura #1042" : "Ex: Falta apurada na contagem"
                  }
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none focus:border-orange-500"
                />
              </div>

              {(entryModalType === "EXPENSE" || entryModalType === "DEVOLUTION") && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fornecedor / Credor / Beneficiário (Opcional)
                  </label>
                  <input
                    type="text"
                    value={entrySupplier}
                    onChange={(e) => setEntrySupplier(e.target.value)}
                    placeholder="Ex: Papelaria Moderna, Lda ou Nome do Cliente"
                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none"
                  />
                </div>
              )}

              {entryError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-bold text-xs">
                  ⚠️ {entryError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseEntryModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold shadow-sm transition cursor-pointer"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: CALCULADORA DE CÉDULAS & MOEDAS */}
      {showDenomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-orange-500" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  Conferência Física da Gaveta (Denominações em Meticais)
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseDenomModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DenominationCounter
              denomCounts={denomCounts}
              onChangeCount={onChangeDenomCount}
              onResetCounts={onResetDenomCounts}
              currency={currency}
              isInteractive={true}
            />

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onCloseDenomModal}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyDenomToPhysical(calculatedFromDenoms);
                  onCloseDenomModal();
                }}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow-sm transition cursor-pointer"
              >
                Actualizar Saldo Físico ({calculatedFromDenoms.toLocaleString()} {currency})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
