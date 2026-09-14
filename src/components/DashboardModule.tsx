import { useMemo, useState, useEffect, memo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag,
  Calendar,
  BadgePercent,
  Trash2,
  Percent,
  Receipt,
  Sparkles,
  ArrowUpRight,
  Package,
  Clock,
  Printer,
  ChevronRight,
  Eye,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Layers,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell
} from "recharts";
import { Product, Customer, Transaction, CashFlowEntry, SystemSettings, Employee, ProductBatch } from "../types";
import { normalizeTransaction, extractDateOnly } from "../lib/normalizeTransaction";
import { printInvoiceHTML } from "../lib/printHelper";
import { ProfitMarginWidget } from "./dashboard/ProfitMarginWidget";
import { CommercialDataService } from "../services/dataService";

interface DashboardModuleProps {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  cashFlow: CashFlowEntry[];
  currency: string;
  activeUser?: Employee;
  onChangeModule?: (mod: string) => void;
  settings?: SystemSettings;
  onUpdateSettings?: (newSettings: Partial<SystemSettings>) => void;
  onUpdateProduct?: (updatedP: Product) => void;
  onAddAuditLog?: (action: string, module: string, description: string) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning") => void;
  onCompleteSale?: (transaction: Transaction) => void;
  pendingSyncQueue?: Record<string, unknown>;
  isManualSyncing?: boolean;
  isOnline?: boolean;
  onManualSync?: () => Promise<void> | void;
  theme?: string;
}

const PAYMENT_COLORS = ["#f97316", "#10b981", "#3b82f6", "#8b5cf6", "#64748b"];

function DashboardModule({
  products = [],
  transactions = [],
  cashFlow = [],
  currency,
  activeUser,
  onChangeModule,
  settings,
  onUpdateProduct,
  onAddAuditLog,
  onShowToast,
  onManualSync
}: DashboardModuleProps) {
  // Period scope: TODAY, YESTERDAY, LAST_7, THIS_MONTH, ALL
  const [timeScope, setTimeScope] = useState<"TODAY" | "YESTERDAY" | "LAST_7" | "THIS_MONTH" | "ALL">("TODAY");

  // Dynamic refresh timestamp and state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() => 
    new Date().toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );

  // Selected Transaction for details modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Expiry Batch Promo / Discard States
  const [promoProduct, setPromoProduct] = useState<Product | null>(null);
  const [promoBatch, setPromoBatch] = useState<ProductBatch | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [customPromoPrice, setCustomPromoPrice] = useState<string>("");
  const [confirmDiscardBatch, setConfirmDiscardBatch] = useState<ProductBatch | null>(null);

  // Auto-refresh timer to keep dashboard live and synchronized
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 20000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setCurrentDate(new Date());
      }
    };
    window.addEventListener("focus", onVisibilityChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onVisibilityChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Gatilho reativo em tempo real para mudanças no estado de transações, fluxo de caixa e produtos
  useEffect(() => {
    setCurrentDate(new Date());
    setLastRefreshedAt(
      new Date().toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    );
  }, [transactions, cashFlow, products]);

  // Listener reativo em tempo real para alterações diretas no banco de dados (vendas, caixa, produtos)
  useEffect(() => {
    const unsubscribe = CommercialDataService.onDatabaseChange((event) => {
      if (event.table === "vendas" || event.table === "caixa" || event.table === "produtos") {
        setCurrentDate(new Date());
        setLastRefreshedAt(
          new Date().toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Normalizar todas as transações de forma robusta e reativa
  const safeTransactions = useMemo(() => {
    return (transactions || []).map(normalizeTransaction);
  }, [transactions]);

  // Robust date helper that extracts YYYY-MM-DD in the user's local timezone
  const dateSplit = (isoStr: string) => {
    return extractDateOnly(isoStr);
  };

  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  const todayStr = useMemo(() => getLocalDateStr(currentDate), [currentDate]);
  
  const yesterdayStr = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    return getLocalDateStr(d);
  }, [currentDate]);

  const last7DaysStrings = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - i);
      list.push(getLocalDateStr(d));
    }
    return list;
  }, [currentDate]);

  const currentMonthStr = useMemo(() => todayStr.substring(0, 7), [todayStr]);

  // Counts of transactions in each period for the tabs
  const periodCounts = useMemo(() => {
    let todayCount = 0;
    let yesterdayCount = 0;
    let last7Count = 0;
    let thisMonthCount = 0;

    safeTransactions.forEach(tx => {
      const txDate = extractDateOnly(tx.timestamp);
      if (txDate === todayStr) todayCount++;
      if (txDate === yesterdayStr) yesterdayCount++;
      if (last7DaysStrings.includes(txDate)) last7Count++;
      if (txDate.startsWith(currentMonthStr)) thisMonthCount++;
    });

    return {
      today: todayCount,
      yesterday: yesterdayCount,
      last7: last7Count,
      thisMonth: thisMonthCount,
      all: safeTransactions.length
    };
  }, [safeTransactions, todayStr, yesterdayStr, last7DaysStrings, currentMonthStr]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setCurrentDate(new Date());
    if (onManualSync) {
      try {
        await onManualSync();
      } catch (err) {
        console.error("Erro ao sincronizar dashboard:", err);
      }
    }
    const newStamp = new Date().toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLastRefreshedAt(newStamp);
    setTimeout(() => {
      setIsRefreshing(false);
      onShowToast?.("Dashboard sincronizado com os dados mais recentes.", "info");
    }, 350);
  };

  // Filter transactions based on selected scope (100% REAL DATA, ZERO MOCK)
  const scopedTransactions = useMemo(() => {
    return safeTransactions.filter(tx => {
      if (timeScope === "ALL") return true;
      const txDate = extractDateOnly(tx.timestamp);
      if (timeScope === "TODAY") return txDate === todayStr;
      if (timeScope === "YESTERDAY") return txDate === yesterdayStr;
      if (timeScope === "LAST_7") return last7DaysStrings.includes(txDate);
      if (timeScope === "THIS_MONTH") return txDate.startsWith(currentMonthStr);
      return true;
    });
  }, [safeTransactions, timeScope, todayStr, yesterdayStr, last7DaysStrings, currentMonthStr]);

  // Product cost lookup helper
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      map.set(p.id, p.costPrice || 0);
    });
    return map;
  }, [products]);

  // Real KPI statistics
  const stats = useMemo(() => {
    // Current period metrics
    let totalRevenue = 0;
    let totalCost = 0;
    let txCount = scopedTransactions.length;

    scopedTransactions.forEach(tx => {
      totalRevenue += Number(tx.grandTotal) || 0;
      if (Array.isArray(tx.items)) {
        tx.items.forEach((item) => {
          const unitCost = item.costPrice !== undefined ? Number(item.costPrice) : (productCostMap.get(item.productId) || 0);
          totalCost += unitCost * (Number(item.quantity) || 1);
        });
      }
    });

    const totalProfit = Math.max(0, totalRevenue - totalCost);
    const avgTicket = txCount > 0 ? Math.round(totalRevenue / txCount) : 0;
    const profitMarginPercent = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

    // Yesterday comparison for daily profit margin widget
    const yesterdayTxs = safeTransactions.filter(tx => extractDateOnly(tx.timestamp) === yesterdayStr);
    let yRevenue = 0;
    let yCost = 0;
    yesterdayTxs.forEach(tx => {
      yRevenue += Number(tx.grandTotal) || 0;
      if (Array.isArray(tx.items)) {
        tx.items.forEach((item) => {
          const itemWithCost = item as { costPrice?: number };
          const unitCost = itemWithCost.costPrice !== undefined ? Number(itemWithCost.costPrice) : (productCostMap.get(item.productId) || 0);
          yCost += unitCost * (Number(item.quantity) || 1);
        });
      }
    });
    const yProfit = Math.max(0, yRevenue - yCost);
    const yMarginPercent = yRevenue > 0 ? Math.round((yProfit / yRevenue) * 100) : 0;

    const profitGrowthRate = yProfit > 0 ? ((totalProfit - yProfit) / yProfit) * 100 : (totalProfit > 0 ? 100 : 0);
    const marginPointsDiff = profitMarginPercent - yMarginPercent;

    // Cash flow metrics in the scoped period
    let scopedCashInflow = 0;
    let scopedCashOutflow = 0;
    (cashFlow || []).forEach(cf => {
      if (timeScope !== "ALL") {
        const cfDate = extractDateOnly(cf.timestamp || cf.date);
        if (timeScope === "TODAY" && cfDate !== todayStr) return;
        if (timeScope === "YESTERDAY" && cfDate !== yesterdayStr) return;
        if (timeScope === "LAST_7" && !last7DaysStrings.includes(cfDate)) return;
        if (timeScope === "THIS_MONTH" && !cfDate.startsWith(currentMonthStr)) return;
      }
      const amt = Math.abs(Number(cf.amount) || 0);
      const isOut = cf.type === "OUT" || cf.type === "OUTFLOW" || (Number(cf.amount) < 0 && cf.type !== "IN");
      if (isOut) {
        scopedCashOutflow += amt;
      } else {
        scopedCashInflow += amt;
      }
    });
    const netCashFlow = scopedCashInflow - scopedCashOutflow;

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      txCount,
      avgTicket,
      profitMarginPercent,
      yesterdaySales: yRevenue,
      yesterdayCostOfSales: yCost,
      yesterdayProfit: yProfit,
      yesterdayProfitMarginPercent: yMarginPercent,
      profitGrowthRate,
      marginPointsDiff,
      scopedCashInflow,
      scopedCashOutflow,
      netCashFlow
    };
  }, [
    scopedTransactions,
    safeTransactions,
    yesterdayStr,
    productCostMap,
    transactions,
    cashFlow,
    products,
    timeScope,
    todayStr,
    last7DaysStrings,
    currentMonthStr
  ]);

  // Chart: Timeline of sales in selected scope
  const chartTimelineData = useMemo(() => {
    if (timeScope === "TODAY" || timeScope === "YESTERDAY") {
      // Group by hour blocks (08:00 to 20:00)
      const hoursMap: Record<string, number> = {};
      const targetDate = timeScope === "TODAY" ? todayStr : yesterdayStr;
      
      const hourSlots = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
      hourSlots.forEach(h => { hoursMap[h] = 0; });

      scopedTransactions.forEach(tx => {
        const txDate = dateSplit(tx.timestamp);
        if (txDate === targetDate) {
          const dateObj = new Date(tx.timestamp);
          const hour = dateObj.getHours();
          // Find closest slot
          let slot = "08:00";
          if (hour >= 21) slot = "22:00";
          else if (hour >= 19) slot = "20:00";
          else if (hour >= 17) slot = "18:00";
          else if (hour >= 15) slot = "16:00";
          else if (hour >= 13) slot = "14:00";
          else if (hour >= 11) slot = "12:00";
          else if (hour >= 9) slot = "10:00";
          else slot = "08:00";

          hoursMap[slot] = (hoursMap[slot] || 0) + tx.grandTotal;
        }
      });

      return hourSlots.map(h => ({
        label: h,
        valor: Math.round(hoursMap[h] || 0)
      }));
    }

    if (timeScope === "LAST_7") {
      // Last 7 days ordered chronologically
      const days = [...last7DaysStrings].reverse();
      const map: Record<string, number> = {};
      days.forEach(d => { map[d] = 0; });

      scopedTransactions.forEach(tx => {
        const d = dateSplit(tx.timestamp);
        if (map[d] !== undefined) {
          map[d] += tx.grandTotal;
        }
      });

      return days.map(d => {
        const parts = d.split("-");
        const formatted = `${parts[2]}/${parts[1]}`;
        return {
          label: formatted,
          valor: Math.round(map[d] || 0)
        };
      });
    }

    // THIS_MONTH: group into weeks / 5-day buckets
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const buckets = [
      { label: "Dias 01-07", start: 1, end: 7, total: 0 },
      { label: "Dias 08-14", start: 8, end: 14, total: 0 },
      { label: "Dias 15-21", start: 15, end: 21, total: 0 },
      { label: "Dias 22-28", start: 22, end: 28, total: 0 },
      { label: `Dias 29-${daysInMonth}`, start: 29, end: 31, total: 0 },
    ];

    scopedTransactions.forEach(tx => {
      const d = new Date(tx.timestamp).getDate();
      const bucket = buckets.find(b => d >= b.start && d <= b.end);
      if (bucket) {
        bucket.total += tx.grandTotal;
      }
    });

    // ALL: group by month or week
    if (timeScope === "ALL") {
      const monthMap: Record<string, number> = {};
      scopedTransactions.forEach(tx => {
        const d = dateSplit(tx.timestamp);
        const m = d.substring(0, 7);
        if (m) {
          monthMap[m] = (monthMap[m] || 0) + (tx.grandTotal || 0);
        }
      });
      const keys = Object.keys(monthMap).sort();
      if (keys.length === 0) return [];
      return keys.slice(-6).map(k => {
        const parts = k.split("-");
        const y = parts[0] || "";
        const m = parts[1] || "";
        return {
          label: `${m}/${y.slice(2)}`,
          valor: Math.round(monthMap[k] || 0)
        };
      });
    }

    return buckets.map(b => ({
      label: b.label,
      valor: Math.round(b.total)
    }));
  }, [scopedTransactions, timeScope, todayStr, yesterdayStr, last7DaysStrings]);

  // Chart: Payment methods distribution (100% REAL)
  const chartPaymentMethods = useMemo(() => {
    const map: Record<string, number> = {
      "Dinheiro": 0,
      "M-Pesa": 0,
      "E-Mola": 0,
      "Cartão (POS)": 0,
      "Outro": 0
    };

    scopedTransactions.forEach(tx => {
      const method = (tx.paymentMethod || "").toUpperCase();
      if (method === "CASH" || method.includes("DINHEIRO")) {
        map["Dinheiro"] += tx.grandTotal;
      } else if (method.includes("MPESA") || method.includes("M-PESA")) {
        map["M-Pesa"] += tx.grandTotal;
      } else if (method.includes("EMOLA") || method.includes("E-MOLA")) {
        map["E-Mola"] += tx.grandTotal;
      } else if (method.includes("CARD") || method.includes("POS") || method.includes("CARTAO") || method.includes("CARTÃO")) {
        map["Cartão (POS)"] += tx.grandTotal;
      } else {
        map["Outro"] += tx.grandTotal;
      }
    });

    return Object.entries(map)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [scopedTransactions]);

  // Top Selling Products in period (100% REAL)
  const topProducts = useMemo(() => {
    const source = scopedTransactions.length > 0 ? scopedTransactions : safeTransactions;
    const map: Record<string, { id: string; name: string; quantity: number; revenue: number; emoji?: string }> = {};

    source.forEach(tx => {
      if (Array.isArray(tx.items)) {
        tx.items.forEach(item => {
          if (!map[item.productId]) {
            const originalProduct = products.find(p => p.id === item.productId);
            map[item.productId] = {
              id: item.productId,
              name: item.productName || originalProduct?.name || "Produto",
              quantity: 0,
              revenue: 0,
              emoji: originalProduct?.emoji || "📦"
            };
          }
          const q = Number(item.quantity) || 1;
          const p = Number(item.price) || 0;
          map[item.productId].quantity += q;
          map[item.productId].revenue += p * q;
        });
      }
    });

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [scopedTransactions, safeTransactions, products]);

  // Recent Transactions (100% REAL, max 6 - prioritizes current scope, falls back to overall recent)
  const recentTransactions = useMemo(() => {
    const sourceList = scopedTransactions.length > 0 ? scopedTransactions : safeTransactions;
    return [...sourceList]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [scopedTransactions, safeTransactions]);

  // Expiring Batches (within 30 days) from real products
  const expiringBatches = useMemo(() => {
    const list: (ProductBatch & { product: Product; daysLeft: number; isExpired: boolean })[] = [];
    const now = new Date();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(now.getDate() + 30);

    products.forEach(p => {
      if (Array.isArray(p.batches)) {
        p.batches.forEach(b => {
          if (b.quantity > 0 && b.expiryDate) {
            const expDate = new Date(b.expiryDate);
            if (expDate <= thirtyDaysAhead) {
              const diffTime = expDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              list.push({
                ...b,
                productId: p.id,
                productName: p.name,
                product: p,
                daysLeft: diffDays,
                isExpired: diffDays <= 0
              });
            }
          }
        });
      }
    });

    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [products]);

  // Actions for batch promos / discards
  const handleApplyPromo = (prodId: string, batchId: string, pct: number, promoPrice: number) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod || !onUpdateProduct) return;

    const updated: Product = {
      ...prod,
      salePrice: promoPrice,
      promotion: "PROMO"
    };

    onUpdateProduct(updated);
    if (onAddAuditLog) {
      onAddAuditLog(
        "PROMOÇÃO_VALIDADE",
        "DASHBOARD",
        `Produto ${prod.name} (Lote: ${batchId}) em promoção por ${promoPrice} ${currency} (-${pct}%)`
      );
    }
    if (onShowToast) {
      onShowToast(`Promoção ativada para ${prod.name}! Novo preço: ${promoPrice} ${currency}`, "success");
    }
    setPromoProduct(null);
    setPromoBatch(null);
  };

  const handleDiscardBatch = (batchId: string) => {
    if (!confirmDiscardBatch || !onUpdateProduct) return;
    const prod = confirmDiscardBatch.product;
    if (!prod) return;

    const updatedBatches = (prod.batches || []).filter((b) => b.id !== batchId);
    const discardedQty = confirmDiscardBatch.quantity;
    const newStock = Math.max(0, (prod.stock || 0) - discardedQty);

    const updatedProd: Product = {
      ...prod,
      stock: newStock,
      batches: updatedBatches
    };

    onUpdateProduct(updatedProd);
    if (onAddAuditLog) {
      onAddAuditLog(
        "DESCARTE_LOTE",
        "STOCK",
        `Descarte de ${discardedQty} unidades do lote ${confirmDiscardBatch.batchCode} de ${prod.name} por vencimento.`
      );
    }
    if (onShowToast) {
      onShowToast(`Lote ${confirmDiscardBatch.batchCode} descartado com sucesso.`, "info");
    }
    setConfirmDiscardBatch(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. CLEAN EXECUTIVE HEADER & PERIOD SELECTOR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Painel de Controlo Comercial • Em tempo real
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Dashboard Executivo
          </h1>
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <span>Visão consolidada de vendas, rentabilidade e operações.</span>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
              Última sincronização: {lastRefreshedAt}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition"
            title="Recarregar dados e atualizar indicadores"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-600 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "A atualizar..." : "Atualizar"}</span>
          </button>

          {/* Period Selector Tabs */}
          <div className="bg-slate-100/80 p-1 rounded-xl flex items-center gap-1 text-xs font-bold w-full md:w-auto border border-slate-200/50 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTimeScope("TODAY")}
              className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${
                timeScope === "TODAY"
                  ? "bg-white text-orange-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Hoje</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                timeScope === "TODAY" ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-600"
              }`}>
                {periodCounts.today}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTimeScope("YESTERDAY")}
              className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${
                timeScope === "YESTERDAY"
                  ? "bg-white text-orange-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Ontem</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                timeScope === "YESTERDAY" ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-600"
              }`}>
                {periodCounts.yesterday}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTimeScope("LAST_7")}
              className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${
                timeScope === "LAST_7"
                  ? "bg-white text-orange-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>7 Dias</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                timeScope === "LAST_7" ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-600"
              }`}>
                {periodCounts.last7}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTimeScope("THIS_MONTH")}
              className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${
                timeScope === "THIS_MONTH"
                  ? "bg-white text-orange-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Este Mês</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                timeScope === "THIS_MONTH" ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-600"
              }`}>
                {periodCounts.thisMonth}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTimeScope("ALL")}
              className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap ${
                timeScope === "ALL"
                  ? "bg-white text-orange-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Geral</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                timeScope === "ALL" ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-600"
              }`}>
                {periodCounts.all}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Helpful banner if today is empty but transactions exist in other periods */}
      {timeScope === "TODAY" && scopedTransactions.length === 0 && transactions.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-amber-950">Ainda não foram registradas vendas no dia de hoje.</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Existem <strong>{transactions.length}</strong> {transactions.length === 1 ? "venda registrada" : "vendas registradas"} em períodos anteriores no histórico.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setTimeScope("LAST_7")}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-white border border-amber-200 text-amber-900 font-bold rounded-lg hover:bg-amber-100/50 cursor-pointer transition"
            >
              Ver 7 Dias ({periodCounts.last7})
            </button>
            <button
              type="button"
              onClick={() => setTimeScope("ALL")}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 cursor-pointer transition shadow-xs"
            >
              Ver Geral ({periodCounts.all})
            </button>
          </div>
        </div>
      )}

      {/* 2. KEY METRICS ROW (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-orange-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {timeScope === "TODAY" ? "Vendas de Hoje" : timeScope === "YESTERDAY" ? "Vendas de Ontem" : timeScope === "LAST_7" ? "Vendas (7 Dias)" : timeScope === "THIS_MONTH" ? "Vendas do Mês" : "Vendas Gerais"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-xl font-bold font-mono text-slate-900">
              {stats.totalRevenue.toLocaleString()} <span className="text-xs font-medium text-slate-400">{currency}</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span>{stats.txCount} {stats.txCount === 1 ? "venda" : "vendas"}</span>
            </p>
          </div>
        </div>

        {/* Card 2: Estimated Profit */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Lucro Real
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-xl font-bold font-mono text-emerald-600">
              +{stats.totalProfit.toLocaleString()} <span className="text-xs font-medium text-slate-400">{currency}</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span>Margem líquida: <strong className="text-slate-700 font-mono">{stats.profitMarginPercent}%</strong></span>
            </p>
          </div>
        </div>

        {/* Card 3: Transaction Count */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Transações
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-xl font-bold font-mono text-slate-900">
              {stats.txCount} <span className="text-xs font-medium text-slate-400">recibos</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Emitidos no POS
            </p>
          </div>
        </div>

        {/* Card 4: Average Ticket */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ticket Médio
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h2 className="text-xl font-bold font-mono text-slate-900">
              {stats.avgTicket.toLocaleString()} <span className="text-xs font-medium text-slate-400">{currency}</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Média por cliente
            </p>
          </div>
        </div>
      </div>

      {/* 3. PERFORMANCE PROFIT MARGIN WIDGET */}
      <ProfitMarginWidget
        dailySales={stats.totalRevenue}
        dailyCostOfSales={stats.totalCost}
        dailyProfit={stats.totalProfit}
        dailyProfitMarginPercent={stats.profitMarginPercent}
        yesterdaySales={stats.yesterdaySales}
        yesterdayCostOfSales={stats.yesterdayCostOfSales}
        yesterdayProfit={stats.yesterdayProfit}
        yesterdayProfitMarginPercent={stats.yesterdayProfitMarginPercent}
        profitGrowthRate={stats.profitGrowthRate}
        marginPointsDiff={stats.marginPointsDiff}
        currency={currency}
        selectedDateStr={todayStr}
        isToday={timeScope === "TODAY"}
      />

      {/* 4. BALANCED CHARTS ROW (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Sales Timeline (Area Chart) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col h-88">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                Evolução do Faturamento
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Valores reais de vendas correspondentes ao período selecionado.
              </p>
            </div>
            <span className="text-xs font-bold font-mono text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-100">
              {stats.totalRevenue.toLocaleString()} {currency}
            </span>
          </div>

          <div className="flex-1 min-h-0 text-[11px] font-mono">
            {stats.totalRevenue === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                <Package className="w-8 h-8 text-slate-300 stroke-1" />
                <p className="text-xs font-medium">Nenhuma venda registrada no período selecionado.</p>
                {onChangeModule && (
                  <button
                    type="button"
                    onClick={() => onChangeModule("POS")}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                  >
                    Abrir Ponto de Venda (POS) <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSalesClean" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: unknown) => [`${Number(value || 0).toLocaleString()} ${currency}`, "Faturamento"]}
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", border: "none", color: "#fff", fontSize: "11px" }}
                  />
                  <Area type="monotone" dataKey="valor" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSalesClean)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Payment Methods (Donut Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col h-88">
          <div className="mb-2">
            <h3 className="font-bold text-slate-800 text-sm">Métodos de Pagamento</h3>
            <p className="text-xs text-slate-400 mt-0.5">Distribuição das vendas realizadas.</p>
          </div>

          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-[11px]">
            {chartPaymentMethods.length === 0 ? (
              <div className="text-center p-6 text-slate-400 space-y-2">
                <CreditCard className="w-8 h-8 text-slate-300 stroke-1 mx-auto" />
                <p className="text-xs font-medium">Sem transações registradas no período.</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartPaymentMethods}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={68}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartPaymentMethods.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: unknown) => [`${Number(val || 0).toLocaleString()} ${currency}`, "Valor"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Clean Custom Legend */}
                <div className="w-full grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
                  {chartPaymentMethods.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between text-[10.5px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: PAYMENT_COLORS[idx % PAYMENT_COLORS.length] }} 
                        />
                        <span className="text-slate-600 truncate">{item.name}</span>
                      </div>
                      <span className="font-bold font-mono text-slate-800 shrink-0">
                        {item.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. OPERATIONAL OVERVIEW: TOP PRODUCTS & RECENT TRANSACTIONS (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Column 1: Top Selling Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Produtos Mais Vendidos</h3>
              <p className="text-xs text-slate-400 mt-0.5">Ranking por receita gerada no período.</p>
            </div>
            {topProducts.length > 0 && (
              <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">
                Top {topProducts.length}
              </span>
            )}
          </div>

          <div className="flex-1">
            {topProducts.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-1">
                <p className="text-xs font-medium">Nenhum produto vendido neste período.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topProducts.map((p, idx) => (
                  <div key={p.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors rounded-xl px-2">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-base">{p.emoji || "📦"}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800 line-clamp-1">{p.name}</p>
                        <p className="text-[10.5px] text-slate-400 font-medium">
                          {p.quantity} {p.quantity === 1 ? "unidade vendida" : "unidades vendidas"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold font-mono text-slate-900">
                        {p.revenue.toLocaleString()} {currency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Recent Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Últimas Transações</h3>
              <p className="text-xs text-slate-400 mt-0.5">Vendas concluídas recentemente.</p>
            </div>
            {onChangeModule && (
              <button
                type="button"
                onClick={() => onChangeModule("CASH")}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
              >
                Ver Todas <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1">
            {recentTransactions.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-1">
                <p className="text-xs font-medium">Nenhuma transação registrada ainda.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTransactions.map((tx) => {
                  const time = new Date(tx.timestamp).toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => setSelectedTx(tx)}
                      className="py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl px-2 cursor-pointer"
                      title="Clique para ver os detalhes da venda"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {tx.invoiceNumber || tx.id.substring(0, 8)}
                          </p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span>{time}</span>
                            <span>•</span>
                            <span>{tx.cashierName || "Operador"}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-600">{tx.paymentMethod}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold font-mono text-emerald-600">
                          +{tx.grandTotal.toLocaleString()} {currency}
                        </p>
                        <span className="text-[9.5px] text-slate-400 font-mono">
                          {tx.items?.length || 0} {tx.items?.length === 1 ? "item" : "itens"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. EXPIRY & BATCH CONTROL (Only shown when there are batches nearing expiry) */}
      {expiringBatches.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200/80 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-900">Alerta de Lotes Próximos ao Vencimento</h3>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Existem {expiringBatches.length} {expiringBatches.length === 1 ? "lote com validade crítica" : "lotes com validade crítica"} a menos de 30 dias.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {expiringBatches.slice(0, 6).map((b) => (
              <div key={b.id} className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{b.productName}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Lote: <strong>{b.batchCode}</strong> • {b.quantity} un
                  </p>
                  <p className={`text-[10px] font-bold ${b.isExpired ? "text-red-600" : "text-amber-600"}`}>
                    {b.isExpired ? "Expirado!" : `Vence em ${b.daysLeft} dias`}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {b.product && (
                    <button
                      type="button"
                      onClick={() => {
                        setPromoProduct(b.product);
                        setPromoBatch(b);
                        const disc = Math.round(b.product.salePrice * 0.8);
                        setCustomPromoPrice(String(disc));
                        setDiscountPercent(20);
                      }}
                      className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition-colors cursor-pointer"
                      title="Criar Promoção"
                    >
                      <BadgePercent className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDiscardBatch(b)}
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors cursor-pointer"
                    title="Descartar Lote"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: TRANSACTION DETAILS */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-600" />
                  <h3 className="font-bold text-sm text-slate-800">
                    Detalhes da Venda {selectedTx.invoiceNumber || ""}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Data & Hora</span>
                    <strong className="text-slate-800">
                      {new Date(selectedTx.timestamp).toLocaleString("pt-MZ")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Operador</span>
                    <strong className="text-slate-800">{selectedTx.cashierName || "N/D"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Pagamento</span>
                    <strong className="text-slate-800">{selectedTx.paymentMethod}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Cliente</span>
                    <strong className="text-slate-800">{selectedTx.customerName || "Consumidor Final"}</strong>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itens da Fatura</span>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl p-2">
                    {selectedTx.items?.map((it, idx) => (
                      <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{it.productName}</p>
                          <p className="text-[10px] text-slate-400">{it.quantity}x a {it.price.toLocaleString()} {currency}</p>
                        </div>
                        <span className="font-bold font-mono text-slate-900">
                          {((it.quantity || 1) * (it.price || 0)).toLocaleString()} {currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-bold text-sm">
                  <span className="text-slate-700">Total Pago:</span>
                  <span className="text-emerald-600 font-mono text-base">
                    {selectedTx.grandTotal.toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (settings) {
                      printInvoiceHTML(selectedTx, settings);
                    }
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  Imprimir Recibo
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROMO / FLYER MODAL */}
      {promoProduct && promoBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <BadgePercent className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Criar Promoção Rápida</h4>
                <p className="text-xs text-slate-500">Defina o desconto promocional para o produto.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-slate-800">{promoProduct.name}</p>
              <div className="flex justify-between text-slate-500 text-[11px] font-mono">
                <span>SKU: {promoProduct.code}</span>
                <span>Lote: {promoBatch.batchCode} ({promoBatch.quantity} un)</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-1 font-bold">
                <span className="text-slate-500">Preço Atual:</span>
                <span className="text-slate-800">{promoProduct.salePrice.toLocaleString()} {currency}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sugestões de Desconto</label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 20, 30, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setDiscountPercent(pct);
                      const calculated = Math.round(promoProduct.salePrice * (1 - pct / 100));
                      setCustomPromoPrice(String(calculated));
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer border ${
                      discountPercent === pct 
                        ? "bg-orange-600 text-white border-orange-600" 
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Preço Promocional ({currency})</label>
              <input
                type="number"
                value={customPromoPrice}
                onChange={(e) => setCustomPromoPrice(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Novo preço"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPromoProduct(null);
                  setPromoBatch(null);
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleApplyPromo(promoProduct.id, promoBatch.id, discountPercent, Number(customPromoPrice))}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Ativar Promoção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DISCARD MODAL */}
      {confirmDiscardBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Descarte de Lote Vencido</h4>
                <p className="text-xs text-slate-500">Deseja realmente dar baixa neste lote?</p>
              </div>
            </div>

            <div className="bg-red-50/60 p-3 rounded-xl text-xs space-y-1 text-red-950">
              <p className="font-bold">{confirmDiscardBatch.productName}</p>
              <p className="text-[11px] font-mono">Lote: <strong>{confirmDiscardBatch.batchCode}</strong> ({confirmDiscardBatch.quantity} un)</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDiscardBatch(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDiscardBatch(confirmDiscardBatch.id)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Confirmar Descarte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(DashboardModule);
