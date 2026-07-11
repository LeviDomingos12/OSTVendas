import React, { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  PiggyBank, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertOctagon, 
  Plus, 
  History, 
  User,
  Calculator,
  CheckCircle,
  FileText,
  Printer,
  Calendar,
  Search,
  Download,
  FileSpreadsheet,
  Coins,
  ShieldCheck,
  Filter,
  Users,
  AlertTriangle,
  Clock,
  Check,
  RotateCcw,
  UserCheck
} from "lucide-react";
import { CashFlowEntry, Transaction, UserRole, SystemSettings } from "../types";
import CashAnalyticalCharts from "./CashAnalyticalCharts";
import DenominationCounter, { DENOMINATIONS } from "./DenominationCounter";

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
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

interface CashRegisterModuleProps {
  cashFlow: CashFlowEntry[];
  transactions: Transaction[];
  onAddCashFlowEntry: (entry: CashFlowEntry) => void;
  activeUsername: string;
  currentRole: UserRole;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currency: string;
  settings?: SystemSettings;
}

export default function CashRegisterModule({
  cashFlow,
  transactions,
  onAddCashFlowEntry,
  activeUsername,
  currentRole,
  onAddAuditLog,
  currency,
  settings = {} as any
}: CashRegisterModuleProps) {
  
  // Tabs: "active" (Painel Analítico) | "closures" (Histórico de Fechamento)
  const [activeModuleTab, setActiveModuleTab] = useState<"active" | "closures">("active");

  // Local state for registering new cash activity
  const [showAddForm, setShowAddForm] = useState(false);
  const [entryType, setEntryType] = useState<"REINFORCEMENT" | "EXPENSE" | "QUEBRA" | "INPUT">("REINFORCEMENT");
  const [entryAmount, setEntryAmount] = useState<number>(0);
  const [entryReason, setEntryReason] = useState("");
  const [entryResponsible, setEntryResponsible] = useState(activeUsername);
  const [entrySupplier, setEntrySupplier] = useState(""); // Supplier/Destinatário field
  const [localError, setLocalError] = useState("");
  const [isSimulatingPrint, setIsSimulatingPrint] = useState(false);

  // Closing drawer workflow states
  const [isOpenClosingPanel, setIsOpenClosingPanel] = useState(false);
  const [closingSupervisor, setClosingSupervisor] = useState("Inácio Macamo");
  const [supervisorPin, setSupervisorPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [closingObservation, setClosingObservation] = useState("");
  const [operatorSignature, setOperatorSignature] = useState("");
  const [showDenomCalculator, setShowDenomCalculator] = useState(false);

  // Denominations count state (for the counter)
  const [denomCounts, setDenomCounts] = useState<{ [key: string]: number }>({
    "1000": 20,
    "500": 18,
    "200": 15,
    "100": 30,
    "50": 40,
    "20": 50,
    "10": 20,
    "5": 10,
    "2": 15,
    "1": 20,
    "0.5": 10
  });

  const handleDenomChange = (value: number, count: number) => {
    setDenomCounts(prev => ({
      ...prev,
      [value.toString()]: count
    }));
  };

  const calculatedFromDenoms = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => {
      const count = denomCounts[d.value.toString()] || 0;
      return sum + (d.value * count);
    }, 0);
  }, [denomCounts]);

  // Physical count manual field state or linked
  const [physicalCount, setPhysicalCount] = useState<number>(136200);

  // Sync physical count with denoms
  const handleApplyDenomsToPhysicalCount = () => {
    setPhysicalCount(calculatedFromDenoms);
    setShowDenomCalculator(false);
  };

  // Past closures history (initial seed)
  const [closuresHistory, setClosuresHistory] = useState<any[]>([
    {
      id: "close-1",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      reinforcements: 5000,
      cashSales: 132450,
      inputs: 1500,
      expenses: 2450,
      quebras: 150,
      theoreticalBalance: 136350,
      physicalBalance: 136200,
      difference: -150,
      operator: "Levi Domingos",
      authorizedSupervisor: "Inácio Macamo",
      observations: "Diferença pontual por quebra física de moedas."
    },
    {
      id: "close-2",
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // Day before yesterday
      reinforcements: 5000,
      cashSales: 122350,
      inputs: 500,
      expenses: 450,
      quebras: 0,
      theoreticalBalance: 127400,
      physicalBalance: 127400,
      difference: 0,
      operator: "Marta Ubisse",
      authorizedSupervisor: "Inácio Macamo",
      observations: "Balanço 100% correto de fechamento."
    }
  ]);

  // Date selectors for analytics
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const past = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    return past.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Timeline list state for quick filters & search
  const [filterChip, setFilterChip] = useState<"TODOS" | "ENTRADAS" | "SAIDAS" | "REFORCOS" | "QUEBRAS" | "SANGRIAS">("TODOS");
  const [timelineSearch, setTimelineSearch] = useState("");

  // Memoized filtered cashflow entries & transactions
  const filteredCashFlow = useMemo(() => {
    return cashFlow.filter(f => {
      if (!f.timestamp) return false;
      const dateStr = f.timestamp.split("T")[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
  }, [cashFlow, startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.timestamp) return false;
      const dateStr = t.timestamp.split("T")[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
  }, [transactions, startDate, endDate]);

  // Calculations for cashier metrics
  const cashCalculation = useMemo(() => {
    const reinforcements = filteredCashFlow
      .filter(f => f.type === "REINFORCEMENT")
      .reduce((s, f) => s + f.amount, 0);

    const inputs = filteredCashFlow
      .filter(f => f.type === "INPUT")
      .reduce((s, f) => s + f.amount, 0);

    const cashSalesAmount = filteredTransactions
      .filter(t => t.paymentMethod === "CASH")
      .reduce((s, t) => s + t.grandTotal, 0);

    const expenses = filteredCashFlow
      .filter(f => f.type === "EXPENSE")
      .reduce((s, f) => s + f.amount, 0);

    const quebras = filteredCashFlow
      .filter(f => f.type === "QUEBRA")
      .reduce((s, f) => s + f.amount, 0);

    // Initial base value assumed (e.g. 5,000 MT opening + reinforcements)
    const openingValue = 5000;
    const totalEntradas = reinforcements + inputs + cashSalesAmount;
    const totalSaidas = expenses;
    const theoreticalTotal = openingValue + totalEntradas - totalSaidas - quebras;

    // Active Movements Count
    const movementsCount = filteredTransactions.filter(t => t.paymentMethod === "CASH").length + filteredCashFlow.length;

    return {
      openingValue,
      reinforcements,
      inputs,
      cashSalesAmount,
      expenses,
      quebras,
      theoreticalTotal,
      totalEntradas,
      totalSaidas,
      movementsCount
    };
  }, [filteredCashFlow, filteredTransactions]);

  // Active Discrepancy Status
  const lastDiscrepancy = useMemo(() => {
    const lastClose = closuresHistory[0];
    return lastClose ? lastClose.difference : 0;
  }, [closuresHistory]);

  const registerStateBadge = useMemo(() => {
    if (lastDiscrepancy !== 0) {
      return {
        label: "Caixa com Divergência",
        color: "bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40",
        bullet: "🔴"
      };
    }
    const totalCurrentCash = cashCalculation.theoreticalTotal;
    if (totalCurrentCash > 15000) {
      return {
        label: "Excesso de Caixa",
        color: "bg-amber-50 text-amber-650 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40",
        bullet: "⚠️"
      };
    }
    return {
      label: "Caixa Aberto & Equilibrado",
      color: "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40",
      bullet: "🟢"
    };
  }, [lastDiscrepancy, cashCalculation.theoreticalTotal]);

  // Compile unified chronology timeline (Item 13)
  const unifiedTimeline = useMemo(() => {
    const items: any[] = [];

    // Add cash transactions (sales)
    filteredTransactions.forEach(t => {
      if (t.paymentMethod === "CASH") {
        items.push({
          id: `tx-${t.id}`,
          timestamp: t.timestamp,
          type: "SALE",
          amount: t.grandTotal,
          reason: `Venda Comercial #${t.invoiceNumber}`,
          responsibleUser: t.cashierName,
          supplier: t.customerName || "Consumidor Final",
          isInput: true,
          badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-900/30",
          iconText: "🛒"
        });
      }
    });

    // Add cashflow entries
    filteredCashFlow.forEach(f => {
      const reasonStr = f.reason || "";
      const isInput = f.type === "REINFORCEMENT" || f.type === "INPUT";
      const isSangria = f.type === "EXPENSE" && (reasonStr.toLowerCase().includes("sangria") || reasonStr.toLowerCase().includes("retirada"));
      
      let badgeColor = "";
      let iconText = "";

      if (f.type === "REINFORCEMENT") {
        badgeColor = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/25 dark:text-blue-400 dark:border-blue-900/30";
        iconText = "➕";
      } else if (f.type === "INPUT") {
        badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-900/30";
        iconText = "💰";
      } else if (isSangria) {
        badgeColor = "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/25 dark:text-orange-400 dark:border-orange-900/30";
        iconText = "💸";
      } else if (f.type === "EXPENSE") {
        badgeColor = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/25 dark:text-rose-400 dark:border-rose-900/30";
        iconText = "❌";
      } else { // QUEBRA
        badgeColor = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/25 dark:text-purple-400 dark:border-purple-900/30";
        iconText = "⚠️";
      }

      items.push({
        id: f.id,
        timestamp: f.timestamp,
        type: f.type,
        amount: f.amount,
        reason: reasonStr,
        responsibleUser: f.responsibleUser,
        supplier: reasonStr.toLowerCase().includes("papel") ? "Papelaria Central" : 
                  reasonStr.toLowerCase().includes("limpeza") ? "Serviços Limpeza" : "Cofre Central",
        isInput,
        badgeColor,
        iconText
      });
    });

    // Sort descending chronologically
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [filteredTransactions, filteredCashFlow]);

  // Filtered timeline items based on search and chip selector
  const filteredTimeline = useMemo(() => {
    let result = unifiedTimeline;

    // Search query
    if (timelineSearch.trim() !== "") {
      const q = timelineSearch.toLowerCase();
      result = result.filter(item => 
        (item.reason || "").toLowerCase().includes(q) ||
        (item.responsibleUser || "").toLowerCase().includes(q) ||
        (item.supplier && item.supplier.toLowerCase().includes(q)) ||
        (item.amount || 0).toString().includes(q)
      );
    }

    // Filter chip
    if (filterChip === "ENTRADAS") {
      result = result.filter(item => item.isInput);
    } else if (filterChip === "SAIDAS") {
      result = result.filter(item => !item.isInput && item.type === "EXPENSE" && !(item.reason || "").toLowerCase().includes("sangria"));
    } else if (filterChip === "REFORCOS") {
      result = result.filter(item => item.type === "REINFORCEMENT");
    } else if (filterChip === "QUEBRAS") {
      result = result.filter(item => item.type === "QUEBRA");
    } else if (filterChip === "SANGRIAS") {
      result = result.filter(item => (item.reason || "").toLowerCase().includes("sangria") || (item.reason || "").toLowerCase().includes("retirada"));
    }

    return result;
  }, [unifiedTimeline, timelineSearch, filterChip]);

  // Hourly analytical bar data
  const hourlyData = useMemo(() => {
    const hours = ["08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h", "20h"];
    const chartMap: { [hour: string]: { Entradas: number; Saídas: number } } = {};
    
    hours.forEach(h => {
      chartMap[h] = { Entradas: 0, Saídas: 0 };
    });

    const parseHour = (ts: string) => {
      try {
        const d = new Date(ts);
        const hr = d.getHours();
        if (hr >= 8 && hr <= 20) {
          return `${String(hr).padStart(2, '0')}h`;
        }
      } catch (e) {}
      return null;
    };

    // Cash sales
    filteredTransactions.forEach(t => {
      if (t.paymentMethod === "CASH") {
        const hrStr = parseHour(t.timestamp);
        if (hrStr && chartMap[hrStr]) {
          chartMap[hrStr].Entradas += t.grandTotal;
        }
      }
    });

    // Cash flow items
    filteredCashFlow.forEach(f => {
      const hrStr = parseHour(f.timestamp);
      if (hrStr && chartMap[hrStr]) {
        if (f.type === "INPUT" || f.type === "REINFORCEMENT") {
          chartMap[hrStr].Entradas += f.amount;
        } else {
          chartMap[hrStr].Saídas += f.amount;
        }
      }
    });

    return hours.map(h => ({
      hour: h,
      Entradas: chartMap[h].Entradas,
      Saídas: chartMap[h].Saídas
    }));
  }, [filteredTransactions, filteredCashFlow]);

  // Operator handled cash sums
  const operatorsSummary = useMemo(() => {
    const map: { [name: string]: number } = {};

    filteredTransactions.forEach(t => {
      const name = t.cashierName || "Outro";
      if (!map[name]) map[name] = 0;
      if (t.paymentMethod === "CASH") {
        map[name] += t.grandTotal;
      }
    });

    filteredCashFlow.forEach(f => {
      const name = f.responsibleUser || "Outro";
      if (!map[name]) map[name] = 0;
      if (f.type === "REINFORCEMENT" || f.type === "INPUT") {
        map[name] += f.amount;
      } else {
        map[name] -= f.amount;
      }
    });

    return Object.entries(map).map(([name, val]) => ({
      name,
      value: val
    })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions, filteredCashFlow]);

  // Active alerts list (Item 16)
  const activeAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (cashCalculation.theoreticalTotal > 15000) {
      alerts.push("Sangria recomendada! O saldo em boca de caixa excedeu o limite máximo operacional de 15.000 MT.");
    }
    if (lastDiscrepancy !== 0) {
      alerts.push(`Diferença ativa! O último fechamento de turno acusou um desvio de ${lastDiscrepancy} MT.`);
    }
    const currentHr = new Date().getHours();
    if (currentHr >= 18) {
      alerts.push("Fechamento atrasado! O turno de atendimento está ativo há mais de 8 horas e deve ser fechado.");
    }
    return alerts;
  }, [cashCalculation, lastDiscrepancy]);

  // Create individual cash-flow launching
  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (entryAmount <= 0 || !entryReason.trim()) {
      setLocalError("Por favor, introduza um valor positivo e especifique o motivo.");
      return;
    }
    setLocalError("");

    let finalReason = entryReason;
    if (entryType === "EXPENSE" && entrySupplier.trim() !== "") {
      finalReason = `Compra: ${entryReason} (Fornecedor: ${entrySupplier})`;
    }

    const newEntry: CashFlowEntry = {
      id: `flow-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: entryType,
      amount: entryAmount,
      reason: finalReason,
      responsibleUser: entryResponsible
    };

    onAddCashFlowEntry(newEntry);
    onAddAuditLog(
      `Lançamento Caixa (${entryType})`,
      "CAIXA",
      `Lançamento de ${entryType} de ${entryAmount} ${currency} por ${entryResponsible}. Motivo: ${finalReason}`
    );

    setEntryAmount(0);
    setEntryReason("");
    setEntrySupplier("");
    setShowAddForm(false);
  };

  // Submit Closure Workflow (Item 11)
  const handlePerformClosure = () => {
    if (supervisorPin !== "1234") {
      setPinError("PIN do Supervisor incorreto! Use 1234 para homologar.");
      return;
    }
    setPinError("");

    const diff = physicalCount - cashCalculation.theoreticalTotal;

    const newClosure = {
      id: `close-${Date.now()}`,
      timestamp: new Date().toISOString(),
      reinforcements: cashCalculation.reinforcements,
      cashSales: cashCalculation.cashSalesAmount,
      inputs: cashCalculation.inputs,
      expenses: cashCalculation.expenses,
      quebras: cashCalculation.quebras,
      theoreticalBalance: cashCalculation.theoreticalTotal,
      physicalBalance: physicalCount,
      difference: diff,
      operator: activeUsername,
      authorizedSupervisor: closingSupervisor,
      observations: closingObservation || "Fechamento regular homologado."
    };

    setClosuresHistory(prev => [newClosure, ...prev]);

    onAddAuditLog(
      "Fechamento Turno Caixa",
      "CAIXA",
      `Turno de caixa fechado. Teórico: ${newClosure.theoreticalBalance} MT, Contado: ${newClosure.physicalBalance} MT. Diferença: ${newClosure.difference} MT. Autorizado por: ${closingSupervisor}`
    );

    // Export PDF on closure
    handleExportSingleClosurePDF(newClosure);

    // Show simulation visualizer
    setIsSimulatingPrint(true);
    setTimeout(() => {
      setIsSimulatingPrint(false);
      setIsOpenClosingPanel(false);
      // Reset Pin, signature
      setSupervisorPin("");
      setClosingObservation("");
      setOperatorSignature("");
    }, 4500);
  };

  // Export functions (Item 12)
  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    const logoData = await getBase64ImageFromUrl(settings?.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
    if (logoData) {
      doc.addImage(logoData, "JPEG", 165, 8, 30, 30);
    }

    doc.setFontSize(16);
    doc.text("OST VENDAS - RELATÓRIO DO LIVRO DE CAIXA", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Período: ${startDate} a ${endDate}`, 14, 22);
    doc.text(`Gerado por: ${activeUsername} em ${new Date().toLocaleString()}`, 14, 27);

    const headers = [["Data/Hora", "Tipo", "Operador", "Descrição", "Valor"]];
    const dataRows = filteredTimeline.map(item => [
      new Date(item.timestamp).toLocaleString(),
      item.type,
      item.responsibleUser,
      item.reason,
      `${item.isInput ? "+" : "-"}${item.amount.toLocaleString()} ${currency}`
    ]);

    autoTable(doc, {
      startY: 33,
      head: headers,
      body: dataRows,
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [249, 115, 22] }
    });

    doc.save(`OST_Livro_Caixa_${Date.now()}.pdf`);
    onAddAuditLog("Exportar Relatório PDF", "CAIXA", `Relatório PDF de caixa exportado por ${activeUsername}.`);
  };

  const handleExportSingleClosurePDF = async (closure: any) => {
    try {
      const doc = new jsPDF();
      
      const logoData = await getBase64ImageFromUrl(settings?.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
      if (logoData) {
        doc.addImage(logoData, "JPEG", 165, 8, 30, 30);
      }

      // Header Style
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(settings.companyName || "OST COMÉRCIO CENTRAL", 14, 20);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`NUIT: ${settings.companyNuit || "400293112"} | ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 26);
      
      doc.setDrawColor(220, 220, 220);
      doc.line(14, 30, 196, 30);
      
      // Title
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("COMPROVATIVO DE FECHO DE CAIXA DE TURNO", 14, 38);
      
      // Info Block
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`ID de Fechamento: ${closure.id}`, 14, 46);
      doc.text(`Data/Hora: ${new Date(closure.timestamp).toLocaleString()}`, 14, 52);
      doc.text(`Operador de Caixa: ${closure.operator || activeUsername}`, 14, 58);
      doc.text(`Supervisor Responsável: ${closure.authorizedSupervisor || "Não informado"}`, 14, 64);
      
      // Balancete Status Badge
      doc.setFont("helvetica", "bold");
      const diffVal = closure.difference || 0;
      const diffText = diffVal === 0 
        ? "CONSOLIDADO SEM DESVIOS (100% REGULAR)" 
        : diffVal > 0 
          ? `DESVIO POSITIVO DE +${diffVal.toLocaleString()} ${currency}`
          : `DESVIO NEGATIVO DE ${diffVal.toLocaleString()} ${currency} (QUEBRA DE CAIXA)`;
      doc.text(`Estado do Balancete: ${diffText}`, 14, 72);
      
      // Table of Cash balance details
      const headers = [["Rubrica de Caixa (Descrição)", "Valor Reconhecido"]];
      const dataRows = [
        ["(+) Fundo de Maneio / Saldo de Abertura", `${(closure.reinforcements || 0).toLocaleString()} ${currency}`],
        ["(+) Vendas em Dinheiro Registradas (POS)", `${(closure.cashSales || 0).toLocaleString()} ${currency}`],
        ["(+) Outras Entradas (Reforços de Caixa)", `${(closure.inputs || 0).toLocaleString()} ${currency}`],
        ["(-) Saídas de Caixa (Sangrias / Despesas)", `${((closure.expenses || 0) + (closure.quebras || 0)).toLocaleString()} ${currency}`],
        ["(=) Saldo Teórico Esperado", `${(closure.theoreticalBalance || 0).toLocaleString()} ${currency}`],
        ["(≡) Saldo Físico Contado", `${(closure.physicalBalance || 0).toLocaleString()} ${currency}`],
        ["(±) Diferença de Fechamento (Desvio)", `${(closure.difference || 0).toLocaleString()} ${currency}`]
      ];
      
      autoTable(doc, {
        startY: 78,
        head: headers,
        body: dataRows,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [249, 115, 22] }, // orange theme
        columnStyles: {
          0: { fontStyle: "bold" },
          1: { halign: "right", fontStyle: "bold" }
        }
      });
      
      // Observations
      const finalY = (doc as any).lastAutoTable?.finalY || 140;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Observações de Fecho:", 14, finalY + 12);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(closure.observations || "Nenhuma observação reportada.", 14, finalY + 18, { maxWidth: 182 });
      
      // Signatures Line
      doc.setDrawColor(180, 180, 180);
      doc.line(14, finalY + 45, 90, finalY + 45);
      doc.line(120, finalY + 45, 196, finalY + 45);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Assinatura do Operador (Caixa)", 14, finalY + 50);
      doc.text("Homologação do Supervisor (Assinatura)", 120, finalY + 50);
      
      doc.save(`Fecho_Caixa_${closure.id}.pdf`);
      onAddAuditLog("Exportar Fecho PDF", "CAIXA", `Comprovativo de fecho de caixa ${closure.id} exportado em PDF por ${activeUsername}.`);
    } catch (err) {
      console.error("Erro ao gerar PDF do fecho:", err);
    }
  };

  const handleExportCSV = () => {
    const headers = ["DATA_HORA", "TIPO", "OPERADOR", "MOTIVO_LANÇAMENTO", "VALOR"];
    const rows = filteredTimeline.map(item => [
      item.timestamp,
      item.type,
      item.responsibleUser,
      item.reason.replace(/,/g, " "),
      `${item.isInput ? "" : "-"}${item.amount}`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `OST_Livro_Caixa_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Indicador de Saldo Consolidado no Topo */}
      <div className="bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-orange-500" />
            <span className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
              Saldo Atual Consolidado
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {currentRole === "ADMIN" ? (
              <span>Fluxo Total Consolidado do Sistema <strong className="text-orange-600 dark:text-orange-400">(Acesso de Admin)</strong></span>
            ) : (
              <span>Movimentos Filtrados do Usuário: <strong className="text-orange-600 dark:text-orange-400">{activeUsername}</strong></span>
            )}
          </h3>
          <p className="text-[11px] text-slate-400">
            Calculado com base no saldo de abertura (5.000,00 {currency}) + entradas (vendas em dinheiro, reforços) - saídas e quebras no período filtrado.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
            Saldo Disponível em Caixa
          </span>
          <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
            {cashCalculation.theoreticalTotal.toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg font-bold text-orange-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Header with quick status state indicator */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3.5 border-b border-slate-100 pb-4 dark:border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 tracking-tight flex items-center gap-1.5">
              <PiggyBank className="w-6 h-6 text-orange-500" />
              Gestão de Caixa Comercial
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${registerStateBadge.color}`}>
              <span className="text-[8px]">{registerStateBadge.bullet}</span>
              {registerStateBadge.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Controle analítico de entradas em numerário, sangrias de segurança, quebras diárias e fechamento homologado de turnos.
          </p>
        </div>

        {/* Export Buttons bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-3 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1 cursor-pointer dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 transition"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1 cursor-pointer dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1 cursor-pointer dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Date filter & Module tabs navigation */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 dark:bg-zinc-900 dark:border-zinc-800">
        
        {/* Module Sub-Tabs (Dashboard vs Closures History) */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/30 dark:bg-zinc-950 dark:border-zinc-850 w-full md:w-auto">
          <button
            onClick={() => setActiveModuleTab("active")}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${
              activeModuleTab === "active"
                ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-slate-400 hover:text-slate-600 dark:text-zinc-400"
            }`}
          >
            Painel Analítico de Fluxo
          </button>
          <button
            onClick={() => setActiveModuleTab("closures")}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${
              activeModuleTab === "closures"
                ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-slate-400 hover:text-slate-600 dark:text-zinc-400"
            }`}
          >
            Histórico de Fechamentos ({closuresHistory.length})
          </button>
        </div>

        {/* Date Filters selector */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Início:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-orange-400/50 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Fim:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-orange-400/50 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-300"
            />
          </div>
        </div>

      </div>

      {/* KPI Indicators Superior (Item 14 & 15) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        
        {/* Caixa Atual */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Caixa Atual</span>
          <h4 className="text-sm font-black font-mono text-slate-800 dark:text-zinc-200 mt-1">
            {cashCalculation.theoreticalTotal.toLocaleString()} <span className="text-[10px] font-normal">{currency}</span>
          </h4>
          
          {/* Comparison pill (Item 15) */}
          <div className="mt-2 text-[9px] text-slate-450 flex items-center gap-1 font-mono">
            <span className="text-emerald-500 font-bold">↑ +11%</span>
            <span>vs ontem</span>
          </div>
        </div>

        {/* Entradas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Entradas</span>
          <h4 className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {cashCalculation.totalEntradas.toLocaleString()} <span className="text-[10px] font-normal">{currency}</span>
          </h4>
          <span className="text-[9px] text-slate-400 block mt-2">Vendas + Reforços</span>
        </div>

        {/* Saídas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Saídas</span>
          <h4 className="text-sm font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
            {cashCalculation.totalSaidas.toLocaleString()} <span className="text-[10px] font-normal">{currency}</span>
          </h4>
          <span className="text-[9px] text-slate-400 block mt-2">Despesas e Sangrias</span>
        </div>

        {/* Trocos / Abertura */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Trocos / Abertura</span>
          <h4 className="text-sm font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
            {cashCalculation.openingValue.toLocaleString()} <span className="text-[10px] font-normal">{currency}</span>
          </h4>
          <span className="text-[9px] text-slate-400 block mt-2">Fundo Base Inicial</span>
        </div>

        {/* Quebras */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Quebras</span>
          <h4 className="text-sm font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
            {cashCalculation.quebras.toLocaleString()} <span className="text-[10px] font-normal">{currency}</span>
          </h4>
          <span className="text-[9px] text-slate-400 block mt-2">Desvios de Gaveta</span>
        </div>

        {/* Movimentos (Qtd) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Movimentos</span>
          <h4 className="text-sm font-black font-mono text-slate-800 dark:text-zinc-200 mt-1">
            {cashCalculation.movementsCount} <span className="text-[10px] font-normal">reg.</span>
          </h4>
          <span className="text-[9px] text-slate-400 block mt-2">No período filtrado</span>
        </div>

      </div>

      {/* RENDER ACTIVE ANALYTICAL DASHBOARD OR CLOSURES */}
      {activeModuleTab === "active" ? (
        <>
          {/* Main Grid: Interactive Cash summaries & Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT 2 COLUMNS: Main detail cards, Hour graph, Timeline */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* O Cartão Principal de Boca de Caixa (Item 1 & Item 2) */}
              <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Boca de Caixa</span>
                    <h2 className="text-3xl font-extrabold font-mono text-orange-400 mt-1">
                      {cashCalculation.theoreticalTotal.toLocaleString()} <span className="text-sm font-mono font-medium text-slate-300">{currency}</span>
                    </h2>
                  </div>
                  <div className="text-right text-xs text-slate-400 font-mono space-y-0.5">
                    <p><span className="text-slate-500">Operador:</span> {activeUsername}</p>
                    <p><span className="text-slate-500">Caixa:</span> Caixa Principal 01</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 font-mono text-xs leading-relaxed">
                  <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                    <p className="text-[10px] text-slate-450 uppercase font-sans font-bold">Abertura</p>
                    <p className="font-bold text-slate-200 mt-1">{cashCalculation.openingValue.toLocaleString()} MT</p>
                  </div>
                  <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                    <p className="text-[10px] text-emerald-450 uppercase font-sans font-bold">Entradas</p>
                    <p className="font-bold text-emerald-400 mt-1">+{cashCalculation.totalEntradas.toLocaleString()} MT</p>
                  </div>
                  <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                    <p className="text-[10px] text-rose-450 uppercase font-sans font-bold">Saídas</p>
                    <p className="font-bold text-rose-400 mt-1">-{cashCalculation.totalSaidas.toLocaleString()} MT</p>
                  </div>
                  <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                    <p className="text-[10px] text-purple-450 uppercase font-sans font-bold">Quebras</p>
                    <p className="font-bold text-purple-400 mt-1">-{cashCalculation.quebras.toLocaleString()} MT</p>
                  </div>
                  <div className="bg-orange-950/20 p-2.5 rounded-xl border border-orange-900/30 col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-orange-400 uppercase font-sans font-bold">Saldo Final</p>
                    <p className="font-bold text-orange-400 mt-1">{cashCalculation.theoreticalTotal.toLocaleString()} MT</p>
                  </div>
                </div>

                {/* Closing Shift Action Button */}
                <div className="mt-5 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <span className="text-[11px] text-slate-400 italic">As transações realizadas em POS e carteiras digitais (M-Pesa) são integradas automaticamente.</span>
                  <button
                    onClick={() => {
                      setPhysicalCount(cashCalculation.theoreticalTotal); // prefill with theoretical
                      setIsOpenClosingPanel(true);
                    }}
                    className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-orange-500/20 active:scale-95"
                  >
                    <Calculator className="w-4 h-4" />
                    Fechar Caixa
                  </button>
                </div>

              </div>

              {/* Bar Chart section (Item 3) */}
              <CashAnalyticalCharts data={hourlyData} currency={currency} />

              {/* Chronological Timeline visual (Item 13) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                
                {/* Visual Title and Quick Filters */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3 mb-4 dark:border-zinc-850">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider dark:text-zinc-300">
                      Linha do Tempo de Movimentações
                    </h3>
                  </div>
                  
                  {/* Search box (Item 7) */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Pesquisar movimentação..."
                      value={timelineSearch}
                      onChange={(e) => setTimelineSearch(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-xs outline-none focus:border-orange-500 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-200 w-full sm:w-48 font-medium"
                    />
                  </div>
                </div>

                {/* Quick Filters row (Item 6) */}
                <div className="flex flex-wrap gap-1.5 mb-4 border-b border-slate-100 pb-3 dark:border-zinc-850">
                  {(["TODOS", "ENTRADAS", "SAIDAS", "REFORCOS", "QUEBRAS", "SANGRIAS"] as const).map(chip => (
                    <button
                      key={chip}
                      onClick={() => setFilterChip(chip)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition ${
                        filterChip === chip
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-850"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Vertical Timeline Ledger */}
                <div className="relative pl-6 border-l-2 border-slate-100 dark:border-zinc-800 space-y-5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredTimeline.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                      Nenhuma atividade encontrada para os filtros aplicados.
                    </div>
                  ) : (
                    filteredTimeline.map((item, index) => {
                      // Apply Item 17 color rules
                      let textAmountColor = "";
                      if (item.type === "SALE" || item.type === "INPUT") textAmountColor = "text-emerald-600 dark:text-emerald-400";
                      else if (item.type === "REINFORCEMENT") textAmountColor = "text-blue-600 dark:text-blue-400";
                      else if ((item.reason || "").toLowerCase().includes("sangria")) textAmountColor = "text-orange-500 dark:text-orange-400";
                      else if (item.type === "EXPENSE") textAmountColor = "text-rose-600 dark:text-rose-400";
                      else textAmountColor = "text-purple-650 dark:text-purple-400";

                      return (
                        <div key={item.id} className="relative group animate-in fade-in duration-200">
                          
                          {/* Bullet node */}
                          <div className={`absolute -left-[35px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs border bg-white dark:bg-zinc-900 ${item.badgeColor}`}>
                            {item.iconText}
                          </div>

                          <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-1 p-3 rounded-xl hover:bg-slate-50/50 dark:hover:bg-zinc-950/20 transition">
                            
                            {/* Visual Timeline detailed item */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">{item.reason}</h4>
                                <span className="text-[9px] text-slate-400">•</span>
                                <span className="text-[10px] font-mono text-slate-400">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>

                              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 text-[10px] text-slate-450">
                                {item.supplier && (
                                  <span className="flex items-center gap-0.5">
                                    <span className="font-bold text-slate-500">Credor/Dest:</span> {item.supplier}
                                  </span>
                                )}
                                <span className="hidden sm:inline text-slate-300">•</span>
                                <span className="flex items-center gap-0.5">
                                  <User className="w-3 h-3" />
                                  {item.responsibleUser}
                                </span>
                              </div>
                            </div>

                            {/* Timeline Amount visual */}
                            <div className="text-right shrink-0">
                              <span className={`text-xs font-bold font-mono ${textAmountColor}`}>
                                {item.isInput ? "+" : "-"} {item.amount.toLocaleString()} {currency}
                              </span>
                              <p className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">
                                {item.type === "SALE" ? "Venda" : item.type === "INPUT" ? "Entrada" : item.type === "REINFORCEMENT" ? "Reforço" : (item.reason || "").toLowerCase().includes("sangria") ? "Sangria" : item.type === "EXPENSE" ? "Despesa" : "Quebra"}
                              </p>
                            </div>

                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

            </div>

            {/* RIGHT COLUMN: Entry launcher form, Small denomination counter, Operator lists, alerts */}
            <div className="space-y-6">
              
              {/* Launcher Form Trigger or Box */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 dark:border-zinc-850">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-orange-500" />
                    Registrar Lançamento Avulso
                  </span>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="text-[10px] text-orange-500 hover:underline font-bold"
                  >
                    {showAddForm ? "Fechar Form" : "Abrir Form"}
                  </button>
                </div>

                {showAddForm ? (
                  <form onSubmit={handleSubmitEntry} className="space-y-4 animate-in slide-in-from-top duration-200">
                    {localError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-600 p-2 rounded-lg text-[11px] font-bold">
                        {localError}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Tipo de Registro</label>
                      <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold dark:bg-zinc-950">
                        {(["REINFORCEMENT", "INPUT", "EXPENSE", "QUEBRA"] as const).map(type => {
                          const label = type === "REINFORCEMENT" ? "Reforço" : type === "INPUT" ? "Entrada" : type === "EXPENSE" ? "Despesa" : "Quebra";
                          const active = entryType === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setEntryType(type)}
                              className={`py-1 rounded-md transition cursor-pointer ${
                                active 
                                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" 
                                  : "text-slate-400 hover:text-slate-650"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Valor ({currency})</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={entryAmount || ""}
                        onChange={(e) => setEntryAmount(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-200 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-orange-500"
                        placeholder="Ex: 500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Justificação / Motivo</label>
                      <textarea
                        required
                        rows={2}
                        value={entryReason}
                        onChange={(e) => setEntryReason(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-200 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                        placeholder="Especifique o motivo..."
                      />
                    </div>

                    {entryType === "EXPENSE" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Fornecedor / Credor</label>
                        <input
                          type="text"
                          value={entrySupplier}
                          onChange={(e) => setEntrySupplier(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-200 rounded-xl p-2.5 text-xs outline-none focus:border-orange-500"
                          placeholder="Ex: Papelaria Central"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Operador Executante</label>
                      <select
                        value={entryResponsible}
                        onChange={(e) => setEntryResponsible(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-200 rounded-xl p-2.5 text-xs outline-none focus:border-orange-500 cursor-pointer font-semibold"
                      >
                        <option value={activeUsername}>{activeUsername} (Eu)</option>
                        <option value="Marta Ubisse">Marta Ubisse</option>
                        <option value="Inácio Macamo">Inácio Macamo</option>
                      </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="w-1/2 py-2 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-350"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="w-1/2 py-2 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-xl text-xs cursor-pointer dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      >
                        Salvar
                      </button>
                    </div>

                  </form>
                ) : (
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Clique em registrar para inserir reforços de trocos, despesas emergenciais, retiradas para sangria, ou perdas mecânicas.
                  </p>
                )}
              </div>

              {/* Equilíbrio de Caixa status check card (Item 18) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 space-y-3.5">
                <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block">Equilíbrio de Caixa</span>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl dark:bg-zinc-950">
                    <span className="text-slate-600 dark:text-zinc-300">✔ Estado do Caixa</span>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">ABERTO</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl dark:bg-zinc-950">
                    <span className="text-slate-600 dark:text-zinc-300">✔ Última Sangria</span>
                    <span className="font-mono text-slate-800 font-bold dark:text-zinc-200">15:00</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl dark:bg-zinc-950">
                    <span className="text-slate-600 dark:text-zinc-300">✔ Último Reforço</span>
                    <span className="font-mono text-slate-800 font-bold dark:text-zinc-200">08:00</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl dark:bg-zinc-950">
                    <span className="text-slate-600 dark:text-zinc-300">✔ Diferença Ativa</span>
                    <span className="font-mono text-slate-850 font-bold dark:text-zinc-100">0 MT</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl dark:bg-zinc-950">
                    <span className="text-slate-600 dark:text-zinc-300">✔ Fechamento Turno</span>
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">PENDENTE</span>
                  </div>
                </div>
              </div>

              {/* Interactive Coins breakdown overview card (Item 8) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 dark:border-zinc-850">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-orange-500" />
                    Resumo de Cédulas
                  </span>
                  <span className="text-[10px] font-mono bg-slate-100 dark:bg-zinc-950 text-slate-500 px-1.5 py-0.5 rounded">Gaveta</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 py-1 dark:border-zinc-850 font-mono">
                    <span className="text-slate-450">1000 MT:</span>
                    <span className="font-bold text-slate-750 dark:text-zinc-300">20 un</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1 dark:border-zinc-850 font-mono">
                    <span className="text-slate-450">500 MT:</span>
                    <span className="font-bold text-slate-750 dark:text-zinc-300">18 un</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1 dark:border-zinc-850 font-mono">
                    <span className="text-slate-450">200 MT:</span>
                    <span className="font-bold text-slate-750 dark:text-zinc-300">15 un</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1 dark:border-zinc-850 font-mono">
                    <span className="text-slate-450">100 MT:</span>
                    <span className="font-bold text-slate-750 dark:text-zinc-300">30 un</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-150 flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-300 dark:border-zinc-850">
                  <span>Soma Total Estimada:</span>
                  <span className="font-mono">{calculatedFromDenoms.toLocaleString()} {currency}</span>
                </div>
              </div>

              {/* Dynamic Cashier handled by Operator (Item 9) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                <span className="text-xs font-bold text-slate-850 dark:text-zinc-300 uppercase tracking-wider block mb-3">
                  Caixa por Operador
                </span>

                <div className="space-y-2">
                  {operatorsSummary.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">Nenhum operador com registros no período.</p>
                  ) : (
                    operatorsSummary.map(op => (
                      <div key={op.name} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-750 dark:text-zinc-300">{op.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                          {op.value.toLocaleString()} {currency}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Important active alerts sidebar list (Item 16) */}
              {activeAlerts.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl dark:bg-rose-950/20 dark:border-rose-900/40 space-y-3">
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-450 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    Alertas do Painel
                  </div>
                  <ul className="space-y-2 text-xs text-rose-600 dark:text-rose-400 leading-relaxed list-disc pl-4">
                    {activeAlerts.map((alert, idx) => (
                      <li key={idx}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}

            </div>

          </div>
        </>
      ) : (
        
        /* 10. PAST CLOSURES HISTORY LOG VIEW */
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
          <div className="p-4 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between dark:bg-zinc-950 dark:border-zinc-850">
            <span className="text-xs font-bold text-slate-750 dark:text-zinc-300 flex items-center gap-1.5">
              <History className="w-4 h-4 text-orange-500" />
              Histórico de Fechamentos de Caixa Homologados
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Turnos Anteriores</span>
          </div>

          <div className="overflow-x-auto max-h-[450px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-250 dark:bg-zinc-950/60 dark:border-zinc-850">
                  <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300">Data/Hora Fecho</th>
                  <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300">Operador</th>
                  <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300">Supervisor</th>
                  <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-right">Saldo Teórico</th>
                  <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-right">Físico Contado</th>
                  <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Diferença / Desvio</th>
                  <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300">Observações</th>
                  <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-zinc-850">
                {closuresHistory.map(hist => {
                  const hasDiscrepancy = hist.difference !== 0;
                  
                  return (
                    <tr key={hist.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-950/20">
                      <td className="p-3.5 font-mono text-slate-500 font-bold">
                        {new Date(hist.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800 dark:text-zinc-200">
                        {hist.operator}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-zinc-400 font-medium">
                        {hist.authorizedSupervisor}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-650 font-bold dark:text-zinc-350">
                        {hist.theoreticalBalance.toLocaleString()} MT
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-800 font-bold dark:text-zinc-100">
                        {hist.physicalBalance.toLocaleString()} MT
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          hist.difference === 0 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" 
                            : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30"
                        }`}>
                          {hist.difference > 0 ? "+" : ""}{hist.difference.toLocaleString()} MT
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 italic font-medium max-w-[200px] truncate">
                        {hist.observations}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleExportSingleClosurePDF(hist)}
                          className="px-2.5 py-1 text-[10px] font-bold bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-950/20 dark:hover:bg-orange-900/30 dark:text-orange-400 rounded-lg flex items-center gap-1 mx-auto transition cursor-pointer"
                          title="Exportar Comprovante de Fecho PDF"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

      )}

      {/* SHIFT CLOSE WORKFLOW OVERLAY POPUP (Item 11) */}
      {isOpenClosingPanel && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl max-w-2xl w-full border border-slate-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900 dark:border-zinc-800">
            
            <div className="flex items-center justify-between border-b border-slate-150 pb-3 dark:border-zinc-850">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 dark:text-zinc-100">
                <Calculator className="w-5 h-5 text-orange-500 animate-pulse" />
                Fechamento Estruturado de Turno de Caixa
              </h3>
              <button 
                onClick={() => setIsOpenClosingPanel(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Column: Metrics & Signature */}
              <div className="space-y-3.5">
                <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block">Resumo Teórico</span>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 space-y-2 text-xs dark:bg-zinc-950 dark:border-zinc-850 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo Abertura:</span>
                    <span>{cashCalculation.openingValue.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total de Entradas:</span>
                    <span className="text-emerald-600 font-bold">+{cashCalculation.totalEntradas.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total de Saídas:</span>
                    <span className="text-rose-600 font-bold">-{cashCalculation.totalSaidas.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quebras Lançadas:</span>
                    <span className="text-purple-600 font-bold">-{cashCalculation.quebras.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-slate-300 pt-2 font-bold text-slate-900 dark:text-zinc-200 dark:border-zinc-800">
                    <span>Saldo Teórico:</span>
                    <span>{cashCalculation.theoreticalTotal.toLocaleString()} MT</span>
                  </div>
                </div>

                {/* Status difference dynamic indicator (Item 2) */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 space-y-2 dark:bg-zinc-950 dark:border-zinc-850">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600 dark:text-zinc-400">Diferença de Fecho:</span>
                    <span className={`font-mono font-black text-sm ${(physicalCount - cashCalculation.theoreticalTotal) === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {(physicalCount - cashCalculation.theoreticalTotal).toLocaleString()} MT
                    </span>
                  </div>

                  {/* Difference indicators */}
                  <div className="flex justify-center pt-1.5">
                    {(physicalCount - cashCalculation.theoreticalTotal) === 0 ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-full flex items-center gap-1">
                        🟢 Correto
                      </span>
                    ) : Math.abs(physicalCount - cashCalculation.theoreticalTotal) <= 200 ? (
                      <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-full flex items-center gap-1 animate-pulse">
                        🟠 Atenção (Discrepância Pequena)
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold uppercase rounded-full flex items-center gap-1 animate-pulse">
                        🔴 Divergência de Caixa Detectada
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Observações do Turno</label>
                  <textarea
                    rows={2}
                    value={closingObservation}
                    onChange={(e) => setClosingObservation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-300 rounded-xl p-2.5 text-xs outline-none focus:border-orange-500"
                    placeholder="Declare qualquer motivo para sobras ou quebras físicas de caixa..."
                  />
                </div>

              </div>

              {/* Right Column: Physical declaration counter & Operator Approval */}
              <div className="space-y-3.5">
                <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block">Validação Física</span>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-slate-500 uppercase tracking-wider">Moeda Física Contada (MT)</label>
                    <button
                      type="button"
                      onClick={() => setShowDenomCalculator(!showDenomCalculator)}
                      className="text-[10px] text-orange-500 font-bold hover:underline flex items-center gap-1"
                    >
                      <Coins className="w-3 h-3" />
                      {showDenomCalculator ? "Ocultar Contador" : "Contar Cédulas"}
                    </button>
                  </div>

                  {showDenomCalculator ? (
                    <div className="space-y-3.5">
                      <DenominationCounter 
                        denomCounts={denomCounts} 
                        onChangeCount={handleDenomChange} 
                        currency={currency} 
                        isInteractive={true}
                      />
                      <button
                        type="button"
                        onClick={handleApplyDenomsToPhysicalCount}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 text-xs font-bold rounded-xl transition"
                      >
                        Aplicar Total Declarado ({calculatedFromDenoms.toLocaleString()} MT)
                      </button>
                    </div>
                  ) : (
                    <input
                      type="number"
                      required
                      value={physicalCount || ""}
                      onChange={(e) => setPhysicalCount(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-100 rounded-xl p-3 text-sm font-mono font-extrabold outline-none focus:border-orange-500"
                      placeholder="Introduza o total contado na gaveta"
                    />
                  )}
                </div>

                {/* Supervisor Approval Signature */}
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 space-y-3">
                  <span className="text-[10px] text-amber-800 dark:text-amber-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Assinatura Homologada do Supervisor
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-450 uppercase">Supervisor</label>
                      <select
                        value={closingSupervisor}
                        onChange={(e) => setClosingSupervisor(e.target.value)}
                        className="w-full bg-white border border-slate-250 dark:bg-zinc-900 dark:border-zinc-800 rounded-lg p-1.5 outline-none font-semibold cursor-pointer text-slate-700 dark:text-zinc-300"
                      >
                        <option value="Inácio Macamo">Inácio Macamo</option>
                        <option value="Levi Domingos">Levi Domingos</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-450 uppercase">PIN de Segurança</label>
                      <input
                        type="password"
                        placeholder="PIN (1234)"
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value)}
                        className="w-full bg-white border border-slate-250 dark:bg-zinc-900 dark:border-zinc-800 rounded-lg p-1.5 text-center font-mono font-bold tracking-widest outline-none text-slate-800 dark:text-zinc-200"
                      />
                    </div>
                  </div>

                  {/* Operador handwriting simulated sign (Item 11) */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-450 uppercase block">Confirmar Assinatura Digital do Operador</label>
                    <input
                      type="text"
                      placeholder="Digite seu nome completo para assinar..."
                      value={operatorSignature}
                      onChange={(e) => setOperatorSignature(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-lg p-1.5 text-xs outline-none italic font-serif text-blue-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-amber-400"
                    />
                  </div>

                  {pinError && (
                    <p className="text-[10px] text-rose-600 font-bold animate-pulse">{pinError}</p>
                  )}
                </div>

              </div>

            </div>

            {/* Bottom Actions footer */}
            <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-zinc-850">
              <button
                type="button"
                onClick={() => setIsOpenClosingPanel(false)}
                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs transition cursor-pointer dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Voltar / Cancelar
              </button>
              <button
                type="button"
                onClick={handlePerformClosure}
                disabled={!operatorSignature.trim()}
                className="w-1/2 py-3 bg-orange-500 hover:bg-orange-650 text-white font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-lg shadow-orange-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserCheck className="w-4 h-4" />
                Confirmar e Assinar Fecho
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Elegant Real-time Virtual Printer Animation Overlay (Item 11 / Item 12) */}
      {isSimulatingPrint && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-xs font-sans">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center space-y-4 text-white">
            <div className="relative w-16 h-16 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
              <Printer className="w-8 h-8 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-500">Impressão do Balancete Fiscal</h4>
              <p className="text-[11px] text-zinc-400 mt-1">Sincronizando com a rede comercial...</p>
            </div>
            
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-left font-mono text-[9px] text-zinc-400 max-h-32 overflow-hidden relative">
              <div className="animate-pulse mb-1.5 flex items-center gap-1.5 text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded w-max">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>• EMISSÃO DE COMPROVANTE FISCAL</span>
              </div>
              <p className="font-bold border-b border-zinc-800 pb-1 mb-1 text-[10px]">OST VENDAS - FECHAMENTO DE TURNO</p>
              <p>OPERADOR RESP: {activeUsername}</p>
              <p>TEÓRICO BALANÇO: {cashCalculation.theoreticalTotal.toLocaleString()} MT</p>
              <p>FÍSICO DECLARADO: {physicalCount.toLocaleString()} MT</p>
              <p>DIFERENÇA: {(physicalCount - cashCalculation.theoreticalTotal).toLocaleString()} MT</p>
              <p className="text-zinc-500 mt-1">Assinado: {operatorSignature}</p>
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none"></div>
            </div>

            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "95%" }}></div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-normal">
              O turno foi encerrado e as estatísticas de caixa foram enviadas ao painel central do supervisor.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
