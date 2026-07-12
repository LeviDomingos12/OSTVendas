import { useMemo, useState, useEffect } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  Layers, 
  DollarSign, 
  PiggyBank, 
  ShoppingBag,
  UserCheck,
  Star,
  Calendar,
  BadgePercent,
  Trash2,
  Percent,
  Clock,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Play,
  Search,
  Eye,
  HelpCircle,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Target,
  Award,
  Info,
  Sliders,
  Printer,
  X,
  FileText,
  Bell,
  Plus,
  Circle
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
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  ComposedChart,
  Line
} from "recharts";
import { Product, Customer, Transaction, CashFlowEntry, SystemSettings } from "../types";
import { printInvoiceHTML } from "../lib/printHelper";

interface DashboardModuleProps {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  cashFlow: CashFlowEntry[];
  currency: string;
  activeUser?: any;
  onChangeModule?: (mod: string) => void;
  settings?: SystemSettings;
  onUpdateSettings?: (newSettings: Partial<SystemSettings>) => void;
  onUpdateProduct?: (updatedP: Product) => void;
  onAddAuditLog?: (action: string, module: string, description: string) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning") => void;
  onCompleteSale?: (transaction: Transaction) => void;
}

export default function DashboardModule({
  products,
  customers,
  transactions,
  cashFlow,
  currency,
  activeUser,
  onChangeModule,
  settings,
  onUpdateSettings,
  onUpdateProduct,
  onAddAuditLog,
  onShowToast,
  onCompleteSale
}: DashboardModuleProps) {
  
  // Date operations helpers
  const dateSplit = (isoStr: string) => isoStr.split("T")[0];
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, []);

  const dayBeforeYesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().split("T")[0];
  }, []);

  // 1. Interactive Scope States
  const [timeScope, setTimeScope] = useState<"TODAY" | "YESTERDAY" | "LAST_7" | "CUSTOM">("TODAY");
  
  // Target Goal State with LocalStorage persistence
  const [targetGoal, setTargetGoal] = useState<number>(() => {
    const saved = localStorage.getItem("erp_daily_revenue_goal");
    return saved ? Number(saved) : 200000;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoalStr, setTempGoalStr] = useState(targetGoal.toString());
  
  // Initialize to the latest date that has sales if today is empty, to provide an amazing and live-loaded feel
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    // Check if today has transactions
    const todayHasTx = transactions.some(tx => dateSplit(tx.timestamp) === todayStr);
    if (todayHasTx || transactions.length === 0) {
      return todayStr;
    }
    // Find the latest recorded transaction date
    const sorted = [...transactions].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return sorted[0] ? dateSplit(sorted[0].timestamp) : todayStr;
  });

  // Secondary states for feed filtering and detailed receipt inspection
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<Transaction | null>(null);

  // Quick POS / Sale Entry states
  const [isQuickSaleModalOpen, setIsQuickSaleModalOpen] = useState(false);
  const [quickSaleCart, setQuickSaleCart] = useState<{ productId: string; name: string; quantity: number; price: number; vatRate: number }[]>([]);
  const [quickSelectedProductId, setQuickSelectedProductId] = useState("");
  const [quickSelectedQuantity, setQuickSelectedQuantity] = useState(1);
  const [quickSelectedCustomerId, setQuickSelectedCustomerId] = useState("");
  const [quickSelectedPaymentMethod, setQuickSelectedPaymentMethod] = useState<"CASH" | "MPESA_PAGA_FACIL" | "EMOLA" | "POS_CARD">("CASH");
  const [quickSelectedCashier, setQuickSelectedCashier] = useState("Levi Domingos");
  const [quickManualCustomerName, setQuickManualCustomerName] = useState("");
  const [quickManualCustomerNuit, setQuickManualCustomerNuit] = useState("");
  const [isSubmittingQuickSale, setIsSubmittingQuickSale] = useState(false);

  // Real-time carousel state & auto-play
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselDirection, setCarouselDirection] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCarouselDirection(1);
      setCarouselIndex((prev) => (prev + 1) % 3);
    }, 6000); // cycle every 6 seconds
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  // Expiry alert states
  const [promoProduct, setPromoProduct] = useState<Product | null>(null);
  const [promoBatch, setPromoBatch] = useState<any | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [customPromoPrice, setCustomPromoPrice] = useState<string>("");
  const [confirmDiscardBatch, setConfirmDiscardBatch] = useState<any | null>(null);

  // Reminders/Daily Tasks notification and state system
  const [reminders, setReminders] = useState<any[]>(() => {
    const saved = localStorage.getItem("erp_daily_reminders");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing reminders", e);
      }
    }
    return [
      { id: "1", title: "Verificar ruptura de estoque nos produtos mais vendidos", completed: false, category: "estoque" },
      { id: "2", title: "Conferir o fechamento de caixa diário", completed: false, category: "financeiro" },
      { id: "3", title: "Sincronizar faturas offline pendentes", completed: false, category: "geral" },
      { id: "4", title: "Rever metas de vendas com a equipa de operadores", completed: false, category: "vendas" },
    ];
  });

  useEffect(() => {
    localStorage.setItem("erp_daily_reminders", JSON.stringify(reminders));
  }, [reminders]);

  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderCategory, setNewReminderCategory] = useState<"vendas" | "estoque" | "financeiro" | "geral">("geral");

  const handleToggleReminder = (id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
    if (onShowToast) onShowToast("Estado do lembrete atualizado!", "success");
  };

  const handleAddReminder = (e: any) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      title: newReminderTitle.trim(),
      completed: false,
      category: newReminderCategory
    };
    setReminders(prev => [newTask, ...prev]);
    setNewReminderTitle("");
    if (onShowToast) onShowToast("Novo lembrete diário adicionado!", "success");
    if (onAddAuditLog) onAddAuditLog("Adicionar Lembrete", "DASHBOARD", `Adicionado lembrete: "${newTask.title}" na categoria ${newTask.category}`);
  };

  const handleDeleteReminder = (id: string) => {
    const target = reminders.find(r => r.id === id);
    setReminders(prev => prev.filter(r => r.id !== id));
    if (onShowToast) onShowToast("Lembrete removido.", "info");
    if (onAddAuditLog && target) {
      onAddAuditLog("Remover Lembrete", "DASHBOARD", `Removido lembrete: "${target.title}"`);
    }
  };

  // Active Tab for reminders list: "diarios" or "recorrentes"
  const [activeReminderTab, setActiveReminderTab] = useState<"diarios" | "recorrentes">("diarios");

  // Recurring Scheduled Reminders state
  const [recurringReminders, setRecurringReminders] = useState<any[]>(() => {
    const saved = localStorage.getItem("erp_recurring_reminders");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing recurring reminders", e);
      }
    }
    return [
      { id: "rec1", title: "Fazer inventário físico rotativo de produtos críticos", completed: false, frequency: "daily", enablePopup: true, category: "estoque", createdAt: new Date().toISOString(), lastTriggered: null },
      { id: "rec2", title: "Análise de fluxo de caixa e conciliação semanal", completed: false, frequency: "weekly", enablePopup: true, category: "financeiro", createdAt: new Date().toISOString(), lastTriggered: null },
      { id: "rec3", title: "Emitir relatórios e faturas consolidadas de clientes a crédito", completed: false, frequency: "monthly", enablePopup: true, category: "vendas", createdAt: new Date().toISOString(), lastTriggered: null }
    ];
  });

  useEffect(() => {
    localStorage.setItem("erp_recurring_reminders", JSON.stringify(recurringReminders));
  }, [recurringReminders]);

  const [newRecurTitle, setNewRecurTitle] = useState("");
  const [newRecurCategory, setNewRecurCategory] = useState<"vendas" | "estoque" | "financeiro" | "geral">("geral");
  const [newRecurFrequency, setNewRecurFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [newRecurEnablePopup, setNewRecurEnablePopup] = useState(true);

  const [activePopupReminder, setActivePopupReminder] = useState<any | null>(null);
  const [snoozedReminders, setSnoozedReminders] = useState<{ [id: string]: number }>({});

  const handleToggleRecurringReminder = (id: string) => {
    setRecurringReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
    if (onShowToast) onShowToast("Estado do lembrete recorrente atualizado!", "success");
  };

  const handleAddRecurringReminder = (e: any) => {
    e.preventDefault();
    if (!newRecurTitle.trim()) return;
    const newRecur = {
      id: "rec_" + Date.now().toString(),
      title: newRecurTitle.trim(),
      completed: false,
      frequency: newRecurFrequency,
      enablePopup: newRecurEnablePopup,
      category: newRecurCategory,
      createdAt: new Date().toISOString(),
      lastTriggered: null
    };
    setRecurringReminders(prev => [newRecur, ...prev]);
    setNewRecurTitle("");
    if (onShowToast) onShowToast("Lembrete recorrente agendado com sucesso!", "success");
    if (onAddAuditLog) onAddAuditLog("Adicionar Lembrete Recorrente", "DASHBOARD", `Adicionado lembrete recorrente: "${newRecur.title}" com frequência ${newRecur.frequency}`);
  };

  const handleDeleteRecurringReminder = (id: string) => {
    const target = recurringReminders.find(r => r.id === id);
    setRecurringReminders(prev => prev.filter(r => r.id !== id));
    if (onShowToast) onShowToast("Lembrete recorrente removido.", "info");
    if (onAddAuditLog && target) {
      onAddAuditLog("Remover Lembrete Recorrente", "DASHBOARD", `Removido lembrete recorrente: "${target.title}"`);
    }
  };

  const handleTriggerCycleCompleted = (id: string) => {
    setRecurringReminders(prev => prev.map(r => r.id === id ? { ...r, lastTriggered: new Date().toISOString(), completed: true } : r));
    if (onShowToast) onShowToast("Ciclo da tarefa recorrente concluído e atualizado!", "success");
    setActivePopupReminder(null);
  };

  const handleSnoozeReminder = (id: string) => {
    setSnoozedReminders(prev => ({
      ...prev,
      [id]: Date.now() + 5 * 60 * 1000 // snooze for 5 minutes
    }));
    if (onShowToast) onShowToast("Lembrete adiado por 5 minutos.", "info");
    setActivePopupReminder(null);
  };

  const handleDismissReminder = (id: string) => {
    // Just update lastTriggered to avoid pop-ups for the rest of the period
    setRecurringReminders(prev => prev.map(r => r.id === id ? { ...r, lastTriggered: new Date().toISOString() } : r));
    if (onShowToast) onShowToast("Lembrete ignorado para este período.", "info");
    setActivePopupReminder(null);
  };

  // Check for due recurring reminders for pop-ups
  useEffect(() => {
    const checkRecurringReminders = () => {
      const now = new Date();
      const nowTime = now.getTime();
      
      const due = recurringReminders.find(reminder => {
        if (!reminder.enablePopup) return false;
        
        // Check if snoozed
        const snoozeUntil = snoozedReminders[reminder.id];
        if (snoozeUntil && nowTime < snoozeUntil) {
          return false;
        }
        
        // If lastTriggered is not set, or we need to alert
        if (!reminder.lastTriggered) return true;
        
        const lastDate = new Date(reminder.lastTriggered);
        const diffMs = nowTime - lastDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        if (reminder.frequency === "daily" && diffDays >= 1) {
          return now.getDate() !== lastDate.getDate() || now.getMonth() !== lastDate.getMonth() || now.getFullYear() !== lastDate.getFullYear();
        }
        if (reminder.frequency === "weekly" && diffDays >= 7) {
          return true;
        }
        if (reminder.frequency === "monthly" && diffDays >= 30) {
          return true;
        }
        return false;
      });
      
      if (due && (!activePopupReminder || activePopupReminder.id !== due.id)) {
        setActivePopupReminder(due);
      }
    };

    // Run after 3s on load and check every 15s
    const timer = setTimeout(checkRecurringReminders, 3000);
    const interval = setInterval(checkRecurringReminders, 15000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [recurringReminders, snoozedReminders, activePopupReminder]);

  // Consolidated list of expiring batches in the next 30 days (excluding 0 qty batches)
  const expiringBatches = useMemo(() => {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + 30);

    const activeBatches = settings?.batches || [];
    
    return activeBatches
      .filter((batch: any) => {
        if (batch.quantity <= 0 || !batch.expiryDate) return false;
        const expiry = new Date(batch.expiryDate);
        return expiry <= limitDate;
      })
      .map((batch: any) => {
        const expiry = new Date(batch.expiryDate);
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const correspondingProduct = products.find(p => p.id === batch.productId);
        return {
          ...batch,
          daysLeft,
          isExpired: daysLeft < 0,
          product: correspondingProduct
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [settings?.batches, products]);

  // Promotions Quick Action Handler
  const handleApplyPromo = (productId: string, batchId: string, discPercent: number, customPrice?: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    let newPrice = Math.round(prod.salePrice * (1 - discPercent / 100));
    if (customPrice && customPrice > 0) {
      newPrice = customPrice;
    }

    const updatedProd: Product = {
      ...prod,
      salePrice: newPrice,
      promotion: "PROMO"
    };

    if (onUpdateProduct) {
      onUpdateProduct(updatedProd);
    }

    if (onAddAuditLog) {
      onAddAuditLog(
        "Criar Promoção Rápida",
        "STOCK",
        `Produto ${prod.name} (Lote ${promoBatch?.batchCode}) colocado em promoção rápida no Dashboard com desconto de ${discPercent}% (${currency} ${prod.salePrice} -> ${currency} ${newPrice}) devido à proximidade de vencimento.`
      );
    }

    if (onShowToast) {
      onShowToast(`Promoção ativada com sucesso! Preço ajustado para ${newPrice.toLocaleString()} ${currency}.`, "success");
    }

    setPromoProduct(null);
    setPromoBatch(null);
    setCustomPromoPrice("");
  };

  // Discard / Write-Off Quick Action Handler
  const handleDiscardBatch = (batchId: string) => {
    const activeBatches = settings?.batches || [];
    const batch = activeBatches.find((b: any) => b.id === batchId);
    if (!batch) return;

    const prod = products.find(p => p.id === batch.productId);

    // 1. Remove the batch
    const updatedBatches = activeBatches.filter((b: any) => b.id !== batchId);

    if (onUpdateSettings) {
      onUpdateSettings({ batches: updatedBatches });
    }

    // 2. Reduce matching product's stock levels
    if (prod) {
      const updatedProd: Product = {
        ...prod,
        stock: Math.max(0, prod.stock - batch.quantity)
      };
      if (onUpdateProduct) {
        onUpdateProduct(updatedProd);
      }
    }

    if (onAddAuditLog) {
      onAddAuditLog(
        "Descarte de Lote Rápido",
        "STOCK",
        `Lote ${batch.batchCode} de ${batch.productName} (${batch.quantity} un) descartado do sistema devido a proximidade de vencimento ou já expirado.`
      );
    }

    if (onShowToast) {
      onShowToast(`Lote ${batch.batchCode} descartado e removido do stock com sucesso.`, "success");
    }

    setConfirmDiscardBatch(null);
  };

  // Quick POS / Sale Entry Functions
  const handleAddToQuickCart = () => {
    if (!quickSelectedProductId) {
      if (onShowToast) onShowToast("Por favor, selecione um produto.", "warning");
      return;
    }
    const product = products.find(p => p.id === quickSelectedProductId);
    if (!product) return;

    if (quickSelectedQuantity <= 0) {
      if (onShowToast) onShowToast("A quantidade deve ser maior que zero.", "warning");
      return;
    }

    if (product.stock < quickSelectedQuantity) {
      if (onShowToast) onShowToast(`Stock insuficiente! Apenas ${product.stock} unidades disponíveis de ${product.name}.`, "warning");
      return;
    }

    setQuickSaleCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + quickSelectedQuantity;
        if (product.stock < newQty) {
          if (onShowToast) onShowToast(`Stock insuficiente no carrinho acumulado! Apenas ${product.stock} unidades disponíveis.`, "warning");
          return prev;
        }
        return prev.map(item => item.productId === product.id ? { ...item, quantity: newQty } : item);
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: quickSelectedQuantity,
        price: product.salePrice,
        vatRate: product.vatRate || 16
      }];
    });

    setQuickSelectedProductId("");
    setQuickSelectedQuantity(1);
    if (onShowToast) onShowToast(`${product.name} adicionado ao carrinho de facturação rápida!`, "success");
  };

  const handleRemoveFromQuickCart = (id: string) => {
    setQuickSaleCart(prev => prev.filter(item => item.productId !== id));
  };

  const handleAutoFillQuickSale = () => {
    // Select 1 to 2 random products with stock > 0
    const inStockProds = products.filter(p => p.stock > 0);
    if (inStockProds.length === 0) {
      if (onShowToast) onShowToast("Não existem produtos com stock disponível no sistema para preenchimento automático.", "warning");
      return;
    }
    const numItems = Math.floor(Math.random() * 2) + 1;
    const shuffled = [...inStockProds].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, Math.min(shuffled.length, numItems));

    const newCart = picked.map(prod => {
      const maxQty = Math.min(prod.stock, 3);
      const qty = Math.floor(Math.random() * maxQty) + 1;
      return {
        productId: prod.id,
        name: prod.name,
        quantity: qty,
        price: prod.salePrice,
        vatRate: prod.vatRate || 16
      };
    });

    setQuickSaleCart(newCart);

    // Pick random cashier
    const cashiers = ["Levi Domingos", "Sofia Tembe", "Dário Matusse", "Amélia Macuácua"];
    setQuickSelectedCashier(cashiers[Math.floor(Math.random() * cashiers.length)]);

    // Pick random payment method
    const methods: ("CASH" | "MPESA_PAGA_FACIL" | "EMOLA" | "POS_CARD")[] = ["CASH", "MPESA_PAGA_FACIL", "EMOLA", "POS_CARD"];
    setQuickSelectedPaymentMethod(methods[Math.floor(Math.random() * methods.length)]);

    // Pick random customer
    if (customers.length > 0 && Math.random() > 0.4) {
      const cust = customers[Math.floor(Math.random() * customers.length)];
      setQuickSelectedCustomerId(cust.id);
      setQuickManualCustomerName("");
      setQuickManualCustomerNuit("");
    } else {
      setQuickSelectedCustomerId("");
      setQuickManualCustomerName("Consumidor Final (Balcão)");
      setQuickManualCustomerNuit("999999999");
    }

    if (onShowToast) onShowToast("Fatura expressa auto-preenchida com artigos reais em stock com sucesso!", "info");
  };

  const handleCompleteQuickSale = () => {
    if (quickSaleCart.length === 0) {
      if (onShowToast) onShowToast("Por favor, adicione pelo menos um produto ao carrinho antes de finalizar.", "warning");
      return;
    }

    if (!onCompleteSale) return;

    setIsSubmittingQuickSale(true);

    try {
      let subtotal = 0;
      let vatTotal = 0;

      const items = quickSaleCart.map(item => {
        const lineSubtotal = item.price * item.quantity;
        const lineVat = lineSubtotal - (lineSubtotal / (1 + item.vatRate / 100));
        subtotal += lineSubtotal;
        vatTotal += lineVat;

        return {
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          vatAmount: Math.round(lineVat),
          discountAmount: 0,
          subtotal: lineSubtotal
        };
      });

      const customer = customers.find(c => c.id === quickSelectedCustomerId);
      const customerName = customer 
        ? customer.name 
        : (quickManualCustomerName.trim() || "Consumidor Final");
      const customerNuit = customer 
        ? customer.nuit 
        : (quickManualCustomerNuit.trim() || "999999999");

      // Generate Invoice Reference
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const randomID = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `FR-${year}${month}${day}-${randomID}`;

      const realTx: Transaction = {
        id: `tx-quick-${Date.now()}`,
        invoiceNumber,
        timestamp: now.toISOString(),
        items,
        subtotal,
        vatTotal: Math.round(vatTotal),
        discountTotal: 0,
        grandTotal: subtotal,
        paymentMethod: quickSelectedPaymentMethod,
        cashierName: quickSelectedCashier,
        customerName,
        customerId: customer ? customer.id : undefined,
        nuit: customerNuit,
        fiscalHash: "FP-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        fiscalKeys: `${Math.floor(10 + Math.random() * 89)}-${Math.floor(10 + Math.random() * 89)}-${Math.floor(10 + Math.random() * 89)}`,
        fiscalCertified: true
      };

      // Push real sale to core state (updates database & deducts real stock level!)
      onCompleteSale(realTx);

      // Audit logs and alert
      if (onAddAuditLog) {
        onAddAuditLog(
          "Registo Rápido de Venda",
          "DASHBOARD",
          `Registo rápido de fatura ${invoiceNumber} no valor de ${subtotal.toLocaleString()} ${currency} via ${quickSelectedPaymentMethod} (Operador: ${quickSelectedCashier}).`
        );
      }

      if (onShowToast) {
        onShowToast(`Sucesso! Venda ${invoiceNumber} registada e stock deduzido.`, "success");
      }

      // Close and clear
      setIsQuickSaleModalOpen(false);
      setQuickSaleCart([]);
      setQuickSelectedProductId("");
      setQuickSelectedQuantity(1);
      setQuickSelectedCustomerId("");
      setQuickManualCustomerName("");
      setQuickManualCustomerNuit("");
    } catch (err) {
      console.error("Erro ao concluir venda expressa:", err);
      if (onShowToast) onShowToast("Erro ao processar e salvar a venda expressa.", "error");
    } finally {
      setIsSubmittingQuickSale(false);
    }
  };

  // 1. Calculations metrics
  const stats = useMemo(() => {
    // Current period filter bounds
    const getScopeDates = (scope: string, baseDate: string) => {
      let dates: string[] = [];
      let prevDates: string[] = [];
      
      if (scope === "TODAY" || scope === "CUSTOM") {
        dates = [baseDate];
        const prev = new Date(baseDate);
        prev.setDate(prev.getDate() - 1);
        prevDates = [prev.toISOString().split("T")[0]];
      } else if (scope === "YESTERDAY") {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - 1);
        const yest = d.toISOString().split("T")[0];
        dates = [yest];
        
        const prev = new Date(yest);
        prev.setDate(prev.getDate() - 1);
        prevDates = [prev.toISOString().split("T")[0]];
      } else if (scope === "LAST_7") {
        // Last 7 days including baseDate
        for (let i = 0; i < 7; i++) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split("T")[0]);
        }
        // Preceding 7 days (days 8-14)
        for (let i = 7; i < 14; i++) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - i);
          prevDates.push(d.toISOString().split("T")[0]);
        }
      }
      return { dates, prevDates };
    };

    const { dates: activeDates, prevDates } = getScopeDates(timeScope, selectedDateStr);

    let salesCurrent = 0;
    let profitCurrent = 0;

    let salesPrev = 0;

    // Month metrics calculations
    let salesMonth = 0;
    let profitMonth = 0;
    const targetMonthYear = selectedDateStr.substring(0, 7); // e.g. "2026-06" or "2026-07"

    // Calculate previous month for comparative monthly growth
    const prevMonthYearStr = (() => {
      const parts = selectedDateStr.split("-");
      let yr = parseInt(parts[0], 10);
      let mo = parseInt(parts[1], 10);
      mo = mo - 1;
      if (mo === 0) {
        mo = 12;
        yr = yr - 1;
      }
      return `${yr}-${String(mo).padStart(2, "0")}`;
    })();
    let salesPrevMonth = 0;

    // Process all transactions
    transactions.forEach(tx => {
      const txDate = dateSplit(tx.timestamp);
      
      let txProfit = 0;
      tx.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const cost = prod ? prod.costPrice : item.price * 0.7; // default fallback margin 30%
        txProfit += (item.price - cost) * item.quantity;
      });

      // Matches current scope
      if (activeDates.includes(txDate)) {
        salesCurrent += tx.grandTotal;
        profitCurrent += txProfit;
      }

      // Matches previous scope
      if (prevDates.includes(txDate)) {
        salesPrev += tx.grandTotal;
      }

      // Matches selected month
      if (tx.timestamp.startsWith(targetMonthYear)) {
        salesMonth += tx.grandTotal;
        profitMonth += txProfit;
      }

      // Matches previous month
      if (tx.timestamp.startsWith(prevMonthYearStr)) {
        salesPrevMonth += tx.grandTotal;
      }
    });

    // Calculate comparative percentages
    const salesGrowthRate = salesPrev > 0 
      ? ((salesCurrent - salesPrev) / salesPrev) * 100 
      : salesCurrent > 0 ? 100 : 0;

    const monthlyGrowthRate = salesPrevMonth > 0 
      ? ((salesMonth - salesPrevMonth) / salesPrevMonth) * 100 
      : salesMonth > 0 ? 100 : 0;

    // Low stock count
    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

    // Debts & Loyalty active clients
    const activeClientsCount = customers.length;
    const activeDebtsCount = customers.filter(c => c.debt > 0).length;
    const totalOutstandingDebt = customers.reduce((acc, c) => acc + c.debt, 0);

    // Dynamic debt settled in the month of selected date
    const debtsSettledMonth = customers.reduce((acc, c) => {
      const settled = (c.settlements || []).filter(s => s.date.startsWith(targetMonthYear));
      return acc + settled.reduce((sAcc, s) => sAcc + s.amount, 0);
    }, 0);

    const creditGivenMonth = transactions
      .filter(t => t.paymentMethod === "DEBT" && t.timestamp.startsWith(targetMonthYear))
      .reduce((s, t) => s + t.grandTotal, 0);

    const recoveryRate = creditGivenMonth > 0 
      ? ((debtsSettledMonth / creditGivenMonth) * 100).toFixed(1) 
      : "0";

    // Cash drawer physical balance for the selected day or overall
    const baseReinforcements = cashFlow
      .filter(f => f.type === "REINFORCEMENT" || f.type === "INPUT")
      .reduce((s, f) => s + f.amount, 0);
    const cashExpenses = cashFlow
      .filter(f => f.type === "EXPENSE" || f.type === "QUEBRA")
      .reduce((s, f) => s + f.amount, 0);

    const cashSalesAmount = transactions
      .filter(t => t.paymentMethod === "CASH")
      .reduce((s, t) => s + t.grandTotal, 0);

    const currentCashDesk = baseReinforcements + cashSalesAmount - cashExpenses;

    return {
      salesToday: salesCurrent,
      profitToday: profitCurrent,
      salesGrowthRate,
      salesMonth,
      profitMonth,
      monthlyGrowthRate,
      lowStockCount,
      activeClientsCount,
      totalOutstandingDebt,
      activeDebtsCount,
      debtsSettledMonth,
      recoveryRate,
      currentCashDesk
    };
  }, [transactions, products, customers, cashFlow, selectedDateStr, timeScope]);

  // 2. Charts Data Prep (fully linked to selectedDateStr)

  // Vendas por Dia (Past 10 Days relative to selectedDateStr)
  const chartDailySales = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    
    // initialize past 10 days ending on selectedDateStr
    for (let i = 9; i >= 0; i--) {
      const d = new Date(selectedDateStr);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split("T")[0];
      dailyMap[str] = 0;
    }

    transactions.forEach(tx => {
      const txDate = dateSplit(tx.timestamp);
      if (dailyMap[txDate] !== undefined) {
        dailyMap[txDate] += tx.grandTotal;
      }
    });

    return Object.entries(dailyMap).map(([date, total]) => {
      const parts = date.split("-");
      const shortDate = `${parts[2]}/${parts[1]}`; // DD/MM format
      return { 
        data: shortDate, 
        Vendas: total 
      };
    });
  }, [transactions, selectedDateStr]);

  // Vendas vs Metas Recorrentes (Past 7 Days relative to selectedDateStr)
  const chartSalesVsGoals = useMemo(() => {
    const dailyMap: Record<string, { Vendas: number; Meta: number }> = {};
    const isCaixa = activeUser?.role?.toUpperCase().includes("CAIXA") || activeUser?.role?.toUpperCase().includes("VENDEDOR");
    // If cashier/caixa, their portion of the target is lower (e.g. 25% of general target or a standard cashier target)
    const dailyMeta = isCaixa ? (targetGoal / 4) : targetGoal;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(selectedDateStr);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split("T")[0];
      dailyMap[str] = { Vendas: 0, Meta: dailyMeta };
    }

    transactions.forEach(tx => {
      const txDate = dateSplit(tx.timestamp);
      if (dailyMap[txDate] !== undefined) {
        dailyMap[txDate].Vendas += tx.grandTotal;
      }
    });

    return Object.entries(dailyMap).map(([date, values]) => {
      const parts = date.split("-");
      const shortDate = `${parts[2]}/${parts[1]}`; // DD/MM format
      return {
        data: shortDate,
        Vendas: values.Vendas,
        Meta: values.Meta,
        dateStr: date
      };
    });
  }, [transactions, selectedDateStr, targetGoal, activeUser]);

  // Receita diária para a semana corrente baseada em selectedDateStr
  const chartWeeklyRevenue = useMemo(() => {
    const current = new Date(selectedDateStr);
    const day = current.getDay();
    // Monday is index 1, Sunday is 0.
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));

    const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const weekData = weekDays.map((name, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      const dateString = d.toISOString().split("T")[0];
      return {
        dayName: name,
        dateStr: dateString,
        fullDateLabel: d.toLocaleDateString("pt-MZ", { day: "2-digit", month: "2-digit" }),
        Receita: 0
      };
    });

    transactions.forEach(tx => {
      const txDate = dateSplit(tx.timestamp);
      const match = weekData.find(wd => wd.dateStr === txDate);
      if (match) {
        match.Receita += tx.grandTotal;
      }
    });

    return weekData;
  }, [transactions, selectedDateStr]);

  const weekBounds = useMemo(() => {
    if (chartWeeklyRevenue.length === 0) return { start: "", end: "" };
    return {
      start: chartWeeklyRevenue[0].fullDateLabel,
      end: chartWeeklyRevenue[chartWeeklyRevenue.length - 1].fullDateLabel
    };
  }, [chartWeeklyRevenue]);

  // Produtos mais vendidos no mês selecionado
  const chartBestSellers = useMemo(() => {
    const productMap: Record<string, { name: string; value: number }> = {};
    const targetMonthYear = selectedDateStr.substring(0, 7);
    
    transactions.forEach(tx => {
      if (tx.timestamp.startsWith(targetMonthYear)) {
        tx.items.forEach(item => {
          if (productMap[item.productId]) {
            productMap[item.productId].value += item.quantity;
          } else {
            productMap[item.productId] = { name: item.productName, value: item.quantity };
          }
        });
      }
    });

    return Object.values(productMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5
  }, [transactions, selectedDateStr]);

  // Vendas por Mês (Totalmente Dinâmico baseado no ano selecionado)
  const chartMonthlySales = useMemo(() => {
    const monthsPT = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];
    
    const targetYear = selectedDateStr.split("-")[0] || "2026";
    
    // Seed with realistic baseline amounts
    const baselineAmounts: Record<number, number> = {
      0: 145000, // Jan
      1: 168000, // Feb
      2: 155000, // Mar
      3: 198000, // Apr
      4: 210000, // May
      5: 240000, // Jun
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
    };

    // Aggregate actual transactions belonging to this year
    transactions.forEach(tx => {
      const txDate = new Date(tx.timestamp);
      if (txDate.getFullYear().toString() === targetYear) {
        const m = txDate.getMonth();
        if (baselineAmounts[m] !== undefined) {
          baselineAmounts[m] += tx.grandTotal;
        } else {
          baselineAmounts[m] = tx.grandTotal;
        }
      }
    });

    return monthsPT.map((name, index) => ({
      Mes: name,
      Valor: Math.round(baselineAmounts[index] || 0)
    }));
  }, [transactions, selectedDateStr]);

  // Vendas dos Últimos 6 Meses agrupadas por mês
  const chartLast6MonthsSales = useMemo(() => {
    const monthsPT = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];
    
    const today = new Date();
    const result = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const label = `${monthsPT[monthIndex]} ${year.toString().slice(-2)}`;
      result.push({
        label,
        year,
        monthIndex,
        Valor: 0,
      });
    }

    // Accumulate sales from actual transactions
    transactions.forEach(tx => {
      const txDate = new Date(tx.timestamp);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();
      
      const matched = result.find(r => r.year === txYear && r.monthIndex === txMonth);
      if (matched) {
        matched.Valor += tx.grandTotal;
      }
    });

    // Baseline/mock baseline amounts for beautiful presentation matching other trends
    const baselineMap: Record<number, number> = {
      0: 145000, // Jan
      1: 168000, // Fev
      2: 155000, // Mar
      3: 198000, // Abr
      4: 210000, // Mai
      5: 240000, // Jun
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
    };

    result.forEach(r => {
      if (r.year === 2026 && baselineMap[r.monthIndex] !== undefined) {
        r.Valor += baselineMap[r.monthIndex];
      }
    });

    return result.map(r => ({
      Mes: r.label,
      Valor: Math.round(r.Valor)
    }));
  }, [transactions]);

  // Métodos de Pagamento Utilizados (Doughnut) correspondentes ao período selecionado
  const chartPaymentMethods = useMemo(() => {
    const paymentMap: Record<string, number> = {
      "Dinheiro": 0,
      "M-Pesa": 0,
      "E-Mola": 0,
      "Cartão/POS": 0,
    };

    // Filter transactions belonging to the selected scope dates
    const getScopeDates = (scope: string, baseDate: string) => {
      let dates: string[] = [];
      if (scope === "TODAY" || scope === "CUSTOM") {
        dates = [baseDate];
      } else if (scope === "YESTERDAY") {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - 1);
        dates = [d.toISOString().split("T")[0]];
      } else if (scope === "LAST_7") {
        for (let i = 0; i < 7; i++) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split("T")[0]);
        }
      }
      return dates;
    };

    const activeDates = getScopeDates(timeScope, selectedDateStr);

    transactions.forEach(tx => {
      const txDate = dateSplit(tx.timestamp);
      if (activeDates.includes(txDate)) {
        if (tx.paymentMethod === "CASH") {
          paymentMap["Dinheiro"] += tx.grandTotal;
        } else if (tx.paymentMethod === "MPESA_PAGA_FACIL") {
          paymentMap["M-Pesa"] += tx.grandTotal;
        } else if (tx.paymentMethod === "EMOLA") {
          paymentMap["E-Mola"] += tx.grandTotal;
        } else {
          paymentMap["Cartão/POS"] += tx.grandTotal;
        }
      }
    });

    return Object.entries(paymentMap).map(([name, value]) => ({ name, value }));
  }, [transactions, selectedDateStr, timeScope]);

  // Distribuição detalhada de receita por métodos de pagamento (Cash, Card, Debt, M-Pesa)
  const paymentRevenueDetails = useMemo(() => {
    const dataMap: Record<string, { totalRevenue: number; count: number; label: string }> = {
      "CASH": { totalRevenue: 0, count: 0, label: "Dinheiro (Cash)" },
      "CARD": { totalRevenue: 0, count: 0, label: "Cartão (Card)" },
      "DEBT": { totalRevenue: 0, count: 0, label: "Dívida (Debt)" },
      "MPESA": { totalRevenue: 0, count: 0, label: "M-Pesa / Mobile" }
    };

    const getScopeDates = (scope: string, baseDate: string) => {
      let dates: string[] = [];
      if (scope === "TODAY" || scope === "CUSTOM") {
        dates = [baseDate];
      } else if (scope === "YESTERDAY") {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - 1);
        dates = [d.toISOString().split("T")[0]];
      } else if (scope === "LAST_7") {
        for (let i = 0; i < 7; i++) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split("T")[0]);
        }
      }
      return dates;
    };

    const activeDates = getScopeDates(timeScope, selectedDateStr);
    let overallTotal = 0;

    transactions.forEach(tx => {
      const txDate = dateSplit(tx.timestamp);
      if (activeDates.includes(txDate)) {
        overallTotal += tx.grandTotal;
        if (tx.paymentMethod === "CASH") {
          dataMap["CASH"].totalRevenue += tx.grandTotal;
          dataMap["CASH"].count += 1;
        } else if (tx.paymentMethod === "MPESA_PAGA_FACIL" || tx.paymentMethod === "EMOLA") {
          dataMap["MPESA"].totalRevenue += tx.grandTotal;
          dataMap["MPESA"].count += 1;
        } else if (tx.paymentMethod === "DEBT") {
          dataMap["DEBT"].totalRevenue += tx.grandTotal;
          dataMap["DEBT"].count += 1;
        } else {
          dataMap["CARD"].totalRevenue += tx.grandTotal;
          dataMap["CARD"].count += 1;
        }
      }
    });

    const chartData = Object.entries(dataMap).map(([key, item]) => {
      const percentage = overallTotal > 0 ? (item.totalRevenue / overallTotal) * 100 : 0;
      const averageTicket = item.count > 0 ? item.totalRevenue / item.count : 0;
      return {
        key,
        name: item.label,
        value: Math.round(item.totalRevenue),
        count: item.count,
        percentage: parseFloat(percentage.toFixed(1)),
        avgTicket: Math.round(averageTicket)
      };
    });

    return {
      chartData,
      overallTotal
    };
  }, [transactions, selectedDateStr, timeScope]);

  const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6"];

  // Top Clientes
  const topCustomers = useMemo(() => {
    return [...customers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 3);
  }, [customers]);

  // Top Cashiers / Salespeople (filtered by month of selected date)
  const topSalespeople = useMemo(() => {
    const sellerMap: Record<string, { name: string; count: number; total: number }> = {};
    const targetMonthYear = selectedDateStr.substring(0, 7);
    
    transactions.forEach(tx => {
      if (tx.timestamp.startsWith(targetMonthYear)) {
        if (!sellerMap[tx.cashierName]) {
          sellerMap[tx.cashierName] = { name: tx.cashierName, count: 0, total: 0 };
        }
        sellerMap[tx.cashierName].count += 1;
        sellerMap[tx.cashierName].total += tx.grandTotal;
      }
    });

    return Object.values(sellerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [transactions, selectedDateStr]);

  const lowStockProducts = useMemo(() => products.filter(p => p.stock <= p.minStock), [products]);

  // Daily Sales Transactions feed corresponding to selectedDate / scope
  const filteredDailyTransactions = useMemo(() => {
    const getScopeDates = (scope: string, baseDate: string) => {
      let dates: string[] = [];
      if (scope === "TODAY" || scope === "CUSTOM") {
        dates = [baseDate];
      } else if (scope === "YESTERDAY") {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - 1);
        dates = [d.toISOString().split("T")[0]];
      } else if (scope === "LAST_7") {
        for (let i = 0; i < 7; i++) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split("T")[0]);
        }
      }
      return dates;
    };

    const activeDates = getScopeDates(timeScope, selectedDateStr);

    let list = transactions.filter(tx => activeDates.includes(dateSplit(tx.timestamp)));

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      list = list.filter(tx => 
        tx.invoiceNumber.toLowerCase().includes(q) ||
        tx.cashierName.toLowerCase().includes(q) ||
        (tx.customerName && tx.customerName.toLowerCase().includes(q))
      );
    }

    if (paymentFilter !== "") {
      list = list.filter(tx => tx.paymentMethod === paymentFilter);
    }

    return list;
  }, [transactions, selectedDateStr, timeScope, searchQuery, paymentFilter]);

  // 1. CAROUSEL PERFORMANCE METRICS CALCULATIONS
  // Hourly sales based on the absolute latest transaction date in DB as "now" (handles static historical data nicely)
  const lastHourMetrics = useMemo(() => {
    if (transactions.length === 0) return { total: 0, count: 0 };
    
    // Find the latest transaction's timestamp
    const sorted = [...transactions].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const latestTxTime = new Date(sorted[0].timestamp).getTime();
    
    const oneHourMs = 60 * 60 * 1000;
    const recentTxs = transactions.filter(tx => {
      const txTime = new Date(tx.timestamp).getTime();
      return (latestTxTime - txTime) >= 0 && (latestTxTime - txTime) <= oneHourMs;
    });
    
    const total = recentTxs.reduce((sum, tx) => sum + tx.grandTotal, 0);
    return { total, count: recentTxs.length };
  }, [transactions]);

  // Average Ticket for the selected filter period
  const averageTicket = useMemo(() => {
    const list = filteredDailyTransactions;
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, tx) => acc + tx.grandTotal, 0);
    return Math.round(sum / list.length);
  }, [filteredDailyTransactions]);

  // Average Ticket percentage growth compared to preceding period
  const averageTicketComparison = useMemo(() => {
    const getScopeDates = (scope: string, baseDate: string) => {
      let prevDates: string[] = [];
      if (scope === "TODAY" || scope === "CUSTOM") {
        const prev = new Date(baseDate);
        prev.setDate(prev.getDate() - 1);
        prevDates = [prev.toISOString().split("T")[0]];
      } else if (scope === "YESTERDAY") {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - 2);
        prevDates = [d.toISOString().split("T")[0]];
      } else if (scope === "LAST_7") {
        for (let i = 7; i < 14; i++) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() - i);
          prevDates.push(d.toISOString().split("T")[0]);
        }
      }
      return prevDates;
    };

    const prevDates = getScopeDates(timeScope, selectedDateStr);
    const prevTxs = transactions.filter(tx => prevDates.includes(dateSplit(tx.timestamp)));
    
    if (prevTxs.length === 0) return 0;
    const prevSum = prevTxs.reduce((acc, tx) => acc + tx.grandTotal, 0);
    const prevAvg = prevSum / prevTxs.length;
    
    const currentAvg = averageTicket;
    if (prevAvg === 0) return currentAvg > 0 ? 100 : 0;
    return ((currentAvg - prevAvg) / prevAvg) * 100;
  }, [transactions, selectedDateStr, timeScope, averageTicket]);

  const targetProgress = useMemo(() => {
    const factor = timeScope === "LAST_7" ? 7 : 1;
    const currentTarget = targetGoal * factor;
    const sales = stats.salesToday;
    const pct = currentTarget > 0 ? (sales / currentTarget) * 100 : 0;
    return {
      pct: Math.min(Math.round(pct), 100),
      rawPct: pct,
      isMet: sales >= currentTarget,
      target: currentTarget,
      remaining: Math.max(0, currentTarget - sales)
    };
  }, [stats.salesToday, timeScope, targetGoal]);

  const handlePrevSlide = () => {
    setIsAutoPlaying(false);
    setCarouselDirection(-1);
    setCarouselIndex((prev) => (prev === 0 ? 2 : prev - 1));
  };

  const handleNextSlide = () => {
    setIsAutoPlaying(false);
    setCarouselDirection(1);
    setCarouselIndex((prev) => (prev === 2 ? 0 : prev + 1));
  };

  const handleSelectSlide = (idx: number) => {
    setIsAutoPlaying(false);
    setCarouselDirection(idx > carouselIndex ? 1 : -1);
    setCarouselIndex(idx);
  };

  return (
    <div className="space-y-6">

      {/* REAL-TIME PERFORMANCE CAROUSEL */}
      <div className="relative bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm overflow-hidden min-h-[155px] flex flex-col justify-between">
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-100/30 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50/40 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        <div className="flex items-center justify-between w-full z-10">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 font-mono">Desempenho Comercial</span>
          </div>
          {/* Autoplay status badge */}
          <button 
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className={`text-[9px] px-2 py-0.5 rounded-full font-bold transition flex items-center gap-1 cursor-pointer ${
              isAutoPlaying 
                ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" 
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            <span className={`w-1 h-1 rounded-full ${isAutoPlaying ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
            {isAutoPlaying ? "Auto-Play" : "Pausado"}
          </button>
        </div>

        <div className="relative my-3 min-h-[70px] flex items-center">
          <AnimatePresence mode="wait" custom={carouselDirection}>
            {carouselIndex === 0 && (
              <motion.div
                key="slide-0"
                custom={carouselDirection}
                initial={{ opacity: 0, y: carouselDirection * 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -carouselDirection * 15 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center w-full"
              >
                <div className="md:col-span-8 flex items-center gap-4">
                  <div className="bg-orange-50 text-orange-600 p-3 rounded-2xl shrink-0 shadow-inner">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Vendas da Última Hora</span>
                    <h3 className="text-2xl font-black font-mono text-slate-800">
                      {lastHourMetrics.total.toLocaleString()} <span className="text-sm font-bold text-slate-400">{currency}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Total de <strong className="text-orange-600 font-mono">{lastHourMetrics.count} transações</strong> registadas nos últimos 60 minutos de atividade.
                    </p>
                  </div>
                </div>
                <div className="hidden md:flex md:col-span-4 justify-end">
                  <span className="text-xs bg-orange-50/80 border border-orange-100/50 text-orange-700 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-orange-500 animate-ping" />
                    Monitorizando ao Vivo
                  </span>
                </div>
              </motion.div>
            )}

            {carouselIndex === 1 && (
              <motion.div
                key="slide-1"
                custom={carouselDirection}
                initial={{ opacity: 0, y: carouselDirection * 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -carouselDirection * 15 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center w-full"
              >
                <div className="md:col-span-8 flex items-center gap-4">
                  <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl shrink-0 shadow-inner">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Ticket Médio Atual</span>
                    <h3 className="text-2xl font-black font-mono text-slate-800">
                      {averageTicket.toLocaleString()} <span className="text-sm font-bold text-slate-400">{currency}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Média do valor faturado por cliente nas compras registadas.
                    </p>
                  </div>
                </div>
                <div className="hidden md:flex md:col-span-4 justify-end">
                  <div className="text-right">
                    <span className={`text-xs px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1 ${
                      averageTicketComparison >= 0 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                        : "bg-rose-50 text-rose-700 border border-rose-100"
                    }`}>
                      {averageTicketComparison >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {averageTicketComparison >= 0 ? "+" : ""}{averageTicketComparison.toFixed(1)}% vs anterior
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {carouselIndex === 2 && (
              <motion.div
                key="slide-2"
                custom={carouselDirection}
                initial={{ opacity: 0, y: carouselDirection * 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -carouselDirection * 15 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center w-full"
              >
                <div className="md:col-span-8 flex items-center gap-4 w-full">
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl shrink-0 shadow-inner">
                    <Target className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 w-full">
                    {isEditingGoal ? (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <input 
                            type="number"
                            value={tempGoalStr}
                            onChange={(e) => setTempGoalStr(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl py-1 px-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36"
                            placeholder="Nova Meta"
                            autoFocus
                          />
                          <span className="absolute right-2 top-1 text-[9px] text-slate-400 font-bold uppercase">{currency}</span>
                        </div>
                        <button 
                          onClick={() => {
                            const val = Number(tempGoalStr);
                            if (val > 0) {
                              setTargetGoal(val);
                              localStorage.setItem("erp_daily_revenue_goal", val.toString());
                              setIsEditingGoal(false);
                              if (onShowToast) onShowToast("Meta diária de receita atualizada com sucesso!", "success");
                              if (onAddAuditLog) onAddAuditLog("Atualizar Meta de Receita", "DASHBOARD", `Meta diária de receita alterada para ${val.toLocaleString()} ${currency}.`);
                            } else {
                              if (onShowToast) onShowToast("A meta deve ser maior que zero.", "warning");
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 rounded-lg text-[11px] cursor-pointer transition active:scale-95"
                        >
                          Salvar
                        </button>
                        <button 
                          onClick={() => {
                            setTempGoalStr(targetGoal.toString());
                            setIsEditingGoal(false);
                          }}
                          className="text-slate-400 hover:text-slate-600 font-bold py-1 px-2 text-[11px] cursor-pointer transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">Meta de Venda Batida</span>
                          <button 
                            onClick={() => {
                              setTempGoalStr(targetGoal.toString());
                              setIsEditingGoal(true);
                              setIsAutoPlaying(false);
                            }}
                            className="text-[10px] text-blue-500 hover:text-blue-700 font-bold underline cursor-pointer"
                          >
                            (Ajustar Meta)
                          </button>
                        </div>
                        <span className="text-xs font-black text-emerald-600 font-mono">{targetProgress.pct}%</span>
                      </div>
                    )}
                    
                    {/* Visual Progress bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mr-4 mt-1 flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${targetProgress.pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${targetProgress.isMet ? "bg-gradient-to-r from-emerald-400 to-teal-500 animate-pulse" : "bg-gradient-to-r from-orange-400 to-emerald-500"}`}
                      />
                    </div>
                    
                    <p className="text-[11px] text-slate-400 mt-1">
                      Faturado: <strong className="text-slate-700 font-mono">{stats.salesToday.toLocaleString()} {currency}</strong> de uma meta de <strong className="text-slate-700 font-mono">{targetProgress.target.toLocaleString()} {currency}</strong>.
                    </p>
                  </div>
                </div>
                <div className="hidden md:flex md:col-span-4 justify-end">
                  {targetProgress.isMet ? (
                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                      Meta Batida! 🎉
                    </span>
                  ) : (
                    <span className="text-xs bg-slate-50 text-slate-600 px-3 py-1.5 rounded-xl font-semibold border border-slate-150">
                      Faltam {targetProgress.remaining.toLocaleString()} {currency}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Controls and Indicators */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
          {/* Slide indicator dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                onClick={() => handleSelectSlide(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  carouselIndex === idx 
                    ? "bg-orange-500 w-6" 
                    : "bg-slate-200 hover:bg-slate-300 w-1.5"
                }`}
                title={`Ver métrica ${idx + 1}`}
              />
            ))}
          </div>

          {/* Nav arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevSlide}
              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer transition"
              title="Métrica Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextSlide}
              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer transition"
              title="Próxima Métrica"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* 0. INTERACTIVE FILTER & LIVE SIMULATOR BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 font-mono">Painel de Controlo Ativo</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Monitorização Comercial de Vendas</h2>
          <p className="text-xs text-slate-300">
            Análise do fluxo transacional correspondente a <strong className="text-orange-400 font-mono">
              {timeScope === "TODAY" ? "Hoje" : timeScope === "YESTERDAY" ? "Ontem" : timeScope === "LAST_7" ? "Últimos 7 dias" : "Data Customizada"}
            </strong> ({new Date(selectedDateStr).toLocaleDateString("pt-MZ", { day: "2-digit", month: "long", year: "numeric" })}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Scope Filters */}
          <div className="bg-slate-800/80 p-1 rounded-2xl border border-slate-700/50 flex gap-1 text-xs font-semibold w-full sm:w-auto">
            <button
              onClick={() => {
                setTimeScope("TODAY");
                setSelectedDateStr(todayStr);
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl cursor-pointer transition ${
                timeScope === "TODAY" 
                  ? "bg-orange-600 text-white font-bold shadow" 
                  : "hover:bg-slate-700 text-slate-300"
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => {
                setTimeScope("YESTERDAY");
                setSelectedDateStr(todayStr); // calculations will shift inside stats
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl cursor-pointer transition ${
                timeScope === "YESTERDAY" 
                  ? "bg-orange-600 text-white font-bold shadow" 
                  : "hover:bg-slate-700 text-slate-300"
              }`}
            >
              Ontem
            </button>
            <button
              onClick={() => {
                setTimeScope("LAST_7");
                setSelectedDateStr(todayStr);
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl cursor-pointer transition ${
                timeScope === "LAST_7" 
                  ? "bg-orange-600 text-white font-bold shadow" 
                  : "hover:bg-slate-700 text-slate-300"
              }`}
            >
              7 Dias
            </button>
            <button
              onClick={() => setTimeScope("CUSTOM")}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl cursor-pointer transition ${
                timeScope === "CUSTOM" 
                  ? "bg-orange-600 text-white font-bold shadow" 
                  : "hover:bg-slate-700 text-slate-300"
              }`}
            >
              Calendário
            </button>
          </div>

          {/* Custom Date Input (shown when CUSTOM is selected) */}
          {timeScope === "CUSTOM" && (
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2 py-1 rounded-2xl">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => {
                  if (e.target.value) setSelectedDateStr(e.target.value);
                }}
                max={todayStr}
                className="bg-transparent border-none text-white text-xs font-bold font-mono focus:outline-none focus:ring-0 w-28"
              />
            </div>
          )}

          {/* Real-time Quick POS Sale Button */}
          {onCompleteSale && (
            <button
              onClick={() => setIsQuickSaleModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-extrabold rounded-2xl cursor-pointer transition shadow-lg shadow-emerald-950/30 active:scale-95 w-full sm:w-auto"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-100" />
              <span>Registar Venda Rápida</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. KEY INDICATORS ROW - Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Sales Today */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {timeScope === "TODAY" ? "Vendas de Hoje" : timeScope === "YESTERDAY" ? "Vendas de Ontem" : timeScope === "LAST_7" ? "Vendas (7 Dias)" : "Vendas do Dia"}
            </span>
            <h3 className="text-xl font-bold font-mono text-slate-800">
              {stats.salesToday.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-400">{currency}</span>
            </h3>
            <span className={`text-[10px] flex items-center gap-0.5 font-bold ${
              stats.salesGrowthRate >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}>
              {stats.salesGrowthRate >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {stats.salesGrowthRate >= 0 ? "+" : ""}{stats.salesGrowthRate.toFixed(1)}% vs anterior
            </span>
          </div>
          <div className="bg-orange-50 text-orange-600 p-3 rounded-xl shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Monthly sales */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Faturação ({new Date(selectedDateStr).toLocaleDateString("pt-MZ", { month: "short", year: "numeric" })})
            </span>
            <h3 className="text-xl font-bold font-mono text-slate-800">
              {stats.salesMonth.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-400">{currency}</span>
            </h3>
            <span className={`text-[10px] flex items-center gap-0.5 font-bold ${
              stats.monthlyGrowthRate >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}>
              {stats.monthlyGrowthRate >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {stats.monthlyGrowthRate >= 0 ? "+" : ""}{stats.monthlyGrowthRate.toFixed(1)}% vs mês ant.
            </span>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Today Profits */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Lucro Estimado</span>
            <h3 className="text-xl font-bold font-mono text-emerald-700">
              +{stats.profitToday.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-400">{currency}</span>
            </h3>
            <span className="text-[10px] text-slate-400">Margem líquida (~30%)</span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Cash drawer values */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Saldo Físico de Caixa</span>
            <h3 className="text-xl font-bold font-mono text-slate-800">
              {stats.currentCashDesk.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-400">{currency}</span>
            </h3>
            <span className="text-[10px] text-slate-400">Controlo de boca de caixa</span>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl shrink-0">
            <PiggyBank className="w-6 h-6" />
          </div>
        </div>

        {/* Secondary metric blocks */}
        {lowStockProducts.length > 0 && (
          <div className="col-span-2 row-span-2 bg-orange-50 border border-orange-200 p-4.5 rounded-2xl flex flex-col gap-3 max-h-64 overflow-hidden">
            <div className="flex items-center justify-between border-b border-orange-100 pb-2">
              <div className="flex gap-2 items-center">
                <AlertTriangle className="w-5 h-5 text-orange-600 animate-pulse" />
                <h4 className="text-sm font-bold text-orange-800 tracking-tight">Central de Alertas (Risco de Ruptura)</h4>
              </div>
              <span className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {lowStockProducts.length} itens críticos
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {lowStockProducts.map(prod => (
                <div key={prod.id} className="bg-white/80 p-3 rounded-xl border border-orange-100/50 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <span className="text-lg">{prod.emoji || "📦"}</span> {prod.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">SKU: {prod.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-700 text-xs">Stock: {prod.stock}</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Min: {prod.minStock}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-orange-100">
              <button 
                onClick={() => onChangeModule && onChangeModule("STOCK")}
                className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-orange-600/20 transition cursor-pointer"
              >
                Atualizar Inventário Agora
              </button>
            </div>
          </div>
        )}

        <div className={`bg-red-50 border border-red-100 p-4.5 rounded-2xl flex flex-col justify-center gap-4 ${lowStockProducts.length > 0 ? "col-span-2 row-span-2" : "col-span-4 lg:col-span-2"}`}>
          <div className="flex gap-3.5 items-center border-b border-red-100 pb-3">
            <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
              <Users className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Créditos de Clientes (Dívidas)</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Visão geral do crédito na praça.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total em Dívida</p>
              <p className="text-lg font-bold text-red-700">{stats.totalOutstandingDebt.toLocaleString()} {currency}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Dívidas Ativas</p>
              <p className="text-lg font-bold text-slate-800">{stats.activeDebtsCount} Clientes</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Liquidadas (Mês)</p>
              <p className="text-lg font-bold text-emerald-600">{stats.debtsSettledMonth.toLocaleString()} {currency}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Recuperação</p>
              <p className="text-lg font-bold text-emerald-600">{stats.recoveryRate}%</p>
            </div>
          </div>
          <div className="pt-2 border-t border-red-100 flex justify-end">
            <button
              onClick={() => onChangeModule && onChangeModule("CUSTOMERS")}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Ver Devedores
            </button>
          </div>
        </div>
      </div>

      {/* 1.5 PRODUCT EXPIRY CONTROL AND QUICK ACTIONS WIDGET */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Controlo de Validade e Lotes Críticos (30 Dias)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Gerencie lotes próximos ao vencimento, criando promoções instantâneas ou registrando perdas/descartes.</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
            expiringBatches.length > 0 
              ? "bg-amber-100 text-amber-800 animate-pulse" 
              : "bg-emerald-100 text-emerald-800"
          }`}>
            {expiringBatches.length === 0 ? "Tudo Regularizado" : `${expiringBatches.length} Lotes Alerta`}
          </span>
        </div>

        {expiringBatches.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="text-3xl">🎉</div>
            <p className="text-xs font-semibold text-slate-500">Excelente! Nenhum lote de produto está a menos de 30 dias de expirar no inventário.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider">
                  <th className="pb-3 pl-2">Produto</th>
                  <th className="pb-3 text-center">Lote / Qtd Ativa</th>
                  <th className="pb-3 text-center">Validade</th>
                  <th className="pb-3 text-center">Estado</th>
                  <th className="pb-3 text-right pr-2">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expiringBatches.map((batch) => {
                  const daysLeft = batch.daysLeft;
                  const isExpired = batch.isExpired;
                  const prod = batch.product;

                  // CSS classes depending on critical level
                  const rowClass = isExpired 
                    ? "bg-red-50/20 hover:bg-red-50/40" 
                    : daysLeft <= 10 
                      ? "bg-amber-50/10 hover:bg-amber-50/30"
                      : "hover:bg-slate-50/40";

                  return (
                    <tr key={batch.id} className={`transition ${rowClass}`}>
                      {/* Product Name */}
                      <td className="py-3.5 pl-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{prod?.emoji || "📦"}</span>
                          <div>
                            <p className="font-extrabold text-xs text-slate-800">{batch.productName}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {prod?.code || "N/A"} • Cat: {prod?.category || "N/A"}</p>
                          </div>
                        </div>
                      </td>

                      {/* Batch Code and Qty */}
                      <td className="py-3.5 text-center">
                        <span className="font-bold font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {batch.batchCode}
                        </span>
                        <p className="text-[10px] text-slate-500 font-bold font-mono mt-1">{batch.quantity} un restantes</p>
                      </td>

                      {/* Expiration date */}
                      <td className="py-3.5 text-center font-mono text-xs font-bold text-slate-700">
                        {new Date(batch.expiryDate).toLocaleDateString("pt-MZ", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </td>

                      {/* Status / Days Left */}
                      <td className="py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          isExpired
                            ? "bg-red-100 text-red-800"
                            : daysLeft <= 10
                              ? "bg-orange-100 text-orange-800"
                              : "bg-amber-100 text-amber-800"
                        }`}>
                          {isExpired ? "Expirado" : `${daysLeft} dias rest.`}
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 text-right pr-2 space-x-1 whitespace-nowrap">
                        {prod && (
                          <button
                            onClick={() => {
                              setPromoProduct(prod);
                              setPromoBatch(batch);
                              // Calculate default 20% discount price
                              const discounted = Math.round(prod.salePrice * 0.8);
                              setCustomPromoPrice(String(discounted));
                              setDiscountPercent(20);
                            }}
                            className="bg-orange-50 hover:bg-orange-100 text-orange-700 font-black px-2.5 py-1.5 rounded-xl text-[10.5px] cursor-pointer transition inline-flex items-center gap-1 shadow-sm border border-orange-200/50"
                            title="Colocar produto em promoção"
                          >
                            <BadgePercent className="w-3.5 h-3.5 text-orange-600" />
                            Promoção
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDiscardBatch(batch)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 font-black px-2.5 py-1.5 rounded-xl text-[10.5px] cursor-pointer transition inline-flex items-center gap-1 shadow-sm border border-red-200/50"
                          title="Descartar lote vencido"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          Descarte
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK PROMOTION MODAL */}
      {promoProduct && promoBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <BadgePercent className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Criar Promoção de Validade</h4>
                <p className="text-xs text-slate-500 mt-0.5">Defina uma promoção rápida para o produto devido ao vencimento iminente do lote.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl space-y-1 text-xs">
              <p className="font-bold text-slate-800">{promoProduct.name}</p>
              <div className="flex justify-between text-slate-500 text-[11px] font-mono mt-1">
                <span>SKU: {promoProduct.code}</span>
                <span>Lote: {promoBatch.batchCode} ({promoBatch.quantity} un)</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 mt-1 font-bold">
                <span className="text-slate-500">Preço de Venda Atual:</span>
                <span className="text-slate-800">{promoProduct.salePrice.toLocaleString()} {currency}</span>
              </div>
            </div>

            {/* Discount Selector */}
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
                    className={`py-2 px-3 text-xs font-extrabold rounded-xl transition cursor-pointer border ${
                      discountPercent === pct 
                        ? "bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-600/15" 
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Price input fields */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                <span>Preço Promocional ({currency})</span>
                {discountPercent > 0 && <span className="text-orange-600 font-bold">-{discountPercent}% aplicado</span>}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={customPromoPrice}
                  onChange={(e) => {
                    setCustomPromoPrice(e.target.value);
                    const entered = Number(e.target.value);
                    if (entered > 0 && promoProduct.salePrice > 0) {
                      const diff = promoProduct.salePrice - entered;
                      const pct = Math.round((diff / promoProduct.salePrice) * 100);
                      setDiscountPercent(pct > 0 ? pct : 0);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Introduza o novo preço"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold uppercase">{currency}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setPromoProduct(null);
                  setPromoBatch(null);
                  setCustomPromoPrice("");
                }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleApplyPromo(promoProduct.id, promoBatch.id, discountPercent, Number(customPromoPrice))}
                className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs cursor-pointer transition shadow-md shadow-orange-600/10 active:scale-95"
              >
                Ativar Promoção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DISCARD MODAL */}
      {confirmDiscardBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Descarte de Lote Crítico</h4>
                <p className="text-xs text-slate-500 mt-0.5">Deseja realmente dar baixa e descartar este lote de produto?</p>
              </div>
            </div>

            <div className="bg-red-50/50 p-3.5 rounded-2xl text-xs text-red-950 space-y-1.5">
              <p className="font-bold">{confirmDiscardBatch.productName}</p>
              <p className="text-[11px] font-mono">Lote: <strong>{confirmDiscardBatch.batchCode}</strong></p>
              <p className="text-[11px] font-mono">Quantidade para Descarte: <strong>{confirmDiscardBatch.quantity} un</strong></p>
              <p className="text-[11px] font-mono">Validade: <strong>{new Date(confirmDiscardBatch.expiryDate).toLocaleDateString("pt-MZ")}</strong></p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              <strong>Nota:</strong> Esta ação removerá definitivamente este lote do sistema e reduzirá o stock do produto associado em <strong>{confirmDiscardBatch.quantity} unidades</strong>. Esta perda será registrada nos registos de auditoria.
            </p>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDiscardBatch(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDiscardBatch(confirmDiscardBatch.id)}
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs cursor-pointer transition shadow-md shadow-red-600/10 active:scale-95"
              >
                Confirmar Descarte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN VISUAL CHARTS ROWS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Daily sales timeline widget */}
        <div className="col-span-2 bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-96">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Vendas por Dia</h3>
            <p className="text-xs text-slate-400 mt-0.5">Fluxo de caixa gerado nos últimos 10 dias correntes.</p>
          </div>
          <div className="flex-1 min-h-0 text-[11px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDailySales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="data" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value) => [`${value.toLocaleString()} MT`, 'Vendas']} />
                <Area type="monotone" dataKey="Vendas" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment methods circular split */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-96">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Métodos de Pagamento</h3>
            <p className="text-xs text-slate-400 mt-0.5">Preferências transacionadas este mês.</p>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center text-[11px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartPaymentMethods}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartPaymentMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value.toLocaleString()} MT`]} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vendas vs Metas Dynamic Composed Chart */}
        <div className="col-span-2 bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-96">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Vendas vs. Metas</h3>
              <p className="text-xs text-slate-400 mt-0.5">Visão comparativa de desempenho comercial dos últimos 7 dias.</p>
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
              activeUser?.role?.toUpperCase().includes("ADMINISTRADOR") || activeUser?.role?.toUpperCase().includes("GESTOR")
                ? "bg-emerald-50 text-emerald-700 border-emerald-150" 
                : "bg-blue-50 text-blue-700 border-blue-150"
            }`}>
              {activeUser?.role?.toUpperCase().includes("ADMINISTRADOR") || activeUser?.role?.toUpperCase().includes("GESTOR")
                ? "Visão: Geral (Administrador)" 
                : `Visão: Própria (Caixa)`}
            </span>
          </div>
          <div className="flex-1 min-h-0 text-[11px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartSalesVsGoals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="data" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value, name) => [`${value.toLocaleString()} ${currency}`, name === "Vendas" ? "Vendido" : "Meta"]} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar dataKey="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} name="Vendas Realizadas" />
                <Line type="monotone" dataKey="Meta" stroke="#ef4444" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} name="Meta de Vendas" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dynamic Goal Explainer / Metric Summary widget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col justify-between h-96">
          <div className="mb-2">
            <h3 className="font-bold text-slate-800 text-sm">Análise de Metas</h3>
            <p className="text-xs text-slate-400 mt-0.5">Indicadores chave de desempenho comercial.</p>
          </div>
          <div className="space-y-4 flex-1 mt-3">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Meta Diária Atual</span>
              <p className="text-lg font-black text-slate-800 mt-0.5">
                {(activeUser?.role?.toUpperCase().includes("CAIXA") || activeUser?.role?.toUpperCase().includes("VENDEDOR"))
                  ? (targetGoal / 4).toLocaleString()
                  : targetGoal.toLocaleString()} {currency}
              </p>
              <span className="text-[9.5px] text-slate-500 block mt-1">
                {(activeUser?.role?.toUpperCase().includes("CAIXA") || activeUser?.role?.toUpperCase().includes("VENDEDOR"))
                  ? "Sua cota individual (25% da meta global da empresa)"
                  : "Meta global de vendas da empresa"}
              </span>
            </div>
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <span className="text-[10px] text-emerald-600 font-bold uppercase block">Vendas Recorrentes</span>
              <p className="text-lg font-black text-emerald-700 mt-0.5">
                {chartSalesVsGoals.reduce((sum, item) => sum + item.Vendas, 0).toLocaleString()} {currency}
              </p>
              <span className="text-[9.5px] text-emerald-600/80 block mt-1">
                Total acumulado nos últimos 7 dias de registos ativos.
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-medium border-t border-slate-100 pt-3">
            Atualizado automaticamente com base nas permissões de utilizador.
          </div>
        </div>

        {/* Weekly Revenue Bar Chart */}
        <div className="col-span-2 bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-96">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Receita Semanal</h3>
            <p className="text-xs text-slate-400 mt-0.5">Distribuição da receita diária da semana corrente ({weekBounds.start} a {weekBounds.end}).</p>
          </div>
          <div className="flex-1 min-h-0 text-[11px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartWeeklyRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dayName" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  formatter={(value) => [`${value.toLocaleString()} ${currency}`, 'Receita']} 
                  labelFormatter={(label, items) => {
                    const item = items[0]?.payload;
                    return item ? `${item.dayName} (${item.fullDateLabel})` : label;
                  }} 
                />
                <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]}>
                  {chartWeeklyRevenue.map((entry, index) => {
                    const isToday = entry.dateStr === todayStr;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isToday ? "#f97316" : "#10b981"} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Products Best sellers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-96">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Produtos Mais Vendidos</h3>
            <p className="text-xs text-slate-400 mt-0.5">Categorias e itens em altas de procura de mercado.</p>
          </div>
          <div className="flex-1 min-h-0 text-[11px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartBestSellers} layout="vertical" margin={{ top: 10, right: 10, left: 35, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" stroke="#64748b" width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {chartBestSellers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Annual Month comparison trend */}
        <div className="col-span-2 bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-96">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Vendas por Mês (Histórico)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Comparativo do volume comercial anual ({currency}).</p>
          </div>
          <div className="flex-1 min-h-0 text-[11px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMonthlySales} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="Mes" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value) => [`${value.toLocaleString()} ${currency}`]} />
                <Bar dataKey="Valor" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top customers and employees dashboard card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm h-96 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-3">Top Operadores & Vendedores</h3>
            <div className="space-y-2.5">
              {topSalespeople.map((sp, idx) => (
                <div key={sp.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{sp.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-slate-800">{sp.total.toLocaleString()} {currency}</p>
                    <span className="text-[9.5px] text-slate-400 font-mono">{sp.count} faturas</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-3">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Top VIP Clientes</h3>
            <div className="space-y-2.5">
              {topCustomers.map((tc, idx) => (
                <div key={tc.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                      VIP
                    </span>
                    <span className="text-xs font-semibold text-slate-750">{tc.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-orange-650">{tc.totalSpent.toLocaleString()} {currency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vendas dos Últimos 6 Meses Bar Chart */}
        <div className="col-span-1 lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-96">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Vendas dos Últimos 6 Meses</h3>
            <p className="text-xs text-slate-400 mt-0.5">Evolução do faturamento total consolidado mês a mês ({currency}).</p>
          </div>
          <div className="flex-1 min-h-0 text-[11px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartLast6MonthsSales} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="Mes" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value) => [`${value.toLocaleString()} ${currency}`, 'Vendas']} />
                <Bar dataKey="Valor" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {chartLast6MonthsSales.map((entry, index) => {
                    const colors = ["#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#4f46e5", "#6366f1"];
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={colors[index % colors.length]} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição de Receita por Método de Pagamento (Donut Chart) */}
        <div className="col-span-1 lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart column */}
          <div className="col-span-1 flex flex-col h-80 justify-between">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                Tendência de Pagamentos (Receita)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Percentagem do faturamento total por modalidade de pagamento no período.
              </p>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center text-[11px] font-mono relative">
              {paymentRevenueDetails.overallTotal > 0 ? (
                <div className="w-full h-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentRevenueDetails.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentRevenueDetails.chartData.map((entry, index) => {
                          const trendColors = ["#10b981", "#6366f1", "#f59e0b", "#ef4444"];
                          return <Cell key={`cell-${index}`} fill={trendColors[index % trendColors.length]} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value.toLocaleString()} ${currency}`, 'Receita Total']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Total</span>
                    <span className="text-xs font-black text-slate-800 font-mono">
                      {paymentRevenueDetails.overallTotal.toLocaleString()} {currency}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Nenhuma transação registrada no período.</p>
              )}
            </div>
          </div>

          {/* Table/Details breakdown column */}
          <div className="col-span-1 lg:col-span-2 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                Métricas por Tipo de Pagamento
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-500">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                      <th className="py-2">Método</th>
                      <th className="py-2 text-right">Volume ({currency})</th>
                      <th className="py-2 text-right">Transações</th>
                      <th className="py-2 text-right">Ticket Médio</th>
                      <th className="py-2 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paymentRevenueDetails.chartData.map((item, index) => {
                      const trendColorsText = ["text-emerald-500", "text-indigo-500", "text-amber-500", "text-red-500"];
                      const trendColorsBg = ["bg-emerald-500", "bg-indigo-500", "bg-amber-500", "bg-red-500"];
                      return (
                        <tr key={item.key} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 font-semibold text-slate-700 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${trendColorsBg[index % trendColorsBg.length]}`} />
                            {item.name}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-slate-800">
                            {item.value.toLocaleString()}
                          </td>
                          <td className="py-3 text-right font-mono font-semibold text-slate-600">
                            {item.count}
                          </td>
                          <td className="py-3 text-right font-mono font-semibold text-slate-600">
                            {item.avgTicket.toLocaleString()} {currency}
                          </td>
                          <td className="py-3 text-right">
                            <span className={`font-mono font-bold ${trendColorsText[index % trendColorsText.length]}`}>
                              {item.percentage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed mt-4">
              💡 <strong>Dica Operacional:</strong> Métodos de carteira móvel (como <strong>M-Pesa</strong>) oferecem liquidez imediata com taxas de operação reduzidas, enquanto pagamentos em <strong>Dívida</strong> devem ser monitorados de perto no módulo de clientes para evitar quebras de fluxo de caixa.
            </div>
          </div>
        </div>

        {/* Componente de Notificações de Lembretes e Tarefas */}
        <div className="col-span-1 lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
          {/* Lembretes List */}
          <div className="flex-1 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <span className="relative">
                    <Bell className="w-5 h-5 text-amber-500 animate-bounce" />
                    {activeReminderTab === "diarios" ? (
                      reminders.filter(r => !r.completed).length > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                      )
                    ) : (
                      recurringReminders.filter(r => !r.completed).length > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
                      )
                    )}
                  </span>
                  Lembretes e Tarefas do Sistema
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeReminderTab === "diarios" 
                    ? "Acompanhe e cumpra as obrigações operacionais para hoje." 
                    : "Gerencie tarefas automáticas cíclicas diárias, semanais ou mensais."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveReminderTab("diarios")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeReminderTab === "diarios" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    Lembretes Diários
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveReminderTab("recorrentes")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeReminderTab === "recorrentes" ? "bg-white text-slate-850 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    Recorrentes Agendados
                  </button>
                </div>

                {activeReminderTab === "diarios" ? (
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] font-mono font-bold text-slate-500 block">
                      {reminders.filter(r => r.completed).length}/{reminders.length} Concluídas
                    </span>
                    <div className="w-20 bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-500" 
                        style={{ width: `${reminders.length > 0 ? (reminders.filter(r => r.completed).length / reminders.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] font-mono font-bold text-slate-500 block">
                      {recurringReminders.filter(r => r.completed).length}/{recurringReminders.length} Concluídas
                    </span>
                    <div className="w-20 bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full transition-all duration-500" 
                        style={{ width: `${recurringReminders.length > 0 ? (recurringReminders.filter(r => r.completed).length / recurringReminders.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {activeReminderTab === "diarios" ? (
              reminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-xs font-medium text-slate-400">Nenhum lembrete registrado para hoje!</p>
                  <p className="text-[10px] text-slate-300">Use o formulário ao lado para programar novos afazeres.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                  {reminders.map((reminder) => {
                    let badgeColor = "bg-slate-100 text-slate-700";
                    if (reminder.category === "vendas") badgeColor = "bg-orange-100 text-orange-700";
                    if (reminder.category === "estoque") badgeColor = "bg-amber-100 text-amber-800";
                    if (reminder.category === "financeiro") badgeColor = "bg-emerald-100 text-emerald-800";

                    return (
                      <div 
                        key={reminder.id}
                        className={`flex items-start justify-between p-3 rounded-xl border transition ${
                          reminder.completed 
                            ? "bg-slate-50/50 border-slate-100 opacity-60 line-through text-slate-400" 
                            : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button 
                            type="button"
                            onClick={() => handleToggleReminder(reminder.id)}
                            className="mt-0.5 text-slate-400 hover:text-emerald-500 transition cursor-pointer shrink-0"
                          >
                            {reminder.completed ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 break-words leading-tight">
                              {reminder.title}
                            </p>
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${badgeColor}`}>
                              {reminder.category}
                            </span>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleDeleteReminder(reminder.id)}
                          className="text-slate-300 hover:text-red-500 p-1 rounded transition ml-2 cursor-pointer shrink-0"
                          title="Eliminar lembrete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              recurringReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-xs font-medium text-slate-400">Nenhuma tarefa recorrente configurada!</p>
                  <p className="text-[10px] text-slate-300">Use o formulário ao lado para programar obrigações periódicas.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                  {recurringReminders.map((reminder) => {
                    let badgeColor = "bg-slate-100 text-slate-700";
                    if (reminder.category === "vendas") badgeColor = "bg-orange-100 text-orange-700";
                    if (reminder.category === "estoque") badgeColor = "bg-amber-100 text-amber-800";
                    if (reminder.category === "financeiro") badgeColor = "bg-emerald-100 text-emerald-800";

                    let freqLabel = "Diária";
                    if (reminder.frequency === "weekly") freqLabel = "Semanal";
                    if (reminder.frequency === "monthly") freqLabel = "Mensal";

                    return (
                      <div 
                        key={reminder.id}
                        className={`flex items-start justify-between p-3 rounded-xl border transition ${
                          reminder.completed 
                            ? "bg-slate-50/50 border-slate-150 opacity-60 line-through text-slate-400" 
                            : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button 
                            type="button"
                            onClick={() => handleToggleRecurringReminder(reminder.id)}
                            className="mt-0.5 text-slate-400 hover:text-indigo-500 transition cursor-pointer shrink-0"
                          >
                            {reminder.completed ? (
                              <CheckCircle className="w-4 h-4 text-indigo-500 fill-indigo-50" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 break-words leading-tight">
                              {reminder.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${badgeColor}`}>
                                {reminder.category}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                                <RefreshCw className="w-2.5 h-2.5" />
                                {freqLabel}
                              </span>
                              {reminder.enablePopup && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                                  <Bell className="w-2 h-2 animate-pulse" />
                                  Pop-up
                                </span>
                              )}
                            </div>
                            {reminder.lastTriggered && (
                              <p className="text-[9px] text-slate-450 font-mono mt-0.5">
                                Último disparo: {new Date(reminder.lastTriggered).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleDeleteRecurringReminder(reminder.id)}
                          className="text-slate-300 hover:text-red-500 p-1 rounded transition ml-2 cursor-pointer shrink-0"
                          title="Eliminar lembrete recorrente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Quick Add Form */}
          <div className="w-full md:w-72 bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
            {activeReminderTab === "diarios" ? (
              <>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-500" />
                  Agendar Nova Tarefa
                </h4>
                <form onSubmit={handleAddReminder} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrição</label>
                    <input 
                      type="text"
                      value={newReminderTitle}
                      onChange={(e) => setNewReminderTitle(e.target.value)}
                      placeholder="Ex: Pagar fornecedor, conferir caixa..."
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria</label>
                    <select
                      value={newReminderCategory}
                      onChange={(e: any) => setNewReminderCategory(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-semibold text-slate-700 cursor-pointer"
                    >
                      <option value="geral">Geral</option>
                      <option value="vendas">Vendas</option>
                      <option value="estoque">Estoque</option>
                      <option value="financeiro">Financeiro</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition shadow-md shadow-emerald-600/10 active:scale-95 flex items-center justify-center gap-1 mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Criar Lembrete
                  </button>
                </form>
              </>
            ) : (
              <>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" style={{ animationDuration: '10s' }} />
                  Agendar Recorrência Fixas
                </h4>
                <form onSubmit={handleAddRecurringReminder} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrição do Afazer</label>
                    <input 
                      type="text"
                      value={newRecurTitle}
                      onChange={(e) => setNewRecurTitle(e.target.value)}
                      placeholder="Ex: Balanço mensal, inventário semanal..."
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-slate-800"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Frequência</label>
                      <select
                        value={newRecurFrequency}
                        onChange={(e: any) => setNewRecurFrequency(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-slate-700 cursor-pointer"
                      >
                        <option value="daily">Diária</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria</label>
                      <select
                        value={newRecurCategory}
                        onChange={(e: any) => setNewRecurCategory(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-slate-700 cursor-pointer"
                      >
                        <option value="geral">Geral</option>
                        <option value="vendas">Vendas</option>
                        <option value="estoque">Estoque</option>
                        <option value="financeiro">Financeiro</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <input 
                      type="checkbox"
                      id="enablePopupCheck"
                      checked={newRecurEnablePopup}
                      onChange={(e) => setNewRecurEnablePopup(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <label htmlFor="enablePopupCheck" className="text-[10px] font-bold text-slate-500 cursor-pointer uppercase select-none">
                      Notificação Pop-up
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition shadow-md shadow-indigo-600/10 active:scale-95 flex items-center justify-center gap-1 mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agendar Recorrente
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

      </div>

      {/* 4. RECENT TRANSACTIONS STREAM (REAL-TIME FEED) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
              <FileText className="w-5 h-5 text-orange-500" />
              Histórico e Fluxo Transacional do Período
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Todas as faturas e recibos gerados no período ativo. Clique em visualizar para inspecionar o recibo fiscal.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar fatura, operador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 w-full sm:w-56"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                >
                  Limpar
                </button>
              )}
            </div>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none text-slate-600"
            >
              <option value="">Todos Met. Pagamento</option>
              <option value="CASH">Dinheiro Físico</option>
              <option value="MPESA_PAGA_FACIL">M-Pesa</option>
              <option value="EMOLA">E-Mola</option>
              <option value="POS_CARD">Cartão POS</option>
            </select>
          </div>
        </div>

        {filteredDailyTransactions.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-slate-300 font-medium text-sm">Nenhuma transação registada neste período.</p>
            <p className="text-slate-400 text-xs">Utilize o botão "Registar Venda Rápida" no topo para registar vendas directamente!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Ref. Fatura</th>
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-4">Operador</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Método Pagamento</th>
                  <th className="py-3 px-4 text-right">Total Transacionado</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredDailyTransactions.map((tx) => {
                  const txTime = new Date(tx.timestamp).toLocaleTimeString("pt-MZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  });
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{tx.invoiceNumber}</td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">{txTime}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-semibold">{tx.cashierName}</td>
                      <td className="py-3.5 px-4 text-slate-600">{tx.customerName || "Consumidor Final"}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                          tx.paymentMethod === "CASH" 
                            ? "bg-orange-500/10 text-orange-600" 
                            : tx.paymentMethod === "MPESA_PAGA_FACIL" 
                            ? "bg-red-500/10 text-red-600" 
                            : tx.paymentMethod === "EMOLA" 
                            ? "bg-emerald-500/10 text-emerald-600" 
                            : "bg-blue-500/10 text-blue-600"
                        }`}>
                          {tx.paymentMethod === "CASH" 
                            ? "Dinheiro" 
                            : tx.paymentMethod === "MPESA_PAGA_FACIL" 
                            ? "M-Pesa" 
                            : tx.paymentMethod === "EMOLA" 
                            ? "E-Mola" 
                            : "Cartão / POS"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900">
                        {tx.grandTotal.toLocaleString()} <span className="text-[10px] text-slate-400">{currency}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedTxForReceipt(tx)}
                            className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-orange-600 hover:text-white rounded-lg font-bold text-slate-600 transition flex items-center justify-center gap-1 cursor-pointer"
                            title="Visualizar Recibo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Recibo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                printInvoiceHTML(tx, settings || { companyName: "OST VENDAS", currency: currency } as SystemSettings);
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="p-1.5 text-slate-650 bg-slate-100 hover:bg-orange-600 hover:text-white rounded-lg font-bold transition flex items-center justify-center cursor-pointer"
                            title="Imprimir Fatura em Nova Janela"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. INTERACTIVE FISCAL THERMAL RECEIPT MODAL */}
      <AnimatePresence>
        {selectedTxForReceipt && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-orange-600" />
                  <span className="font-extrabold text-slate-800 text-sm">Visualizador de Recibo Fiscal</span>
                </div>
                <button
                  onClick={() => setSelectedTxForReceipt(null)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Thermal Receipt body wrapper with paper effect */}
               <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
                <div id="dashboard-receipt-container" className="bg-white w-full shadow-md rounded-lg p-5 border border-slate-200/60 font-mono text-xs text-slate-800 relative space-y-4">
                  <style>{`
                    @media print {
                      body * {
                        visibility: hidden !important;
                      }
                      #dashboard-receipt-container, #dashboard-receipt-container * {
                        visibility: visible !important;
                      }
                      #dashboard-receipt-container {
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
                  {/* Jagged thermal edge top */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-slate-200 to-transparent"></div>

                  <div className="text-center space-y-1">
                    <p className="font-bold text-sm tracking-widest uppercase">SUPERMERCADO SUPER-POUPANÇA</p>
                    <p className="text-[10px] text-slate-500">AV. DA MOÇAMBIQUE, MAPUTO</p>
                    <p className="text-[10px] text-slate-500">TEL: +258 21 450 900 | NUIT: 400123456</p>
                    <p className="text-[10px] text-slate-500 font-bold border-t border-b border-dashed border-slate-300 py-1 my-2">
                      FACTURA RECIBO: {selectedTxForReceipt.invoiceNumber}
                    </p>
                  </div>

                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>DATA / HORA:</span>
                      <span className="font-bold">
                        {new Date(selectedTxForReceipt.timestamp).toLocaleDateString("pt-MZ")} {new Date(selectedTxForReceipt.timestamp).toLocaleTimeString("pt-MZ")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>OPERADOR(A):</span>
                      <span className="font-bold uppercase">{selectedTxForReceipt.cashierName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CLIENTE:</span>
                      <span className="font-bold uppercase">{selectedTxForReceipt.customerName || "CONSUMIDOR FINAL"}</span>
                    </div>
                    {selectedTxForReceipt.nuit && (
                      <div className="flex justify-between">
                        <span>NUIT CLIENTE:</span>
                        <span className="font-bold">{selectedTxForReceipt.nuit}</span>
                      </div>
                    )}
                  </div>

                  {/* Items list */}
                  <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-2 text-[11px]">
                    <div className="grid grid-cols-12 font-bold text-slate-600">
                      <span className="col-span-6">DESCRIÇÃO</span>
                      <span className="col-span-2 text-center">QTD</span>
                      <span className="col-span-4 text-right">TOTAL</span>
                    </div>

                    {selectedTxForReceipt.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 text-slate-700">
                        <span className="col-span-6 truncate font-sans">{item.productName}</span>
                        <span className="col-span-2 text-center font-bold">{item.quantity}</span>
                        <span className="col-span-4 text-right font-bold">{item.subtotal.toLocaleString()} MT</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>SUBTOTAL:</span>
                      <span>{selectedTxForReceipt.subtotal.toLocaleString()} MT</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>IVA INCLUÍDO (16%):</span>
                      <span>{selectedTxForReceipt.vatTotal.toLocaleString()} MT</span>
                    </div>
                    <div className="flex justify-between text-sm font-black border-t border-slate-300 pt-1.5 text-slate-900">
                      <span>TOTAL A PAGAR:</span>
                      <span>{selectedTxForReceipt.grandTotal.toLocaleString()} MT</span>
                    </div>
                  </div>

                  {/* Payment Method Details */}
                  <div className="bg-slate-50 p-2 rounded border border-slate-200/50 space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>FORMA DE PAGAMENTO:</span>
                      <span className="font-extrabold uppercase">
                        {selectedTxForReceipt.paymentMethod === "CASH" ? "Dinheiro Físico" : selectedTxForReceipt.paymentMethod === "MPESA_PAGA_FACIL" ? "M-Pesa" : selectedTxForReceipt.paymentMethod === "EMOLA" ? "E-Mola" : "Cartão / POS"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ESTADO:</span>
                      <span className="text-emerald-600 font-extrabold">LIQUIDADO / CERTIFICADO</span>
                    </div>
                  </div>

                  {/* Fiscal Certification Seal */}
                  <div className="text-center space-y-1 pt-3 border-t border-dotted border-slate-300 text-[9px] text-slate-400">
                    <p className="font-bold text-slate-600 tracking-wider">REGIME GERAL DE IVA - MOÇAMBIQUE</p>
                    <p>M-SOFTWARE DE FATURAÇÃO CERTIFICADO Nº 112/AUT/2026</p>
                    <p className="font-bold font-mono text-slate-700">HASH FISCAL: {selectedTxForReceipt.fiscalHash || "FP-CERTIFIED"}</p>
                    <p className="font-mono">CHAVES: {selectedTxForReceipt.fiscalKeys || "01-02-03"}</p>
                    <div className="mt-3 pt-3 border-t border-dashed border-slate-300 flex flex-col items-center justify-center gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm no-print">
                      <div className="p-1 bg-slate-50 rounded-lg border border-slate-200">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedTxForReceipt.invoiceNumber)}`}
                          alt={`QR Code Fatura ${selectedTxForReceipt.invoiceNumber}`}
                          className="w-16 h-16 object-contain mx-auto"
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-[8px] font-black text-slate-700 tracking-wider font-sans uppercase">AUT. AT - MOÇAMBIQUE</span>
                        <p className="text-[7.5px] text-slate-400 font-sans mt-0.5 leading-tight">
                          Certificação de Integridade e Emissão Fiscal Homologada
                        </p>
                      </div>
                    </div>
                    <p className="text-[8px] text-slate-400 italic mt-3">Muito obrigado pela sua preferência!</p>
                  </div>
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
                <button
                  onClick={() => setSelectedTxForReceipt(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      printInvoiceHTML(selectedTxForReceipt, settings || { companyName: "OST VENDAS", currency: currency } as SystemSettings);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Fatura (Nova Janela)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5.1 QUICK REAL SALE POS REGISTRATION MODAL */}
      <AnimatePresence>
        {isQuickSaleModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  <div className="text-left">
                    <span className="font-extrabold text-slate-800 text-sm block">Facturação Expressa (Registo Rápido)</span>
                    <span className="text-[10px] text-slate-500 block">Dedução de stock imediata & emissão fiscal directa</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsQuickSaleModalOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
                {/* Auto fill helper notice */}
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl flex items-start justify-between gap-3 text-amber-900 text-xs font-semibold">
                  <div>
                    <span className="block font-bold">Modo de Operação Real</span>
                    <span className="block font-normal text-amber-800 mt-0.5 text-[10px]">Pode adicionar artigos, definir quantidades, associar clientes e processar o pagamento. Se preferir fazer um teste de stress rápido, clique no botão ao lado para preencher automaticamente com stock real do catálogo.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillQuickSale}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-200" />
                    Auto-Preencher
                  </button>
                </div>

                {/* Grid for forms */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select product */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-600 text-xs font-bold uppercase tracking-wider">Selecionar Artigo</label>
                    <select
                      value={quickSelectedProductId}
                      onChange={(e) => setQuickSelectedProductId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    >
                      <option value="">-- Selecione o Produto em Stock --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} ({p.stock} un. disponíveis) - {p.salePrice.toLocaleString()} {currency}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity & Add button */}
                  <div className="space-y-1.5 flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <label className="block text-slate-600 text-xs font-bold uppercase tracking-wider">Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={quickSelectedQuantity}
                        onChange={(e) => setQuickSelectedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddToQuickCart}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Items currently in express cart */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                  <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-100 flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <span>Artigos a Facturar</span>
                    <span className="font-mono">{quickSaleCart.length} Itens</span>
                  </div>
                  {quickSaleCart.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      O carrinho rápido está vazio. Adicione artigos acima.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {quickSaleCart.map((item) => (
                        <div key={item.productId} className="px-4 py-2 flex justify-between items-center text-xs">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800">{item.name}</span>
                            <span className="block text-[10px] text-slate-500 font-mono">
                              {item.quantity} un x {item.price.toLocaleString()} {currency}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-slate-900">
                              {(item.price * item.quantity).toLocaleString()} {currency}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromQuickCart(item.productId)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Quick Cart subtotal summary bar */}
                  {quickSaleCart.length > 0 && (
                    <div className="px-4 py-2.5 bg-slate-100/50 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-600">Total Acumulado:</span>
                      <span className="font-black text-slate-900 text-sm">
                        {quickSaleCart.reduce((acc, c) => acc + c.price * c.quantity, 0).toLocaleString()} {currency}
                      </span>
                    </div>
                  )}
                </div>

                {/* Additional Checkout parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  {/* Select Customer */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-600 text-xs font-bold uppercase tracking-wider">Cliente Associado</label>
                    <select
                      value={quickSelectedCustomerId}
                      onChange={(e) => {
                        setQuickSelectedCustomerId(e.target.value);
                        if (e.target.value) {
                          setQuickManualCustomerName("");
                          setQuickManualCustomerNuit("");
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    >
                      <option value="">-- Cliente de Balcão (Anónimo) --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} (NUIT: {c.nuit || "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1.5">
                    <label className="block text-slate-600 text-xs font-bold uppercase tracking-wider">Forma de Pagamento</label>
                    <select
                      value={quickSelectedPaymentMethod}
                      onChange={(e) => setQuickSelectedPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    >
                      <option value="CASH">Dinheiro Físico</option>
                      <option value="MPESA_PAGA_FACIL">M-Pesa Paga Fácil</option>
                      <option value="EMOLA">E-Mola Pay</option>
                      <option value="POS_CARD">Cartão de Débito/Crédito (POS)</option>
                    </select>
                  </div>

                  {/* Cashier and Manual input if no custom customer */}
                  {!quickSelectedCustomerId && (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-slate-600 text-xs font-bold uppercase tracking-wider">Nome de Cliente Manual (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: Manuel Silva"
                          value={quickManualCustomerName}
                          onChange={(e) => setQuickManualCustomerName(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-slate-600 text-xs font-bold uppercase tracking-wider">NUIT do Cliente (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: 102938482"
                          maxLength={9}
                          value={quickManualCustomerNuit}
                          onChange={(e) => setQuickManualCustomerNuit(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-slate-600 text-xs font-bold uppercase tracking-wider">Operador de Caixa</label>
                    <select
                      value={quickSelectedCashier}
                      onChange={(e) => setQuickSelectedCashier(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                    >
                      <option value="Levi Domingos">Levi Domingos</option>
                      <option value="Sofia Tembe">Sofia Tembe</option>
                      <option value="Dário Matusse">Dário Matusse</option>
                      <option value="Amélia Macuácua">Amélia Macuácua</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickSaleModalOpen(false);
                    setQuickSaleCart([]);
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCompleteQuickSale}
                  disabled={quickSaleCart.length === 0 || isSubmittingQuickSale}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs transition shadow-lg shadow-emerald-950/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingQuickSale ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processando Venda...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Concluir & Registar Venda</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL FOR DUE RECURRING REMINDERS */}
      <AnimatePresence>
        {activePopupReminder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-br from-indigo-650 to-indigo-800 text-white relative">
                <button
                  type="button"
                  onClick={() => setActivePopupReminder(null)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md animate-bounce">
                    <Bell className="w-5 h-5 text-indigo-100" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 text-white px-2.5 py-0.5 rounded-full">
                      Lembrete Recorrente Ativo
                    </span>
                    <h3 className="font-bold text-base mt-1.5">Tarefa Agendada Pendente</h3>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <h4 className="font-bold text-slate-800 text-sm leading-snug">
                    {activePopupReminder.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-indigo-100 text-indigo-800">
                      Categoria: {activePopupReminder.category}
                    </span>
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-amber-100 text-amber-800 flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '6s' }} />
                      Frequência: {activePopupReminder.frequency === "daily" ? "Diária" : activePopupReminder.frequency === "weekly" ? "Semanal" : "Mensal"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Esta é uma obrigação operacional recorrente programada para manter o bom andamento da sua empresa. Escolha uma das opções abaixo para agir.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleSnoozeReminder(activePopupReminder.id)}
                  className="flex-1 px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Adiar (5 min)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissReminder(activePopupReminder.id)}
                  className="px-3 py-2.5 bg-slate-200/60 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer whitespace-nowrap"
                >
                  Ignorar Ciclo
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerCycleCompleted(activePopupReminder.id)}
                  className="flex-1 px-4 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Concluir Tarefa</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
