import React, { useState } from "react";
import { 
  PlusCircle, 
  MinusCircle, 
  MoreVertical, 
  Eye, 
  MessageSquare, 
  Sparkles, 
  Edit3, 
  Copy, 
  Trash2, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  Info 
} from "lucide-react";
import { Product, SystemSettings } from "../../types";

export interface StockProductsTableProps {
  products: Product[];
  paginatedProducts: Product[];
  selectedProductIds: string[];
  sortField: "name" | "code" | "category" | "salePrice" | "costPrice" | "stock" | "stockValue";
  sortDirection: "asc" | "desc";
  canMutate: boolean;
  currency: string;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  settings?: SystemSettings;
  highlightedProductId?: string | null;
  onSort: (field: "name" | "code" | "category" | "salePrice" | "costPrice" | "stock" | "stockValue") => void;
  onToggleSelectAll: () => void;
  onToggleSelectProduct: (id: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenQuickAdjust: (product: Product, type: "IN" | "OUT") => void;
  onSendWhatsAppAlert: (product: Product) => void;
  onOpenEditForm: (product: Product) => void;
  onDuplicateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
}

export const StockProductsTable: React.FC<StockProductsTableProps> = ({
  products,
  paginatedProducts,
  selectedProductIds,
  sortField,
  sortDirection,
  canMutate,
  currency,
  currentPage,
  totalPages,
  itemsPerPage,
  settings,
  highlightedProductId,
  onSort,
  onToggleSelectAll,
  onToggleSelectProduct,
  onOpenProductDetail,
  onOpenQuickAdjust,
  onSendWhatsAppAlert,
  onOpenEditForm,
  onDuplicateProduct,
  onDeleteProduct,
  onPageChange,
  onItemsPerPageChange
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const isAllCurrentPageSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProductIds.includes(p.id));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] font-black text-slate-500 uppercase tracking-wider dark:bg-zinc-800/60 dark:border-zinc-800 dark:text-zinc-400">
              <th className="p-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={onToggleSelectAll}
                  className="rounded cursor-pointer accent-orange-500"
                />
              </th>
              <th className="p-3 text-center w-12">ÍCONE</th>
              <th className="p-3.5 cursor-pointer hover:bg-slate-200/50 select-none transition" onClick={() => onSort("code")}>
                <div className="flex items-center gap-1">
                  SKU
                  {sortField === "code" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </div>
              </th>
              <th className="p-3.5 cursor-pointer hover:bg-slate-200/50 select-none transition" onClick={() => onSort("name")}>
                <div className="flex items-center gap-1">
                  PRODUTO
                  {sortField === "name" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </div>
              </th>
              <th className="p-3.5 cursor-pointer hover:bg-slate-200/50 select-none transition" onClick={() => onSort("category")}>
                <div className="flex items-center gap-1">
                  CATEGORIA
                  {sortField === "category" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </div>
              </th>
              <th className="p-3.5 text-right cursor-pointer hover:bg-slate-200/50 select-none transition" onClick={() => onSort("salePrice")}>
                <div className="flex items-center justify-end gap-1">
                  PREÇOS (LUCRO)
                  {sortField === "salePrice" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </div>
              </th>
              <th className="p-3.5 text-center cursor-pointer hover:bg-slate-200/50 select-none transition" onClick={() => onSort("stock")}>
                <div className="flex items-center justify-center gap-1">
                  ESTADO STOCK
                  {sortField === "stock" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </div>
              </th>
              <th className="p-3.5 text-right cursor-pointer hover:bg-slate-200/50 select-none transition" onClick={() => onSort("stockValue")}>
                <div className="flex items-center justify-end gap-1">
                  VALOR EM STOCK
                  {sortField === "stockValue" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </div>
              </th>
              <th className="p-3.5 text-center w-24">AÇÕES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                  Nenhum produto atendeu aos critérios comerciais de pesquisa selecionados.
                </td>
              </tr>
            ) : (
              paginatedProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                
                const profitAmt = p.salePrice - p.costPrice;
                const profitPct = p.costPrice > 0 ? Math.round((profitAmt / p.costPrice) * 100) : 0;
                const ratio = Math.min(100, (p.stock / Math.max(p.minStock * 3, p.stock || 1)) * 100);

                let expiryBadge = null;
                if (p.expiryDate) {
                  const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  if (daysLeft < 0) {
                    expiryBadge = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-700 uppercase">Vencido</span>;
                  } else if (daysLeft <= 30) {
                    expiryBadge = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-100 text-purple-700">Vence {daysLeft}d</span>;
                  } else {
                    expiryBadge = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-100 text-slate-500">Val: {daysLeft}d</span>;
                  }
                }

                const productBatches = (settings?.batches || []).filter(b => b.productId === p.id && b.quantity > 0);
                const hasExpiredBatch = productBatches.some(b => {
                  const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return daysLeft < 0;
                });
                const hasExpiringBatch = productBatches.some(b => {
                  const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return daysLeft >= 0 && daysLeft <= 30;
                });

                let batchExpiryBadge = null;
                if (hasExpiredBatch) {
                  batchExpiryBadge = (
                    <span 
                      className="px-1.5 py-0.5 rounded text-[8px] font-black bg-red-100 text-red-800 border border-red-200 animate-pulse flex items-center gap-0.5"
                      title="Este produto possui lotes ativos expirados no inventário!"
                    >
                      LOTE EXPIRADO ⚠️
                    </span>
                  );
                } else if (hasExpiringBatch) {
                  batchExpiryBadge = (
                    <span 
                      className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-0.5"
                      title="Este produto possui lotes ativos que vencem em menos de 30 dias!"
                    >
                      LOTE CRÍTICO ⏳
                    </span>
                  );
                }

                const isHighlighted = highlightedProductId === p.id;

                return (
                  <tr 
                    key={p.id} 
                    className={
                      isHighlighted
                        ? "bg-amber-50/90 dark:bg-amber-950/40 border-y-2 border-orange-500 font-medium transition-colors"
                        : "hover:bg-slate-50/40 transition group dark:hover:bg-zinc-800/40"
                    }
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={() => onToggleSelectProduct(p.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded cursor-pointer accent-orange-500"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <div className="w-9 h-9 mx-auto rounded-xl flex items-center justify-center border border-slate-200 bg-slate-50 select-none overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                        {p.image ? (
                          <img 
                            src={p.image} 
                            alt={p.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-lg">{p.emoji || "📦"}</span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 font-mono text-slate-500 font-semibold dark:text-zinc-400">{p.code}</td>

                    <td 
                      className="p-3 cursor-pointer"
                      onClick={() => onOpenProductDetail(p)}
                    >
                      <div className="font-bold text-slate-800 dark:text-zinc-100 group-hover:text-orange-600 transition-colors flex items-center gap-1.5">
                        {p.name}
                        {isHighlighted && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500 text-white shadow-xs">
                            NOVO
                          </span>
                        )}
                        <Info className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5 font-mono">
                        <span>SKU: {p.code}</span>
                        {p.supplier && <span>• F: {p.supplier}</span>}
                        {expiryBadge}
                        {batchExpiryBadge}
                      </div>
                    </td>

                    <td className="p-3 font-mono text-slate-500 dark:text-zinc-400">{p.category}</td>

                    <td className="p-3 text-right">
                      <div className="font-mono text-slate-600 dark:text-zinc-400 text-[10px]">C: {p.costPrice.toLocaleString()} {currency}</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-zinc-200">V: {p.salePrice.toLocaleString()} {currency}</div>
                      <div className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded-full inline-block mt-0.5 dark:bg-emerald-950/20 dark:text-emerald-400">
                        Lucro: {profitAmt.toLocaleString()} {currency} ({profitPct}%)
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-between gap-2 max-w-[130px] mx-auto">
                        <span className={`font-mono font-bold text-xs ${
                          isOutOfStock 
                            ? "text-red-700 bg-red-50 px-1 rounded" 
                            : isLowStock 
                            ? "text-amber-700 bg-amber-50 px-1 rounded" 
                            : "text-slate-800 dark:text-zinc-200"
                        }`}>
                          {p.stock} un
                        </span>
                        
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                          isOutOfStock ? "bg-red-100 text-red-700" :
                          isLowStock ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {isOutOfStock ? "🔴 Esgotado" : isLowStock ? "🟠 Baixo" : "🟢 OK"}
                        </span>
                      </div>

                      <div className="w-full max-w-[130px] bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden mx-auto dark:bg-zinc-800">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOutOfStock ? "bg-red-500 w-0" :
                            isLowStock ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                      <p className="text-[8px] text-slate-400 font-mono mt-0.5">Min Alerta: {p.minStock}</p>
                    </td>

                    <td className="p-3 text-right font-mono">
                      <div className="font-bold text-slate-700 dark:text-zinc-200">{(p.stock * p.salePrice).toLocaleString()} {currency}</div>
                      <div className="text-[9px] text-slate-400">Custo: {(p.stock * p.costPrice).toLocaleString()} {currency}</div>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 relative">
                        <button
                          onClick={() => onOpenQuickAdjust(p, "IN")}
                          className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition"
                          title="Dar Entrada"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenQuickAdjust(p, "OUT")}
                          className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition"
                          title="Dar Saída"
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === p.id ? null : p.id)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-600 transition cursor-pointer dark:hover:bg-zinc-700"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openDropdownId === p.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setOpenDropdownId(null)}></div>
                            <div className="absolute right-0 top-7 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-left text-xs animate-in fade-in duration-100 dark:bg-zinc-900 dark:border-zinc-800">
                              <button
                                onClick={() => { onOpenProductDetail(p); setOpenDropdownId(null); }}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ver Detalhes
                              </button>

                              <button
                                onClick={() => { onSendWhatsAppAlert(p); setOpenDropdownId(null); }}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 text-emerald-700 font-semibold flex items-center gap-2 dark:text-emerald-400 dark:hover:bg-zinc-800"
                                title="Notificar stock deste produto por WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                Notificar Stock
                              </button>
                              
                              {canMutate && (
                                <>
                                  <button
                                    onClick={() => { onOpenEditForm(p); setOpenDropdownId(null); }}
                                    className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => { onDuplicateProduct(p); setOpenDropdownId(null); }}
                                    className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    Duplicar
                                  </button>
                                  <div className="border-t border-slate-100 my-1 dark:border-zinc-800"></div>
                                  <button
                                    onClick={() => { onDeleteProduct(p.id); setOpenDropdownId(null); }}
                                    className="w-full px-3 py-1.5 hover:bg-red-50 text-red-600 font-bold flex items-center gap-2 dark:hover:bg-red-950/35"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
        <div className="flex items-center gap-4">
          <span>
            Mostrando <span className="font-bold text-slate-700 dark:text-zinc-300">{Math.min(products.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(products.length, currentPage * itemsPerPage)}</span> de <span className="font-bold text-slate-700 dark:text-zinc-300">{products.length}</span> produtos
          </span>
          
          <div className="flex items-center gap-1.5">
            <span>Mostrar:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="bg-white border rounded px-1.5 py-0.5 text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Page Buttons navigation */}
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className="px-2.5 py-1 border rounded bg-white font-bold hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer dark:bg-zinc-950 dark:border-zinc-800"
          >
            &lt; Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1 border rounded font-bold cursor-pointer transition ${
                currentPage === page
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white hover:bg-slate-50 dark:bg-zinc-950 dark:border-zinc-800 text-slate-600"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className="px-2.5 py-1 border rounded bg-white font-bold hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer dark:bg-zinc-950 dark:border-zinc-800"
          >
            Seguinte &gt;
          </button>
        </div>
      </div>
    </div>
  );
};
