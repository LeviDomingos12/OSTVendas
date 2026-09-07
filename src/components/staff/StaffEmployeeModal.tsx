import React from "react";
import { Lock } from "lucide-react";
import { checkPasswordStrength } from "./staffUtils";

interface StaffEmployeeModalProps {
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  localError: string;
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
  setLocalError: (err: string) => void;
  email: string;
  setEmail: (email: string) => void;
  sendEmailCredentials: boolean;
  setSendEmailCredentials: (send: boolean) => void;
  emailSendingStatus: "IDLE" | "SENDING" | "SUCCESS" | "ERROR";
}

export const StaffEmployeeModal: React.FC<StaffEmployeeModalProps> = ({
  isFormOpen,
  setIsFormOpen,
  onSubmit,
  localError,
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
  setLocalError,
  email,
  setEmail,
  sendEmailCredentials,
  setSendEmailCredentials,
  emailSendingStatus,
}) => {
  if (!isFormOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-slate-900 text-sm">Contratar / Cadastrar Funcionário</h3>
          <button 
            onClick={() => setIsFormOpen(false)}
            className="text-slate-400 hover:text-slate-600 font-bold text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          {localError && (
            <div className="bg-red-500/10 text-red-700 p-2.5 rounded-lg text-xs font-semibold border border-red-500/20">
              {localError}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nome Completo do Colaborador *</label>
            <input
              type="text"
              required
              placeholder="Ex: Levi Domingos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-800 transition text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cargo / Atribuição</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer text-xs"
            >
              <option value="Administrador">Administrador</option>
              <option value="Supervisor de Vendas">Supervisor de Vendas</option>
              <option value="Operador de Caixa">Operador de Caixa</option>
              <option value="Gestor de Stock">Gestor de Stock</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Contacto Telefónico *</label>
              <input
                type="tel"
                required
                placeholder="Ex: 841234567"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Salário Bruto (MT)</label>
              <input
                type="number"
                required
                min="1000"
                placeholder="Ex: 85000"
                value={salary || ""}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none text-xs"
              />
            </div>
          </div>

          {/* Credenciais de Acesso */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3.5">
            <p className="text-[10px] font-extrabold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Credenciais de Acesso ao Terminal
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block text-left">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: ldomingos"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none focus:border-orange-500 text-xs text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  <span>Senha Temporária *</span>
                  {role === "Administrador" && (
                    <span className="text-[9px] text-orange-600 font-extrabold">Requer Senha Forte</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  maxLength={32}
                  placeholder={role === "Administrador" ? "Mín. 8 chars (letras + números)" : "Mínimo 6 caracteres"}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (localError) setLocalError("");
                  }}
                  className={`w-full bg-white border rounded-lg p-2 font-mono font-semibold outline-none focus:border-orange-500 text-xs text-slate-850 ${
                    role === "Administrador" && pin && !checkPasswordStrength(pin).isValidAdmin
                      ? "border-rose-300 bg-rose-50/20"
                      : "border-slate-200"
                  }`}
                />
              </div>
            </div>

            {/* Password Strength Indicator */}
            {pin && (() => {
              const strength = checkPasswordStrength(pin);
              return (
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-slate-500">Força da Senha:</span>
                    <span className={
                      strength.score >= 3.5 ? "text-emerald-600 font-black" :
                      strength.score >= 2.5 ? "text-green-600 font-black" :
                      strength.score >= 1.5 ? "text-amber-600 font-black" : "text-rose-600 font-black"
                    }>
                      {strength.label} {role === "Administrador" && (!strength.isValidAdmin ? "❌ (Insuficiente para Admin)" : "✅ (Aceitável para Admin)")}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                    <div className={`h-full transition-all duration-300 rounded-full ${strength.score >= 1 ? strength.color : "bg-slate-200"}`} style={{ width: "25%" }} />
                    <div className={`h-full transition-all duration-300 rounded-full ${strength.score >= 2 ? strength.color : "bg-slate-200"}`} style={{ width: "25%" }} />
                    <div className={`h-full transition-all duration-300 rounded-full ${strength.score >= 3 ? strength.color : "bg-slate-200"}`} style={{ width: "25%" }} />
                    <div className={`h-full transition-all duration-300 rounded-full ${strength.score >= 3.5 ? strength.color : "bg-slate-200"}`} style={{ width: "25%" }} />
                  </div>
                  {role === "Administrador" && !strength.isValidAdmin && (
                    <p className="text-[9px] text-rose-600 font-semibold leading-tight">
                      ⚠️ Senhas de Administrador exigem no mínimo 8 caracteres com pelo menos 1 letra e 1 número.
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block text-left">E-mail para Notificação *</label>
              <input
                type="email"
                required
                placeholder="Ex: colaborador@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Opção para envio de credenciais ao Gmail do funcionário */}
          {email.trim() && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-bold">Enviar credenciais por E-mail</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={sendEmailCredentials}
                    onChange={(e) => setSendEmailCredentials(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
              <p className="text-[9px] text-slate-400">
                O funcionário receberá um e-mail com o PIN do operador e as diretrizes do cargo para login seguro no terminal.
              </p>
              
              {emailSendingStatus === "SENDING" && (
                <div className="text-[10px] text-orange-500 font-semibold flex items-center gap-1.5 pt-1">
                  <span className="w-3 h-3 rounded-full border border-orange-500 border-t-transparent animate-spin"></span>
                  <span>A enviar credenciais para o Gmail...</span>
                </div>
              )}
              {emailSendingStatus === "SUCCESS" && (
                <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 pt-1">
                  <span>✓ Credenciais enviadas com sucesso ao Gmail!</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer transition shadow-md shadow-orange-500/10"
            >
              Confirmar Contratação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
