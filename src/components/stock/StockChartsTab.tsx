import React, { useMemo } from "react";
import { Layers, Percent, AlertTriangle } from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { Product } from "../../types";

export interface StockChartsTabProps {
  products: Product[];
}

export const StockChartsTab: React.FC<StockChartsTabProps> = ({ products }) => {
  const chartsData = useMemo(() => {
    // 1. Stock cost vs sale value per category
    const categoryTotals: Record<string, { name: string; Custo: number; Venda: number; Lucro: number }> = {};
    products.forEach(p => {
      if (!categoryTotals[p.category]) {
        categoryTotals[p.category] = { name: p.category, Custo: 0, Venda: 0, Lucro: 0 };
      }
      categoryTotals[p.category].Custo += p.costPrice * p.stock;
      categoryTotals[p.category].Venda += p.salePrice * p.stock;
      categoryTotals[p.category].Lucro += (p.salePrice - p.costPrice) * p.stock;
    });
    const categoryData = Object.values(categoryTotals);

    // 2. Critical products list
    const criticalProducts = products
      .filter(p => p.stock <= p.minStock)
      .slice(0, 8)
      .map(p => ({
        name: p.name.length > 18 ? p.name.substring(0, 16) + "..." : p.name,
        Stock: p.stock,
        Minimo: p.minStock
      }));

    // 3. Margin range statistics
    let highMargin = 0; // > 40%
    let midMargin = 0;  // 20% - 40%
    let lowMargin = 0;  // < 20%
    products.forEach(p => {
      const margin = p.costPrice > 0 ? ((p.salePrice - p.costPrice) / p.costPrice) * 100 : 0;
      if (margin > 40) highMargin++;
      else if (margin >= 20) midMargin++;
      else lowMargin++;
    });

    const marginPieData = [
      { name: "Margem Alta (>40%)", value: highMargin, color: "#10b981" },
      { name: "Margem Média (20-40%)", value: midMargin, color: "#f59e0b" },
      { name: "Margem Baixa (<20%)", value: lowMargin, color: "#ef4444" }
    ].filter(d => d.value > 0);

    return {
      categoryData,
      criticalProducts,
      marginPieData
    };
  }, [products]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Value by Category BarChart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="font-bold text-slate-800 text-sm mb-1.5 dark:text-zinc-200 flex items-center gap-1.5">
            <Layers className="w-4.5 h-4.5 text-orange-500" />
            Valor Comercial de Stock por Categoria (MT)
          </h3>
          <p className="text-xs text-slate-400 mb-4">Investimento (Preço de Custo) vs Retorno Potencial (Preço de Venda).</p>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.categoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip cursor={{ fill: 'rgba(244, 245, 246, 0.4)' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Custo" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Custo Total" />
                <Bar dataKey="Venda" fill="#f97316" radius={[4, 4, 0, 0]} name="Venda Estimada" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit margin donut distribution chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="font-bold text-slate-800 text-sm mb-1.5 dark:text-zinc-200 flex items-center gap-1.5">
            <Percent className="w-4.5 h-4.5 text-emerald-500" />
            Distribuição de Margens de Lucro
          </h3>
          <p className="text-xs text-slate-400 mb-4">Classificação de produtos baseada no percentual de retorno do custo.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartsData.marginPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartsData.marginPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {chartsData.marginPieData.map((d, index) => (
                <div key={index} className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600 dark:text-zinc-300">{d.name}</span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-zinc-100 font-mono">{d.value} un</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Critical Replenishment Stocks List Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <h3 className="font-bold text-slate-800 text-sm mb-1.5 dark:text-zinc-200 flex items-center gap-1.5">
          <AlertTriangle className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
          Níveis Críticos: Stock Real vs Nível de Alerta Mínimo
        </h3>
        <p className="text-xs text-slate-400 mb-4">Produtos abaixo do limite mínimo de reabastecimento comercial.</p>

        {chartsData.criticalProducts.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-400 italic">Nenhum produto em nível crítico de stock no momento. Excelente!</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData.criticalProducts} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9.5} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Stock" fill="#ef4444" radius={[4, 4, 0, 0]} name="Stock Atual" />
                <Bar dataKey="Minimo" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Nível Mínimo" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
