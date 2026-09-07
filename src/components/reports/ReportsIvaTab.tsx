import React from "react";
import { Percent, Clock, Calculator, CheckCircle, Download, FileText } from "lucide-react";
import { Transaction } from "../../types";

export interface ReportVatRowProps {
  transaction: Transaction;
  formatMZ: (val: number) => string;
}

export const ReportVatRow = React.memo(({
  transaction,
  formatMZ
}: ReportVatRowProps) => {
  return (
    <tr className="hover:bg-slate-50/50 transition">
      <td className="p-3 font-bold font-mono text-slate-800">{transaction.invoiceNumber}</td>
      <td className="p-3 text-[11px] whitespace-nowrap">{new Date(transaction.timestamp).toLocaleString()}</td>
      <td className="p-3 font-semibold text-slate-700">{transaction.customerName || "Consumidor Geral"}</td>
      <td className="p-3 text-right font-mono font-medium text-slate-600">{formatMZ(transaction.subtotal)}</td>
      <td className="p-3 text-center font-bold">
        <span className={`px-2 py-0.5 rounded text-[10px] ${
          transaction.vatTotal > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
        }`}>
          {transaction.vatTotal > 0 ? "16%" : "0% (Isento)"}
        </span>
      </td>
      <td className="p-3 text-right font-mono font-medium text-slate-800">{formatMZ(transaction.vatTotal)}</td>
      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatMZ(transaction.grandTotal)}</td>
    </tr>
  );
});
ReportVatRow.displayName = "ReportVatRow";

export interface VatCalculations {
  taxableSalesSubtotal: number;
  exemptSalesSubtotal: number;
  realVatCollected: number;
  simulatedVatCollected: number;
  netVatPayable: number;
}

export interface ReportsIvaTabProps {
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  manualIvaDeduction: number;
  setManualIvaDeduction: (n: number) => void;
  simulatedIvaRate: number;
  setSimulatedIvaRate: (n: number) => void;
  financialTotals: {
    salesTotal: number;
    subtotalTotal: number;
    discountTotal: number;
    vatTotal: number;
  };
  vatCalculations: VatCalculations;
  filteredTransactions: Transaction[];
  vatFilterClass: "all" | "taxable" | "exempt";
  setVatFilterClass: (f: "all" | "taxable" | "exempt") => void;
  exportMessage: string | null;
  isExporting: boolean;
  onExportIvaPdf: () => void;
  onExportIvaCsv: () => void;
  formatMZ: (val: number) => string;
}

export const ReportsIvaTab: React.FC<ReportsIvaTabProps> = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  manualIvaDeduction,
  setManualIvaDeduction,
  simulatedIvaRate,
  setSimulatedIvaRate,
  financialTotals,
  vatCalculations,
  filteredTransactions,
  vatFilterClass,
  setVatFilterClass,
  exportMessage,
  isExporting,
  onExportIvaPdf,
  onExportIvaCsv,
  formatMZ
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 text-slate-950 p-2.5 rounded-xl shrink-0">
            <Percent className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base">Calculadora & Declaração de IVA</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Apuração automatizada e cálculo periódico do Imposto sobre Valor Acrescentado (IVA) de Moçambique (16%).
            </p>
          </div>
        </div>
      </div>

      {/* Date and Input Config Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Date Picker */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4 text-orange-500" />
            Intervalo de Apuração
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Data Inicial</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-650 font-semibold outline-none focus:ring-1 focus:ring-orange-400/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Data Final</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-650 font-semibold outline-none focus:ring-1 focus:ring-orange-400/50"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Modifique as datas para recalcular instantaneamente os valores agregados das faturas.
          </p>
        </div>

        {/* Input VAT / Manual Deductions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
            <Calculator className="w-4 h-4 text-blue-500" />
            Deduções de IVA (Compras/Custos)
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">IVA Dedutível Suportado (MT)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">MT</span>
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={manualIvaDeduction || ""}
                onChange={(e) => setManualIvaDeduction(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-800 font-semibold font-mono outline-none focus:ring-1 focus:ring-blue-400/50"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Insira o IVA total pago em facturas de compras a fornecedores para compensar contra o IVA retido das vendas.
          </p>
        </div>

        {/* Simulated Rate Selector */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
            <Percent className="w-4 h-4 text-emerald-500" />
            Simulação de Alíquota Diferencial
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
              <span>Alíquota do Simulador:</span>
              <span className="text-emerald-600 font-mono text-xs">{simulatedIvaRate}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={simulatedIvaRate}
              onChange={(e) => setSimulatedIvaRate(parseInt(e.target.value) || 0)}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Alíquota oficial de Moçambique: 16%. Ajuste o slider para simular o imposto arrecadado com alíquotas diferentes.
          </p>
        </div>
      </div>

      {/* IVA Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4.5">
        {/* Brut Sales */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Faturamento Bruto</span>
          <h4 className="text-lg font-mono font-bold text-slate-800 mt-1">{formatMZ(financialTotals.salesTotal)}</h4>
          <span className="text-[10px] text-slate-400 mt-0.5 block">{filteredTransactions.length} faturas faturadas</span>
        </div>

        {/* Output VAT Collected */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">IVA Liquidado (Vendas)</span>
          <h4 className="text-lg font-mono font-bold text-slate-800 mt-1">{formatMZ(vatCalculations.realVatCollected)}</h4>
          <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full inline-block mt-1 leading-none text-[9px]">Taxa Aplicada de 16%</span>
        </div>

        {/* Input VAT Deductible */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">IVA Dedutível (Compras)</span>
          <h4 className="text-lg font-mono font-bold text-slate-800 mt-1">{formatMZ(manualIvaDeduction)}</h4>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Crédito fiscal dedutível</span>
        </div>

        {/* Net VAT Balance Payable/Refundable */}
        <div className={`p-4.5 rounded-2xl border ${
          vatCalculations.netVatPayable >= 0 
            ? "bg-red-50/50 border-red-200 text-red-900" 
            : "bg-emerald-50/50 border-emerald-200 text-emerald-900"
        }`}>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Saldo Final (IVA Net)</span>
          <h4 className="text-lg font-mono font-bold mt-1">
            {vatCalculations.netVatPayable >= 0 ? "+" : "-"}
            {formatMZ(Math.abs(vatCalculations.netVatPayable))}
          </h4>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-1 leading-none text-[9px] ${
            vatCalculations.netVatPayable >= 0 
              ? "bg-red-100 text-red-800" 
              : "bg-emerald-100 text-emerald-800"
          }`}>
            {vatCalculations.netVatPayable >= 0 ? "Imposto a Pagar ao Estado" : "Crédito Fiscal a Recuperar"}
          </span>
        </div>
      </div>

      {/* Grid Layout: Left (Detailed Official Sheet), Right (Simulations, Controls, Exports) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT Column: Detailed Sheet (occupies 2 cols) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Resumo da Apuração de IVA (Modelo Oficial)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Balancete simulado em conformidade com o regulamento do IVA de Moçambique.</p>
          </div>

          {/* Sheet Table */}
          <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
            {/* Headers */}
            <div className="grid grid-cols-3 bg-slate-100 p-3 font-bold text-slate-700 border-b border-slate-200">
              <div className="col-span-2">Rubricas de Apuração e Base Legal</div>
              <div className="text-right">Montante Consolidado</div>
            </div>

            {/* Line 1 */}
            <div className="grid grid-cols-3 p-3 text-slate-600 border-b border-slate-100 font-sans hover:bg-slate-50 transition">
              <div className="col-span-2 flex gap-2">
                <span className="font-bold text-slate-400 font-mono">01.</span>
                <span>Total de Vendas / Faturamento Bruto Comercial</span>
              </div>
              <div className="text-right font-mono font-semibold text-slate-800">{formatMZ(financialTotals.salesTotal)}</div>
            </div>

            {/* Line 2 */}
            <div className="grid grid-cols-3 p-3 text-slate-600 border-b border-slate-100 font-sans hover:bg-slate-50 transition">
              <div className="col-span-2 flex gap-2">
                <span className="font-bold text-slate-400 font-mono">02.</span>
                <span>Base Tributável de Vendas (Sujeitas a IVA à taxa normal)</span>
              </div>
              <div className="text-right font-mono font-semibold text-slate-800">{formatMZ(vatCalculations.taxableSalesSubtotal)}</div>
            </div>

            {/* Line 3 */}
            <div className="grid grid-cols-3 p-3 text-slate-600 border-b border-slate-100 font-sans hover:bg-slate-50 transition">
              <div className="col-span-2 flex gap-2">
                <span className="font-bold text-slate-400 font-mono">03.</span>
                <span>Operações Isentas ou Não Sujeitas (IVA 0%)</span>
              </div>
              <div className="text-right font-mono font-semibold text-slate-800">{formatMZ(vatCalculations.exemptSalesSubtotal)}</div>
            </div>

            {/* Line 4 */}
            <div className="grid grid-cols-3 p-3 text-slate-600 border-b border-slate-100 font-sans hover:bg-slate-50 transition">
              <div className="col-span-2 flex gap-2">
                <span className="font-bold text-slate-400 font-mono">04.</span>
                <span>IVA Liquidado (Imposto retido nas vendas a taxa de 16%)</span>
              </div>
              <div className="text-right font-mono font-extrabold text-slate-800">{formatMZ(vatCalculations.realVatCollected)}</div>
            </div>

            {/* Line 5 */}
            <div className="grid grid-cols-3 p-3 text-slate-600 border-b border-slate-100 font-sans hover:bg-slate-50 transition">
              <div className="col-span-2 flex gap-2">
                <span className="font-bold text-slate-400 font-mono">05.</span>
                <span>IVA Dedutível Autorizado (Suportado nas compras declaradas)</span>
              </div>
              <div className="text-right font-mono font-extrabold text-blue-600">-{formatMZ(manualIvaDeduction)}</div>
            </div>

            {/* Saldo Final */}
            <div className={`grid grid-cols-3 p-3.5 font-bold text-xs ${
              vatCalculations.netVatPayable >= 0 ? "bg-red-50 text-red-950" : "bg-emerald-50 text-emerald-950"
            }`}>
              <div className="col-span-2 flex gap-2 items-center">
                <span className="font-mono text-slate-500">06.</span>
                <span>
                  {vatCalculations.netVatPayable >= 0 
                    ? "IMPOSTO LÍQUIDO A ENTREGAR AO ESTADO" 
                    : "CRÉDITO FISCAL DE IVA A RECUPERAR / REPORTAR"}
                </span>
              </div>
              <div className="text-right font-mono font-extrabold text-sm">
                {formatMZ(Math.abs(vatCalculations.netVatPayable))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT Column: Exports & Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Resumos Exportáveis & Ações</h3>
              <p className="text-xs text-slate-400 mt-0.5">Gere relatórios certificados de auditoria de impostos de forma segura.</p>
            </div>

            {/* Simulated Rate Stats Card if slider adjusted */}
            {simulatedIvaRate !== 16 && (
              <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 text-xs space-y-1">
                <span className="text-[9px] font-bold text-emerald-700 uppercase block tracking-wider">Cenário de Simulação Diferencial</span>
                <p className="text-slate-600 text-[11px] leading-snug">
                  Se a alíquota de IVA fosse <span className="font-bold">{simulatedIvaRate}%</span>, o IVA coletado seria de <span className="font-bold">{formatMZ(vatCalculations.simulatedVatCollected)}</span> (diferença de <span className="font-bold">{formatMZ(vatCalculations.simulatedVatCollected - vatCalculations.realVatCollected)}</span>).
                </p>
              </div>
            )}

            <div className="bg-slate-50 p-3.5 rounded-xl border space-y-2 text-[11px] text-slate-500 leading-snug">
              <div className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Período fiscal fechado localmente e pronto para exportação.</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Compatível com as finanças de Moçambique.</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3">
            {exportMessage && (
              <p className="bg-green-50 border border-green-200 text-green-700 text-xs p-2.5 rounded-lg font-bold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-green-700 shrink-0" />
                {exportMessage}
              </p>
            )}

            <button
              id="btn-export-iva-pdf"
              type="button"
              onClick={onExportIvaPdf}
              disabled={isExporting}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-lg shadow-slate-950/15"
            >
              <Download className="w-4 h-4 text-orange-400 shrink-0" />
              {isExporting ? "A processar..." : "Descarregar Declaração IVA Oficial (PDF)"}
            </button>

            <button
              id="btn-export-iva-csv"
              type="button"
              onClick={onExportIvaCsv}
              disabled={isExporting}
              className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
            >
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              Descarregar Ficheiro de Apoio (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Transactions list inside IVA tab */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-3.5 items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-800">Transações Auditadas no Período ({filteredTransactions.length} registros)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Exibindo detalhes fiscais de faturas emitidas de {startDate} até {endDate}</p>
          </div>

          {/* Class filters */}
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold border">
            <button
              type="button"
              onClick={() => setVatFilterClass("all")}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition ${vatFilterClass === "all" ? "bg-white text-slate-900 shadow-sm border" : "text-slate-500"}`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setVatFilterClass("taxable")}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition ${vatFilterClass === "taxable" ? "bg-white text-slate-900 shadow-sm border" : "text-slate-500"}`}
            >
              Tributadas (16%)
            </button>
            <button
              type="button"
              onClick={() => setVatFilterClass("exempt")}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition ${vatFilterClass === "exempt" ? "bg-white text-slate-900 shadow-sm border" : "text-slate-500"}`}
            >
              Isentas (0%)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full min-w-[800px] text-left text-slate-650 text-xs font-sans">
            <thead>
              <tr className="bg-slate-100 uppercase text-[10px] font-bold text-slate-500 tracking-wider">
                <th className="p-3">Fatura</th>
                <th className="p-3">Data</th>
                <th className="p-3">Cliente</th>
                <th className="p-3 text-right">Base Tributável (Subtotal)</th>
                <th className="p-3 text-center">Alíquota</th>
                <th className="p-3 text-right">IVA Coletado</th>
                <th className="p-3 text-right">Valor Total Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-sans">
              {filteredTransactions
                .filter(t => {
                  if (vatFilterClass === "taxable") return t.vatTotal > 0;
                  if (vatFilterClass === "exempt") return t.vatTotal === 0;
                  return true;
                })
                .length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic font-sans">
                    Nenhuma transação correspondente a este filtro de classe de IVA neste período.
                  </td>
                </tr>
              ) : (
                filteredTransactions
                  .filter(t => {
                  if (vatFilterClass === "taxable") return t.vatTotal > 0;
                  if (vatFilterClass === "exempt") return t.vatTotal === 0;
                  return true;
                })
                  .slice(0, 15)
                  .map((t) => (
                    <ReportVatRow key={t.id} transaction={t} formatMZ={formatMZ} />
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
