import React from "react";
import {
  Search,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Lock,
  UserX,
  Plus,
  Edit3,
  Trash2,
  Info,
} from "lucide-react";
import { AuditLog, UserRole } from "../../types";
import { AuditLogLocationMap } from "./AuditLogLocationMap";

export interface GroupedAuditLogItem {
  log: AuditLog;
  count: number;
  firstTime: string;
  lastTime: string;
  isGroup: boolean;
  originalLogs: AuditLog[];
}

interface StaffAuditTabProps {
  auditSearch: string;
  setAuditSearch: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  auditModuleFilter: string;
  setAuditModuleFilter: (val: string) => void;
  modules: string[];
  onDownloadAuditCSV: () => void;
  onDownloadAuditPDF: (exportAll: boolean) => void;
  onCopyLogs: () => void;
  copiedLogs: boolean;
  groupedAuditLogs: GroupedAuditLogItem[];
  expandedLogId: string | null;
  setExpandedLogId: (id: string | null) => void;
  currentRole: UserRole;
  translateDatabaseMessage: (msg: string | undefined | null) => string;
  isDatabaseError: (msg: string | undefined | null) => boolean;
}

export const StaffAuditTab: React.FC<StaffAuditTabProps> = ({
  auditSearch,
  setAuditSearch,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  auditModuleFilter,
  setAuditModuleFilter,
  modules,
  onDownloadAuditCSV,
  onDownloadAuditPDF,
  onCopyLogs,
  copiedLogs,
  groupedAuditLogs,
  expandedLogId,
  setExpandedLogId,
  currentRole,
  translateDatabaseMessage,
  isDatabaseError,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[450px]">
      {/* Filter bars */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-150 flex flex-col xl:flex-row gap-3.5 items-center justify-between">
        <div className="relative w-full xl:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="audit-logs-search-input"
            type="text"
            placeholder="Filtrar por usuário, módulo, data ou ação..."
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 transition font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-start xl:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
              Início:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 font-semibold text-slate-700"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
              Fim:
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 font-semibold text-slate-700"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">
              Módulo:
            </span>
            <select
              value={auditModuleFilter}
              onChange={(e) => setAuditModuleFilter(e.target.value)}
              className="bg-white border text-slate-650 rounded-lg py-1.5 px-3 text-xs outline-none cursor-pointer font-semibold border-slate-200"
            >
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onDownloadAuditCSV}
            title="Exportar logs de auditoria filtrados para formato CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition-all duration-150 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            id="export-audit-pdf-filtered-button"
            onClick={() => onDownloadAuditPDF(false)}
            title="Exportar relatório PDF dos logs de auditoria filtrados"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition-all duration-150 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Exportar PDF</span>
          </button>

          <button
            id="export-audit-pdf-complete-button"
            onClick={() => onDownloadAuditPDF(true)}
            title="Exportar log de auditoria completo para arquivo PDF (Análise de Segurança Externa)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition-all duration-150 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Auditoria Completa (PDF)</span>
          </button>

          <button
            onClick={onCopyLogs}
            title="Copiar logs de auditoria filtrados em formato de texto estruturado"
            className={`flex items-center gap-1.5 px-3 py-1.5 font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition-all duration-150 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
              copiedLogs
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-slate-800 hover:bg-slate-900 text-white"
            }`}
          >
            {copiedLogs ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedLogs ? "Copiado!" : "Copiar Logs"}</span>
          </button>
        </div>
      </div>

      {/* TABLE DISPLAY */}
      <div className="flex-1 overflow-x-auto max-h-[500px] overflow-y-auto text-[11.5px] custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[9px] font-mono">
              <th className="p-3 w-6"></th>
              <th className="p-3.5 w-40">DATA / HORA</th>
              <th className="p-3.5">UTENTE</th>
              <th className="p-3.5 text-center">NÍVEL</th>
              <th className="p-3.5">OPERACIONAIS</th>
              <th className="p-3.5 text-center">MÓDULO</th>
              <th className="p-3.5">DETALHES CONSOLIDADOS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px] leading-relaxed">
            {groupedAuditLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-slate-400 italic font-sans text-xs"
                >
                  Nenhum evento registrado de auditoria atendeu aos filtros.
                </td>
              </tr>
            ) : (
              groupedAuditLogs.map((group, index) => {
                const log = group.log;
                const isGroupExpanded = expandedLogId === log.id;

                const isError =
                  log.module === "ERRO_FRONTEND" ||
                  (log.action || "").toLowerCase().includes("erro") ||
                  isDatabaseError(log.details);
                const isWarning =
                  (log.action || "").toLowerCase().includes("falha") ||
                  (log.action || "").toLowerCase().includes("unauthorized") ||
                  (log.action || "").toLowerCase().includes("bloque");

                const severityLabel = isError ? "ERRO" : isWarning ? "AVISO" : "INFO";
                const severityColor = isError
                  ? "text-red-700 bg-red-50 border-red-100"
                  : isWarning
                  ? "text-amber-700 bg-amber-50 border-amber-100"
                  : "text-emerald-700 bg-emerald-50 border-emerald-100";

                const rowBorderColor = isError
                  ? "border-l-4 border-l-red-500"
                  : isWarning
                  ? "border-l-4 border-l-amber-500"
                  : "border-l-4 border-l-emerald-500";

                const getIcon = () => {
                  const act = (log.action || "").toLowerCase();
                  if (isError) return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
                  if (act.includes("login")) return <Lock className="w-3.5 h-3.5 text-indigo-500" />;
                  if (act.includes("logout") || act.includes("sair"))
                    return <UserX className="w-3.5 h-3.5 text-slate-500" />;
                  if (
                    act.includes("contratar") ||
                    act.includes("criar") ||
                    act.includes("add")
                  )
                    return <Plus className="w-3.5 h-3.5 text-emerald-500" />;
                  if (
                    act.includes("edit") ||
                    act.includes("alterar") ||
                    act.includes("atualizar")
                  )
                    return <Edit3 className="w-3.5 h-3.5 text-blue-500" />;
                  if (
                    act.includes("remover") ||
                    act.includes("excluir") ||
                    act.includes("deletar")
                  )
                    return <Trash2 className="w-3.5 h-3.5 text-rose-500" />;
                  return <Info className="w-3.5 h-3.5 text-slate-450" />;
                };

                return (
                  <React.Fragment key={`${log.id || ""}-${index}`}>
                    <tr
                      onClick={() =>
                        setExpandedLogId(isGroupExpanded ? null : log.id || `${index}`)
                      }
                      className={`hover:bg-slate-50/50 cursor-pointer transition ${rowBorderColor} ${
                        isGroupExpanded ? "bg-slate-50/70" : ""
                      }`}
                    >
                      <td className="p-3 text-center text-slate-400">
                        {isGroupExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 text-slate-700 font-bold font-sans">
                        <span className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center font-bold text-[9px] font-sans">
                            {log.user ? log.user.charAt(0) : "S"}
                          </span>
                          {log.user || "Sistema"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold font-sans border ${severityColor}`}
                        >
                          {severityLabel}
                        </span>
                      </td>
                      <td className="p-3 font-semibold font-sans text-slate-800">
                        <span className="flex items-center gap-1.5">
                          {getIcon()}
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wide border bg-slate-50 border-slate-200 text-slate-600">
                          {log.module}
                        </span>
                      </td>
                      <td className="p-3 max-w-sm truncate text-[11px] font-sans text-slate-550">
                        {group.isGroup && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded mr-1.5 uppercase font-mono tracking-tight shrink-0">
                            {group.count} ocorrências ({group.lastTime} ➔ {group.firstTime})
                          </span>
                        )}
                        {translateDatabaseMessage(log.details)}
                      </td>
                    </tr>

                    {/* EXPANDABLE ROW FULL METADATA DETAIL DISPLAY */}
                    {isGroupExpanded && (
                      <tr className="bg-slate-50/50">
                        <td
                          colSpan={7}
                          className="p-4 border-l-4 border-l-orange-500 font-sans text-xs text-slate-600 space-y-3.5"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">
                                Mensagem do Evento
                              </span>
                              <span className="font-medium text-slate-800 block leading-relaxed">
                                {translateDatabaseMessage(log.details)}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">
                                ID de Auditoria
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 block">
                                {log.id || "N/D"}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">
                                Nível e Função
                              </span>
                              <span className="font-mono text-slate-500 block">
                                {log.userRole || "ADMIN"}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">
                                Sessão e IP
                              </span>
                              <span className="font-mono text-slate-500 block">
                                IP: {log.ip || "197.218.12.82 (Maputo, MZ)"} | Ses: erp-pos-3000
                              </span>
                            </div>
                          </div>

                          {/* GEOLOCATION & ACCESS MAP FOR LOGIN/SECURITY LOGS */}
                          {(() => {
                            const isLoginOrSecurityLog =
                              log.module?.toLowerCase().includes("segurança") ||
                              log.module?.toLowerCase().includes("autenticação") ||
                              log.action?.toLowerCase().includes("login") ||
                              log.action?.toLowerCase().includes("logout") ||
                              log.action?.toLowerCase().includes("recuperação") ||
                              log.action?.toLowerCase().includes("acesso") ||
                              log.details?.toLowerCase().includes("login") ||
                              log.details?.toLowerCase().includes("sessão");
                            if (isLoginOrSecurityLog) {
                              return <AuditLogLocationMap log={log} />;
                            }
                            return null;
                          })()}

                          {/* Stack trace / detailed log visualization */}
                          <div className="bg-slate-900 text-slate-300 p-3 rounded-xl border border-slate-800 font-mono text-[10px] space-y-2 relative overflow-hidden">
                            <div className="flex justify-between items-center text-[9px] text-slate-500 border-b border-slate-800 pb-1.5 mb-1.5">
                              <span>CONSOLE_LOG_METADATA_TRACE</span>
                              {currentRole === "ADMIN" && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                                    alert(
                                      "Detalhes técnicos de segurança copiados com sucesso!"
                                    );
                                  }}
                                  className="hover:text-white flex items-center gap-1 cursor-pointer bg-slate-800 px-2 py-0.5 rounded text-[8.5px] font-sans border border-slate-700 hover:border-slate-550 transition"
                                >
                                  <Copy className="w-3 h-3" />
                                  Copiar Traceback Técnico
                                </button>
                              )}
                            </div>
                            <div className="leading-relaxed">
                              <p>Dispositivo / Navegador: {log.device || "Desktop (Chrome)"}</p>
                              <p className="mt-1">
                                Base de Dados: Supabase PostgreSQL (Oficial)
                              </p>
                              <p className="mt-1 text-slate-400">
                                Timestamp ISO: {log.timestamp}
                              </p>
                              <p className="mt-2 text-rose-400 font-bold">
                                Traceback: {log.details}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
