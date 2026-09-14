import React from "react";
import { X, Edit3, Copy, Plus, Minus } from "lucide-react";
import { Product } from "../../types";

export interface ProductDetailSlideOverProps {
  product: Product | null;
  currency?: string;
  canMutate?: boolean;
  onClose: () => void;
  onOpenEditForm?: (product: Product) => void;
  onEditProduct?: (product: Product) => void;
  onDuplicateProduct?: (product: Product) => void;
  onQuickAdjust?: (product: Product, type: "IN" | "OUT") => void;
  onRequestStock?: (product: Product) => void;
}

export const ProductDetailSlideOver: React.FC<ProductDetailSlideOverProps> = ({
  product,
  currency = "MT",
  canMutate = true,
  onClose,
  onOpenEditForm,
  onEditProduct,
  onDuplicateProduct,
  onQuickAdjust,
  onRequestStock
}) => {
  if (!product) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-55 transition-opacity" onClick={onClose} />
      
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-55 flex flex-col animate-in slide-in-from-right duration-200 dark:bg-zinc-900 dark:border-zinc-800 text-xs text-slate-600">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{product.emoji || "📦"}</span>
            <div>
              <h3 className="font-bold text-slate-800 text-sm dark:text-zinc-100">{product.name}</h3>
              <span className="text-[10px] font-mono text-slate-400">SKU / ID: {product.code}</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Image Banner if available, else big emoji */}
          {product.image ? (
            <div className="w-full h-40 rounded-xl overflow-hidden border border-slate-200">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="w-full h-24 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center select-none dark:bg-zinc-950 dark:border-zinc-800">
              <span className="text-4xl">{product.emoji || "📦"}</span>
            </div>
          )}

          {/* Financial Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2.5 dark:bg-zinc-950 dark:border-zinc-800">
            <h4 className="font-bold text-[10px] text-slate-400 uppercase font-mono tracking-wider">Tabela de Preços & Margens</h4>
            
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <p className="text-[10px] text-slate-400">Preço de Custo</p>
                <p className="font-bold text-slate-700 dark:text-zinc-200 mt-0.5">{product.costPrice.toLocaleString()} {currency}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Preço de Venda</p>
                <p className="font-bold text-slate-800 dark:text-zinc-100 mt-0.5">{product.salePrice.toLocaleString()} {currency}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Lucro Unitário</p>
                <p className="font-bold text-emerald-600 mt-0.5">{(product.salePrice - product.costPrice).toLocaleString()} {currency}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Margem Comercial</p>
                <p className="font-bold text-emerald-600 mt-0.5">
                  {product.costPrice > 0 ? Math.round(((product.salePrice - product.costPrice) / product.costPrice) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Inventory Box */}
          <div className="space-y-3">
            <h4 className="font-bold text-[10px] text-slate-400 uppercase font-mono tracking-wider">Métricas de Stock</h4>
            
            <div className="grid grid-cols-2 gap-3.5">
              <div className="border border-slate-200 p-3 rounded-xl dark:border-zinc-800">
                <p className="text-slate-400 text-[10px]">Stock Atual</p>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-zinc-100 mt-0.5">{product.stock} un</p>
              </div>
              <div className="border border-slate-200 p-3 rounded-xl dark:border-zinc-800">
                <p className="text-slate-400 text-[10px]">Mínimo Alerta</p>
                <p className="text-xl font-bold font-mono text-slate-800 dark:text-zinc-100 mt-0.5">{product.minStock} un</p>
              </div>
            </div>

            {/* Quick stock adjustment buttons */}
            {canMutate && onQuickAdjust && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onQuickAdjust(product, "IN")}
                  className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Stock (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickAdjust(product, "OUT")}
                  className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 shadow-xs"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>Dar Saída (-)</span>
                </button>
              </div>
            )}

            <div className="border border-slate-200 p-3.5 rounded-xl space-y-2 dark:border-zinc-800">
              <div className="flex justify-between items-center text-xs">
                <span>Validade:</span>
                <span className="font-bold font-mono">
                  {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : "Sem vencimento"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>Imposto IVA:</span>
                <span className="font-bold font-mono">{product.vatRate || 16}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>Fornecedor:</span>
                <span className="font-bold text-slate-700 dark:text-zinc-300">{product.supplier || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>Categoria:</span>
                <span className="font-bold font-mono text-slate-500">{product.category}</span>
              </div>
            </div>
          </div>

          {/* Stock Movement Logs */}
          <div className="space-y-3">
            <h4 className="font-bold text-[10px] text-slate-400 uppercase font-mono tracking-wider">Histórico de Movimentações</h4>
            
            <div className="space-y-2.5">
              <div className="flex gap-2.5 items-start border-l-2 border-green-500 pl-3 py-0.5">
                <div className="flex-1">
                  <p className="font-bold text-slate-700 dark:text-zinc-300">Inventário Inicial de Cadastro</p>
                  <p className="text-[10px] text-slate-400">Criado com semente padrão ou XLS</p>
                </div>
                <span className="font-bold font-mono text-green-600 text-xs">+{product.stock}</span>
              </div>

              <div className="flex gap-2.5 items-start border-l-2 border-slate-300 pl-3 py-0.5">
                <div className="flex-1">
                  <p className="font-bold text-slate-700 dark:text-zinc-300">Auditoria Regular OST</p>
                  <p className="text-[10px] text-slate-400">Conformidade de Stock</p>
                </div>
                <span className="font-bold font-mono text-slate-500 text-xs">OK</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Actions Footer */}
        {canMutate && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2 dark:bg-zinc-950 dark:border-zinc-800">
            <button
              onClick={() => {
                if (onEditProduct) onEditProduct(product);
                else if (onOpenEditForm) onOpenEditForm(product);
                onClose();
              }}
              className="flex-1 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200"
            >
              <Edit3 className="w-4 h-4" />
              Editar Produto
            </button>
            {onDuplicateProduct && (
              <button
                onClick={() => { onDuplicateProduct(product); onClose(); }}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Copy className="w-4 h-4" />
                Duplicar
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
