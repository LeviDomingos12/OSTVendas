import React from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

interface HourlyData {
  hour: string;
  Entradas: number;
  Saídas: number;
}

interface CashAnalyticalChartsProps {
  data: HourlyData[];
  currency: string;
}

export default function CashAnalyticalCharts({ data, currency }: CashAnalyticalChartsProps) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
      <div className="mb-4">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider dark:text-zinc-300">
          Fluxo de Caixa por Hora
        </h4>
        <p className="text-[11px] text-slate-400">
          Entradas e Saídas distribuídas ao longo das horas do turno atual.
        </p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-zinc-800" />
            <XAxis 
              dataKey="hour" 
              stroke="#94a3b8" 
              fontSize={10}
              tickLine={false}
            />
            <YAxis 
              stroke="#94a3b8" 
              fontSize={10}
              tickLine={false}
              tickFormatter={(v) => `${v.toLocaleString()}`}
            />
            <Tooltip 
              formatter={(value: any) => [`${value.toLocaleString()} ${currency}`, ""]}
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "none",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#f8fafc"
              }}
            />
            <Legend 
              verticalAlign="top" 
              height={36} 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px" }}
            />
            <Bar dataKey="Entradas" name="Entradas (Vendas / Reforços)" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Saídas" name="Saídas (Despesas / Sangrias)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
