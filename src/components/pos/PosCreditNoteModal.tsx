import React from "react";
import { CheckCircle2, Printer } from "lucide-react";

export interface CompletedCreditNote {
  id: string;
  invoiceRef: string;
  date: string;
  customerName?: string;
  items: { productId: string; quantity: number; price: number }[];
  totalRefund: number;
  reason: string;
  refundMethod: string;
}

interface PosCreditNoteModalProps {
  completedCreditNote: CompletedCreditNote | null;
  onClose: () => void;
}

export const PosCreditNoteModal: React.FC<PosCreditNoteModalProps> = ({
  completedCreditNote,
  onClose,
}) => {
  if (!completedCreditNote) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-900 text-base">Nota de Crédito Emitida!</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            N/Crédito: <span className="font-bold text-slate-700">{completedCreditNote.id}</span>
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left font-mono text-[11px] text-slate-700 space-y-1.5">
          <div className="flex justify-between">
            <span>Fatura Original:</span>
            <span className="font-bold">{completedCreditNote.invoiceRef}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Estornado:</span>
            <span className="font-bold text-rose-600">{completedCreditNote.totalRefund.toLocaleString()} MT</span>
          </div>
          <div className="flex justify-between">
            <span>Reembolso:</span>
            <span>{completedCreditNote.refundMethod}</span>
          </div>
          <div className="border-t border-slate-200 pt-1 text-[10px] text-slate-500 font-sans">
            Motivo: {completedCreditNote.reason}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                window.print();
              } catch (e) {
                console.warn(e);
              }
            }}
            className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir N/C</span>
          </button>
        </div>
      </div>
    </div>
  );
};
