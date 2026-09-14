import React, { useState, useEffect } from "react";
import { Product } from "../../types";

export interface QuickAdjustModalProps {
  product: Product | null;
  type?: "IN" | "OUT";
  initialType?: "IN" | "OUT";
  onClose: () => void;
  onConfirmAdjust?: (product: Product, type: "IN" | "OUT", qty: number, reason: string) => void;
  onSaveAdjustment?: (productId: string, delta: number, reason: string) => void;
}

export const QuickAdjustModal: React.FC<QuickAdjustModalProps> = ({
  product,
  type,
  initialType,
  onClose,
  onConfirmAdjust,
  onSaveAdjustment
}) => {
  const [adjustmentType, setAdjustmentType] = useState<"IN" | "OUT">("IN");
  const [adjustmentQty, setAdjustmentQty] = useState<number>(1);
  const [adjustmentReason, setAdjustmentReason] = useState("");

  useEffect(() => {
    const defaultType = type || initialType || "IN";
    setAdjustmentType(defaultType);
    setAdjustmentQty(1);
    setAdjustmentReason("");
  }, [product, type, initialType]);

  if (!product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentQty || adjustmentQty <= 0) return;

    const reason = adjustmentReason.trim() || (adjustmentType === "IN" ? "Entrada Manual de Stock" : "Saída Manual de Stock");
    const delta = adjustmentType === "IN" ? adjustmentQty : -adjustmentQty;

    if (onSaveAdjustment) {
      onSaveAdjustment(product.id, delta, reason);
    } else if (onConfirmAdjust) {
      onConfirmAdjust(product, adjustmentType, adjustmentQty, reason);
    }

    onClose();
  };

  const calculatedNewStock = adjustmentType === "IN" 
    ? product.stock + (adjustmentQty || 0)
    : Math.max(0, product.stock - (adjustmentQty || 0));

  const applyPreset = (qty: number) => {
    setAdjustmentQty(prev => Math.max(1, (prev || 0) + qty));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white p-5 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2 dark:border-zinc-800">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">
              {adjustmentType === "IN" ? "Adicionar Stock Manual" : "Registar Saída de Stock"}
            </h3>
            <p className="text-[11px] text-orange-600 font-semibold truncate max-w-[220px]">
              {product.name}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdjustmentType("IN")}
              className={`w-1/2 py-2 rounded-xl font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                adjustmentType === "IN"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700 shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
              }`}
            >
              <span>📥</span>
              <span>Entrada (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentType("OUT")}
              className={`w-1/2 py-2 rounded-xl font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                adjustmentType === "OUT"
                  ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700 shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
              }`}
            >
              <span>📤</span>
              <span>Saída (-)</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                {adjustmentType === "IN" ? "Quantidade a Adicionar" : "Quantidade a Retirar"}
              </label>
              <span className="text-[10px] font-mono text-slate-400">Atual: {product.stock} un</span>
            </div>
            <input
              type="number"
              required
              min="1"
              placeholder="Ex: 10"
              value={adjustmentQty || ""}
              onChange={(e) => setAdjustmentQty(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 rounded-xl p-2.5 font-bold font-mono text-center text-base outline-none focus:border-orange-500"
              autoFocus
            />

            {/* Quick Presets */}
            <div className="flex gap-1.5 pt-1">
              {[1, 5, 10, 25, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[10px] font-bold text-slate-600 dark:text-zinc-300 transition"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Motivo / Justificação</label>
            <input
              type="text"
              placeholder={adjustmentType === "IN" ? "Ex: Reposição, Compra Fornecedor, Inventário..." : "Ex: Quebra, Danificado, Devolução..."}
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              className="w-full border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 rounded-xl p-2.5 font-medium outline-none focus:border-orange-500"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 font-mono dark:bg-zinc-950 dark:border-zinc-800">
            <div className="flex justify-between items-center text-xs">
              <span>Stock Atual:</span>
              <span className="font-bold">{product.stock} un</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-1 border-t border-slate-200 dark:border-zinc-800 pt-1">
              <span>Novo Stock Previsto:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{calculatedNewStock} un</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-xl transition shadow-md shadow-orange-500/15 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Confirmar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
