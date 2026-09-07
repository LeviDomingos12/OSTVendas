import React from "react";
import { History, Printer, RotateCcw } from "lucide-react";
import { Transaction, SystemSettings } from "../../types";
import { printInvoiceHTML } from "../../lib/printHelper";

interface PosSalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  settings?: SystemSettings;
  onViewReceipt: (tx: Transaction) => void;
  onStartReturn: (tx: Transaction) => void;
}

export const PosSalesHistoryModal: React.FC<PosSalesHistoryModalProps> = ({
  isOpen,
  onClose,
  transactions,
  settings,
  onViewReceipt,
  onStartReturn,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl max-w-xl w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-800">
            <History className="w-5 h-5 text-orange-500" />
            <h3 className="font-extrabold text-sm">Histórico da Sessão Atual</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
          >
            ×
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {transactions.length > 0 ? (
            transactions.slice(0, 8).map((tx, idx) => (
              <div
                key={`${tx.id || ""}-${idx}`}
                className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-xs transition hover:bg-slate-100"
              >
                <div>
                  <span className="font-bold text-slate-700 block">{tx.invoiceNumber}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} •{" "}
                    {tx.paymentMethod} • Op: {tx.cashierName}
                  </span>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-extrabold text-slate-800">{tx.grandTotal.toLocaleString()} MT</span>
                  <button
                    type="button"
                    onClick={() => onViewReceipt(tx)}
                    className="p-1.5 bg-white border border-slate-200 hover:bg-orange-50 rounded text-[10px] font-bold text-orange-600 transition cursor-pointer"
                    title="Visualizar Recibo"
                  >
                    Visualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        printInvoiceHTML(
                          tx,
                          settings || ({ companyName: "OST VENDAS", currency: "MT" } as SystemSettings)
                        );
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="p-1.5 bg-slate-100 hover:bg-orange-600 hover:text-white rounded text-[10px] font-bold text-slate-650 transition cursor-pointer flex items-center justify-center"
                    title="Imprimir Fatura em Nova Janela"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartReturn(tx)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white rounded text-[10px] font-bold text-rose-600 border border-rose-200 transition cursor-pointer flex items-center gap-1"
                    title="Devolver Artigos / Emitir Nota de Crédito"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Devolver</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-xs text-slate-400 py-6">Nenhuma venda realizada neste terminal ainda.</p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-850"
        >
          Fechar Painel
        </button>
      </div>
    </div>
  );
};
