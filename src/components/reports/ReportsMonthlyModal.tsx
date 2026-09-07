import React from "react";
import { Activity, Download } from "lucide-react";
import { Transaction } from "../../types";

export interface MonthlyStats {
  monthName: string;
  year: number;
  totalSales: number;
  averageTicket: number;
  totalItemsCount: number;
  totalVat: number;
  totalDiscount: number;
  monthlyTx: Transaction[];
  topProducts: { name: string; qty: number; revenue: number }[];
}

export interface ReportsMonthlyModalProps {
  showMonthlySummaryModal: boolean;
  monthlyStats: MonthlyStats;
  isExporting: boolean;
  formatMZ: (val: number) => string;
  onClose: () => void;
  onExportPDF: () => void;
}

export const ReportsMonthlyModal: React.FC<ReportsMonthlyModalProps> = ({
  showMonthlySummaryModal,
  monthlyStats,
  isExporting,
  formatMZ,
  onClose,
  onExportPDF
}) => {
  if (!showMonthlySummaryModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-orange-500 text-white p-2 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm md:text-base leading-tight">
                Resumo Executivo Mensal
              </h3>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                {monthlyStats.monthName.toUpperCase()} DE {monthlyStats.year}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer px-2 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 text-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Faturamento</span>
              <span className="text-xs md:text-sm font-bold font-mono text-slate-800 mt-1 block">
                {formatMZ(monthlyStats.totalSales)}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 text-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Ticket Médio</span>
              <span className="text-xs md:text-sm font-bold font-mono text-slate-800 mt-1 block">
                {formatMZ(monthlyStats.averageTicket)}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 text-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Qtd Vendida</span>
              <span className="text-xs md:text-sm font-bold font-mono text-slate-800 mt-1 block">
                {monthlyStats.totalItemsCount} un
              </span>
            </div>
          </div>

          {/* Tax & Discounts info card */}
          <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-extrabold text-orange-950 uppercase tracking-wide">
              Impostos & Encargos do Mês
            </h4>
            <div className="text-xs space-y-1.5 font-medium text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Transações no período:</span>
                <span className="font-mono font-bold text-slate-800">{monthlyStats.monthlyTx.length} vendas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Imposto IVA Acumulado (16%):</span>
                <span className="font-mono font-bold text-slate-800">{formatMZ(monthlyStats.totalVat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Descontos Geral Concedidos:</span>
                <span className="font-mono font-bold text-red-650">-{formatMZ(monthlyStats.totalDiscount)}</span>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              Produtos Mais Vendidos (Top 5)
            </h4>
            {monthlyStats.topProducts.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                Nenhuma venda registrada neste mês corrente ainda.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs bg-white shadow-sm">
                {monthlyStats.topProducts.map((p, index) => (
                  <div key={index} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-slate-400 w-4 font-mono">#{index + 1}</span>
                      <span className="font-semibold text-slate-700">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-800 block">{p.qty} un</span>
                      <span className="text-[10px] text-slate-400 font-mono">{formatMZ(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-100 transition cursor-pointer text-center"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={onExportPDF}
            disabled={isExporting}
            className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition shadow-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? "A processar..." : "Exportar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
};
