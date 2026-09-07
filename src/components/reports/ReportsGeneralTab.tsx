import React from "react";
import {
  TrendingUp,
  Calculator,
  DollarSign,
  FileText,
  Activity,
  Download,
  Calendar,
  Printer,
  Mail,
  Clock,
  Play,
  CheckCircle
} from "lucide-react";
import { Transaction, SystemSettings } from "../../types";
import { MonthlyStats } from "./ReportsMonthlyModal";
import { ReportTransactionTable } from "./ReportTransactionTable";

export interface ReportsGeneralTabProps {
  financialTotals: {
    salesTotal: number;
    subtotalTotal: number;
    discountTotal: number;
    vatTotal: number;
    profitTotal: number;
  };
  filteredTransactions: Transaction[];
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  reportType: "SALES" | "FINANCE" | "VAT";
  setReportType: (t: "SALES" | "FINANCE" | "VAT") => void;
  exportFormat: "PDF" | "EXCEL" | "CSV";
  setExportFormat: (f: "PDF" | "EXCEL" | "CSV") => void;
  exportMessage: string;
  setExportMessage: (msg: string) => void;
  isExporting: boolean;
  setIsExporting: (exp: boolean) => void;
  monthlyStats: MonthlyStats;
  setShowMonthlySummaryModal: (show: boolean) => void;
  onExportMonthlySummaryPDF: () => void;
  onPerformExport: () => void;
  onExportSalesSummaryPDF: () => void;
  onExportDailyFinancialSummaryPDF: () => void;
  onPerformExecutivePrintPDF: () => void;
  localError: string;
  recipientEmail: string;
  setRecipientEmail: (email: string) => void;
  reportHour: string;
  setReportHour: (hour: string) => void;
  reportFrequency: "daily" | "weekly";
  setReportFrequency: (freq: "daily" | "weekly") => void;
  saveSettingsSuccess: boolean;
  onSaveEmailConfig: (e: React.FormEvent) => void;
  testSendStatus: "idle" | "sending" | "sent";
  onTriggerTestEmail: () => void;
  currency: string;
  settings: SystemSettings;
  formatMZ: (val: number) => string;
  onOpenEmail: (t: Transaction) => void;
  onOpenPrint: (t: Transaction) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
}

export const ReportsGeneralTab: React.FC<ReportsGeneralTabProps> = ({
  financialTotals,
  filteredTransactions,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  reportType,
  setReportType,
  exportFormat,
  setExportFormat,
  exportMessage,
  setExportMessage,
  isExporting,
  setIsExporting,
  monthlyStats,
  setShowMonthlySummaryModal,
  onExportMonthlySummaryPDF,
  onPerformExport,
  onExportSalesSummaryPDF,
  onExportDailyFinancialSummaryPDF,
  onPerformExecutivePrintPDF,
  localError,
  recipientEmail,
  setRecipientEmail,
  reportHour,
  setReportHour,
  reportFrequency,
  setReportFrequency,
  saveSettingsSuccess,
  onSaveEmailConfig,
  testSendStatus,
  onTriggerTestEmail,
  currency,
  settings,
  formatMZ,
  onOpenEmail,
  onOpenPrint,
  onAddAuditLog
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
        {/* Sales Card mini */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Faturação Coletada (Acumulada)</span>
            <h4 className="text-xl font-mono font-bold text-slate-800 mt-1">{formatMZ(financialTotals.salesTotal)}</h4>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{filteredTransactions.length} vendas registradas no período</span>
          </div>
          <div className="bg-orange-50 text-orange-600 p-2.5 rounded-xl text-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* VAT Tax collection widget */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Imposto IVA Acumulado</span>
            <h4 className="text-xl font-mono font-bold text-slate-800 mt-1">{formatMZ(financialTotals.vatTotal)}</h4>
            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full inline-block mt-1 leading-none">IVA Oficial 16%</span>
          </div>
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl text-center">
            <Calculator className="w-5 h-5" />
          </div>
        </div>

        {/* Profits metrics */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lucro Líquido Sazonal</span>
            <h4 className="text-xl font-mono font-bold text-emerald-700 mt-1">+{formatMZ(financialTotals.profitTotal)}</h4>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Lucro com base em margens operacionais</span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl text-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid: Left - Manual Query & Exports, Right - Automatic email scheduler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT COLUMN: Manual Report compilers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[480px] space-y-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Gerador Manual de Relatórios Fiscais</h3>
              <p className="text-xs text-slate-400 mt-0.5">Selecione o intervalo de datas e o formato de exportação.</p>
            </div>

            {/* Date filter inputs */}
            <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-3 rounded-xl border">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Data Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-650 font-semibold outline-none focus:ring-1 focus:ring-orange-400/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-650 font-semibold outline-none focus:ring-1 focus:ring-orange-400/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl text-xs font-bold border">
              <button 
                type="button"
                onClick={() => setReportType("SALES")}
                className={`py-2 rounded-lg cursor-pointer transition ${reportType === "SALES" ? "bg-white text-slate-900 shadow-sm border" : "text-slate-500"}`}
              >
                Relatório de Vendas
              </button>
              <button 
                type="button"
                onClick={() => setReportType("FINANCE")}
                className={`py-2 rounded-lg cursor-pointer transition ${reportType === "FINANCE" ? "bg-white text-slate-900 shadow-sm border py-2" : "text-slate-500"}`}
              >
                Relatório Financeiro
              </button>
              <button 
                type="button"
                onClick={() => setReportType("VAT")}
                className={`py-2 rounded-lg cursor-pointer transition ${reportType === "VAT" ? "bg-white text-slate-900 shadow-sm border py-2" : "text-slate-500"}`}
              >
                Balanço de IVA
              </button>
            </div>

            <div className="flex items-center gap-4.5 justify-between py-2 text-xs text-slate-650">
              <span>Selecione Formato Digital para Exportar:</span>
              <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-bold font-mono">
                {(["PDF", "EXCEL", "CSV"] as const).map(format => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setExportFormat(format)}
                    className={`px-3 py-1 rounded-md cursor-pointer ${exportFormat === format ? "bg-slate-900 text-white shadow" : "text-slate-500"}`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border flex flex-col gap-1 text-[11px] text-slate-500 leading-relaxed max-h-36 overflow-y-auto">
              {reportType === "SALES" && (
                <p>O Relatório de Vendas consolidação inclui: faturas geradas, faturamento bruto em Meticais (MT), cupons aplicados de desconto e divisão por utilizador (caixa).</p>
              )}
              {reportType === "FINANCE" && (
                <p>O Relatório Financeiro compila receitas de mercadoria versus despesas registadas no fluxo de caixa da empresa, com estimativa líquida de lucros fiscais.</p>
              )}
              {reportType === "VAT" && (
                <p>O Relatório de Imposto IVA reúne todas as taxas isentas fiscais, taxas padrão acumuladas de 16% de Moçambique, e faturas parametrizadas para submissão das declarações.</p>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-3.5 border-t border-slate-100">
            {exportMessage && (
              <p className="bg-green-50 border border-green-200 text-green-700 text-xs p-2.5 rounded-lg font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-700 shrink-0" />
                {exportMessage}
              </p>
            )}

            <button
              type="button"
              id="btn-generate-monthly-summary"
              onClick={() => setShowMonthlySummaryModal(true)}
              className="w-full py-3.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-md shadow-orange-500/20 hover:shadow-orange-500/35 transition-all duration-250 active:scale-[0.98]"
            >
              <Activity className="w-4.5 h-4.5 text-white shrink-0" />
              Visualizar Resumo Mensal ({monthlyStats.monthName})
            </button>

            <button
              type="button"
              id="btn-export-monthly-pdf"
              onClick={onExportMonthlySummaryPDF}
              disabled={isExporting}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-250 hover:bg-slate-50 text-slate-700 bg-white transition-all shadow-sm ${
                isExporting ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"
              }`}
            >
              <Download className="w-4 h-4 text-amber-500 shrink-0" />
              {isExporting ? "Exportando PDF Mensal..." : `Exportar Resumo Financeiro Mensal (PDF - ${monthlyStats.monthName})`}
            </button>

            <button
              onClick={onPerformExport}
              disabled={isExporting}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all ${
                isExporting 
                  ? "bg-slate-200 text-slate-400" 
                  : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10"
              }`}
            >
              <Download className="w-4 h-4 shrink-0" />
              {isExporting ? "Gerando Ficheiro e compilando bases de dados..." : `Gerar e Descarregar Relatório em ${exportFormat}`}
            </button>

            <button
              type="button"
              onClick={onExportSalesSummaryPDF}
              disabled={isExporting}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-250 hover:bg-slate-50 text-slate-700 bg-white transition-all shadow-sm ${
                isExporting ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
              Exportar Sumário de Vendas do Período (PDF)
            </button>

            <button
              type="button"
              onClick={onExportDailyFinancialSummaryPDF}
              disabled={isExporting}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-250 hover:bg-slate-50 text-slate-700 bg-white transition-all shadow-sm ${
                isExporting ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"
              }`}
            >
              <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
              Exportar Resumo Financeiro Diário (A4 PDF)
            </button>

            <button
              type="button"
              onClick={onPerformExecutivePrintPDF}
              disabled={isExporting}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-250 hover:bg-slate-50 text-slate-700 bg-white transition-all shadow-sm ${
                isExporting ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"
              }`}
            >
              <Printer className="w-4 h-4 text-orange-500 shrink-0" />
              Imprimir Resumo Financeiro Executivo (A4 PDF)
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Automatic email setup scheduler */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-[420px] flex flex-col justify-between">
          <form onSubmit={onSaveEmailConfig} className="space-y-4">
            {localError && (
              <div className="bg-red-500/10 text-red-400 p-2.5 rounded-lg text-xs font-semibold border border-red-500/20">
                {localError}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1 text-orange-600">
                <Mail className="w-4.5 h-4.5" />
                <h3 className="font-bold text-slate-800 text-sm">Relatórios Automáticos por Email (SMTP/Robô)</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Venda o sistema para as empresas configurando o e-mail de destino do administrador.</p>
            </div>

            <div className="space-y-3 md:text-xs">
              {/* Recipient Address */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">E-mail Destinatário Administrativo *</label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold text-slate-750 outline-none text-xs"
                  placeholder="Ex: levidomingos12@gmail.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Send Hour */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Horário de Envio Automático</label>
                  <div className="relative">
                    <Clock className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                    <select
                      value={reportHour}
                      onChange={(e) => setReportHour(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-2 font-semibold cursor-pointer outline-none text-slate-650 text-xs"
                    >
                      <option value="02:00">02h00 (Padrão sugerido)</option>
                      <option value="18:00">18h00 (Fecho operacional)</option>
                      <option value="20:00">20h00</option>
                      <option value="22:00">22h00</option>
                    </select>
                  </div>
                </div>

                {/* Send Frequency */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Frequência do Robô</label>
                  <select
                    value={reportFrequency}
                    onChange={(e) => setReportFrequency(e.target.value as "daily" | "weekly")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold cursor-pointer outline-none text-xs"
                  >
                    <option value="daily">Todos os Dias (Diário)</option>
                    <option value="weekly">Semanalmente (Sábados às 02h00)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-slate-100 hover:bg-slate-250 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition border border-slate-200"
            >
              {saveSettingsSuccess ? "Definições de Email Gravadas ✓" : "Salvar Configuração SMTP de Relatórios"}
            </button>
          </form>

          {/* Test Action Trigger Area */}
          <div className="p-3.5 bg-orange-50/50 rounded-xl border border-orange-100 flex items-center justify-between gap-3.5 mt-2 text-xs text-slate-500">
            <div className="max-w-[200px]">
              <span className="text-[9.5px] font-extrabold text-orange-800 uppercase tracking-widest font-mono">Disparador de Piloto</span>
              <p className="text-[10.5px] mt-0.5 leading-tight">Quer receber as estatísticas correntes do OST Vendas agora?</p>
            </div>

            {testSendStatus === "idle" ? (
              <button
                type="button"
                onClick={onTriggerTestEmail}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Play className="w-3.5 h-3.5 shrink-0" />
                Testar Envio PDF
              </button>
            ) : testSendStatus === "sending" ? (
              <div className="text-xs font-bold text-orange-600 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></span>
                A Disparar...
              </div>
            ) : (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-2 rounded-lg text-[10px] leading-snug font-bold">
                ✓ Despachado! Verifique a sua caixa {recipientEmail}!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visual Table Segment */}
      <ReportTransactionTable
        filteredTransactions={filteredTransactions}
        startDate={startDate}
        endDate={endDate}
        currency={currency}
        financialTotals={financialTotals}
        settings={settings}
        formatMZ={formatMZ}
        onOpenEmail={onOpenEmail}
        onOpenPrint={onOpenPrint}
        onAddAuditLog={onAddAuditLog}
        setExportMessage={setExportMessage}
        setIsExporting={setIsExporting}
        setExportFormat={setExportFormat}
      />
    </div>
  );
};
