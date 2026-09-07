import React, { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Transaction } from "../../types";

interface PosReturnModalProps {
  isOpen: boolean;
  selectedTx: Transaction | null;
  onClose: () => void;
  onConfirm: (
    items: { productId: string; quantity: number; price: number }[],
    reason: string,
    refundMethod: string
  ) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export const PosReturnModal: React.FC<PosReturnModalProps> = ({
  isOpen,
  selectedTx,
  onClose,
  onConfirm,
  onShowToast,
}) => {
  const [returnReason, setReturnReason] = useState<string>("Defeito / Avaria de Produto");
  const [customReturnReason, setCustomReturnReason] = useState<string>("");
  const [returnedItemQuantities, setReturnedItemQuantities] = useState<Record<string, number>>({});
  const [returnRefundMethod, setReturnRefundMethod] = useState<string>("CASH");

  if (!isOpen || !selectedTx) return null;

  const itemsToReturn = (selectedTx.items || [])
    .filter(it => (returnedItemQuantities[it.productId] || 0) > 0)
    .map(it => ({
      productId: it.productId,
      quantity: returnedItemQuantities[it.productId],
      price: it.price
    }));

  const totalRefund = itemsToReturn.reduce((sum, it) => sum + (it.price * it.quantity), 0);

  const handleConfirm = () => {
    if (itemsToReturn.length === 0) {
      if (onShowToast) onShowToast("Selecione pelo menos um artigo com quantidade superior a zero para devolver.", "warning");
      return;
    }

    const finalReason = returnReason === "Outro Motivo" && customReturnReason.trim() ? customReturnReason.trim() : returnReason;
    onConfirm(itemsToReturn, finalReason, returnRefundMethod);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2 text-rose-600">
              <RotateCcw className="w-5 h-5" />
              <span>Devolução & Nota de Crédito Fiscal</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Fatura: <span className="font-bold text-slate-700">{selectedTx.invoiceNumber}</span> • Cliente: {selectedTx.customerName || "Consumidor Final"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* List of items to return */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">Artigos a Devolver e Quantidades:</label>
          <div className="max-h-44 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2.5 bg-slate-50">
            {(selectedTx.items || []).map((it) => {
              const currQty = returnedItemQuantities[it.productId] || 0;
              return (
                <div key={it.productId} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                  <div className="flex-1 pr-2">
                    <span className="font-bold text-slate-800 block truncate">{it.productName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Preço: {it.price.toLocaleString()} MT • Faturado: {it.quantity} un
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReturnedItemQuantities(prev => ({ ...prev, [it.productId]: Math.max(0, (prev[it.productId] || 0) - 1) }))}
                      className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold w-7 text-center">{currQty}</span>
                    <button
                      type="button"
                      onClick={() => setReturnedItemQuantities(prev => ({ ...prev, [it.productId]: Math.min(it.quantity, (prev[it.productId] || 0) + 1) }))}
                      className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reason selection */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Motivo da Devolução:</label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="Defeito / Avaria de Produto">Defeito / Avaria de Produto</option>
              <option value="Troca por Outro Artigo">Troca por Outro Artigo</option>
              <option value="Erro de Registo no Caixa">Erro de Registo no Caixa</option>
              <option value="Desistência do Cliente">Desistência do Cliente</option>
              <option value="Outro Motivo">Outro Motivo</option>
            </select>
          </div>

          <div>
            <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Modalidade de Reembolso:</label>
            <select
              value={returnRefundMethod}
              onChange={(e) => setReturnRefundMethod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="CASH">Dinheiro (Caixa)</option>
              <option value="MPESA_PAGA_FACIL">M-Pesa</option>
              <option value="EMOLA">e-Mola</option>
              <option value="POS_CARD">Cartão POS / Bancário</option>
              <option value="DEBT">Abate na Conta Corrente (Dívida)</option>
            </select>
          </div>
        </div>

        {returnReason === "Outro Motivo" && (
          <input
            type="text"
            value={customReturnReason}
            onChange={(e) => setCustomReturnReason(e.target.value)}
            placeholder="Especifique detalhadamente o motivo..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none"
          />
        )}

        {/* Refund Totals Summary */}
        <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 space-y-1 text-xs">
          <div className="flex justify-between font-bold text-rose-900">
            <span>Total a Reembolsar / Creditar:</span>
            <span className="text-base font-black font-mono">{totalRefund.toLocaleString()} MT</span>
          </div>
          <p className="text-[10.5px] text-rose-700">
            O stock dos {itemsToReturn.length} artigo(s) selecionados será restaurado automaticamente no inventário e registado em auditoria.
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-rose-600/20"
          >
            Confirmar Devolução & Estorno ✓
          </button>
        </div>
      </div>
    </div>
  );
};
