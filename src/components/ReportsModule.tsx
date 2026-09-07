import React, { useState, useMemo, useCallback, memo } from "react";
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
  Printer, 
  Calendar, 
  Activity, 
  User, 
  ShieldAlert, 
  AlertTriangle, 
  Flame 
} from "lucide-react";
import { Transaction, SystemSettings, AuditLog } from "../types";
import { sendEmail } from "../lib/gmail";
import { authenticatedFetch } from "../lib/apiClient";
import { generateInvoiceEmailHtml } from "../lib/emailTemplate";
import { SYSTEM_THEMES } from "../lib/themes";
import { ReportsGeneralTab } from "./reports/ReportsGeneralTab";
import { ReportsIvaTab } from "./reports/ReportsIvaTab";
import { ReportsActivityTab } from "./reports/ReportsActivityTab";
import { ReportsEmailModal } from "./reports/ReportsEmailModal";
import { ReportsPrintModal } from "./reports/ReportsPrintModal";
import { ReportsMonthlyModal } from "./reports/ReportsMonthlyModal";
import { getBase64ImageFromUrl, getFormatFromBase64 } from "./reports/reportsExportHelper";

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: { finalY: number };
}

interface ReportsModuleProps {
  transactions: Transaction[];
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currency: string;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
  auditLogs?: AuditLog[];
}

function ReportsModule({
  transactions,
  settings,
  onUpdateSettings,
  onAddAuditLog,
  currency,
  onShowToast,
  auditLogs = []
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

  // Individual Email Send States
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState("");
  const [showEmailModal, setShowEmailModal] = useState<Transaction | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<Transaction | null>(null);

  const handleOpenEmailModal = useCallback((t: Transaction) => {
    setShowEmailModal(t);
  }, []);

  const handleOpenPrintModal = useCallback((t: Transaction) => {
    setShowPrintModal(t);
  }, []);

  // Monthly summary state & calculations
  const [showMonthlySummaryModal, setShowMonthlySummaryModal] = useState(false);

  const getMonthNamePT = (monthIndex: number) => {
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return months[monthIndex];
  };

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Filter transactions for current month
    const monthlyTx = transactions.filter(t => {
      if (!t.timestamp) return false;
      const d = new Date(t.timestamp);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    let totalSales = 0;
    let totalVat = 0;
    let totalDiscount = 0;
    let totalItemsCount = 0;

    const productSales: { [productName: string]: { qty: number; revenue: number } } = {};

    monthlyTx.forEach(t => {
      totalSales += t.grandTotal;
      totalVat += t.vatTotal;
      totalDiscount += t.discountTotal;
      t.items.forEach(item => {
        const name = item.productName || "Produto Geral";
        if (!productSales[name]) {
          productSales[name] = { qty: 0, revenue: 0 };
        }
        productSales[name].qty += item.quantity;
        productSales[name].revenue += (item.price * item.quantity);
        totalItemsCount += item.quantity;
      });
    });

    const averageTicket = monthlyTx.length ? Math.round(totalSales / monthlyTx.length) : 0;

    const topProducts = Object.entries(productSales)
      .map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5); // top 5

    return {
      monthlyTx,
      totalSales,
      totalVat,
      totalDiscount,
      totalItemsCount,
      averageTicket,
      topProducts,
      monthName: getMonthNamePT(currentMonth),
      year: currentYear
    };
  }, [transactions]);

  // Active sub-tab state inside ReportsModule
  const [activeSubTab, setActiveSubTab] = useState<"general" | "iva" | "activity">("general");

  // Grouping for the system activity bar chart
  const [activityGrouping, setActivityGrouping] = useState<"daily" | "hourly" | "module">("daily");

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

  // Memoized audit logs filtered by active dates
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (!log.timestamp) return false;
      const logDate = log.timestamp.split("T")[0];
      return logDate >= startDate && logDate <= endDate;
    });
  }, [auditLogs, startDate, endDate]);

  // Audit Logs analytics calculations
  const activityAnalytics = useMemo(() => {
    const dailyCounts: Record<string, number> = {};
    const hourlyCounts: Record<string, number> = {};
    const moduleCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    filteredLogs.forEach(log => {
      // Daily grouping
      if (log.timestamp) {
        const dateStr = log.timestamp.split("T")[0];
        dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;

        // Hourly grouping
        const parts = log.timestamp.split("T");
        if (parts[1]) {
          const hour = parts[1].slice(0, 2) + "h";
          hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
        }
      }

      // Module grouping
      const mod = log.module || "GERAL";
      moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;

      // User grouping
      const usr = log.user || "Sistema";
      userCounts[usr] = (userCounts[usr] || 0) + 1;
    });

    // Peak daily activity
    let peakActivityValue = 0;
    let peakActivityDate = "";
    Object.entries(dailyCounts).forEach(([date, count]) => {
      if (count > peakActivityValue) {
        peakActivityValue = count;
        peakActivityDate = date;
      }
    });

    // Active modules count and most active
    const activeModulesCount = Object.keys(moduleCounts).length;
    let mostActiveModule = "";
    let mostActiveModuleLogsCount = 0;
    Object.entries(moduleCounts).forEach(([mod, count]) => {
      if (count > mostActiveModuleLogsCount) {
        mostActiveModuleLogsCount = count;
        mostActiveModule = mod;
      }
    });

    // Most active operator
    let mostActiveUser = "";
    let mostActiveUserLogsCount = 0;
    Object.entries(userCounts).forEach(([usr, count]) => {
      if (count > mostActiveUserLogsCount) {
        mostActiveUserLogsCount = count;
        mostActiveUser = usr;
      }
    });

    return {
      dailyCounts,
      hourlyCounts,
      moduleCounts,
      peakActivityValue,
      peakActivityDate,
      activeModulesCount,
      mostActiveModule,
      mostActiveUser,
      mostActiveUserLogsCount
    };
  }, [filteredLogs]);

  // Chart data based on activityGrouping selector
  const chartData = useMemo(() => {
    if (activityGrouping === "daily") {
      return Object.entries(activityAnalytics.dailyCounts)
        .map(([date, count]) => ({
          label: date,
          count
        }))
        .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
    } else if (activityGrouping === "hourly") {
      const hours = Array.from({ length: 24 }, (_, i) => {
        const h = String(i).padStart(2, "0") + "h";
        return {
          label: h,
          count: activityAnalytics.hourlyCounts[h] || 0
        };
      });
      // Filter out hours with zero activity to make it clean, or keep all to see full day.
      // Let's keep all 24 hours to clearly show peaks across the day, or only those with activity.
      // Keeping all 24 hours is a nice full-day curve.
      return hours;
    } else {
      return Object.entries(activityAnalytics.moduleCounts)
        .map(([moduleName, count]) => ({
          label: moduleName,
          count: Number(count)
        }))
        .sort((a, b) => b.count - a.count);
    }
  }, [activityGrouping, activityAnalytics]);

  const formatMZ = useCallback((val: number) => {
    return new Intl.NumberFormat('pt-MZ', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(val) + " MT";
  }, []);

  // Handle saving configurations
  const handleSaveEmailConfig = useCallback((e: React.FormEvent) => {
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
  }, [recipientEmail, reportHour, reportFrequency, onUpdateSettings, onAddAuditLog]);

  // Test Dispatch simulated emails via Express Server `/api/email/send-report`
  const handleTriggerTestEmail = useCallback(async () => {
    setTestSendStatus("sending");

    try {
      const response = await authenticatedFetch("/api/email/send-report", {
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
    } catch (err) {
      setTestSendStatus("idle");
      const errMsg = err.message || "Erro desconhecido ao despachar correio.";
      if (onShowToast) {
        onShowToast(errMsg, "error", "Falha de Envio");
      }
    }
  }, [recipientEmail, reportFrequency, financialTotals, onAddAuditLog, onShowToast]);

  const handleSendInvoiceEmail = useCallback(async (e: React.FormEvent) => {
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
      
      const finalY = (doc as AutoTableDoc).lastAutoTable?.finalY || 50;
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
    } catch (error) {
      if (onShowToast) onShowToast(`Falha ao enviar e-mail: ${error.message}`, "error");
      onAddAuditLog("Erro no Envio de Fatura (Gmail)", "RELATÓRIOS", `Falha ao enviar fatura ${showEmailModal.invoiceNumber} para ${targetEmail}: ${error.message}`);
    } finally {
      setSendingInvoiceId(null);
    }
  }, [showEmailModal, targetEmail, settings, onShowToast, onAddAuditLog]);

  // Real exports compilation
  const handlePerformExport = useCallback(() => {
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
  }, [exportFormat, reportType, startDate, endDate, financialTotals, filteredTransactions, settings, formatMZ, onAddAuditLog]);

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

        const finalY = (doc as AutoTableDoc).lastAutoTable?.finalY || 120;

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
      } catch (err) {
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

  const handleExportMonthlySummaryPDF = async () => {
    setIsExporting(true);
    if (onShowToast) {
      onShowToast("Gerando PDF Estruturado do Resumo Executivo Mensal...", "info", "Aguarde");
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
        // 1. Beautiful color header band
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
        doc.text(`RESUMO EXECUTIVO MENSAL - ${monthlyStats.monthName.toUpperCase()} DE ${monthlyStats.year}`, 14, 48);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Período de Apuração: 01 de ${monthlyStats.monthName} de ${monthlyStats.year} até hoje`, 14, 54);
        doc.text(`Emitido em: ${new Date().toLocaleString("pt-MZ")} | Moeda: Meticais (MT)`, 14, 59);

        // 5. Beautiful Metric Cards Row
        // Card 1: Faturamento Mensal
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(14, 65, 57, 20, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, 65, 57, 20, "S");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("FATURAÇÃO MENSAL", 18, 71);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(rgbArray[0], rgbArray[1], rgbArray[2]);
        doc.text(formatMZ(monthlyStats.totalSales), 18, 79);

        // Card 2: Ticket Médio
        doc.setFillColor(248, 250, 252);
        doc.rect(76, 65, 57, 20, "F");
        doc.rect(76, 65, 57, 20, "S");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("TICKET MÉDIO", 80, 71);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(formatMZ(monthlyStats.averageTicket), 80, 79);

        // Card 3: Volume & Qtd Itens
        doc.setFillColor(248, 250, 252);
        doc.rect(138, 65, 58, 20, "F");
        doc.rect(138, 65, 58, 20, "S");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("ITENS VENDIDOS", 142, 71);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(`${monthlyStats.totalItemsCount.toLocaleString()} unidades`, 142, 79);

        // 6. Section: Resumo de Impostos e Descontos
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("BALANÇO DE ENCARGOS E IMPOSTOS DO MÊS", 14, 94);

        const summaryHead = [["Métrica", "Valor Acumulado (MT)"]];
        const summaryBody = [
          ["Faturamento Bruto das Faturas", formatMZ(monthlyStats.totalSales)],
          ["IVA Coletado sobre Vendas (16%)", formatMZ(monthlyStats.totalVat)],
          ["Total de Descontos Concedidos aos Clientes", `-${formatMZ(monthlyStats.totalDiscount)}`],
          ["Volume Total de Transações Processadas", `${monthlyStats.monthlyTx.length} vendas`]
        ];

        autoTable(doc, {
          startY: 98,
          head: summaryHead,
          body: summaryBody,
          theme: "striped",
          styles: { fontSize: 8.5, cellPadding: 3.5 },
          headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: {
            1: { halign: "right", fontStyle: "bold" }
          }
        });

        const secondStartY = ((doc as AutoTableDoc).lastAutoTable?.finalY || 0) + 12;

        // 7. Section: Top Products Table
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("PRODUTOS MAIS VENDIDOS (TOP 5)", 14, secondStartY);

        const prodHead = [["Posição", "Nome do Produto", "Quantidade Vendida", "Faturamento Acumulado"]];
        const prodBody = monthlyStats.topProducts.map((p, index) => [
          `#${index + 1}`,
          p.name,
          `${p.qty} un`,
          formatMZ(p.revenue)
        ]);

        autoTable(doc, {
          startY: secondStartY + 4,
          head: prodHead,
          body: prodBody,
          theme: "striped",
          styles: { fontSize: 8.5, cellPadding: 3.5 },
          headStyles: { fillColor: [rgbArray[0], rgbArray[1], rgbArray[2]] as [number, number, number], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: {
            2: { halign: "right" },
            3: { halign: "right", fontStyle: "bold" }
          },
          didDrawPage: (data) => {
            // Footer
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${data.pageNumber}`, 14, 288);
            doc.text(`OST Vendas ERP - Resumo Mensal Comercial`, 120, 288);
          }
        });

        const finalY = (doc as AutoTableDoc).lastAutoTable?.finalY || secondStartY + 40;

        const drawSignatures = (targetDoc: typeof doc, startY: number) => {
          targetDoc.setDrawColor(203, 213, 225);
          targetDoc.line(20, startY + 15, 95, startY + 15);
          targetDoc.line(115, startY + 15, 190, startY + 15);
          
          targetDoc.setFont("helvetica", "bold");
          targetDoc.setFontSize(8);
          targetDoc.setTextColor(71, 85, 105);
          targetDoc.text("Assinatura do Responsável Comercial", 28, startY + 19);
          targetDoc.text("Diretor Geral / Administração", 128, startY + 19);

          targetDoc.setFont("helvetica", "normal");
          targetDoc.setFontSize(7.5);
          targetDoc.setTextColor(148, 163, 184);
          targetDoc.text("Este documento é um balancete executivo oficial de apoio gerencial, compilado a partir de vendas registradas em terminal POS.", 14, startY + 28);
        };

        if (finalY + 35 > 280) {
          doc.addPage();
          doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
          doc.rect(0, 0, 210, 8, "F");
          drawSignatures(doc, 15);
        } else {
          drawSignatures(doc, finalY);
        }

        doc.save(`Resumo_Executivo_Mensal_${monthlyStats.monthName}_${monthlyStats.year}.pdf`);
        
        onAddAuditLog(
          "Exportar Resumo Mensal PDF",
          "RELATÓRIOS",
          `Gestor exportou relatório de resumo executivo do mês de ${monthlyStats.monthName} de ${monthlyStats.year} contendo ${monthlyStats.monthlyTx.length} transações.`
        );

        if (onShowToast) {
          onShowToast("Resumo Mensal exportado com sucesso em PDF!", "success", "Relatório Gerado");
        }
      } catch (err) {
        console.error("Erro ao gerar resumo mensal PDF:", err);
        if (onShowToast) {
          onShowToast("Falha ao exportar relatório PDF mensal.", "error", "Erro de Exportação");
        }
      } finally {
        setIsExporting(false);
      }
    }, 1200);
  };

  const handleExportDailyFinancialSummaryPDF = async () => {
    setIsExporting(true);
    setExportMessage("");
    if (onShowToast) {
      onShowToast("Preparando Resumo Financeiro Diário...", "info", "Aguarde");
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

        // Filter transactions for the selected endDate
        const dailyTransactions = transactions.filter(t => {
          if (!t.timestamp) return false;
          return t.timestamp.split("T")[0] === endDate;
        });

        // Sort by timestamp ascending
        dailyTransactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Calculate daily totals
        let dailySalesTotal = 0;
        let dailyVatTotal = 0;
        let dailyDiscountTotal = 0;
        let dailySubtotalTotal = 0;

        dailyTransactions.forEach(t => {
          dailySalesTotal += t.grandTotal;
          dailyVatTotal += t.vatTotal;
          dailyDiscountTotal += t.discountTotal;
          dailySubtotalTotal += t.subtotal;
        });

        const dailyAvgTicket = dailyTransactions.length ? Math.round(dailySalesTotal / dailyTransactions.length) : 0;
        const dailyProfitTotal = Math.round(dailySalesTotal * 0.32); // margin estimate

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
        doc.text("RESUMO FINANCEIRO DIÁRIO", 14, 48);

        // Format Date beautifully
        let formattedDateString = endDate;
        try {
          formattedDateString = new Date(endDate + "T00:00:00").toLocaleDateString("pt-MZ", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          });
          // Capitalize first letter
          formattedDateString = formattedDateString.charAt(0).toUpperCase() + formattedDateString.slice(1);
        } catch (e) {
          formattedDateString = endDate;
        }

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Dia da Apuração: ${formattedDateString}`, 14, 54);
        doc.text(`Emitido em: ${new Date().toLocaleString("pt-MZ")} | Moeda Oficial: Meticais (MT)`, 14, 59);

        // 5. Beautiful Metric Cards Row
        // Card 1: Faturamento Bruto Diário
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(14, 65, 57, 20, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, 65, 57, 20, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("FATURAÇÃO DIÁRIA", 18, 71);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(rgbArray[0], rgbArray[1], rgbArray[2]);
        doc.text(formatMZ(dailySalesTotal), 18, 79);

        // Card 2: Imposto IVA Diário
        doc.setFillColor(248, 250, 252);
        doc.rect(76, 65, 57, 20, "F");
        doc.rect(76, 65, 57, 20, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("IVA DIÁRIO (16%)", 80, 71);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(formatMZ(dailyVatTotal), 80, 79);

        // Card 3: Volume & Ticket Médio
        doc.setFillColor(248, 250, 252);
        doc.rect(138, 65, 58, 20, "F");
        doc.rect(138, 65, 58, 20, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("VOLUME & TICKET MÉDIO", 142, 71);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(`${dailyTransactions.length} vendas | ${formatMZ(dailyAvgTicket)}`, 142, 79);

        // KPI Row 2
        // Card 4: Descontos Diários
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 89, 57, 18, "F");
        doc.rect(14, 89, 57, 18, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("DESCONTOS DIÁRIOS", 18, 94);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 38, 38); // red-600
        doc.text(`-${formatMZ(dailyDiscountTotal)}`, 18, 101);

        // Card 5: Margem Diária Est.
        doc.setFillColor(248, 250, 252);
        doc.rect(76, 89, 57, 18, "F");
        doc.rect(76, 89, 57, 18, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("LUCRO ESTIMADO (32%)", 80, 94);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129); // emerald-500
        doc.text(`+${formatMZ(dailyProfitTotal)}`, 80, 101);

        // Card 6: Subtotal Diário
        doc.setFillColor(248, 250, 252);
        doc.rect(138, 89, 58, 18, "F");
        doc.rect(138, 89, 58, 18, "S");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("VALOR SUB-TOTAL", 142, 94);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(formatMZ(dailySubtotalTotal), 142, 101);

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 113, 196, 113);

        // 6. Section: Payment Methods Distribution for the day
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("MEIOS DE PAGAMENTO DO DIA", 14, 120);

        const paymentBreakdown: Record<string, { count: number; total: number }> = {};
        dailyTransactions.forEach(t => {
          const method = t.paymentMethod || "OUTRO";
          if (!paymentBreakdown[method]) {
            paymentBreakdown[method] = { count: 0, total: 0 };
          }
          paymentBreakdown[method].count += 1;
          paymentBreakdown[method].total += t.grandTotal;
        });

        const totalTransactions = dailyTransactions.length || 1;
        const totalRevenue = dailySalesTotal || 1;

        const paymentRows = Object.entries(paymentBreakdown).map(([method, data]) => {
          // Translate payment methods beautifully
          let readableMethod = method;
          if (method === "CASH") readableMethod = "Dinheiro (Caixa)";
          else if (method === "MPESA_PAGA_FACIL") readableMethod = "M-Pesa (Paga Fácil)";
          else if (method === "EMOLA") readableMethod = "e-Mola";
          else if (method === "POS_CARD") readableMethod = "POS / Cartão Débito";
          else if (method === "CREDIT_CARD") readableMethod = "Cartão de Crédito";
          else if (method === "BANK_TRANSFER") readableMethod = "Transferência Bancária";
          else if (method === "MIXED") readableMethod = "Misto (Dinheiro + Digital)";
          else if (method === "DEBT") readableMethod = "Crédito / Conta Corrente";

          return [
            readableMethod,
            `${data.count} transações`,
            `${((data.count / totalTransactions) * 100).toFixed(1)}%`,
            formatMZ(data.total),
            `${((data.total / totalRevenue) * 100).toFixed(1)}%`
          ];
        });

        autoTable(doc, {
          startY: 124,
          head: [["Meio de Pagamento", "Qtd Transações", "% Transações", "Faturamento do Dia", "% Receita"]],
          body: paymentRows.length > 0 ? paymentRows : [["Nenhum faturamento registrado no dia", "0", "0%", "0,00 MT", "0%"]],
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: {
            3: { halign: "right", fontStyle: "bold" },
            4: { halign: "right" }
          }
        });

        let nextY = ((doc as AutoTableDoc).lastAutoTable?.finalY || 0) + 10;

        // 7. Section: Detailed Sales List for the Day
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("TRANSAÇÕES DETALHADAS DO DIA", 14, nextY);

        const tableHead = [["FATURA", "HORA", "CLIENTE", "MÉTODO", "SUBTOTAL", "DESC", "IVA", "TOTAL MT"]];
        const tableBody = dailyTransactions.map(t => {
          let timeStr = "";
          try {
            timeStr = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            timeStr = t.timestamp.split("T")[1]?.slice(0, 5) || "";
          }

          let readableMethod: string = t.paymentMethod;
          if (t.paymentMethod === "CASH") readableMethod = "DINHEIRO";
          else if (t.paymentMethod === "MPESA_PAGA_FACIL") readableMethod = "M-PESA";
          else if (t.paymentMethod === "POS_CARD") readableMethod = "CARTÃO";

          return [
            t.invoiceNumber,
            timeStr,
            t.customerName || "Consumidor Geral",
            readableMethod,
            formatMZ(t.subtotal),
            `-${formatMZ(t.discountTotal)}`,
            formatMZ(t.vatTotal),
            formatMZ(t.grandTotal)
          ];
        });

        autoTable(doc, {
          startY: nextY + 4,
          head: tableHead,
          body: tableBody.length > 0 ? tableBody : [["-", "-", "Nenhuma venda registrada no dia", "-", "0,00 MT", "0,00 MT", "0,00 MT", "0,00 MT"]],
          theme: "striped",
          styles: { fontSize: 7.5, cellPadding: 2 },
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

        nextY = ((doc as AutoTableDoc).lastAutoTable?.finalY || 0) + 10;

        // 8. Signatures Section
        const drawDocSignatures = (targetDoc: typeof doc, startY: number) => {
          targetDoc.setDrawColor(203, 213, 225);
          targetDoc.line(20, startY + 12, 90, startY + 12);
          targetDoc.line(120, startY + 12, 190, startY + 12);

          targetDoc.setFont("helvetica", "bold");
          targetDoc.setFontSize(8);
          targetDoc.setTextColor(71, 85, 105);
          targetDoc.text("Responsável de Vendas / Operador", 26, startY + 16);
          targetDoc.text("Supervisor / Diretor Administrativo", 126, startY + 16);

          targetDoc.setFont("helvetica", "normal");
          targetDoc.setFontSize(7.5);
          targetDoc.setTextColor(148, 163, 184);
          targetDoc.text("Documento oficial gerencial para conciliação diária de faturamento físico e digital.", 14, startY + 24);
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
        doc.save(`Resumo_Financeiro_Diario_${endDate}.pdf`);

        setExportMessage(`Resumo Financeiro Diário (A4 PDF) de ${endDate} gerado com sucesso!`);
        onAddAuditLog(
          "Exportar Resumo Financeiro Diário PDF",
          "RELATÓRIOS",
          `Gestor exportou resumo financeiro diário de ${endDate}.`
        );

        if (onShowToast) {
          onShowToast("Resumo Financeiro Diário gerado com sucesso!", "success", "PDF Exportado");
        }
      } catch (err) {
        console.error("Erro ao gerar PDF de resumo diário:", err);
        setExportMessage(`Erro ao compilar PDF diário: ${err.message || err}`);
        if (onShowToast) {
          onShowToast("Falha ao gerar resumo financeiro diário.", "error", "Erro de Exportação");
        }
      } finally {
        setIsExporting(false);
      }
    }, 1200);
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

        let nextY = ((doc as AutoTableDoc).lastAutoTable?.finalY || 0) + 10;

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

        nextY = ((doc as AutoTableDoc).lastAutoTable?.finalY || 0) + 10;

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
      } catch (err) {
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

        let nextY = ((doc as AutoTableDoc).lastAutoTable?.finalY || 0) + 10;

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
        const lastY = ((doc as AutoTableDoc).lastAutoTable?.finalY || 0) + 12;
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
      } catch (err) {
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
    } catch (err) {
      console.error(err);
      if (onShowToast) {
        onShowToast("Falha ao exportar CSV de IVA.", "error");
      }
    }
  };

  const handleExportActivityLogsPDF = async () => {
    setIsExporting(true);
    setExportMessage("");
    if (onShowToast) {
      onShowToast("Gerando Relatório de Auditoria e Atividade com Logotipo...", "info", "Aguarde");
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

        // Header band
        doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
        doc.rect(0, 0, 210, 8, "F");

        // Company Logo
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

        // Title
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("RELATÓRIO DE AUDITORIA E ATIVIDADES DO SISTEMA", 14, 46);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`Período de Análise: ${new Date(startDate).toLocaleDateString()} até ${new Date(endDate).toLocaleDateString()}`, 14, 52);
        doc.text(`Emitido em: ${new Date().toLocaleString()} | Total de Registros: ${filteredLogs.length}`, 14, 57);

        // KPI Summary Table
        const kpiHead = [["MÉTRICA DE AUDITORIA", "VALOR / DETALHE"]];
        const kpiBody = [
          ["Total de Ações Registradas", `${filteredLogs.length} ações`],
          ["Módulo Mais Ativo", activityAnalytics.mostActiveModule || "N/A"],
          ["Operador Mais Ativo", `${activityAnalytics.mostActiveUser || "N/D"} (${activityAnalytics.mostActiveUserLogsCount} ações)`],
          ["Pico de Atividade Registrado", `${activityAnalytics.peakActivityValue} ações em ${activityAnalytics.peakActivityDate || "N/D"}`]
        ];

        autoTable(doc, {
          startY: 64,
          head: kpiHead,
          body: kpiBody,
          theme: "grid",
          headStyles: { fillColor: [rgbArray[0], rgbArray[1], rgbArray[2]] as [number, number, number], textColor: [255, 255, 255] },
          styles: { fontSize: 8.5, cellPadding: 3 },
          columnStyles: {
            1: { fontStyle: "bold" }
          }
        });

        let nextY = ((doc as AutoTableDoc).lastAutoTable?.finalY || 0) + 10;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("REGISTRO OPERACIONAL DE AUDITORIA", 14, nextY);

        const logsHead = [["DATA/HORA", "OPERADOR", "MÓDULO", "AÇÃO", "DETALHES"]];
        const logsBody = [...filteredLogs].reverse().slice(0, 40).map(log => [
          new Date(log.timestamp).toLocaleString("pt-MZ"),
          log.user || "Sistema",
          log.module,
          log.action,
          log.details || "-"
        ]);

        autoTable(doc, {
          startY: nextY + 4,
          head: logsHead,
          body: logsBody,
          theme: "striped",
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
          styles: { fontSize: 7.5, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { fontStyle: "bold", cellWidth: 30 },
            2: { cellWidth: 25 },
            3: { fontStyle: "bold", cellWidth: 35 }
          }
        });

        doc.save(`Relatorio_Auditoria_${startDate}_a_${endDate}.pdf`);
        setExportMessage(`Relatório de Auditoria PDF compilado com sucesso!`);
        onAddAuditLog("Exportar Relatório Auditoria PDF", "RELATÓRIOS", `Relatório de auditoria exportado com ${filteredLogs.length} logs.`);

        if (onShowToast) {
          onShowToast("Relatório de Auditoria em PDF gerado com sucesso!", "success", "PDF Exportado");
        }
      } catch (err) {
        console.error("Erro ao gerar PDF de Auditoria:", err);
        setExportMessage(`Erro ao gerar PDF: ${err.message}`);
        if (onShowToast) {
          onShowToast(`Erro ao gerar PDF: ${err.message}`, "error", "Falha de Exportação");
        }
      } finally {
        setIsExporting(false);
      }
    }, 800);
  };

  const handleExportCurrentViewPDF = async () => {
    if (activeSubTab === "iva") {
      await handleExportIvaPdf();
    } else if (activeSubTab === "activity") {
      await handleExportActivityLogsPDF();
    } else {
      if (reportType === "VAT") {
        await handleExportIvaPdf();
      } else if (reportType === "FINANCE") {
        await handleExportDailyFinancialSummaryPDF();
      } else {
        await handleExportSalesSummaryPDF();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Navigation inside ReportsModule */}
      <div className="flex border-b border-slate-200 gap-2 bg-white p-2.5 rounded-2xl border flex-wrap items-center justify-between shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <button
            id="btn-subtab-reports-general"
            type="button"
            onClick={() => setActiveSubTab("general")}
            className={`px-5 py-2.5 font-bold text-xs transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
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
            className={`px-5 py-2.5 font-bold text-xs transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
              activeSubTab === "iva"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Percent className="w-4 h-4" />
            Calculadora & Declaração de IVA
          </button>
          <button
            id="btn-subtab-reports-activity"
            type="button"
            onClick={() => setActiveSubTab("activity")}
            className={`px-5 py-2.5 font-bold text-xs transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
              activeSubTab === "activity"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Activity className="w-4 h-4 text-orange-500 animate-pulse" />
            Atividade & Auditoria (Gráfico)
          </button>
        </div>

        {/* Master PDF Export Button with Logo */}
        <button
          type="button"
          id="btn-export-current-view-pdf"
          onClick={handleExportCurrentViewPDF}
          disabled={isExporting}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs cursor-pointer bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/20 transition-all ${
            isExporting ? "opacity-50 cursor-not-allowed" : "active:scale-95 hover:scale-[1.02]"
          }`}
          title="Exportar a vista atual como relatório PDF formatado com o logotipo da empresa"
        >
          <Printer className="w-4 h-4 text-amber-100 shrink-0" />
          <span>{isExporting ? "Compilando PDF..." : "Exportar Vista Atual em PDF (com Logotipo)"}</span>
        </button>
      </div>

      {activeSubTab === "general" && (
        <ReportsGeneralTab
          financialTotals={financialTotals}
          filteredTransactions={filteredTransactions}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          reportType={reportType}
          setReportType={setReportType}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          exportMessage={exportMessage}
          setExportMessage={setExportMessage}
          isExporting={isExporting}
          setIsExporting={setIsExporting}
          monthlyStats={monthlyStats}
          setShowMonthlySummaryModal={setShowMonthlySummaryModal}
          onExportMonthlySummaryPDF={handleExportMonthlySummaryPDF}
          onPerformExport={handlePerformExport}
          onExportSalesSummaryPDF={handleExportSalesSummaryPDF}
          onExportDailyFinancialSummaryPDF={handleExportDailyFinancialSummaryPDF}
          onPerformExecutivePrintPDF={handlePerformExecutivePrintPDF}
          localError={localError}
          recipientEmail={recipientEmail}
          setRecipientEmail={setRecipientEmail}
          reportHour={reportHour}
          setReportHour={setReportHour}
          reportFrequency={reportFrequency}
          setReportFrequency={setReportFrequency}
          saveSettingsSuccess={saveSettingsSuccess}
          onSaveEmailConfig={handleSaveEmailConfig}
          testSendStatus={testSendStatus}
          onTriggerTestEmail={handleTriggerTestEmail}
          currency={currency}
          settings={settings}
          formatMZ={formatMZ}
          onOpenEmail={handleOpenEmailModal}
          onOpenPrint={handleOpenPrintModal}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {activeSubTab === "iva" && (
        <ReportsIvaTab
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          manualIvaDeduction={manualIvaDeduction}
          setManualIvaDeduction={setManualIvaDeduction}
          simulatedIvaRate={simulatedIvaRate}
          setSimulatedIvaRate={setSimulatedIvaRate}
          financialTotals={financialTotals}
          vatCalculations={vatCalculations}
          filteredTransactions={filteredTransactions}
          vatFilterClass={vatFilterClass}
          setVatFilterClass={setVatFilterClass}
          exportMessage={exportMessage}
          isExporting={isExporting}
          onExportIvaPdf={handleExportIvaPdf}
          onExportIvaCsv={handleExportIvaCsv}
          formatMZ={formatMZ}
        />
      )}

      {activeSubTab === "activity" && (
        <ReportsActivityTab
          filteredLogs={filteredLogs}
          activityAnalytics={activityAnalytics}
          chartData={chartData}
          activityGrouping={activityGrouping}
          setActivityGrouping={setActivityGrouping}
          onExportActivityLogsPDF={handleExportActivityLogsPDF}
          isExporting={isExporting}
          settings={settings}
        />
      )}

      <ReportsEmailModal
        showEmailModal={showEmailModal}
        targetEmail={targetEmail}
        setTargetEmail={setTargetEmail}
        sendingInvoiceId={sendingInvoiceId}
        currency={currency}
        onClose={() => {
          setShowEmailModal(null);
          setTargetEmail("");
        }}
        onSubmit={handleSendInvoiceEmail}
      />

      <ReportsPrintModal
        showPrintModal={showPrintModal}
        settings={settings}
        currency={currency}
        onClose={() => setShowPrintModal(null)}
      />

      <ReportsMonthlyModal
        showMonthlySummaryModal={showMonthlySummaryModal}
        monthlyStats={monthlyStats}
        isExporting={isExporting}
        formatMZ={formatMZ}
        onClose={() => setShowMonthlySummaryModal(false)}
        onExportPDF={handleExportMonthlySummaryPDF}
      />

    </div>
  );
}

export default memo(ReportsModule);
