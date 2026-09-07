import React from "react";
import { Activity, Flame, ShieldAlert, User, AlertTriangle, Printer } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";
import { AuditLog, SystemSettings } from "../../types";
import { SYSTEM_THEMES } from "../../lib/themes";

export interface ActivityAnalytics {
  peakActivityValue: number;
  peakActivityDate: string;
  activeModulesCount: number;
  mostActiveModule: string;
  mostActiveUser: string;
  mostActiveUserLogsCount: number;
}

export interface ChartDataItem {
  label: string;
  count: number;
}

interface ReportAuditLogRowProps {
  log: AuditLog;
}

export const ReportAuditLogRow = React.memo(({ log }: ReportAuditLogRowProps) => {
  return (
    <tr className="hover:bg-slate-50/50 transition">
      <td className="p-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
        {new Date(log.timestamp).toLocaleString("pt-MZ")}
      </td>
      <td className="p-3 font-semibold text-slate-800">{log.user || "Sistema"}</td>
      <td className="p-3">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-150 text-slate-600 uppercase">
          {log.module}
        </span>
      </td>
      <td className="p-3 font-bold text-slate-800">{log.action}</td>
      <td className="p-3 text-slate-500 max-w-xs truncate" title={log.details}>
        {log.details}
      </td>
      <td className="p-3 text-right font-mono text-[10px] text-slate-400">
        {log.ip || "127.0.0.1"}
      </td>
    </tr>
  );
});
ReportAuditLogRow.displayName = "ReportAuditLogRow";

export interface ReportsActivityTabProps {
  filteredLogs: AuditLog[];
  activityAnalytics: ActivityAnalytics;
  chartData: ChartDataItem[];
  activityGrouping: "daily" | "hourly" | "module";
  setActivityGrouping: (g: "daily" | "hourly" | "module") => void;
  onExportActivityLogsPDF: () => void;
  isExporting: boolean;
  settings: SystemSettings;
}

export const ReportsActivityTab: React.FC<ReportsActivityTabProps> = ({
  filteredLogs,
  activityAnalytics,
  chartData,
  activityGrouping,
  setActivityGrouping,
  onExportActivityLogsPDF,
  isExporting,
  settings
}) => {
  const currentTheme = SYSTEM_THEMES.find(t => t.id === settings.theme);
  const themeFill = currentTheme?.rgb ? `rgb(${currentTheme.rgb})` : "#f97316";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 text-slate-950 p-2.5 rounded-xl shrink-0">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base">Atividade & Auditoria do Sistema</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Análise visual dos logs de auditoria para monitorar a frequência de ações, identificar picos operacionais e rastrear acessos ou modificações.
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-export-activity-pdf-header"
          onClick={onExportActivityLogsPDF}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Printer className="w-4 h-4 text-slate-950 shrink-0" />
          <span>Exportar Auditoria (PDF com Logotipo)</span>
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4.5">
        {/* KPI 1 */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total de Ações</span>
            <h4 className="text-xl font-mono font-bold text-slate-800 mt-1">{filteredLogs.length}</h4>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Registros no período</span>
          </div>
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Pico de Atividade</span>
            <h4 className="text-xl font-mono font-bold text-slate-800 mt-1">{activityAnalytics.peakActivityValue} ações</h4>
            <span className="text-[10px] text-slate-400 mt-0.5 block">em {activityAnalytics.peakActivityDate || "N/D"}</span>
          </div>
          <div className="bg-orange-50 text-orange-600 p-2.5 rounded-xl">
            <Flame className="w-5 h-5 animate-bounce" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Módulos Ativos</span>
            <h4 className="text-xl font-mono font-bold text-slate-800 mt-1">{activityAnalytics.activeModulesCount}</h4>
            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full inline-block mt-1 leading-none text-[9px]">{activityAnalytics.mostActiveModule || "N/A"}</span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Operador Mais Ativo</span>
            <h4 className="text-sm font-bold text-slate-800 mt-1 truncate max-w-[130px]">{activityAnalytics.mostActiveUser || "N/D"}</h4>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{activityAnalytics.mostActiveUserLogsCount} ações registradas</span>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Chart Controls & Recharts Visualization */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Cronograma Frequencial de Logs e Ações</h3>
            <p className="text-xs text-slate-400 mt-0.5">Representação gráfica da densidade de transações, acessos, exportações e alterações.</p>
          </div>

          {/* Grouping Toggle buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold font-mono">
            {(["daily", "hourly", "module"] as const).map(group => (
              <button
                key={group}
                type="button"
                onClick={() => setActivityGrouping(group)}
                className={`px-3.5 py-1.5 rounded-lg cursor-pointer transition ${
                  activityGrouping === group ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {group === "daily" ? "Por Dia" : group === "hourly" ? "Por Hora" : "Por Módulo"}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Container */}
        <div className="h-[350px] w-full text-xs font-mono">
          {chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50/50 rounded-2xl border border-dashed p-10">
              <AlertTriangle className="w-8 h-8 text-slate-350" />
              <span>Nenhuma atividade registrada no período selecionado.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <RechartsTooltip 
                  contentStyle={{ background: "#0f172a", border: "none", borderRadius: "12px", color: "#fff", fontSize: "11px" }}
                  itemStyle={{ color: "#38bdf8" }}
                />
                <Bar 
                  dataKey="count" 
                  name="Ações Executadas" 
                  fill={themeFill} 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Audit Logs Table for context */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Registro Operacional em Tempo Real</h3>
          <p className="text-xs text-slate-400 mt-0.5">Lista detalhada dos últimos logs de auditoria correspondentes ao período.</p>
        </div>

        <div className="border border-slate-150 rounded-xl overflow-x-auto custom-scrollbar text-xs">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
              <tr>
                <th className="p-3">Data/Hora</th>
                <th className="p-3">Operador</th>
                <th className="p-3">Módulo</th>
                <th className="p-3">Ação</th>
                <th className="p-3">Detalhes</th>
                <th className="p-3 text-right">IP/Dispositivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                [...filteredLogs].reverse().slice(0, 15).map((log, idx) => (
                  <ReportAuditLogRow key={`${log.id || 'log'}-${idx}`} log={log} />
                ))
              )}
            </tbody>
          </table>
          {filteredLogs.length > 15 && (
            <div className="p-3 bg-slate-50 border-t border-slate-150 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Exibindo as 15 ações mais recentes de {filteredLogs.length} logs totais no período.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
