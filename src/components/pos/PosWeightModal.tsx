import React, { useState } from "react";
import { Product } from "../../types";

interface PosWeightModalProps {
  product: Product | null;
  onClose: () => void;
  onConfirmWeight: (product: Product, weightKg: number) => void;
}

export const PosWeightModal: React.FC<PosWeightModalProps> = ({
  product,
  onClose,
  onConfirmWeight,
}) => {
  const [weightInputValue, setWeightInputValue] = useState("");

  if (!product) return null;

  const handleConfirm = () => {
    const val = parseFloat(weightInputValue);
    if (!isNaN(val) && val > 0) {
      onConfirmWeight(product, val);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl max-w-xs w-full border border-slate-100 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
          <span className="text-2xl">{product.emoji || "⚖️"}</span>
        </div>

        <div>
          <h3 className="font-extrabold text-slate-900 text-sm">Pesagem de Artigo (Baloneta)</h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Insira a quantidade pesada de <span className="font-bold text-slate-700">{product.name}</span>
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="1.25"
              value={weightInputValue}
              onChange={(e) => setWeightInputValue(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3 text-center text-xl font-bold font-mono outline-none focus:ring-1 focus:ring-orange-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
            />
            <span className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400">kg</span>
          </div>

          {/* Fast weight presets */}
          <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold text-slate-700">
            {["0.25", "0.50", "1.0", "2.5"].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeightInputValue(w)}
                className="py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
              >
                {w} kg
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Lançar Peso ✓
          </button>
        </div>
      </div>
    </div>
  );
};
