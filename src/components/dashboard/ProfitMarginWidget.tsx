import React from "react";
import { motion } from "motion/react";
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  DollarSign, 
  ShoppingCart, 
  Boxes, 
  Info,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface ProfitMarginWidgetProps {
  dailySales: number;
  dailyCostOfSales: number;
  dailyProfit: number;
  dailyProfitMarginPercent: number;
  yesterdaySales: number;
  yesterdayCostOfSales: number;
  yesterdayProfit: number;
  yesterdayProfitMarginPercent: number;
  profitGrowthRate: number;
  marginPointsDiff: number;
  currency: string;
  selectedDateStr: string;
  isToday: boolean;
}

export const ProfitMarginWidget: React.FC<ProfitMarginWidgetProps> = ({
  dailySales,
  dailyCostOfSales,
  dailyProfit,
  dailyProfitMarginPercent,
  yesterdaySales,
  yesterdayCostOfSales,
  yesterdayProfit,
  yesterdayProfitMarginPercent,
  profitGrowthRate,
  marginPointsDiff,
  currency,
  selectedDateStr,
  isToday
}) => {
  const isPositiveGrowth = profitGrowthRate >= 0;
  const isPositiveMarginDiff = marginPointsDiff >= 0;

  // Margin classification
  const marginStatus = dailyProfitMarginPercent >= 35 
    ? { label: "Rentabilidade Alta", color: "text-emerald-700 bg-emerald-100/80 border-emerald-200" }
    : dailyProfitMarginPercent >= 20 
      ? { label: "Margem Saudável", color: "text-blue-700 bg-blue-100/80 border-blue-200" }
      : dailyProfitMarginPercent > 0 
        ? { label: "Margem Regular", color: "text-amber-700 bg-amber-100/80 border-amber-200" }
        : { label: "Sem Vendas / Margem Zero", color: "text-slate-600 bg-slate-100 border-slate-200" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md"
      id="widget-kpi-margem-lucro-diaria"
    >
      {/* Background visual accents */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-500/5 via-teal-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-mono">
                KPI de Desempenho
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${marginStatus.color}`}>
                {marginStatus.label}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 mt-0.5 flex items-center gap-1.5">
              Margem de Lucro Diária
              <span className="text-[11px] font-normal text-slate-400">
                ({isToday ? "Hoje" : new Date(selectedDateStr).toLocaleDateString("pt-MZ")})
              </span>
            </h3>
          </div>
        </div>

        {/* Variation Badge vs Yesterday */}
        <div className="flex items-center gap-2">
          <div 
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black tracking-tight border shadow-xs ${
              isPositiveGrowth 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
            title={`Lucro Diário: ${dailyProfit.toLocaleString()} ${currency} vs ${yesterdayProfit.toLocaleString()} ${currency} no dia anterior`}
          >
            {isPositiveGrowth ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>
              {isPositiveGrowth ? "+" : ""}{profitGrowthRate.toFixed(1)}%
            </span>
            <span className="text-[10px] font-bold opacity-75 font-sans">vs dia anterior</span>
          </div>
        </div>
      </div>

      {/* Main Metric Numbers & Formula Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        
        {/* Metric 1: Profit Margin % */}
        <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Margem % sobre Vendas</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-700">
              {dailyProfitMarginPercent.toFixed(1)}%
            </span>
            <span className={`text-[11px] font-bold flex items-center ${
              isPositiveMarginDiff ? "text-emerald-600" : "text-rose-600"
            }`}>
              {isPositiveMarginDiff ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
              {isPositiveMarginDiff ? "+" : ""}{marginPointsDiff.toFixed(1)} pp vs ontem ({yesterdayProfitMarginPercent.toFixed(1)}%)
            </span>
          </div>
          {/* Visual Mini Progress Bar */}
          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                dailyProfitMarginPercent >= 30 ? "bg-emerald-500" : dailyProfitMarginPercent >= 15 ? "bg-blue-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, dailyProfitMarginPercent))}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Daily Net Profit (Vendas - Custo) */}
        <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Lucro Diário Líquido</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black font-mono text-slate-800">
              +{dailyProfit.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-400">{currency}</span>
            </span>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Ontem: {yesterdayProfit.toLocaleString()} {currency}
            </p>
          </div>
        </div>

        {/* Metric 3: Breakdown Formula (Total Vendas - Custo) */}
        <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Cálculo de Desempenho</span>
            <Info className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-2 space-y-1 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-700">
              <span className="flex items-center gap-1 text-[11px] text-slate-500 font-sans">
                <ShoppingCart className="w-3 h-3 text-slate-400" /> Total Vendas:
              </span>
              <span className="font-bold">{dailySales.toLocaleString()} {currency}</span>
            </div>
            <div className="flex items-center justify-between text-rose-700">
              <span className="flex items-center gap-1 text-[11px] text-slate-500 font-sans">
                <Boxes className="w-3 h-3 text-slate-400" /> (-) Custo Vendas:
              </span>
              <span className="font-bold">{dailyCostOfSales.toLocaleString()} {currency}</span>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};
