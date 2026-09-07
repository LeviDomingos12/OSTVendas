import React, { useState } from "react";
import { Product } from "../../types";

export interface QuickAdjustModalProps {
  product: Product | null;
  onClose: () => void;
  onConfirmAdjust: (product: Product, type: "IN" | "OUT", qty: number, reason: string) => void;
}

export const QuickAdjustModal: React.FC<QuickAdjustModalProps> = ({
  product,
  onClose,
  onConfirmAdjust
}) => {
  const [adjustmentType, setAdjustmentType] = useState<"IN" | "OUT">("IN");
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");

  if (!product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustmentQty <= 0) return;
    onConfirmAdjust(product, adjustmentType, adjustmentQty, adjustmentReason);
    onClose();
  };

  const calculatedNewStock = adjustmentType === "IN" 
    ? product.stock + (adjustmentQty || 0)
    : Math.max(0, product.stock - (adjustmentQty || 0));

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white p-5 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2 dark:border-zinc-800">
          <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">
            Ajustar Stock: <span className="text-orange-500">{product.name}</span>
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdjustmentType("IN")}
              className={`w-1/2 py-2 rounded-xl font-bold border transition cursor-pointer ${
                adjustmentType === "IN"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700"
                  : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
              }`}
            >
              📥 Entrada (+)
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentType("OUT")}
              className={`w-1/2 py-2 rounded-xl font-bold border transition cursor-pointer ${
                adjustmentType === "OUT"
                  ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700"
                  : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
              }`}
            >
              📤 Saída (-)
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade do Ajuste</label>
            <input
              type="number"
              required
              min="1"
              placeholder="Ex: 5"
              value={adjustmentQty || ""}
              onChange={(e) => setAdjustmentQty(Number(e.target.value))}
              className="w-full border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 rounded-xl p-2.5 font-bold font-mono text-center text-sm outline-none focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Motivo Comercial</label>
            <input
              type="text"
              placeholder="Ex: Reposição de Fornecedor, Quebra, etc."
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              className="w-full border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 rounded-xl p-2.5 font-medium outline-none focus:border-orange-500"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 font-mono dark:bg-zinc-950 dark:border-zinc-800">
            <p className="text-[10px] text-slate-400">Previsão Comercial</p>
            <div className="flex justify-between items-center text-xs mt-1">
              <span>Quantidade Atual:</span>
              <span className="font-bold">{product.stock} un</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-1 border-t border-slate-200 dark:border-zinc-800 pt-1">
              <span>Novo Stock Estimado:</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">{calculatedNewStock} un</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-1/2 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
