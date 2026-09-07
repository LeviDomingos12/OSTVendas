import React from "react";
import { Send } from "lucide-react";
import { Transaction } from "../../types";

export interface ReportsEmailModalProps {
  showEmailModal: Transaction | null;
  targetEmail: string;
  setTargetEmail: (email: string) => void;
  sendingInvoiceId: string | null;
  currency: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ReportsEmailModal: React.FC<ReportsEmailModalProps> = ({
  showEmailModal,
  targetEmail,
  setTargetEmail,
  sendingInvoiceId,
  currency,
  onClose,
  onSubmit
}) => {
  if (!showEmailModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Enviar Fatura por E-mail</h3>
            <p className="text-xs text-slate-500 mt-0.5">Disparo via Gmail Oficial</p>
          </div>
          <div className="bg-orange-50 text-orange-600 p-2 rounded-xl">
            <Send className="w-5 h-5" />
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 mb-2">
            <p className="text-xs text-slate-600 font-semibold mb-1">Fatura Selecionada:</p>
            <div className="flex justify-between items-center font-mono">
              <span className="font-bold text-slate-900">{showEmailModal.invoiceNumber}</span>
              <span className="font-bold text-emerald-600">{showEmailModal.grandTotal.toLocaleString()} {currency}</span>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">E-mail do Cliente</label>
            <input
              type="email"
              required
              autoFocus
              placeholder="cliente@email.com"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={sendingInvoiceId === showEmailModal.id}
              className="w-1/2 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sendingInvoiceId === showEmailModal.id || !targetEmail}
              className="w-1/2 py-2.5 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-slate-900/20 disabled:opacity-70"
            >
              {sendingInvoiceId === showEmailModal.id ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0"></span>
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Enviar Agora
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
