import React from "react";
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  AlertTriangle 
} from "lucide-react";

export interface StockStatsHeaderProps {
  totalItems: number;
  outOfStockCount: number;
  lowStockCount: number;
  totalCostValuation: number;
  totalSaleValuation: number;
  totalPotentialProfit: number;
  avgMarginPct: number;
  currency: string;
  stockFilter: "ALL" | "LOW" | "OUT";
  onStockFilterChange: (filter: "ALL" | "LOW" | "OUT") => void;
}

export const StockStatsHeader: React.FC<StockStatsHeaderProps> = ({
  totalItems,
  outOfStockCount,
  lowStockCount,
  totalCostValuation,
  totalSaleValuation,
  totalPotentialProfit,
  avgMarginPct,
  currency,
  stockFilter,
  onStockFilterChange
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Products & Stock Volume */}
      <div 
        onClick={() => onStockFilterChange("ALL")}
        className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:border-slate-300 dark:bg-zinc-900 dark:border-zinc-800 ${
          stockFilter === "ALL" ? "ring-2 ring-orange-500 border-transparent" : "border-slate-200/70"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 font-mono">
            Total do Catálogo
          </span>
          <div className="p-2 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-850 dark:text-zinc-100">{totalItems}</span>
          <span className="text-xs text-slate-400 font-medium">SKUs registados</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Todos os produtos ativos no sistema.</p>
      </div>

      {/* 2. Total Financial Valuation (Cost vs Sale) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 font-mono">
            Avaliação Financeira
          </span>
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-black text-slate-850 dark:text-zinc-100">
            {totalSaleValuation.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Custo Base: {totalCostValuation.toLocaleString()} {currency}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          <span>Lucro Estimado: {totalPotentialProfit.toLocaleString()} {currency}</span>
        </div>
      </div>

      {/* 3. Average Profit Margin */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 font-mono">
            Margem Bruta Média
          </span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-850 dark:text-zinc-100">{avgMarginPct}%</span>
          <span className="text-xs text-emerald-600 font-bold">Retorno markup</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Margem média calculada sobre os custos.</p>
      </div>

      {/* 4. Stock Alerts (Low & Out of stock) */}
      <div 
        onClick={() => onStockFilterChange(stockFilter === "LOW" ? "OUT" : stockFilter === "OUT" ? "ALL" : "LOW")}
        className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:border-slate-300 dark:bg-zinc-900 dark:border-zinc-800 ${
          stockFilter !== "ALL" ? "ring-2 ring-amber-500 border-transparent" : "border-slate-200/70"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 font-mono">
            Alertas Críticos
          </span>
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div>
            <div className="text-lg font-black text-amber-600">{lowStockCount}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">Stock Baixo</div>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-zinc-800" />
          <div>
            <div className="text-lg font-black text-rose-600">{outOfStockCount}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">Esgotados</div>
          </div>
        </div>
        <p className="text-[10px] text-amber-600 font-medium mt-1">
          {stockFilter === "LOW" ? "Filtrando: Apenas Stock Baixo" : stockFilter === "OUT" ? "Filtrando: Apenas Esgotados" : "Clique para filtrar por alertas"}
        </p>
      </div>
    </div>
  );
};
