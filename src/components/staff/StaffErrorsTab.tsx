import React from "react";
import { Activity, AlertTriangle, Clock, ChevronRight, ChevronDown, Copy } from "lucide-react";
import { AuditLog } from "../../types";

interface StaffErrorsTabProps {
  systemErrors: AuditLog[];
  isDiagnosing: boolean;
  onRunDiagnostics: () => Promise<void>;
  onSimulateFailure: () => Promise<void>;
  diagnosticResult: {
    server: "ok" | "failed" | null;
    db: "ok" | "failed" | null;
    time: string | null;
  };
  expandedErrorLogId: string | null;
  setExpandedErrorLogId: (id: string | null) => void;
}

export const StaffErrorsTab: React.FC<StaffErrorsTabProps> = ({
  systemErrors,
  isDiagnosing,
  onRunDiagnostics,
  onSimulateFailure,
  diagnosticResult,
  expandedErrorLogId,
  setExpandedErrorLogId,
}) => {
  return (
    <div className="space-y-6">
      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: CONNECTIVITY */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              navigator.onLine ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600 animate-pulse"
            }`}
          >
            <Activity className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block font-mono">
              Conectividade de Rede
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  navigator.onLine ? "bg-emerald-500 animate-pulse" : "bg-red-500 animate-pulse"
                }`}
              ></span>
              <span className="text-sm font-extrabold text-slate-800">
                {navigator.onLine ? "Dispositivo Online" : "Dispositivo Offline"}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
              {navigator.onLine
                ? "Sincronização com Base de Dados ativa"
                : "Operando com Cache e Banco Local Offline"}
            </span>
          </div>
        </div>

        {/* CARD 2: TOTAL FAILURES */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              systemErrors.length === 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block font-mono">
              Total de Erros Capturados
            </span>
            <span className="text-xl font-black text-slate-800 block mt-0.5">
              {systemErrors.length}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {systemErrors.length === 0
                ? "Nenhuma anomalia crítica registrada"
                : "Requer atenção do administrador"}
            </span>
          </div>
        </div>

        {/* CARD 3: LAST DETECTED */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 text-slate-500">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block font-mono">
              Último Incidente
            </span>
            <span className="text-xs font-bold text-slate-700 block mt-1.5 truncate">
              {systemErrors.length > 0
                ? new Date(systemErrors[0].timestamp).toLocaleString()
                : "Nenhum erro registrado"}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Monitoramento contínuo em tempo real
            </span>
          </div>
        </div>
      </div>

      {/* DIAGNOSTIC TOOLS BOX */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="border-b pb-3 border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-extrabold text-slate-900 text-sm">Ferramentas de Diagnóstico do Sistema</h4>
            <p className="text-[10px] text-slate-400">Verifique a saúde de suas conexões e APIs em tempo real</p>
          </div>
          <span className="bg-orange-50 border border-orange-100 text-orange-700 text-[10px] font-bold px-2.5 py-1 rounded-lg">
            Painel do Administrador
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* DIAGNOSTIC ACTIONS */}
          <div className="space-y-3 lg:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block mb-2">Acções Disponíveis</span>

            <button
              onClick={onRunDiagnostics}
              disabled={isDiagnosing}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50 shadow-sm"
            >
              {isDiagnosing ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              )}
              {isDiagnosing ? "Executando..." : "Executar Autodiagnóstico"}
            </button>

            <button
              onClick={onSimulateFailure}
              className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Simular Falha de API (404)
            </button>
          </div>

          {/* DIAGNOSTIC RESULT STATUS */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 lg:col-span-2 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block mb-3">
                Status de Autodiagnóstico
              </span>
              {diagnosticResult.time ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-slate-200/60 flex flex-col justify-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">
                      Servidor Backend API
                    </span>
                    <span
                      className={`text-xs font-bold mt-1.5 flex items-center gap-1.5 ${
                        diagnosticResult.server === "ok" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          diagnosticResult.server === "ok" ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                        }`}
                      ></span>
                      {diagnosticResult.server === "ok" ? "Conectado (200 OK)" : "Inacessível / Offline"}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200/60 flex flex-col justify-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">
                      Banco de Dados PostgreSQL
                    </span>
                    <span
                      className={`text-xs font-bold mt-1.5 flex items-center gap-1.5 ${
                        diagnosticResult.db === "ok" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          diagnosticResult.db === "ok" ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                        }`}
                      ></span>
                      {diagnosticResult.db === "ok" ? "Conexão Ativa" : "Falha na resposta de sincronização"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 italic text-xs font-medium">
                  Execute o autodiagnóstico para testar o status de comunicação da API e banco de dados.
                </div>
              )}
            </div>

            {diagnosticResult.time && (
              <div className="text-[10px] text-slate-400 text-right mt-3 font-mono">
                Último teste executado às {diagnosticResult.time}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LOGS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">Relatório de Eventos de Incidente</span>
          <span className="text-[10px] font-bold text-slate-400 font-mono">EXCLUSIVO DO GESTOR</span>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto text-[11.5px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[9px] font-mono">
                <th className="p-3 w-6"></th>
                <th className="p-3.5 w-40">DATA / HORA</th>
                <th className="p-3.5">OPERADOR</th>
                <th className="p-3.5">EVENTO</th>
                <th className="p-3.5">MENSAGEM DE ERRO DETALHADA</th>
                <th className="p-3.5 text-center w-28">SEVERIDADE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px] leading-relaxed text-slate-700">
              {systemErrors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic font-sans text-xs">
                    Excelente! Nenhum erro de rede ou falha de API detectada no sistema.
                  </td>
                </tr>
              ) : (
                systemErrors.map((log, index) => {
                  const isExpanded = expandedErrorLogId === log.id;
                  return (
                    <React.Fragment key={`${log.id || "err"}-${index}`}>
                      <tr
                        onClick={() => setExpandedErrorLogId(isExpanded ? null : log.id)}
                        className={`hover:bg-slate-50/50 cursor-pointer transition border-l-4 ${
                          log.action.includes("REDE") ||
                          log.action.includes("Rede") ||
                          log.action.includes("FALHA_REDE")
                            ? "border-l-rose-500 hover:bg-rose-50/10"
                            : "border-l-amber-500 hover:bg-amber-50/10"
                        } ${isExpanded ? "bg-slate-50/50" : ""}`}
                      >
                        <td className="p-3 text-center text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="p-3 text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 text-slate-700 font-bold font-sans">
                          {log.user || "Sistema"}
                        </td>
                        <td className="p-3 font-semibold font-sans text-slate-800">
                          <span className="flex items-center gap-1.5 text-rose-600">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] font-sans text-slate-550 max-w-md truncate">
                          {log.details}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold font-sans border text-red-700 bg-red-50 border-red-100">
                            CRÍTICO
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/40">
                          <td
                            colSpan={6}
                            className="p-4 border-l-4 border-l-rose-500 font-sans text-xs text-slate-600 space-y-3"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-slate-700">
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">
                                  Origem / Rota
                                </span>
                                <span className="font-mono text-slate-800 block text-[11px] break-all">
                                  {log.details.match(/https?:\/\/[^\s]+/)?.[0] || "API interna / PostgreSQL"}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">
                                  Identificador Único
                                </span>
                                <span className="font-mono text-[10px] text-slate-500 block">
                                  {log.id || "N/A"}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">
                                  Função do Operador
                                </span>
                                <span className="font-mono text-slate-500 block">
                                  {log.userRole || "ADMIN"}
                                </span>
                              </div>
                            </div>

                            <div className="bg-slate-950 text-slate-300 p-3.5 rounded-xl border border-slate-800 font-mono text-[10px] space-y-2">
                              <div className="flex justify-between items-center text-[9px] text-slate-500 border-b border-slate-800 pb-1.5 mb-1.5">
                                <span>TECHNICAL_ERROR_METADATA_TRACE</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                                    alert("Detalhes técnicos copiados!");
                                  }}
                                  className="hover:text-white flex items-center gap-1 cursor-pointer bg-slate-800 px-2 py-0.5 rounded text-[8.5px] font-sans border border-slate-700 transition"
                                >
                                  <Copy className="w-3 h-3" />
                                  Copiar Erro Técnico
                                </button>
                              </div>
                              <div className="space-y-1 text-slate-400 font-mono text-[10px] leading-relaxed break-all">
                                <p>Detalhes: {log.details}</p>
                                <p className="mt-1">Timestamp: {log.timestamp}</p>
                                <p className="mt-1">User Agent: {navigator.userAgent}</p>
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
    </div>
  );
};
