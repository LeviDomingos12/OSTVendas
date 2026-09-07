import React, { useState } from "react";
import { Layers } from "lucide-react";
import { Product, SystemSettings, ProductBatch } from "../../types";
import { generateEntityId, generateSecurePin } from "../../lib/deterministic";
import BatchManager from "../BatchManager";

export interface StockBatchesTabProps {
  products: Product[];
  settings?: SystemSettings;
  currency: string;
  onUpdateSettings?: (settings: Partial<SystemSettings>) => void;
  onUpdateProduct: (p: Product) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export const StockBatchesTab: React.FC<StockBatchesTabProps> = ({
  products,
  settings,
  currency,
  onUpdateSettings,
  onUpdateProduct,
  onAddAuditLog,
  onShowToast
}) => {
  const [batchProductId, setBatchProductId] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [batchQty, setBatchQty] = useState<number>(50);
  const [batchCost, setBatchCost] = useState<number>(0);
  const [batchExpiry, setBatchExpiry] = useState("");
  const [batchSupplier, setBatchSupplier] = useState("");

  const handleRegisterBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchProductId) {
      onShowToast?.("Por favor, selecione um produto.", "error");
      return;
    }
    if (!batchCode) {
      onShowToast?.("Por favor, introduza o código do lote.", "error");
      return;
    }
    if (batchQty <= 0) {
      onShowToast?.("A quantidade deve ser maior que zero.", "error");
      return;
    }
    if (!batchExpiry) {
      onShowToast?.("Por favor, defina uma data de validade.", "error");
      return;
    }

    const prod = products.find(p => p.id === batchProductId);
    if (!prod) return;

    const newBatch: ProductBatch = {
      id: generateEntityId("batch"),
      productId: batchProductId,
      productName: prod.name,
      batchCode: batchCode,
      quantity: batchQty,
      initialQuantity: batchQty,
      costPrice: batchCost || prod.costPrice,
      receivedDate: new Date().toISOString().split("T")[0],
      expiryDate: batchExpiry,
      supplier: batchSupplier || prod.supplier || "Geral"
    };

    const currentBatches = settings?.batches || [];
    const updatedBatches = [...currentBatches, newBatch];

    onUpdateProduct({
      ...prod,
      stock: prod.stock + batchQty
    });

    if (onUpdateSettings) {
      onUpdateSettings({ batches: updatedBatches });
    }

    onAddAuditLog(
      "Registrar Novo Lote",
      "STOCK",
      `Lote ${batchCode} (${batchQty} un) adicionado ao produto ${prod.name} com validade ${batchExpiry}. Estoque geral incrementado.`
    );

    onShowToast?.(`Lote ${batchCode} registrado com sucesso e adicionado ao stock!`, "success");

    setBatchProductId("");
    setBatchCode("");
    setBatchQty(50);
    setBatchCost(0);
    setBatchExpiry("");
    setBatchSupplier("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Panel: Strategy and Explanation */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 dark:bg-zinc-950 dark:border-zinc-800">
        <div className="space-y-1">
          <h4 className="font-extrabold text-slate-800 text-sm dark:text-zinc-100 flex items-center gap-1.5">
            <Layers className="w-5 h-5 text-orange-500" />
            Estratégia de Consumo de Lotes (Validade/Giro)
          </h4>
          <p className="text-xs text-slate-500">
            O motor OST Vendas utiliza esta estratégia no checkout POS para deduzir automaticamente as validades adequadas.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Estratégia:</span>
          <select
            value={settings?.inventoryStrategy || "FIFO"}
            onChange={(e) => {
              if (onUpdateSettings) {
                onUpdateSettings({ inventoryStrategy: e.target.value as "FIFO" | "LIFO" });
                onShowToast?.(`Estratégia de stock atualizada para ${e.target.value}!`, "success");
              }
            }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs outline-none cursor-pointer text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
          >
            <option value="FIFO">FIFO (First-In, First-Out - Validade mais antiga)</option>
            <option value="LIFO">LIFO (Last-In, First-Out - Lote mais recente)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Register New Batch */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 dark:text-zinc-100 dark:border-zinc-800">
            Cadastrar Novo Lote & Entrada
          </h4>
          
          <form onSubmit={handleRegisterBatchSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Selecione o Produto</label>
              <select
                value={batchProductId}
                onChange={(e) => {
                  setBatchProductId(e.target.value);
                  const prod = products.find(p => p.id === e.target.value);
                  if (prod) {
                    setBatchCost(prod.costPrice);
                    setBatchCode(`LT-${prod.name.slice(0, 3).toUpperCase()}-${generateSecurePin(4)}`);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-700 outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
              >
                <option value="">-- Escolha um Produto --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Código do Lote</label>
                <input
                  type="text"
                  placeholder="LOTE-XYZ"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade Entrada</label>
                <input
                  type="number"
                  value={batchQty}
                  onChange={(e) => setBatchQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Preço de Custo (MT)</label>
                <input
                  type="number"
                  value={batchCost}
                  onChange={(e) => setBatchCost(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Data de Validade</label>
                <input
                  type="date"
                  value={batchExpiry}
                  onChange={(e) => setBatchExpiry(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 px-1.5 font-bold text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Fornecedor / Origem</label>
              <input
                type="text"
                placeholder="Distribuidor Oficial"
                value={batchSupplier}
                onChange={(e) => setBatchSupplier(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
            >
              Registrar Entrada de Lote (+ Stock)
            </button>
          </form>
        </div>

        {/* List: Registered Batches Grid */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3 dark:border-zinc-800">
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm dark:text-zinc-100">
                Gestão de Lotes & Rastreabilidade de Validades (BatchManager)
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Acompanhamento rigoroso de lotes ativos de produtos perecíveis.</p>
            </div>
            <span className="self-start sm:self-auto text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-mono">
              {(settings?.batches || []).length} lotes ativos
            </span>
          </div>

          <BatchManager
            products={products}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onUpdateProduct={onUpdateProduct}
            onAddAuditLog={onAddAuditLog}
            onShowToast={onShowToast}
            currency={currency}
          />
        </div>
      </div>
    </div>
  );
};
