import React from "react";
import { Download, FileText, Mail, Printer } from "lucide-react";
import { Transaction, SystemSettings } from "../../types";
import { getBase64ImageFromUrl, getFormatFromBase64 } from "./reportsExportHelper";

export interface ReportTransactionRowProps {
  transaction: Transaction;
  currency: string;
  onOpenEmail: (t: Transaction) => void;
  onOpenPrint: (t: Transaction) => void;
  formatMZ: (val: number) => string;
}

export const ReportTransactionRow = React.memo(({
  transaction,
  currency,
  onOpenEmail,
  onOpenPrint,
  formatMZ
}: ReportTransactionRowProps) => {
  return (
    <tr className="hover:bg-slate-50/50 transition">
      <td className="p-3 font-bold font-mono text-slate-800">{transaction.invoiceNumber}</td>
      <td className="p-3 text-[11px] whitespace-nowrap">{new Date(transaction.timestamp).toLocaleString()}</td>
      <td className="p-3 font-semibold text-slate-700">{transaction.customerName || "Consumidor Geral"}</td>
      <td className="p-3">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
          transaction.paymentMethod === "CASH" ? "bg-amber-50 text-amber-700" :
          (transaction.paymentMethod as string) === "MPESA_PAGA_FACIL" || (transaction.paymentMethod as string) === "M-PESA" ? "bg-red-50 text-red-600" :
          "bg-sky-50 text-sky-700"
        }`}>{transaction.paymentMethod}</span>
      </td>
      <td className="p-3 text-right font-mono font-medium text-slate-600">{formatMZ(transaction.subtotal)}</td>
      <td className="p-3 text-right font-mono text-red-500 font-medium">-{formatMZ(transaction.discountTotal)}</td>
      <td className="p-3 text-right font-mono text-slate-500 font-medium">{formatMZ(transaction.vatTotal)}</td>
      <td className="p-3 text-right font-mono font-bold text-slate-800">{formatMZ(transaction.grandTotal)}</td>
      <td className="p-3 text-center flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onOpenEmail(transaction)}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg inline-flex items-center justify-center transition cursor-pointer"
          title="Enviar Fatura por E-mail"
        >
          <Mail className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenPrint(transaction)}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg inline-flex items-center justify-center transition cursor-pointer"
          title="Imprimir Fatura / Recibo"
        >
          <Printer className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
});
ReportTransactionRow.displayName = "ReportTransactionRow";

export interface ReportTransactionTableProps {
  filteredTransactions: Transaction[];
  startDate: string;
  endDate: string;
  currency: string;
  financialTotals: {
    salesTotal: number;
    subtotalTotal: number;
    discountTotal: number;
    vatTotal: number;
  };
  settings: SystemSettings;
  formatMZ: (val: number) => string;
  onOpenEmail: (t: Transaction) => void;
  onOpenPrint: (t: Transaction) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  setExportMessage: (msg: string) => void;
  setIsExporting: (exporting: boolean) => void;
  setExportFormat: (fmt: "PDF" | "EXCEL" | "CSV") => void;
}

export const ReportTransactionTable: React.FC<ReportTransactionTableProps> = ({
  filteredTransactions,
  startDate,
  endDate,
  currency,
  financialTotals,
  settings,
  formatMZ,
  onOpenEmail,
  onOpenPrint,
  onAddAuditLog,
  setExportMessage,
  setIsExporting,
  setExportFormat
}) => {
  const handleExportCsv = () => {
    setExportFormat("CSV");
    setTimeout(() => {
      setIsExporting(true);
      setTimeout(() => {
        setIsExporting(false);
        let csvContent = "\uFEFF"; // UTF-8 BOM
        csvContent += "OST Vendas - Relatorio de Faturamento e Vendas\n";
        csvContent += `Periodo Escolhido: ${startDate} ate ${endDate}\n`;
        csvContent += `Documento Gerado Em: ${new Date().toLocaleString()}\n`;
        csvContent += `Faturamento Total: ${financialTotals.salesTotal} MT\n\n`;
        csvContent += "FATURA;DATA;CLIENTE;METODO DE PAGAMENTO;SUBTOTAL (MT);DESCONTO;IVA COBRADO;TOTAL PAGO (MT)\n";
        filteredTransactions.forEach(t => {
          csvContent += `${t.invoiceNumber};${new Date(t.timestamp).toLocaleDateString()};${t.customerName || "Consumidor Geral"};${t.paymentMethod};${t.subtotal};${t.discountTotal};${t.vatTotal};${t.grandTotal}\n`;
        });
        const finalBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(finalBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Relatorio_Faturamento_${startDate}_a_${endDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setExportMessage(`Relatório CSV descarregado com sucesso!`);
        onAddAuditLog("Exportar Relatório por Datas", "RELATÓRIOS", `Relatório de vendas exportado em formato CSV.`);
      }, 200);
    }, 50);
  };

  const handleExportPdf = async () => {
    setExportFormat("PDF");
    setIsExporting(true);
    
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();
      
      const logoData = await getBase64ImageFromUrl(settings.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
      if (logoData) {
        const format = getFormatFromBase64(logoData);
        doc.addImage(logoData, format, 165, 8, 30, 30);
      }
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(settings.companyName || "OST COMÉRCIO CENTRAL", 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`NUIT: ${settings.companyNuit || "400293112"} | ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 26);
      doc.text(`Relatório Consolidado de Vendas e Faturamento`, 14, 32);
      doc.text(`Período Selecionado: ${startDate} até ${endDate} | Emitido em: ${new Date().toLocaleString()}`, 14, 38);
      
      doc.setFillColor(245, 245, 245);
      doc.rect(14, 44, 182, 24, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Financeiro:", 18, 50);
      doc.setFont("helvetica", "normal");
      doc.text(`Faturação Coletada: ${formatMZ(financialTotals.salesTotal)}`, 18, 58);
      doc.text(`Imposto IVA Liquidado: ${formatMZ(financialTotals.vatTotal)}`, 18, 64);
      doc.text(`Vendas Fechadas: ${filteredTransactions.length} Operações`, 116, 58);
      
      autoTable(doc, {
        startY: 74,
        head: [["FATURA", "DATA", "CLIENTE", "MÉTODO", "VALOR MT"]],
        body: filteredTransactions.map(t => [
          t.invoiceNumber,
          new Date(t.timestamp).toLocaleDateString(),
          t.customerName || "Consumidor Geral",
          t.paymentMethod,
          formatMZ(t.grandTotal)
        ]),
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: "bold" },
        columnStyles: {
          4: { halign: "right", fontStyle: "bold" }
        }
      });
      
      doc.save(`Relatorio_Faturamento_${startDate}_a_${endDate}.pdf`);
      setExportMessage(`Relatório PDF compilado e descarregado com sucesso!`);
      onAddAuditLog("Exportar Relatório por Datas", "RELATÓRIOS", `Relatório de faturamento exportado em formato PDF correspondente.`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setExportMessage("Ocorreu um erro ao gerar o PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-3.5 items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-800">Visualização Prévia da Tabela de Relatórios ({filteredTransactions.length} registros)</span>
          <p className="text-[10px] text-slate-400 mt-0.5">Exibindo transações faturadas de {startDate} até {endDate}</p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={handleExportCsv}
            className="border border-slate-200 hover:bg-slate-50 text-slate-705 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer bg-white transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            Exportar CSV
          </button>
          <button
            onClick={handleExportPdf}
            className="border border-slate-200 hover:bg-slate-50 text-slate-705 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer bg-white transition shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[800px] text-left text-slate-650 text-xs">
          <thead>
            <tr className="bg-slate-100 uppercase text-[10px] font-bold text-slate-500 tracking-wider">
              <th className="p-3">Fatura</th>
              <th className="p-3">Data</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Método</th>
              <th className="p-3 text-right">Subtotal</th>
              <th className="p-3 text-right">Desconto</th>
              <th className="p-3 text-right">IVA (16%)</th>
              <th className="p-3 text-right">Total Pago</th>
              <th className="p-3 text-center">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white font-sans">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                  Nenhuma fatura encontrada neste intervalo de datas.
                </td>
              </tr>
            ) : (
              filteredTransactions.slice(0, 10).map((t) => (
                <ReportTransactionRow
                  key={t.id}
                  transaction={t}
                  currency={currency}
                  onOpenEmail={onOpenEmail}
                  onOpenPrint={onOpenPrint}
                  formatMZ={formatMZ}
                />
              ))
            )}
            {filteredTransactions.length > 10 && (
              <tr>
                <td colSpan={9} className="p-3 text-center bg-slate-50 text-[10.5px] font-semibold text-slate-400">
                  ... e mais {filteredTransactions.length - 10} vendas faturadas no período selecionadas para a exportação oficial.
                </td>
              </tr>
            )}
          </tbody>
          {filteredTransactions.length > 0 && (
            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
              <tr>
                <td colSpan={4} className="p-3 text-right text-[10px] uppercase text-slate-500">Totais da Visualização:</td>
                <td className="p-3 text-right font-mono text-slate-800">{formatMZ(financialTotals.subtotalTotal)}</td>
                <td className="p-3 text-right font-mono text-red-600">-{formatMZ(financialTotals.discountTotal)}</td>
                <td className="p-3 text-right font-mono text-slate-800">{formatMZ(financialTotals.vatTotal)}</td>
                <td className="p-3 text-right font-mono text-emerald-700">{formatMZ(financialTotals.salesTotal)}</td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
