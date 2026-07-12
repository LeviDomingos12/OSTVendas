import React, { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  FileText, 
  Mail, 
  Clock, 
  Download, 
  CheckCircle, 
  Send, 
  TrendingUp, 
  DollarSign, 
  Calculator,
  Percent,
  Play,
  Printer
} from "lucide-react";
import { Transaction, SystemSettings } from "../types";
import { sendEmail } from "../lib/gmail";
import { generateInvoiceEmailHtml } from "../lib/emailTemplate";
import { SYSTEM_THEMES } from "../lib/themes";
import { printInvoiceHTML } from "../lib/printHelper";

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Error loading logo for PDF:", err);
    return "";
  }
};

const getFormatFromBase64 = (base64: string): string => {
  if (!base64) return "JPEG";
  if (base64.startsWith("data:image/png")) return "PNG";
  if (base64.startsWith("data:image/webp")) return "WEBP";
  if (base64.startsWith("data:image/gif")) return "GIF";
  if (base64.startsWith("data:image/svg")) return "SVG";
  return "JPEG";
};

interface ReportsModuleProps {
  transactions: Transaction[];
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currency: string;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export default function ReportsModule({
  transactions,
  settings,
  onUpdateSettings,
  onAddAuditLog,
  currency,
  onShowToast
}: ReportsModuleProps) {
  
  // Local states
  const [reportType, setReportType] = useState<"SALES" | "FINANCE" | "VAT">("SALES");
  const [exportFormat, setExportFormat] = useState<"PDF" | "EXCEL" | "CSV">("PDF");
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  // Date limit selector states
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const past = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)); // default to 30 days ago
    return past.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Automated email configuration states
  const [recipientEmail, setRecipientEmail] = useState(settings.reportRecipientEmail);
  const [reportHour, setReportHour] = useState(settings.reportHour);
  const [reportFrequency, setReportFrequency] = useState(settings.reportFrequency);
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);
  const [localError, setLocalError] = useState("");

  // Send test email stats
  const [testSendStatus, setTestSendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [testSentMessage, setTestSentMessage] = useState("");

  // Individual Email Send States
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState("");
  const [showEmailModal, setShowEmailModal] = useState<Transaction | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<Transaction | null>(null);

  // Active sub-tab state inside ReportsModule
  const [activeSubTab, setActiveSubTab] = useState<"general" | "iva">("general");

  // Local states for the VAT (IVA) calculator
  const [manualIvaDeduction, setManualIvaDeduction] = useState<number>(0);
  const [simulatedIvaRate, setSimulatedIvaRate] = useState<number>(16); // default 16% standard rate in Mozambique
  const [vatFilterClass, setVatFilterClass] = useState<"all" | "taxable" | "exempt">("all");

  // Memoized filtered transactions list by custom date interval selected
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.timestamp) return false;
      const tDate = t.timestamp.split("T")[0];
      return tDate >= startDate && tDate <= endDate;
    });
  }, [transactions, startDate, endDate]);

  // Consolidated values (using date filtered records!)
  const financialTotals = useMemo(() => {
    let salesTotal = 0;
    let vatTotal = 0;
    let discountTotal = 0;
    let subtotalTotal = 0;

    filteredTransactions.forEach(t => {
      salesTotal += t.grandTotal;
      vatTotal += t.vatTotal;
      discountTotal += t.discountTotal;
      subtotalTotal += t.subtotal;
    });

    const profitTotal = Math.round(salesTotal * 0.32); // margin estimate

    return {
      salesTotal,
      vatTotal,
      discountTotal,
      profitTotal,
      subtotalTotal
    };
  }, [filteredTransactions]);

  // Memoized calculations specifically for VAT (IVA) audit and declaration
  const vatCalculations = useMemo(() => {
    let taxableSalesSubtotal = 0;
    let exemptSalesSubtotal = 0;
    let realVatCollected = 0;
    let totalTransactions = filteredTransactions.length;

    filteredTransactions.forEach(t => {
      if (t.vatTotal > 0) {
        taxableSalesSubtotal += t.subtotal;
        realVatCollected += t.vatTotal;
      } else {
        exemptSalesSubtotal += t.subtotal;
      }
    });

    const simulatedVatCollected = Math.round(taxableSalesSubtotal * (simulatedIvaRate / 100));
    const netVatPayable = realVatCollected - manualIvaDeduction;

    return {
      taxableSalesSubtotal,
      exemptSalesSubtotal,
      realVatCollected,
      simulatedVatCollected,
      netVatPayable,
      totalTransactions
    };
  }, [filteredTransactions, simulatedIvaRate, manualIvaDeduction]);

  const formatMZ = (val: number) => {
    return new Intl.NumberFormat('pt-MZ', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(val) + " MT";
  };

  // Handle saving configurations
  const handleSaveEmailConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.includes("@")) {
      setLocalError("Por favor introduza um endereço de e-mail institucional válido.");
      return;
    }
    setLocalError("");

    onUpdateSettings({
      reportRecipientEmail: recipientEmail,
      reportHour,
      reportFrequency
    });

    setSaveSettingsSuccess(true);
    onAddAuditLog(
      "Salvar Configuração de Relatório Automático",
      "RELATÓRIOS",
      `Email modificado para: ${recipientEmail}. Frequência: ${reportFrequency} às ${reportHour}`
    );

    setTimeout(() => setSaveSettingsSuccess(false), 2000);
  };

  // Test Dispatch simulated emails via Express Server `/api/email/send-report`
  const handleTriggerTestEmail = async () => {
    setTestSendStatus("sending");
    setTestSentMessage("");

    try {
      const response = await fetch("/api/email/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: recipientEmail,
          frequency: reportFrequency,
          reportBody: {
            salesTotal: financialTotals.salesTotal,
            vatTotal: financialTotals.vatTotal,
            profitTotal: financialTotals.profitTotal
          }
        })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTestSendStatus("sent");
        setTestSentMessage(data.message);
        onAddAuditLog(
          "Forçar Disparo de Relatório Piloto por Email",
          "RELATÓRIOS",
          `Relatório consolidado enviado com sucesso para ${recipientEmail}.`
        );
        if (onShowToast) {
          onShowToast(data.message || "Relatório piloto enviado com sucesso!", "success", "Relatório Despachado");
        }
      } else {
        throw new Error(data.error || "O servidor SMTP recusou a entrega do relatório.");
      }
    } catch (err: any) {
      setTestSendStatus("idle");
      const errMsg = err.message || "Erro desconhecido ao despachar correio.";
      setTestSentMessage(`Erro: ${errMsg}`);
      if (onShowToast) {
        onShowToast(errMsg, "error", "Falha de Envio");
      }
    }
  };

  const handleSendInvoiceEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEmailModal || !targetEmail.includes("@")) return;

    setSendingInvoiceId(showEmailModal.id);
    try {
      const htmlBody = generateInvoiceEmailHtml(showEmailModal, settings.companyName);
      
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
      doc.text(`FATURA ${showEmailModal.invoiceNumber}`, 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Empresa: ${settings.companyName || "OST Vendas"}`, 14, 30);
      doc.text(`Cliente: ${showEmailModal.customerName || "Consumidor Geral"}`, 14, 36);
      doc.text(`Data: ${new Date(showEmailModal.timestamp).toLocaleString()}`, 14, 42);
      
      const tableBody = showEmailModal.items.map(item => [
        item.productName,
        item.quantity.toString(),
        `${item.price.toLocaleString()} MT`,
        `${item.subtotal.toLocaleString()} MT`
      ]);
      
      autoTable(doc, {
        startY: 50,
        head: [["Produto/Serviço", "Qtd", "Preço Unit.", "Subtotal"]],
        body: tableBody,
        theme: "striped",
        headStyles: { fillColor: [249, 115, 22] }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY || 50;
      doc.setFont("helvetica", "bold");
      doc.text(`Subtotal: ${showEmailModal.subtotal.toLocaleString()} MT`, 14, finalY + 10);
      doc.text(`IVA (16%): ${showEmailModal.vatTotal.toLocaleString()} MT`, 14, finalY + 16);
      doc.text(`Total Pago: ${showEmailModal.grandTotal.toLocaleString()} MT`, 14, finalY + 22);

      const pdfBase64DataUri = doc.output('datauristring');
      const base64Content = pdfBase64DataUri.split(',')[1];
      
      await sendEmail({
        to: targetEmail,
        subject: `Fatura ${showEmailModal.invoiceNumber} - ${settings.companyName || "OST Vendas"}`,
        body: htmlBody,
        isHtml: true,
        attachments: [{
          filename: `Fatura_${showEmailModal.invoiceNumber}.pdf`,
          content: base64Content,
          mimeType: "application/pdf"
        }]
      });

      if (onShowToast) onShowToast(`Fatura e PDF enviados com sucesso para ${targetEmail}`, "success");
      onAddAuditLog("Envio de Fatura por E-mail (Gmail)", "RELATÓRIOS", `Enviado fatura ${showEmailModal.invoiceNumber} com anexo PDF para ${targetEmail} com sucesso.`);
      
      setShowEmailModal(null);
      setTargetEmail("");
    } catch (error: any) {
      if (onShowToast) onShowToast(`Falha ao enviar e-mail: ${error.message}`, "error");
      onAddAuditLog("Erro no Envio de Fatura (Gmail)", "RELATÓRIOS", `Falha ao enviar fatura ${showEmailModal.invoiceNumber} para ${targetEmail}: ${error.message}`);
    } finally {
      setSendingInvoiceId(null);
    }
  };

  // Real exports compilation
  const handlePerformExport = () => {
    setIsExporting(true);
    setExportMessage("");

    setTimeout(async () => {
      setIsExporting(false);
      
      const fileExt = exportFormat === "PDF" ? "pdf" : "csv";
      const filename = `OST_Vendas_Relatorio_${reportType}_${startDate}_a_${endDate}.${fileExt}`;
      
      try {
        let finalBlob: Blob;

        if (exportFormat === "CSV" || exportFormat === "EXCEL") {
          // Generate precise, valid CSV that opens flawlessly in Excel without encoding/accents errors
          let csvContent = "\uFEFF"; // UTF-8 BOM

          if (reportType === "SALES") {
            csvContent += "OST Vendas - Relatorio de Faturamento e Vendas\n";
            csvContent += `Periodo Escolhido: ${startDate} ate ${endDate}\n`;
            csvContent += `Documento Gerado Em: ${new Date().toLocaleString()}\n`;
            csvContent += `Faturamento Total: ${financialTotals.salesTotal} MT\n\n`;
            csvContent += "FATURA;DATA;CLIENTE;METODO DE PAGAMENTO;SUBTOTAL (MT);DESCONTO;IVA COBRADO;TOTAL PAGO (MT)\n";
            filteredTransactions.forEach(t => {
              csvContent += `${t.invoiceNumber};${new Date(t.timestamp).toLocaleDateString()};${t.customerName || "Consumidor Geral"};${t.paymentMethod};${t.subtotal};${t.discountTotal};${t.vatTotal};${t.grandTotal}\n`;
            });
          } else if (reportType === "FINANCE") {
            csvContent += "OST Vendas - Analise e Balanco Financeiro Geral\n";
            csvContent += `Periodo Escolhido: ${startDate} ate ${endDate}\n`;
            csvContent += `Documento Gerado Em: ${new Date().toLocaleString()}\n\n`;
            csvContent += "INDICADOR COMERCIAL;VALOR CONSOLIDADO (METICAIS - MT)\n";
            csvContent += `Faturamento Bruto Coletado;${financialTotals.salesTotal}\n`;
            csvContent += `Total de Imposto IVA Arrecadado;${financialTotals.vatTotal}\n`;
            csvContent += `Total de Descontos Concedidos;${financialTotals.discountTotal}\n`;
            csvContent += `Estimativa de Margem Comercial de Lucro (32%);${financialTotals.profitTotal}\n`;
            csvContent += `Numero Total de Transacoes Processadas;${filteredTransactions.length}\n`;
          } else {
            csvContent += "OST Vendas - Demonstracao de Apuracao de IVA\n";
            csvContent += `Periodo Escolhido: ${startDate} ate ${endDate}\n`;
            csvContent += `Documento Gerado Em: ${new Date().toLocaleString()}\n\n`;
            csvContent += "FATURA;DATA;CLIENTE;ALIQUOTA DE IMPOSTO;BASE CALCULO (MT);IVA COBRADO (MT)\n";
            filteredTransactions.forEach(t => {
              const baseCalculo = Math.round(t.grandTotal * 0.84);
              csvContent += `${t.invoiceNumber};${new Date(t.timestamp).toLocaleDateString()};${t.customerName || "Consumidor Geral"};16%;${baseCalculo};${t.vatTotal}\n`;
            });
          }

          finalBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        } else {
          const titleLabel = reportType === "SALES" ? "Vendas e Faturamento" : reportType === "FINANCE" ? "Demonstrativo Financeiro" : "Apuração Fiscal de IVA";
          
          const doc = new jsPDF();
          
          const activeTheme = SYSTEM_THEMES.find(t => t.id === settings.theme) || SYSTEM_THEMES[0];
          const rgbArray = activeTheme.rgb.split(",").map(Number);
          
          // Draw a nice aesthetic top border using the theme color
          doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
          doc.rect(0, 0, 210, 8, "F");
          
          const logoData = await getBase64ImageFromUrl(settings.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
          if (logoData) {
            const format = getFormatFromBase64(logoData);
            doc.addImage(logoData, format, 165, 12, 30, 30);
          }
          
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 41, 59);
          doc.text(settings.companyName || "OST COMÉRCIO CENTRAL", 14, 22);
          
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text(`NUIT: ${settings.companyNuit || "400293112"} | Endereço: ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 28);
          doc.text(`Contacto: ${settings.storeContact || "+258 84 900 1202"} | E-mail: ${settings.smtpUser || "suporte@ost.co.mz"}`, 14, 33);
          
          doc.setDrawColor(226, 232, 240);
          doc.line(14, 38, 196, 38);

          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 41, 59);
          doc.text(`Relatório Consolidado de ${titleLabel}`, 14, 46);
          
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          doc.text(`Período Selecionado: ${startDate} até ${endDate}`, 14, 52);
          doc.text(`Documento gerado em: ${new Date().toLocaleString()}`, 14, 57);
          
          // Styled summary container box
          doc.setFillColor(248, 250, 252);
          doc.rect(14, 62, 182, 16, "F");
          doc.setDrawColor(226, 232, 240);
          doc.rect(14, 62, 182, 16, "S");
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(rgbArray[0], rgbArray[1], rgbArray[2]);
          doc.text(`Faturação Total: ${financialTotals.salesTotal.toLocaleString()} MT`, 18, 72);
          doc.text(`IVA Líquido: ${financialTotals.vatTotal.toLocaleString()} MT`, 80, 72);
          doc.text(`Transações: ${filteredTransactions.length}`, 150, 72);
          
          let head = [];
          let body = [];

          if (reportType === "SALES") {
            head = [["FATURA", "DATA", "CLIENTE", "MÉTODO", "VALOR MT"]];
            body = filteredTransactions.map(t => [
              t.invoiceNumber,
              new Date(t.timestamp).toLocaleDateString(),
              t.customerName || "Consumidor Geral",
              t.paymentMethod,
              formatMZ(t.grandTotal)
            ]);
          } else if (reportType === "FINANCE") {
            head = [["INDICADOR FINANCEIRO", "VALOR MT"]];
            body = [
              ["Total de Faturação de Vendas", formatMZ(financialTotals.salesTotal)],
              ["Total de IVA Liquidado", formatMZ(financialTotals.vatTotal)],
              ["Descontos Geral Concedidos", `-${formatMZ(financialTotals.discountTotal)}`],
              ["Margem Comercial de Lucro (Estimativa 32%)", `+${formatMZ(financialTotals.profitTotal)}`],
              ["Média de Ticket por Operação", formatMZ(filteredTransactions.length ? Math.round(financialTotals.salesTotal / filteredTransactions.length) : 0)]
            ];
          } else {
            head = [["FATURA", "CLIENTE", "ALÍQUOTA", "BASE CALCULO", "IVA DECLARADO"]];
            body = filteredTransactions.map(t => [
              t.invoiceNumber,
              t.customerName || "Consumidor Geral",
              "16%",
              formatMZ(Math.round(t.grandTotal * 0.84)),
              formatMZ(t.vatTotal)
            ]);
          }

          autoTable(doc, {
            startY: 84,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [rgbArray[0], rgbArray[1], rgbArray[2]] as [number, number, number] },
            styles: { fontSize: 8, cellPadding: 3 }
          });

          finalBlob = doc.output('blob');
        }
        
        const url = URL.createObjectURL(finalBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn("Dispositivo em iFrame bloqueado para transferencias físicas. Download registrado virtualmente.");
      }

      const successLabel = exportFormat === "PDF" 
        ? "Documento PDF" 
        : exportFormat;

      setExportMessage(`Relatório ${filename} compilado e descarregado em formato de alta compatibilidade ${successLabel}!`);
      onAddAuditLog(
        "Exportar Relatório por Datas",
        "RELATÓRIOS",
        `Relatório do tipo ${reportType} criado de ${startDate} até ${endDate} no formato ${exportFormat}.`
      );
    }, 1500);
  };

  const handlePerformExecutivePrintPDF = async () => {
    setIsExporting(true);
    setExportMessage("");

    setTimeout(async () => {
      try {
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });

        // A4 Dimensions: 210 x 297 mm
        // High contrast top line
        doc.setFillColor(30, 41, 59); // Dark Slate for elegant high-contrast printing
        doc.rect(0, 0, 210, 8, "F");

        // Company Logo
        const logoData = await getBase64ImageFromUrl(settings.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
        if (logoData) {
          const format = getFormatFromBase64(logoData);
          doc.addImage(logoData, format, 165, 12, 30, 30);
        }

        // Company Info Header
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(settings.companyName || "OST COMÉRCIO CENTRAL", 14, 20);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`NUIT: ${settings.companyNuit || "400293112"} | Endereço: ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 27);
        doc.text(`Contacto: ${settings.storeContact || "+258 84 900 1202"} | E-mail: ${settings.smtpUser || "suporte@ost.co.mz"}`, 14, 32);

        // Divider
        doc.setDrawColor(203, 213, 225);
        doc.line(14, 37, 196, 37);

        // Document Title
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("RELATÓRIO FINANCEIRO E RESUMO OPERACIONAL DE GESTÃO", 14, 45);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`Período do Relatório: ${new Date(startDate).toLocaleDateString()} até ${new Date(endDate).toLocaleDateString()}`, 14, 51);
        doc.text(`Emitido em: ${new Date().toLocaleString()} | Operador Responsável: ${settings.companyName || "Administrador Geral"}`, 14, 56);

        // KPI Box Row 1
        // Box 1 - Faturamento Bruto
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 62, 57, 18, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, 62, 57, 18, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("FATURAÇÃO BRUTA", 18, 67);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(formatMZ(financialTotals.salesTotal), 18, 74);

        // Box 2 - IVA Arrecadado
        doc.setFillColor(248, 250, 252);
        doc.rect(76, 62, 57, 18, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(76, 62, 57, 18, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("IVA ARRECADADO (16%)", 80, 67);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(formatMZ(financialTotals.vatTotal), 80, 74);

        // Box 3 - Margem de Lucro Estimada
        doc.setFillColor(248, 250, 252);
        doc.rect(138, 62, 58, 18, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(138, 62, 58, 18, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("MARGEM DE LUCRO (32% EST.)", 142, 67);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129); // emerald green
        doc.text(`+${formatMZ(financialTotals.profitTotal)}`, 142, 74);

        // KPI Box Row 2
        // Box 4 - Descontos
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 84, 57, 18, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, 84, 57, 18, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("DESCONTOS CONCEDIDOS", 18, 89);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(239, 68, 68); // red
        doc.text(`-${formatMZ(financialTotals.discountTotal)}`, 18, 96);

        // Box 5 - Volume Transações
        doc.setFillColor(248, 250, 252);
        doc.rect(76, 84, 57, 18, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(76, 84, 57, 18, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("VOLUME DE VENDAS", 80, 89);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(`${filteredTransactions.length} Operações`, 80, 96);

        // Box 6 - Ticket Médio
        doc.setFillColor(248, 250, 252);
        doc.rect(138, 84, 58, 18, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(138, 84, 58, 18, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("TICKET MÉDIO", 142, 89);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        const avgTicket = filteredTransactions.length ? Math.round(financialTotals.salesTotal / filteredTransactions.length) : 0;
        doc.text(formatMZ(avgTicket), 142, 96);

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 107, 196, 107);

        // Detailed Transactions Title
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("DEMONSTRATIVO DE TRANSAÇÕES DETALHADAS", 14, 114);

        const tableHead = [["FATURA", "DATA", "CLIENTE", "MÉTODO", "SUBTOTAL", "DESC", "IVA (16%)", "TOTAL MT"]];
        const tableBody = filteredTransactions.map(t => [
          t.invoiceNumber,
          new Date(t.timestamp).toLocaleDateString() + " " + new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          t.customerName || "Consumidor Geral",
          t.paymentMethod,
          formatMZ(t.subtotal),
          `-${formatMZ(t.discountTotal)}`,
          formatMZ(t.vatTotal),
          formatMZ(t.grandTotal)
        ]);

        autoTable(doc, {
          startY: 118,
          head: tableHead,
          body: tableBody,
          theme: "striped",
          styles: { fontSize: 7.5, cellPadding: 2.5 },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: {
            4: { halign: "right" },
            5: { halign: "right", textColor: [220, 38, 38] },
            6: { halign: "right" },
            7: { halign: "right", fontStyle: "bold" }
          },
          didDrawPage: (data) => {
            // Footer
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${data.pageNumber}`, 14, 288);
            doc.text("OST Vendas - Sistema de Gestão Comercial Integrado", 120, 288);
          }
        });

        const finalY = (doc as any).lastAutoTable.finalY || 120;

        const drawSignatures = (targetDoc: typeof doc, startY: number) => {
          targetDoc.setDrawColor(203, 213, 225);
          targetDoc.line(20, startY + 20, 95, startY + 20);
          targetDoc.line(115, startY + 20, 190, startY + 20);
          
          targetDoc.setFont("helvetica", "bold");
          targetDoc.setFontSize(8);
          targetDoc.setTextColor(71, 85, 105);
          targetDoc.text("Assinatura do Gestor Responsável", 32, startY + 24);
          targetDoc.text("Visto da Auditoria / Administração", 124, startY + 24);

          targetDoc.setFont("helvetica", "normal");
          targetDoc.setFontSize(7.5);
          targetDoc.setTextColor(148, 163, 184);
          targetDoc.text("Documento oficial impresso gerado automaticamente para fins tributários e de balancete.", 14, startY + 33);
        };

        if (finalY + 45 > 280) {
          doc.addPage();
          doc.setFillColor(30, 41, 59);
          doc.rect(0, 0, 210, 8, "F");
          drawSignatures(doc, 20);
        } else {
          drawSignatures(doc, finalY);
        }

        doc.save(`Resumo_Executivo_Financeiro_${startDate}_a_${endDate}.pdf`);
        setExportMessage(`Resumo financeiro executivo (A4 PDF) gerado com sucesso!`);
        onAddAuditLog(
          "Exportar Resumo Executivo PDF",
          "RELATÓRIOS",
          `Gestor exportou resumo financeiro impresso de ${startDate} até ${endDate} contendo assinaturas.`
        );
        if (onShowToast) {
          onShowToast("Resumo executivo impresso (A4 PDF) pronto!", "success", "Relatório PDF Gerado");
        }
      } catch (err: any) {
        console.error("Erro ao gerar resumo financeiro PDF:", err);
        setExportMessage(`Erro ao compilar PDF: ${err.message || err}`);
        if (onShowToast) {
          onShowToast("Falha ao compilar relatório PDF.", "error", "Erro de Exportação");
        }
      } finally {
        setIsExporting(false);
      }
    }, 1500);
  };

  const handleExportSalesSummaryPDF = async () => {
    setIsExporting(true);
    setExportMessage("");
    if (onShowToast) {
      onShowToast("Preparando Sumário de Vendas Profissional...", "info", "Aguarde");
    }

    setTimeout(async () => {
      try {
        const { jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });

        const activeTheme = SYSTEM_THEMES.find(t => t.id === settings.theme) || SYSTEM_THEMES[0];
        const rgbArray = activeTheme.rgb.split(",").map(Number);

        // A4: 210 x 297 mm
        // 1. Top elegant color band
        doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
        doc.rect(0, 0, 210, 10, "F");

        // 2. Company Logo
        const logoData = await getBase64ImageFromUrl(settings.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
        if (logoData) {
          const format = getFormatFromBase64(logoData);
          doc.addImage(logoData, format, 165, 14, 30, 30);
        }

        // 3. Corporate Info Header
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(settings.companyName || "OST COMÉRCIO CENTRAL", 14, 22);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`NUIT: ${settings.companyNuit || "400293112"} | Endereço: ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 29);
        doc.text(`Contacto: ${settings.storeContact || "+258 84 900 1202"} | E-mail: ${settings.smtpUser || "suporte@ost.co.mz"}`, 14, 34);

        // Header Divider Line
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.4);
        doc.line(14, 39, 196, 39);

        // 4. Document Title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("SUMÁRIO EXECUTIVO DE VENDAS E DESEMPENHO", 14, 48);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Período de Apuração: ${new Date(startDate).toLocaleDateString("pt-MZ")} até ${new Date(endDate).toLocaleDateString("pt-MZ")}`, 14, 54);
        doc.text(`Emitido em: ${new Date().toLocaleString("pt-MZ")} | Moeda Oficial: Meticais (MT)`, 14, 59);

        // 5. Beautiful Metric Cards Row
        // Card 1: Faturamento Bruto
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(14, 65, 57, 20, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, 65, 57, 20, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("FATURAÇÃO BRUTA", 18, 71);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(rgbArray[0], rgbArray[1], rgbArray[2]);
        doc.text(formatMZ(financialTotals.salesTotal), 18, 79);

        // Card 2: Imposto IVA
        doc.setFillColor(248, 250, 252);
        doc.rect(76, 65, 57, 20, "F");
        doc.rect(76, 65, 57, 20, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("IVA RECOLHIDO (16%)", 80, 71);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(formatMZ(financialTotals.vatTotal), 80, 79);

        // Card 3: Volume & Ticket Médio
        doc.setFillColor(248, 250, 252);
        doc.rect(138, 65, 58, 20, "F");
        doc.rect(138, 65, 58, 20, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("TICKET MÉDIO", 142, 71);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        const avgTicket = filteredTransactions.length ? Math.round(financialTotals.salesTotal / filteredTransactions.length) : 0;
        doc.text(formatMZ(avgTicket), 142, 79);

        // 6. Section: Payment Methods Distribution
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("DISTRIBUIÇÃO DE RECEITAS POR MÉTODO", 14, 94);

        const paymentBreakdown: Record<string, { count: number; total: number }> = {};
        filteredTransactions.forEach(t => {
          const method = t.paymentMethod || "OUTRO";
          if (!paymentBreakdown[method]) {
            paymentBreakdown[method] = { count: 0, total: 0 };
          }
          paymentBreakdown[method].count += 1;
          paymentBreakdown[method].total += t.grandTotal;
        });

        const totalTransactions = filteredTransactions.length || 1;
        const totalRevenue = financialTotals.salesTotal || 1;

        const paymentRows = Object.entries(paymentBreakdown).map(([method, data]) => [
          method,
          `${data.count} transações`,
          `${((data.count / totalTransactions) * 100).toFixed(1)}%`,
          formatMZ(data.total),
          `${((data.total / totalRevenue) * 100).toFixed(1)}%`
        ]);

        autoTable(doc, {
          startY: 98,
          head: [["Método de Pagamento", "Volume de Vendas", "% Transações", "Faturamento Acumulado", "% Receita"]],
          body: paymentRows.length > 0 ? paymentRows : [["Nenhum método registrado", "0", "0%", "0,00 MT", "0%"]],
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: {
            3: { halign: "right", fontStyle: "bold" },
            4: { halign: "right" }
          }
        });

        let nextY = (doc as any).lastAutoTable.finalY + 10;

        // 7. Section: Top Products Sold
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("PRODUTOS MAIS VENDIDOS NO PERÍODO", 14, nextY);

        const productSales: Record<string, { qty: number; total: number }> = {};
        filteredTransactions.forEach(t => {
          if (t.items && Array.isArray(t.items)) {
            t.items.forEach(item => {
              const prodName = item.productName || "Produto Sem Nome";
              if (!productSales[prodName]) {
                productSales[prodName] = { qty: 0, total: 0 };
              }
              productSales[prodName].qty += item.quantity || 0;
              productSales[prodName].total += item.subtotal || 0;
            });
          }
        });

        const topProducts = Object.entries(productSales)
          .map(([name, data]) => ({ name, qty: data.qty, total: data.total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

        const productRows = topProducts.map((p, idx) => [
          `0${idx + 1}`,
          p.name,
          `${p.qty} unidades`,
          formatMZ(p.total)
        ]);

        autoTable(doc, {
          startY: nextY + 4,
          head: [["Posição", "Produto / Serviço", "Qtd Vendida", "Faturamento Gerado"]],
          body: productRows.length > 0 ? productRows : [["-", "Nenhum produto registrado no período", "0", "0,00 MT"]],
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: {
            0: { halign: "center", fontStyle: "bold", textColor: [100, 116, 139] },
            3: { halign: "right", fontStyle: "bold" }
          }
        });

        nextY = (doc as any).lastAutoTable.finalY + 10;

        // 8. Signatures Section (draw at page bottom or next page if no space)
        const drawDocSignatures = (targetDoc: typeof doc, startY: number) => {
          targetDoc.setDrawColor(203, 213, 225);
          targetDoc.line(20, startY + 12, 90, startY + 12);
          targetDoc.line(120, startY + 12, 190, startY + 12);

          targetDoc.setFont("helvetica", "bold");
          targetDoc.setFontSize(8);
          targetDoc.setTextColor(71, 85, 105);
          targetDoc.text("Responsável de Vendas / Caixa", 28, startY + 16);
          targetDoc.text("Administração / Direção Geral", 130, startY + 16);

          targetDoc.setFont("helvetica", "normal");
          targetDoc.setFontSize(7.5);
          targetDoc.setTextColor(148, 163, 184);
          targetDoc.text("Este sumário consolidado serve como documento gerencial de auditoria e desempenho de vendas.", 14, startY + 24);
        };

        if (nextY + 30 > 280) {
          doc.addPage();
          doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
          doc.rect(0, 0, 210, 10, "F");
          drawDocSignatures(doc, 20);
        } else {
          drawDocSignatures(doc, nextY);
        }

        // Save PDF file
        doc.save(`Sumario_Vendas_Profissional_${startDate}_a_${endDate}.pdf`);

        setExportMessage(`Sumário Profissional de Vendas (A4 PDF) gerado com sucesso!`);
        onAddAuditLog(
          "Exportar Sumário de Vendas PDF",
          "RELATÓRIOS",
          `Gestor exportou sumário profissional de faturamento de ${startDate} até ${endDate}.`
        );

        if (onShowToast) {
          onShowToast("Sumário de Vendas Profissional gerado com sucesso!", "success", "PDF Exportado");
        }
      } catch (err: any) {
        console.error("Erro ao gerar PDF de sumário de vendas:", err);
        setExportMessage(`Erro ao compilar PDF de vendas: ${err.message || err}`);
        if (onShowToast) {
          onShowToast("Falha ao gerar sumário de vendas PDF.", "error", "Erro de Exportação");
        }
      } finally {
        setIsExporting(false);
      }
    }, 1200);
  };

  const handleExportIvaPdf = async () => {
    setIsExporting(true);
    setExportMessage("");
    if (onShowToast) {
      onShowToast("Preparando Declaração de IVA...", "info", "Aguarde");
    }
    
    setTimeout(async () => {
      try {
        const { jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });

        const activeTheme = SYSTEM_THEMES.find(t => t.id === settings.theme) || SYSTEM_THEMES[0];
        const rgbArray = activeTheme.rgb.split(",").map(Number);

        // Top aesthetic header band
        doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
        doc.rect(0, 0, 210, 8, "F");

        // App logo
        const logoData = await getBase64ImageFromUrl(settings.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
        if (logoData) {
          const format = getFormatFromBase64(logoData);
          doc.addImage(logoData, format, 165, 12, 30, 30);
        }

        // Header Section
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(settings.companyName || "OST COMÉRCIO CENTRAL", 14, 22);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`NUIT: ${settings.companyNuit || "400293112"} | Endereço: ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 28);
        doc.text(`Contacto: ${settings.storeContact || "+258 84 900 1202"} | E-mail: ${settings.smtpUser || "suporte@ost.co.mz"}`, 14, 33);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 38, 196, 38);

        // Document Title
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("DECLARAÇÃO PERIÓDICA E DEMONSTRATIVO DE IVA", 14, 46);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`Período da Apuração: ${new Date(startDate).toLocaleDateString()} até ${new Date(endDate).toLocaleDateString()}`, 14, 52);
        doc.text(`Gerado em: ${new Date().toLocaleString()} | Alíquota de IVA padrão: 16% (Moçambique)`, 14, 57);

        // Table 1: Financial Summary & VAT Balances
        const summaryHead = [["MÉTRICA / RUBRICA FISCAL", "VALOR (MT)"]];
        const summaryBody = [
          ["Faturamento Total Bruto (Vendas)", formatMZ(financialTotals.salesTotal)],
          ["Base Tributável (Vendas com IVA)", formatMZ(vatCalculations.taxableSalesSubtotal)],
          ["Faturamento Isento ou Não Sujeito", formatMZ(vatCalculations.exemptSalesSubtotal)],
          ["IVA Liquidado Coletado (Output VAT)", formatMZ(vatCalculations.realVatCollected)],
          ["IVA Dedutível Informado (Input VAT)", formatMZ(manualIvaDeduction)],
          [
            vatCalculations.netVatPayable >= 0 
              ? "SALDO FINAL: IVA A PAGAR AO ESTADO" 
              : "SALDO FINAL: CRÉDITO DE IVA A RECUPERAR", 
            formatMZ(Math.abs(vatCalculations.netVatPayable))
          ]
        ];

        autoTable(doc, {
          startY: 64,
          head: summaryHead,
          body: summaryBody,
          theme: "grid",
          headStyles: { fillColor: [rgbArray[0], rgbArray[1], rgbArray[2]] as [number, number, number], textColor: [255, 255, 255] },
          styles: { fontSize: 8.5, cellPadding: 3 },
          columnStyles: {
            1: { halign: "right", fontStyle: "bold" }
          }
        });

        let nextY = (doc as any).lastAutoTable.finalY + 10;

        // Table 2: Detailed Transactions within selection
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("DETALHE DAS TRANSAÇÕES E IMPOSTOS RETIDOS", 14, nextY);

        const transHead = [["FATURA", "DATA", "CLIENTE", "BASE CÁLCULO", "TAXA", "IVA RETIDO", "TOTAL PAGO"]];
        const transBody = filteredTransactions.map(t => [
          t.invoiceNumber,
          new Date(t.timestamp).toLocaleDateString(),
          t.customerName || "Consumidor Geral",
          formatMZ(t.subtotal),
          t.vatTotal > 0 ? "16%" : "0% (Isento)",
          formatMZ(t.vatTotal),
          formatMZ(t.grandTotal)
        ]);

        autoTable(doc, {
          startY: nextY + 4,
          head: transHead,
          body: transBody,
          theme: "striped",
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
          styles: { fontSize: 7.5, cellPadding: 2 },
          columnStyles: {
            3: { halign: "right" },
            5: { halign: "right" },
            6: { halign: "right", fontStyle: "bold" }
          }
        });

        // Signature block
        const lastY = (doc as any).lastAutoTable.finalY + 12;
        if (lastY + 35 > 280) {
          doc.addPage();
          doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
          doc.rect(0, 0, 210, 8, "F");
          doc.setDrawColor(203, 213, 225);
          doc.line(40, 50, 170, 50);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text("Assinatura do Responsável Técnico / Contabilista Certificado", 58, 55);
        } else {
          doc.setDrawColor(203, 213, 225);
          doc.line(40, lastY + 20, 170, lastY + 20);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text("Assinatura do Responsável Técnico / Contabilista Certificado", 58, lastY + 25);
        }

        doc.save(`Declaracao_IVA_${startDate}_a_${endDate}.pdf`);
        setExportMessage(`Declaração de IVA compilada e descarregada com sucesso!`);
        onAddAuditLog("Exportar Declaração IVA PDF", "RELATÓRIOS", `Declaracao de IVA gerada de ${startDate} ate ${endDate} com saldo de ${formatMZ(vatCalculations.netVatPayable)}.`);
        
        if (onShowToast) {
          onShowToast("Declaração de IVA compilada com sucesso!", "success", "Exportação PDF Concluída");
        }
      } catch (err: any) {
        console.error("Erro ao gerar PDF de IVA:", err);
        setExportMessage(`Erro ao gerar PDF: ${err.message}`);
        if (onShowToast) {
          onShowToast(`Erro ao gerar PDF de IVA: ${err.message}`, "error", "Falha de Exportação");
        }
      } finally {
        setIsExporting(false);
      }
    }, 1000);
  };

  const handleExportIvaCsv = () => {
    try {
      let csvContent = "\uFEFF"; // UTF-8 BOM
      csvContent += "OST Vendas - Demonstracao de Apuracao de IVA\n";
      csvContent += `Periodo de Apuracao: ${startDate} ate ${endDate}\n`;
      csvContent += `Documento Gerado Em: ${new Date().toLocaleString()}\n\n`;

      csvContent += "RESUMO DA APURACAO DE IVA\n";
      csvContent += `Total de Faturamento Bruto (MT);${financialTotals.salesTotal}\n`;
      csvContent += `Faturamento Base Tributavel (MT);${vatCalculations.taxableSalesSubtotal}\n`;
      csvContent += `Faturamento Isento ou Nao Sujeito (MT);${vatCalculations.exemptSalesSubtotal}\n`;
      csvContent += `Total de IVA Liquidado (MT);${vatCalculations.realVatCollected}\n`;
      csvContent += `Total de IVA Dedutivel Informado (MT);${manualIvaDeduction}\n`;
      csvContent += `SALDO FINAL DE IVA (MT);${vatCalculations.netVatPayable}\n\n`;

      csvContent += "DETALHE DE TRANSACOES FISCAIS\n";
      csvContent += "FATURA;DATA;CLIENTE;BASE CALCULO (MT);ALIQUOTA;IVA LIQUIDADO (MT);TOTAL PAGO (MT)\n";
      
      filteredTransactions.forEach(t => {
        csvContent += `${t.invoiceNumber};${new Date(t.timestamp).toLocaleDateString()};${t.customerName || "Consumidor Geral"};${t.subtotal};${t.vatTotal > 0 ? "16%" : "0%"};${t.vatTotal};${t.grandTotal}\n`;
      });

      const finalBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Apuracao_IVA_${startDate}_a_${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportMessage(`Demonstrativo de IVA descarregado com sucesso!`);
      onAddAuditLog("Exportar Demonstrativo IVA CSV", "RELATÓRIOS", `Demonstrativo de IVA em CSV gerado.`);
      if (onShowToast) {
        onShowToast("Demonstrativo de IVA CSV descarregado!", "success");
      }
    } catch (err: any) {
      console.error(err);
      if (onShowToast) {
        onShowToast("Falha ao exportar CSV de IVA.", "error");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Navigation inside ReportsModule */}
      <div className="flex border-b border-slate-200 gap-1 bg-white p-2 rounded-2xl border">
        <button
          id="btn-subtab-reports-general"
          type="button"
          onClick={() => setActiveSubTab("general")}
          className={`flex-1 md:flex-none px-6 py-3 font-bold text-xs transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === "general"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <FileText className="w-4 h-4" />
          Relatórios Gerais & Agendamentos
        </button>
        <button
          id="btn-subtab-reports-iva"
          type="button"
          onClick={() => setActiveSubTab("iva")}
          className={`flex-1 md:flex-none px-6 py-3 font-bold text-xs transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === "iva"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Percent className="w-4 h-4" />
          Calculadora & Declaração de IVA
        </button>
      </div>

      {activeSubTab === "general" ? (
        <div className="space-y-6 animate-in fade-in duration-200">
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

      {/* Grid: Left - Manual Query & Exports, Right - Automatiic email scheduler */}
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
                {["PDF", "EXCEL", "CSV"].map(format => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setExportFormat(format as any)}
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
              onClick={handlePerformExport}
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
              onClick={handleExportSalesSummaryPDF}
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
              onClick={handlePerformExecutivePrintPDF}
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
          <form onSubmit={handleSaveEmailConfig} className="space-y-4">
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
                    onChange={(e) => setReportFrequency(e.target.value as any)}
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
                onClick={handleTriggerTestEmail}
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

      {/* Visual Table Segment inside ReportsModule */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-3.5 items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-800">Visualização Prévia da Tabela de Relatórios ({filteredTransactions.length} registros)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Exibindo transações faturadas de {startDate} até {endDate}</p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => {
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
              }}
              className="border border-slate-200 hover:bg-slate-50 text-slate-705 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer bg-white transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              Exportar CSV
            </button>
            <button
              onClick={async () => {
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
              }}
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
                  <tr key={t.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 font-bold font-mono text-slate-800">{t.invoiceNumber}</td>
                    <td className="p-3 text-[11px] whitespace-nowrap">{new Date(t.timestamp).toLocaleString()}</td>
                    <td className="p-3 font-semibold text-slate-700">{t.customerName || "Consumidor Geral"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        t.paymentMethod === "CASH" ? "bg-amber-50 text-amber-700" :
                        t.paymentMethod === "M-PESA" ? "bg-red-50 text-red-600" :
                        "bg-sky-50 text-sky-700"
                      }`}>{t.paymentMethod}</span>
                    </td>
                    <td className="p-3 text-right font-mono font-medium text-slate-600">{formatMZ(t.subtotal)}</td>
                    <td className="p-3 text-right font-mono text-red-500 font-medium">-{formatMZ(t.discountTotal)}</td>
                    <td className="p-3 text-right font-mono text-slate-500 font-medium">{formatMZ(t.vatTotal)}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">{formatMZ(t.grandTotal)}</td>
                    <td className="p-3 text-center flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowEmailModal(t)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg inline-flex items-center justify-center transition cursor-pointer"
                        title="Enviar Fatura por E-mail"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPrintModal(t)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg inline-flex items-center justify-center transition cursor-pointer"
                        title="Imprimir Fatura / Recibo"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
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
      </div>
      ) : (
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
                  onClick={handleExportIvaPdf}
                  disabled={isExporting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-lg shadow-slate-950/15"
                >
                  <Download className="w-4 h-4 text-orange-400 shrink-0" />
                  {isExporting ? "A processar..." : "Descarregar Declaração IVA Oficial (PDF)"}
                </button>

                <button
                  id="btn-export-iva-csv"
                  type="button"
                  onClick={handleExportIvaCsv}
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
                        <tr key={t.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-bold font-mono text-slate-800">{t.invoiceNumber}</td>
                          <td className="p-3 text-[11px] whitespace-nowrap">{new Date(t.timestamp).toLocaleString()}</td>
                          <td className="p-3 font-semibold text-slate-700">{t.customerName || "Consumidor Geral"}</td>
                          <td className="p-3 text-right font-mono font-medium text-slate-600">{formatMZ(t.subtotal)}</td>
                          <td className="p-3 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              t.vatTotal > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                            }`}>
                              {t.vatTotal > 0 ? "16%" : "0% (Isento)"}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-medium text-slate-800">{formatMZ(t.vatTotal)}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">{formatMZ(t.grandTotal)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Enviar Fatura por E-mail</h3>
                <p className="text-xs text-slate-500 mt-0.5">Disparo via Gmail Oficial</p>
              </div>
              <div className="bg-orange-50 text-orange-600 p-2 rounded-xl">
                <Send className="w-5 h-5" />
              </div>
            </div>
            
            <form onSubmit={handleSendInvoiceEmail} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 mb-2">
                <p className="text-xs text-slate-600 font-semibold mb-1">Fatura Selecionada:</p>
                <div className="flex justify-between items-center font-mono">
                  <span className="font-bold text-slate-900">{showEmailModal.invoiceNumber}</span>
                  <span className="font-bold text-emerald-600">{showEmailModal.grandTotal.toLocaleString()} {currency}</span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">E-mail do Cliente</label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="cliente@email.com"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailModal(null);
                    setTargetEmail("");
                  }}
                  disabled={sendingInvoiceId === showEmailModal.id}
                  className="w-1/2 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingInvoiceId === showEmailModal.id || !targetEmail}
                  className="w-1/2 py-2.5 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-slate-900/20 disabled:opacity-70"
                >
                  {sendingInvoiceId === showEmailModal.id ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0"></span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Enviar Agora
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 flex flex-col gap-4">
            
            {/* Modal Header (No-Print) */}
            <div className="no-print flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-orange-500" />
                <h3 className="font-extrabold text-slate-900 text-sm">Comprovativo de Venda</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                Fechar ×
              </button>
            </div>

            {/* Printable Receipt Layout */}
            <div id="print-modal-container" className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-[11px] leading-tight text-slate-705 max-h-[420px] overflow-y-auto select-all">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #print-modal-container, #print-modal-container * {
                    visibility: visible !important;
                  }
                  #print-modal-container {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    border: none !important;
                    background: white !important;
                    color: black !important;
                    padding: 20px !important;
                    margin: 0 !important;
                    box-shadow: none !important;
                    overflow: visible !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}</style>

              <div className="text-center font-bold text-slate-800 mb-2 border-b border-dashed border-slate-300 pb-2">
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="Logo Recibo"
                    className="w-10 h-10 object-contain mx-auto mb-1.5 bg-white p-0.5 rounded border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                )}
                <p className="uppercase">{settings.companyName || "OST COMÉRCIO CENTRAL"}</p>
                <p className="font-normal text-[9px] text-slate-500 font-sans">{settings.storeAddress || "Av. Marginal, Kiosk 14, Maputo"}</p>
                <p className="font-normal text-[9px] text-slate-500 font-sans">NUIT: {settings.companyNuit || "400293112"}</p>
              </div>

              <div className="space-y-1 mb-2">
                <p><span className="text-slate-500">Fatura:</span> {showPrintModal.invoiceNumber}</p>
                <p><span className="text-slate-500">Data/Hora:</span> {new Date(showPrintModal.timestamp).toLocaleString()}</p>
                <p><span className="text-slate-500">Operador:</span> {showPrintModal.cashierName}</p>
                <p><span className="text-slate-500">Cliente:</span> {showPrintModal.customerName || "Consumidor Geral"}</p>
                {showPrintModal.nuit && <p><span className="text-slate-500">NUIT Cli:</span> {showPrintModal.nuit}</p>}
              </div>

              <div className="border-b border-dashed border-slate-300 py-1 mb-2">
                <div className="grid grid-cols-12 gap-1 font-bold text-slate-800 text-[10px]">
                  <span className="col-span-6 truncate">PRODUTO</span>
                  <span className="col-span-2 text-center">QTD</span>
                  <span className="col-span-4 text-right">VALOR</span>
                </div>
                {showPrintModal.items.map((item, i) => (
                  <div key={`${item.productId}-${i}`} className="grid grid-cols-12 gap-1 py-0.5 text-slate-600">
                    <span className="col-span-6 truncate">{item.productName}</span>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-4 text-right">{(item.price * item.quantity).toLocaleString()} {currency}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-slate-600 text-right">
                <p>SUBTOTAL: {showPrintModal.subtotal.toLocaleString()} {currency}</p>
                {showPrintModal.discountTotal > 0 && <p className="text-red-650 font-bold">DESC. GER: -{showPrintModal.discountTotal.toLocaleString()} {currency}</p>}
                <p>TOTAL IVA COBRADO: {showPrintModal.vatTotal.toLocaleString()} {currency}</p>
                <p className="text-slate-900 font-bold text-xs border-t border-dashed border-slate-300 pt-1">
                  TOTAL PAGO: {showPrintModal.grandTotal.toLocaleString()} {currency}
                </p>
                <p className="text-[10px] text-slate-500 font-medium italic mt-1">Método: {showPrintModal.paymentMethod}</p>
                {showPrintModal.paymentDetails && (
                  <p className="text-[9.5px] text-red-600 font-semibold italic mt-0.5">{showPrintModal.paymentDetails}</p>
                )}
              </div>

              <p className="text-center font-semibold text-[9px] text-slate-500 mt-3 border-t border-dashed border-slate-300 pt-2 block">
                *** Muito Obrigado Pela Visita! ***
              </p>

              {/* Unique QR Code Generator for Digital Receipt */}
              <div className="mt-3 pt-3 border-t border-dashed border-slate-300 flex flex-col items-center justify-center gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm no-print">
                <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(showPrintModal.invoiceNumber)}`}
                    alt={`QR Code Fatura ${showPrintModal.invoiceNumber}`}
                    className="w-20 h-20 object-contain"
                  />
                </div>
                <div className="text-center">
                  <span className="text-[8px] font-black text-slate-700 tracking-wider font-sans uppercase">RECIBO DIGITAL</span>
                  <p className="text-[7.5px] text-slate-400 font-sans mt-0.5 max-w-[180px] mx-auto leading-tight">
                    Aponte a câmara para visualizar a fatura digital <strong className="font-semibold text-slate-600">#{showPrintModal.invoiceNumber}</strong>
                  </p>
                </div>
              </div>

              {showPrintModal.fiscalCertified && (
                <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-500 font-sans space-y-2">
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-slate-700 tracking-wider">DOCUMENTO FISCAL HOMOLOGADO</p>
                    <p className="text-[8px]">Certificação Nº: {settings.fiscalCertificationNumber || "OST/CERT/00249/2026"}</p>
                    {showPrintModal.fiscalKeys && <p className="font-mono text-[8px] bg-white py-0.5 rounded border border-slate-200 px-1 font-bold text-slate-800 select-all">Chave: {showPrintModal.fiscalKeys}</p>}
                    {showPrintModal.fiscalHash && <p className="font-mono text-[6.5px] text-slate-400 break-all leading-tight">Assinatura: {showPrintModal.fiscalHash}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Print Action Buttons (No-Print) */}
            <div className="no-print flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    printInvoiceHTML(showPrintModal, settings);
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="w-full py-2.5 font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-orange-650/20 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Fatura (Nova Janela)
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(null)}
                  className="w-1/2 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition cursor-pointer text-center"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.print();
                    } catch (err) {
                      console.warn(err);
                    }
                  }}
                  className="w-1/2 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  Via Térmica
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
