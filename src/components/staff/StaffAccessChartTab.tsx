import React from "react";
import {
  TrendingUp,
  Activity,
  UserCheck2,
  Terminal,
  BarChart3,
  Calendar,
  Filter,
  UserCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Employee } from "../../types";

export interface AccessInsights {
  ranking: Array<{
    username: string;
    name: string;
    role: string;
    count: number;
    percentage: number;
    lastAccess: string;
  }>;
  moduleDistribution: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  mostActive: { name: string; count: number; role: string } | null;
  mostAccessedModule: { name: string; count: number; percentage: number } | null;
  avgDaily: number;
  totalAccesses: number;
}

export interface AccessChartDataPoint {
  label: string;
  total?: number;
  [key: string]: string | number | undefined;
}

export interface AccessChartData {
  points: AccessChartDataPoint[];
  activeEmployees: string[];
  totalAccesses: number;
}

interface StaffAccessChartTabProps {
  accessInsights: AccessInsights;
  accessChartType: "line" | "bar" | "area";
  setAccessChartType: (type: "line" | "bar" | "area") => void;
  accessPeriod: "7d" | "30d" | "90d" | "custom";
  setAccessPeriod: (p: "7d" | "30d" | "90d" | "custom") => void;
  accessModule: string;
  setAccessModule: (m: string) => void;
  accessModulesList: string[];
  accessEmployee: string;
  setAccessEmployee: (e: string) => void;
  employees: Employee[];
  accessStartDate: string;
  setAccessStartDate: (d: string) => void;
  accessEndDate: string;
  setAccessEndDate: (d: string) => void;
  computedAccessDates: { startStr: string; endStr: string };
  accessChartData: AccessChartData;
  employeeColors: { [username: string]: string };
}

export const StaffAccessChartTab: React.FC<StaffAccessChartTabProps> = ({
  accessInsights,
  accessChartType,
  setAccessChartType,
  accessPeriod,
  setAccessPeriod,
  accessModule,
  setAccessModule,
  accessModulesList,
  accessEmployee,
  setAccessEmployee,
  employees,
  accessStartDate,
  setAccessStartDate,
  accessEndDate,
  setAccessEndDate,
  computedAccessDates,
  accessChartData,
  employeeColors,
}) => {
  interface TooltipPayloadItem {
    name: string;
    value: number;
    color?: string;
  }

  interface CustomChartTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string;
  }

  const CustomChartTooltip = ({ active, payload, label }: CustomChartTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-md space-y-1.5 dark:bg-zinc-900 dark:border-zinc-800">
          <p className="font-extrabold text-xs text-slate-800 dark:text-zinc-100 font-mono">
            {label}
          </p>
          <div className="space-y-1">
            {payload.map((p: TooltipPayloadItem) => {
              if (p.name === "total" || p.value === 0) return null;
              return (
                <div key={p.name} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="font-bold text-slate-600 dark:text-zinc-400">
                    {p.name}
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-zinc-100 font-mono">
                    {p.value} acessos
                  </span>
                </div>
              );
            })}
            <div className="border-t border-slate-100 pt-1 mt-1 flex items-center justify-between text-[11px] font-mono dark:border-zinc-850">
              <span className="font-bold text-slate-400">Total Geral:</span>
              <span className="font-black text-orange-600 font-mono">
                {payload.reduce((sum: number, item: TooltipPayloadItem) => {
                  if (item.name === "total") return sum;
                  return sum + Number(item.value || 0);
                }, 0)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* KPI 1: Acessos Totais */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50 text-orange-500 dark:bg-orange-950/20 dark:text-orange-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block font-mono dark:text-zinc-500">
              Acessos Totais
            </span>
            <span className="text-xl font-black text-slate-800 dark:text-zinc-100 block mt-0.5">
              {accessInsights.totalAccesses}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5">
              Interações registadas no período
            </span>
          </div>
        </div>

        {/* KPI 2: Média Diária */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 text-blue-500 dark:bg-blue-950/20 dark:text-blue-400">
            <Activity className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block font-mono dark:text-zinc-500">
              Média Diária
            </span>
            <span className="text-xl font-black text-slate-800 dark:text-zinc-100 block mt-0.5">
              {accessInsights.avgDaily.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5">
              Acessos por dia de atividade
            </span>
          </div>
        </div>

        {/* KPI 3: Colaborador Mais Ativo */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400">
            <UserCheck2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block font-mono dark:text-zinc-500">
              Mais Ativo
            </span>
            <span className="text-sm font-extrabold text-slate-800 dark:text-zinc-100 block mt-0.5 truncate">
              {accessInsights.mostActive ? accessInsights.mostActive.name : "Ninguém"}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5">
              {accessInsights.mostActive
                ? `${accessInsights.mostActive.count} acessos (${accessInsights.mostActive.role})`
                : "Sem logs no período"}
            </span>
          </div>
        </div>

        {/* KPI 4: Módulo Mais Acedido */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-400">
            <Terminal className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block font-mono dark:text-zinc-500">
              Módulo Principal
            </span>
            <span className="text-sm font-extrabold text-slate-800 dark:text-zinc-100 block mt-0.5 truncate">
              {accessInsights.mostAccessedModule
                ? accessInsights.mostAccessedModule.name
                : "Nenhum"}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5">
              {accessInsights.mostAccessedModule
                ? `${accessInsights.mostAccessedModule.count} ações (${accessInsights.mostAccessedModule.percentage.toFixed(0)}%)`
                : "Nenhum registo"}
            </span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-zinc-800">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm dark:text-zinc-100 flex items-center gap-1.5">
              <BarChart3 className="w-4.5 h-4.5 text-orange-500" />
              Controle e Histórico Temporal de Acessos
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
              Filtre as interações de colaboradores por período de tempo, módulo correspondente e colaborador específico.
            </p>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 text-[10px] font-bold border border-slate-200 self-start lg:self-auto dark:bg-zinc-950 dark:border-zinc-850">
            <button
              type="button"
              onClick={() => setAccessChartType("line")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                accessChartType === "line"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Gráfico de Linha
            </button>
            <button
              type="button"
              onClick={() => setAccessChartType("bar")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                accessChartType === "bar"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Gráfico de Barras
            </button>
            <button
              type="button"
              onClick={() => setAccessChartType("area")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                accessChartType === "area"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Gráfico de Área
            </button>
          </div>
        </div>

        {/* Real Filter Selectors Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Filter 1: Period Selection */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wide flex items-center gap-1 dark:text-zinc-400">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Período Temporal
            </label>
            <select
              value={accessPeriod}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAccessPeriod(e.target.value as "7d" | "30d" | "90d" | "custom")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-orange-500 text-slate-800 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-100"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="custom">Período Personalizado</option>
            </select>
          </div>

          {/* Filter 2: System Module */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wide flex items-center gap-1 dark:text-zinc-400">
              <Filter className="w-3.5 h-3.5 text-slate-400" /> Módulo de Sistema
            </label>
            <select
              value={accessModule}
              onChange={(e) => setAccessModule(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-orange-500 text-slate-800 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-100"
            >
              {accessModulesList.map((mod) => (
                <option key={mod} value={mod}>
                  {mod === "Todos" ? "Todos os Módulos" : mod}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Collaborator selection */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wide flex items-center gap-1 dark:text-zinc-400">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Colaborador
            </label>
            <select
              value={accessEmployee}
              onChange={(e) => setAccessEmployee(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-orange-500 text-slate-800 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-100"
            >
              <option value="Todos">Todos os Colaboradores</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.username}>
                  {emp.name} ({emp.username})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4: Custom Date Range */}
          {accessPeriod === "custom" ? (
            <div className="md:col-span-3 grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-150">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                  Início
                </label>
                <input
                  type="date"
                  value={accessStartDate}
                  onChange={(e) => setAccessStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-800 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                  Fim
                </label>
                <input
                  type="date"
                  value={accessEndDate}
                  onChange={(e) => setAccessEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-800 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-100"
                />
              </div>
            </div>
          ) : (
            <div className="md:col-span-3 text-right">
              <span className="text-[10px] text-slate-400 block font-mono italic p-2 dark:text-zinc-500">
                Período selecionado:{" "}
                {(() => {
                  const { startStr, endStr } = computedAccessDates;
                  const formatDateStr = (str: string) => {
                    const parts = str.split("-");
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : str;
                  };
                  return `${formatDateStr(startStr)} até ${formatDateStr(endStr)}`;
                })()}
              </span>
            </div>
          )}
        </div>

        {/* Chart Area Display */}
        <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-2xl h-80 flex flex-col justify-between dark:bg-zinc-950/40 dark:border-zinc-850">
          {accessChartData.points.length === 0 || accessChartData.totalAccesses === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 italic text-xs gap-2">
              <Activity className="w-8 h-8 text-slate-300 animate-pulse" />
              <span>Sem registros de acessos para os filtros selecionados neste intervalo temporal.</span>
            </div>
          ) : (
            <div className="w-full h-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                {(() => {
                  const dataPoints = accessChartData.points;
                  const activeEmps = accessChartData.activeEmployees;

                  if (accessChartType === "line") {
                    return (
                      <LineChart
                        data={dataPoints}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                          className="dark:stroke-zinc-800"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="#94a3b8"
                          fontSize={9}
                          fontStyle="bold"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={9}
                          fontStyle="bold"
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            paddingTop: "10px",
                          }}
                        />
                        {activeEmps.map((emp) => (
                          <Line
                            key={emp}
                            type="monotone"
                            dataKey={emp}
                            name={emp}
                            stroke={employeeColors[emp] || "#f97316"}
                            strokeWidth={2.5}
                            dot={{ r: 3, strokeWidth: 1.5 }}
                            activeDot={{ r: 5 }}
                          />
                        ))}
                      </LineChart>
                    );
                  } else if (accessChartType === "area") {
                    return (
                      <AreaChart
                        data={dataPoints}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          {activeEmps.map((emp) => (
                            <linearGradient
                              key={emp}
                              id={`grad-${emp}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor={employeeColors[emp] || "#f97316"}
                                stopOpacity={0.35}
                              />
                              <stop
                                offset="95%"
                                stopColor={employeeColors[emp] || "#f97316"}
                                stopOpacity={0.0}
                              />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                          className="dark:stroke-zinc-800"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="#94a3b8"
                          fontSize={9}
                          fontStyle="bold"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={9}
                          fontStyle="bold"
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            paddingTop: "10px",
                          }}
                        />
                        {activeEmps.map((emp) => (
                          <Area
                            key={emp}
                            type="monotone"
                            dataKey={emp}
                            name={emp}
                            stroke={employeeColors[emp] || "#f97316"}
                            strokeWidth={2}
                            fill={`url(#grad-${emp})`}
                          />
                        ))}
                      </AreaChart>
                    );
                  } else {
                    return (
                      <BarChart
                        data={dataPoints}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                          className="dark:stroke-zinc-800"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="#94a3b8"
                          fontSize={9}
                          fontStyle="bold"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={9}
                          fontStyle="bold"
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            paddingTop: "10px",
                          }}
                        />
                        {activeEmps.map((emp) => (
                          <Bar
                            key={emp}
                            dataKey={emp}
                            name={emp}
                            stackId="access_stack"
                            fill={employeeColors[emp] || "#f97316"}
                          />
                        ))}
                      </BarChart>
                    );
                  }
                })()}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Analytical Subsections */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Left Box: Collaborator Ranking Table */}
        <div className="xl:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="border-b pb-3 border-slate-100 flex items-center justify-between dark:border-zinc-800">
            <div>
              <h4 className="font-extrabold text-slate-800 text-xs dark:text-zinc-100 flex items-center gap-1.5">
                <UserCheck2 className="w-4 h-4 text-orange-500" />
                Ranking de Atividade de Colaboradores
              </h4>
              <p className="text-[9px] text-slate-400 mt-0.5">
                Frequência bruta e percentual de acessos ao sistema por operador ativo.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] font-mono dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Cargo</th>
                  <th className="p-3 text-right">Acessos</th>
                  <th className="p-3 text-right">Representatividade</th>
                  <th className="p-3 text-center">Último Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {accessInsights.ranking.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-4 text-center text-slate-400 italic text-[11px]"
                    >
                      Nenhum acesso registrado no período.
                    </td>
                  </tr>
                ) : (
                  accessInsights.ranking.map((row) => (
                    <tr
                      key={row.username}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20 transition-colors font-medium text-slate-700 dark:text-zinc-300"
                    >
                      <td className="p-3 flex items-center gap-2.5">
                        <span
                          className="w-6 h-6 rounded-lg font-bold text-[9px] flex items-center justify-center text-white shrink-0"
                          style={{
                            backgroundColor: employeeColors[row.username] || "#cbd5e1",
                          }}
                        >
                          {row.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <span className="block font-bold text-slate-800 dark:text-zinc-200 truncate max-w-[120px]">
                            {row.name}
                          </span>
                          <span className="block text-[9px] text-slate-400 font-mono truncate">
                            @{row.username}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {row.role}
                        </span>
                      </td>
                      <td className="p-3 text-right font-black font-mono text-slate-900 dark:text-zinc-100">
                        {row.count}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-bold font-mono">
                            {row.percentage.toFixed(1)}%
                          </span>
                          <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden dark:bg-zinc-800 shrink-0">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.percentage}%`,
                                backgroundColor: employeeColors[row.username],
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono text-[10px] text-slate-500 dark:text-zinc-400">
                        {row.lastAccess}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Box: Module access distribution progress bars */}
        <div className="xl:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="border-b pb-3 border-slate-100 flex items-center justify-between dark:border-zinc-800">
            <div>
              <h4 className="font-extrabold text-slate-800 text-xs dark:text-zinc-100 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-orange-500" />
                Distribuição por Módulo de Sistema
              </h4>
              <p className="text-[9px] text-slate-400 mt-0.5">
                Principais focos de acesso e operação dos colaboradores.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {accessInsights.moduleDistribution.length === 0 ? (
              <div className="text-center py-8 text-slate-400 italic text-[11px]">
                Nenhum registro modular no período.
              </div>
            ) : (
              accessInsights.moduleDistribution.map((item, idx) => {
                const moduleColors = [
                  "bg-orange-500",
                  "bg-blue-500",
                  "bg-emerald-500",
                  "bg-indigo-500",
                  "bg-purple-500",
                  "bg-rose-500",
                  "bg-amber-500",
                  "bg-cyan-500",
                ];
                const selectedBg = moduleColors[idx % moduleColors.length];

                return (
                  <div key={item.name} className="space-y-1.5 font-sans">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 dark:text-zinc-300">
                        {item.name}
                      </span>
                      <span className="font-mono text-[11px] font-black text-slate-800 dark:text-zinc-100">
                        {item.count}{" "}
                        <span className="text-slate-400 font-normal">
                          ({item.percentage.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${selectedBg}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
