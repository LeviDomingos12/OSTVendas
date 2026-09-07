import React, { useState } from "react";
import { MapPin, ArrowLeftRight } from "lucide-react";
import { Product, SystemSettings, StockTransfer } from "../../types";
import { generateEntityId } from "../../lib/deterministic";

export interface StockBranchesTabProps {
  products: Product[];
  settings?: SystemSettings;
  onUpdateSettings?: (settings: Partial<SystemSettings>) => void;
  onUpdateProduct: (p: Product) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export const StockBranchesTab: React.FC<StockBranchesTabProps> = ({
  products,
  settings,
  onUpdateSettings,
  onUpdateProduct,
  onAddAuditLog,
  onShowToast
}) => {
  const [transferOriginBranchId, setTransferOriginBranchId] = useState("central");
  const [transferDestBranchId, setTransferDestBranchId] = useState("matola");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferQty, setTransferQty] = useState<number>(10);

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferOriginBranchId === transferDestBranchId) {
      onShowToast?.("A filial de origem e destino não podem ser iguais.", "error");
      return;
    }
    if (!transferProductId) {
      onShowToast?.("Por favor, selecione o produto para transferir.", "error");
      return;
    }
    if (transferQty <= 0) {
      onShowToast?.("A quantidade deve ser maior que zero.", "error");
      return;
    }

    const prod = products.find(p => p.id === transferProductId);
    if (!prod) return;

    const originStocks = prod.branchStocks || {};
    const currentOriginQty = originStocks[transferOriginBranchId] !== undefined 
      ? originStocks[transferOriginBranchId] 
      : prod.stock;

    if (currentOriginQty < transferQty) {
      onShowToast?.(`Quantidade insuficiente na filial de origem. Stock disponível: ${currentOriginQty} un.`, "error");
      return;
    }

    const destStocks = prod.branchStocks || {};
    const currentDestQty = destStocks[transferDestBranchId] !== undefined
      ? destStocks[transferDestBranchId]
      : 0;

    const updatedBranchStocks = {
      ...originStocks,
      [transferOriginBranchId]: currentOriginQty - transferQty,
      [transferDestBranchId]: currentDestQty + transferQty
    };

    onUpdateProduct({
      ...prod,
      branchStocks: updatedBranchStocks
    });

    const newTransfer: StockTransfer = {
      id: generateEntityId("st"),
      originBranchId: transferOriginBranchId,
      destinationBranchId: transferDestBranchId,
      productId: transferProductId,
      productName: prod.name,
      quantity: transferQty,
      timestamp: new Date().toISOString(),
      status: "COMPLETED",
      responsibleUser: "Gerente de Logística"
    };

    const currentTransfers = settings?.stockTransfers || [];
    const updatedTransfers = [newTransfer, ...currentTransfers];

    if (onUpdateSettings) {
      onUpdateSettings({ stockTransfers: updatedTransfers });
    }

    onAddAuditLog(
      "Transferência de Stock Inter-Filial",
      "STOCK",
      `Transferência de ${transferQty} un de ${prod.name} de [${transferOriginBranchId.toUpperCase()}] para [${transferDestBranchId.toUpperCase()}] concluída.`
    );

    onShowToast?.(`Transferência de ${transferQty} un de ${prod.name} realizada!`, "success");
    setTransferProductId("");
    setTransferQty(10);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Active Branch Selector Info */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 dark:bg-zinc-950 dark:border-zinc-800">
        <div className="space-y-1">
          <h4 className="font-extrabold text-slate-800 text-sm dark:text-zinc-100 flex items-center gap-1.5">
            <MapPin className="w-5 h-5 text-orange-500" />
            Filial de Operação Ativa
          </h4>
          <p className="text-xs text-slate-500">
            Esta é a filial geográfica para a qual todas as vendas do POS atual serão imputadas e os stocks deduzidos.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Filial Ativa:</span>
          <select
            value={settings?.activeBranchId || "central"}
            onChange={(e) => {
              if (onUpdateSettings) {
                onUpdateSettings({ activeBranchId: e.target.value });
                onShowToast?.(`Filial de vendas atualizada para: [${e.target.value.toUpperCase()}]!`, "success");
              }
            }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs outline-none cursor-pointer text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
          >
            {(settings?.branches || []).map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards Grid: Branch Listing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
        {(settings?.branches || []).map((branch) => {
          const totalItems = products.length;
          const totalQty = products.reduce((sum, p) => {
            const bStock = p.branchStocks?.[branch.id];
            return sum + (bStock !== undefined ? bStock : p.stock);
          }, 0);

          const isActive = (settings?.activeBranchId || "central") === branch.id;

          return (
            <div
              key={branch.id}
              className={`p-5 rounded-2xl border transition-all ${
                isActive 
                  ? "bg-orange-50/40 border-orange-200 shadow-sm" 
                  : "bg-white border-slate-100 hover:border-slate-200"
              } dark:bg-zinc-900 dark:border-zinc-800`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-slate-400 font-extrabold text-[9px] font-mono uppercase tracking-widest">{branch.code}</span>
                  <h4 className="font-bold text-slate-800 text-sm dark:text-zinc-100 mt-0.5">{branch.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-1">{branch.address}, {branch.city}</p>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-orange-500 animate-pulse' : 'bg-slate-350'}`} />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4.5 pt-3.5 border-t border-slate-100 font-mono text-slate-650 dark:border-zinc-800">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-sans">Variedade Itens</p>
                  <p className="font-bold text-slate-700 dark:text-zinc-200 text-xs mt-0.5">{totalItems} prods</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-sans">Stock Consolidado</p>
                  <p className="font-bold text-slate-800 dark:text-zinc-100 text-xs mt-0.5">{totalQty.toLocaleString()} un</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Stock Transfer between stores */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 dark:text-zinc-100 dark:border-zinc-800">
            Transferência de Stock Inter-Filial
          </h4>

          <form onSubmit={handleTransferSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Origem</label>
                <select
                  value={transferOriginBranchId}
                  onChange={(e) => setTransferOriginBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-xs text-slate-700 outline-none cursor-pointer dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                >
                  {(settings?.branches || []).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Destino</label>
                <select
                  value={transferDestBranchId}
                  onChange={(e) => setTransferDestBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-xs text-slate-700 outline-none cursor-pointer dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                >
                  {(settings?.branches || []).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Selecione o Produto</label>
              <select
                value={transferProductId}
                onChange={(e) => setTransferProductId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-700 outline-none cursor-pointer dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
              >
                <option value="">-- Escolha o Produto --</option>
                {products.map(p => {
                  const branchQty = p.branchStocks?.[transferOriginBranchId] !== undefined
                    ? p.branchStocks[transferOriginBranchId]
                    : p.stock;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} (Disp: {branchQty} un)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade a Transferir</label>
              <input
                type="number"
                value={transferQty}
                onChange={(e) => setTransferQty(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Efetuar Guia de Transferência
            </button>
          </form>
        </div>

        {/* List of recent stock transfers */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 dark:text-zinc-100 dark:border-zinc-800">
            Histórico de Guias e Transferências de Stock
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 dark:border-zinc-800">
                  <th className="py-2.5">Data/Hora</th>
                  <th className="py-2.5">Produto</th>
                  <th className="py-2.5 text-center">Origem</th>
                  <th className="py-2.5 text-center">Destino</th>
                  <th className="py-2.5 text-center">Quantidade</th>
                  <th className="py-2.5 text-center">Responsável</th>
                  <th className="py-2.5 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[11px] font-medium text-slate-650 dark:divide-zinc-800/50">
                {(settings?.stockTransfers || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium italic">
                      Nenhuma guia de transferência inter-filial gerada até ao momento.
                    </td>
                  </tr>
                ) : (
                  (settings?.stockTransfers || []).map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 font-mono text-slate-450">{new Date(st.timestamp).toLocaleString()}</td>
                      <td className="py-2.5 font-bold text-slate-800 dark:text-zinc-200">{st.productName}</td>
                      <td className="py-2.5 text-center uppercase font-bold text-slate-600">{st.originBranchId}</td>
                      <td className="py-2.5 text-center uppercase font-bold text-slate-600">{st.destinationBranchId}</td>
                      <td className="py-2.5 text-center font-bold text-slate-800 dark:text-zinc-100">{st.quantity} un</td>
                      <td className="py-2.5 text-center text-slate-500">{st.responsibleUser}</td>
                      <td className="py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-green-50 text-green-700 tracking-wide uppercase">
                          Concluído
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
