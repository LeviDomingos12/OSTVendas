import React from "react";
import { AlertTriangle } from "lucide-react";
import { Product } from "../../types";

interface PosCriticalStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsLeavingStockBelowCritical: { product: Product; quantity: number }[];
}

export const PosCriticalStockModal: React.FC<PosCriticalStockModalProps> = ({
  isOpen,
  onClose,
  itemsLeavingStockBelowCritical,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        id="pos-critical-stock-modal"
      >
        {/* Header */}
        <div className="p-6 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shadow-inner animate-pulse">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-left">
              <h3 className="font-extrabold text-slate-900 text-sm">Alerta de Stock Crítico</h3>
              <p className="text-[11px] text-red-650 font-bold">Produtos que ficarão abaixo do nível de alerta após a venda</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-red-100 border border-red-200 text-red-400 hover:text-red-600 flex items-center justify-center transition cursor-pointer font-bold text-xs font-mono"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-[11.5px] text-slate-500 leading-normal text-left">
            Os seguintes itens no carrinho de compras atual têm quantidades que reduzirão o estoque restante abaixo ou ao nível crítico definido individualmente nas configurações de stock.
          </p>

          <div className="space-y-3">
            {itemsLeavingStockBelowCritical.map(item => {
              const currentStock = item.product.stock;
              const saleQty = item.quantity;
              const finalStock = currentStock - saleQty;
              const minStock = item.product.minStock || 0;

              return (
                <div 
                  key={item.product.id}
                  className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl flex flex-col gap-2 hover:bg-slate-100/70 transition text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">{item.product.brand || "Genérico"} ({item.product.code})</span>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1 leading-tight">{item.product.name}</h4>
                    </div>
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                      Mín Alerta: {minStock}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Stock Atual</span>
                      <span className="text-xs font-mono font-bold text-slate-600">{currentStock}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">No Carrinho</span>
                      <span className="text-xs font-mono font-bold text-orange-600">-{saleQty}</span>
                    </div>
                    <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                      <span className="text-[9px] font-bold text-red-400 block uppercase">Stock Final</span>
                      <span className={`text-xs font-mono font-bold ${finalStock < 0 ? "text-red-700 underline" : "text-red-600"}`}>
                        {finalStock}
                      </span>
                    </div>
                  </div>

                  {finalStock < 0 && (
                    <p className="text-[9.5px] text-red-600 font-bold flex items-center gap-1">
                      ⚠️ Atenção: Esta transação causará ruptura de stock (estoque negativo)!
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-sm"
          >
            Entendi, Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
