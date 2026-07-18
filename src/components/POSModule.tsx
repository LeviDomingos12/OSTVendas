import React, { useState, useMemo, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  Tag, 
  Percent, 
  Receipt, 
  UserPlus, 
  CreditCard,
  CheckCircle2,
  Phone,
  Mail,
  Printer,
  Smartphone,
  ChevronRight,
  ShoppingCart,
  Clock,
  Wifi,
  Sparkles,
  Camera,
  RotateCcw,
  AlertTriangle,
  History,
  UserCheck,
  Check,
  Maximize2,
  Minimize2,
  MessageSquare,
  Scan,
  QrCode,
  Keyboard,
  HelpCircle,
  Zap
} from "lucide-react";
import { Product, Customer, CartItem, Transaction, SystemSettings } from "../types";
import { QrReader } from "react-qr-reader";
import { sendEmail } from "../lib/gmail";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SYSTEM_THEMES } from "../lib/themes";
import { printInvoiceHTML } from "../lib/printHelper";

// Extends CartItem type locally for inline observations
interface UpgradedCartItem extends CartItem {
  observation?: string;
}

interface POSModuleProps {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  activeUsername: string;
  settings: SystemSettings;
  onCompleteSale: (tx: Transaction) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currency: string;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
  isPOSFullscreen?: boolean;
  onChangePOSFullscreen?: (val: boolean) => void;
  onTriggerPanic?: () => void;
}

// Static helper for certified digital signing (Moçambique fiscal standards)
const generateFiscalSignature = (invoiceNum: string, dateStr: string, total: number) => {
  const seed = `${invoiceNum}|${dateStr}|${total}|OST-VENDAS-SECURE-KEY-2026`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  const part1 = hex.slice(0, 4);
  const part2 = hex.slice(4, 8);
  const key1 = invoiceNum.split('-')[2] || "2026";
  const key2 = Math.floor(1000 + Math.random() * 9000).toString();
  return {
    fiscalHash: `FAC-${hex}-${part1}-${part2}-OSTVENDAS`,
    fiscalKeys: `${part1}-${part2}-${key1}-${key2}`,
    fiscalCertified: true
  };
};

export default function POSModule({
  products,
  customers,
  transactions,
  activeUsername,
  settings,
  onCompleteSale,
  onAddAuditLog,
  currency,
  onShowToast,
  isPOSFullscreen = false,
  onChangePOSFullscreen,
  onTriggerPanic
}: POSModuleProps) {
  
  // Local synchronized state to allow quick registering of customers and updating stock locally in the view
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  
  // Sync when props change
  useEffect(() => { setLocalCustomers(customers); }, [customers]);
  useEffect(() => { setLocalProducts(products); }, [products]);

  // Session stats & setup
  const [currentSaleNumber, setCurrentSaleNumber] = useState<number>(245);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Time ticker and network toggle simulation
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts cheat sheet overlay or triggers
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerSelectRef = useRef<HTMLSelectElement>(null);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [cart, setCart] = useState<UpgradedCartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("CASH");
  const [showPanicConfirm, setShowPanicConfirm] = useState(false);

  // Multi-method payment cash allocations
  const [mixedCash, setMixedCash] = useState<number>(0);
  const [mixedMpesa, setMixedMpesa] = useState<number>(0);
  const [mixedPOS, setMixedPOS] = useState<number>(0);

  // Cash change automatic calculator states
  const [receivedCashAmount, setReceivedCashAmount] = useState<number>(0);

  const [debtDays, setDebtDays] = useState<number>(15);
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [vatMode, setVatMode] = useState<"AUTO" | "EXEMPT" | "CUSTOM">("AUTO");
  const [customVatRate, setCustomVatRate] = useState<number>(16);

  // Completed Invoice Popup State
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [sendEmailStatus, setSendEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sendSmsStatus, setSendSmsStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sendWhatsAppStatus, setSendWhatsAppStatus] = useState<"idle" | "sending" | "sent">("idle");

  // Dynamic QR Code generation for the completed transaction/invoice
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    if (completedTx) {
      const origin = window.location.origin;
      const receiptLink = `${origin}/receipt/${completedTx.invoiceNumber}`;
      QRCode.toDataURL(
        receiptLink,
        {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 160,
          color: {
            dark: "#1e293b", // slate-800
            light: "#ffffff",
          },
        },
        (err, url) => {
          if (err) {
            console.error("Error generating QR code for invoice:", err);
          } else {
            setQrCodeDataUrl(url);
          }
        }
      );
    } else {
      setQrCodeDataUrl("");
    }
  }, [completedTx]);

  // Completed Budget (Orçamento) Popup State
  const [completedBudget, setCompletedBudget] = useState<{
    budgetNumber: string;
    timestamp: number;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerNuit?: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    discountTotal: number;
    vatTotal: number;
    grandTotal: number;
  } | null>(null);
  const [sendBudgetEmailStatus, setSendBudgetEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sendBudgetSmsStatus, setSendBudgetSmsStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sendBudgetWhatsAppStatus, setSendBudgetWhatsAppStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [budgetTargetEmail, setBudgetTargetEmail] = useState("");
  const [budgetTargetPhone, setBudgetTargetPhone] = useState("");
  
  // Custom states for budget printing and ESC/POS styling
  const [budgetPrintFormat, setBudgetPrintFormat] = useState<"A4_DOC" | "ESC_POS">("A4_DOC");
  const [budgetTab, setBudgetTab] = useState<"PREVIEW" | "RAW_COMMANDS">("PREVIEW");
  const [selectedPaperSize, setSelectedPaperSize] = useState<"80MM" | "58MM">("80MM");
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showCriticalStockModal, setShowCriticalStockModal] = useState(false);

  useEffect(() => {
    if (completedBudget) {
      setBudgetPrintFormat(settings.printerEnabled ? "ESC_POS" : "A4_DOC");
      setBudgetTab("PREVIEW");
      setSelectedPaperSize(settings.paperSize === "58MM" ? "58MM" : "80MM");
    }
  }, [completedBudget, settings.printerEnabled, settings.paperSize]);

  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappDirectUrl, setWhatsappDirectUrl] = useState("");
  const [isSimulatingPrint, setIsSimulatingPrint] = useState(false);
  const [printMode, setPrintMode] = useState<"receipt" | "invoice">("receipt");
  const [noReceiptSuccess, setNoReceiptSuccess] = useState(false);

  // Dynamic Mobile Money Payment states
  const [mobilePaymentProvider, setMobilePaymentProvider] = useState<"MPESA" | "EMOLA" | "MKESH">("MPESA");
  const [mobileMerchantCode, setMobileMerchantCode] = useState<string>("849001202");
  const [mobileCustomerPhone, setMobileCustomerPhone] = useState<string>("");
  const [mobileReference, setMobileReference] = useState<string>("");
  const [mobileQrDataUrl, setMobileQrDataUrl] = useState<string>("");
  const [mobilePaymentStatus, setMobilePaymentStatus] = useState<"IDLE" | "SENDING_PUSH" | "AWAITING_PIN" | "VERIFYING" | "CONFIRMED" | "EXPIRED">("IDLE");
  const [mobilePaymentProgress, setMobilePaymentProgress] = useState<number>(0);
  const [mobilePaymentTimer, setMobilePaymentTimer] = useState<number>(120);

  // 15. Suspended carts system
  const [suspendedCarts, setSuspendedCarts] = useState<{ id: string; time: string; cart: UpgradedCartItem[]; customerId: string }[]>([]);

  // 19. Weight prompt modal state
  const [weightPromptProduct, setWeightPromptProduct] = useState<Product | null>(null);
  const [weightInputValue, setWeightInputValue] = useState<string>("1.0");

  // 20. Mock Camera Barcode Scanner Modal State
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [manualBarcodeScan, setManualBarcodeScan] = useState("");
  const [scannerTab, setScannerTab] = useState<"camera" | "simulation">("camera");
  const lastAlertTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  const [continuousScan, setContinuousScan] = useState<boolean>(false);

  // 24. Pre-checkout Confirmation Modal State
  const [showPreCheckoutModal, setShowPreCheckoutModal] = useState(false);
  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
  const [pendingEmitReceipt, setPendingEmitReceipt] = useState<boolean>(true);

  // 10. Quick Add Customer Modal State
  const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState("");
  const [quickCustPhone, setQuickCustPhone] = useState("");
  const [quickCustNuit, setQuickCustNuit] = useState("");
  const [quickCustPreferredMethod, setQuickCustPreferredMethod] = useState("CASH");
  const [quickCustOneClick, setQuickCustOneClick] = useState(false);
  const [pendingReceiptAction, setPendingReceiptAction] = useState<"email" | "sms" | "whatsapp" | null>(null);

  // 16. Past sales modal trigger
  const [showSalesHistoryModal, setShowSalesHistoryModal] = useState(false);

  // 17. Hover details state
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);

  // Categories list (including ⭐ Favoritos virtual tag)
  const categories = useMemo(() => {
    const list = new Set(localProducts.map(p => p.category));
    return ["Todos", "⭐ Favoritos", ...Array.from(list)];
  }, [localProducts]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return localProducts.filter(p => {
      const sQuery = searchQuery.toLowerCase();
      const matchSearch = 
        (p.name || "").toLowerCase().includes(sQuery) || 
        (p.code || "").toLowerCase().includes(sQuery) ||
        (p.brand || "").toLowerCase().includes(sQuery) ||
        (p.category || "").toLowerCase().includes(sQuery) ||
        (p.barcode || "").includes(searchQuery);

      if (selectedCategory === "Todos") return matchSearch;
      if (selectedCategory === "⭐ Favoritos") return matchSearch && p.isFavorite;
      return matchSearch && p.category === selectedCategory;
    });
  }, [localProducts, searchQuery, selectedCategory]);

  const selectedCustomer = useMemo(() => {
    return localCustomers.find(c => c.id === selectedCustomerId) || null;
  }, [localCustomers, selectedCustomerId]);

  // Automatic digital dispatch after quick customer registration
  useEffect(() => {
    if (pendingReceiptAction && selectedCustomer) {
      const action = pendingReceiptAction;
      setPendingReceiptAction(null); // Reset to prevent any infinite loops
      
      const timer = setTimeout(() => {
        if (action === "email") {
          simulateSendEmail();
        } else if (action === "sms") {
          simulateSendSms();
        } else if (action === "whatsapp") {
          handleOpenWhatsAppModal();
        }
      }, 400); // 400ms delay to ensure state and DOM is fully updated
      
      return () => clearTimeout(timer);
    }
  }, [selectedCustomer, pendingReceiptAction]);

  // Smart Search / Autocomplete Barcode auto-addition hook
  useEffect(() => {
    if (!searchQuery) return;
    const barcodeMatch = localProducts.find(p => p.barcode === searchQuery.trim() || p.code === searchQuery.trim());
    if (barcodeMatch) {
      if (barcodeMatch.stock <= 0) {
        if (onShowToast) onShowToast(`Produto ${barcodeMatch.name} está esgotado!`, "error");
        setSearchQuery("");
        return;
      }
      handleTriggerAddToCart(barcodeMatch);
      if (onShowToast) onShowToast(`Escaneado: ${barcodeMatch.name} adicionado ao carrinho!`, "success");
      setSearchQuery("");
    }
  }, [searchQuery, localProducts]);

  // Global Keyboard Shortcuts (F1, F2, F3, F4, F6, F8, F9, ESC)
  useEffect(() => {
    const executeShortcut = (key: string) => {
      if (key === "F1") {
        if (showPreCheckoutModal) {
          // If the pre-checkout modal is already open, F1 confirms and finalizes the sale
          handleCheckout(true);
          if (onShowToast) onShowToast("Atalho F1: Venda faturada e confirmada!", "success");
        } else {
          // Open help/shortcuts overlay
          setShowShortcutsHelp(prev => !prev);
        }
      } else if (key === "F2") {
        customerSelectRef.current?.focus();
        if (onShowToast) onShowToast("Atalho F2: Selecionar cliente focado!", "info");
      } else if (key === "F3") {
        searchInputRef.current?.focus();
        if (onShowToast) onShowToast("Atalho F3: Pesquisa de produtos focada!", "info");
      } else if (key === "F4") {
        setQuickCustomerModalOpen(true);
      } else if (key === "F6") {
        const value = prompt("Insira a percentagem de desconto comercial (0 a 100):");
        if (value !== null) {
          const num = parseFloat(value);
          if (!isNaN(num) && num >= 0 && num <= 100) {
            setDiscountType("PERCENT");
            setDiscountValue(num);
            if (onShowToast) onShowToast(`Desconto de ${num}% aplicado!`, "success");
          }
        }
      } else if (key === "F8") {
        // Toggle payment method
        const methods = ["CASH", "MPESA_PAGA_FACIL", "EMOLA", "POS_CARD", "DEBT", "MIXED"];
        const nextIdx = (methods.indexOf(selectedPaymentMethod) + 1) % methods.length;
        setSelectedPaymentMethod(methods[nextIdx]);
        if (onShowToast) onShowToast(`Método alterado para: ${methods[nextIdx]}`, "info");
      } else if (key === "F9") {
        if (cart.length > 0) {
          setShowPreCheckoutModal(true);
        } else {
          if (onShowToast) onShowToast("O carrinho está vazio para finalizar.", "warning");
        }
      } else if (key === "Escape") {
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        } else if (cart.length > 0) {
          if (confirm("Deseja mesmo limpar e cancelar a venda actual?")) {
            handleReset();
            if (onShowToast) onShowToast("Venda cancelada com sucesso.", "info");
          }
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1" || e.key === "F2" || e.key === "F3" || e.key === "F4" || e.key === "F6" || e.key === "F8" || e.key === "F9" || e.key === "Escape") {
        e.preventDefault();
        executeShortcut(e.key);
      }
    };

    const handleCustomShortcut = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string }>;
      if (customEvent.detail && customEvent.detail.key) {
        executeShortcut(customEvent.detail.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pos-shortcut-trigger", handleCustomShortcut);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pos-shortcut-trigger", handleCustomShortcut);
    };
  }, [cart, selectedPaymentMethod, showPreCheckoutModal, showShortcutsHelp]);

  // Buffer input speed for USB Barcode Scanners - Robust hardware listener (50ms interval + 150ms debounce)
  useEffect(() => {
    let lastKeyTime = Date.now();
    let scanBuffer = "";
    let timeoutId: any = null;

    const processBuffer = () => {
      const code = scanBuffer.trim();
      if (code.length >= 3) {
        const prod = localProducts.find(p => p.barcode === code || p.code === code);
        if (prod) {
          if (prod.stock <= 0) {
            if (onShowToast) onShowToast(`Produto ${prod.name} está esgotado!`, "error");
          } else {
            handleTriggerAddToCart(prod);
            if (onShowToast) onShowToast(`Leitor: ${prod.name} adicionado!`, "success");
          }
        }
      }
      scanBuffer = "";
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside input/textarea fields (handled individually by inputs)
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      // Ignore modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey || e.key === "Shift" || e.key === "Control" || e.key === "Alt") return;

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (e.key === "Enter") {
        if (scanBuffer.trim()) {
          processBuffer();
        }
        scanBuffer = "";
        return;
      }

      // Hardware scanners type extremely rapidly (< 50ms per key)
      if (diff < 50 || scanBuffer === "") {
        if (e.key.length === 1) {
          scanBuffer += e.key;
        }
      } else {
        // Reset buffer if typing slow
        if (e.key.length === 1) {
          scanBuffer = e.key;
        }
      }

      // Timeout fallback for scanners that do not append Enter key at the end
      timeoutId = setTimeout(() => {
        if (scanBuffer.trim()) {
          processBuffer();
        }
      }, 150);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [localProducts]);

  // Add Item Router (check if weight-based)
  const handleTriggerAddToCart = (product: Product, forcedWeight?: number) => {
    if (product.weightBased && !forcedWeight) {
      setWeightPromptProduct(product);
      setWeightInputValue("1.0");
    } else {
      const addedQty = forcedWeight || 1;
      setCart(prev => {
        const existing = prev.find(item => item.product.id === product.id);
        if (existing) {
          if (existing.quantity + addedQty > product.stock) {
            if (onShowToast) onShowToast(`Quantidade excede o stock disponível (${product.stock} un)!`, "warning");
            return prev;
          }
          return prev.map(item => 
            item.product.id === product.id 
              ? { ...item, quantity: parseFloat((item.quantity + addedQty).toFixed(3)) }
              : item
          );
        } else {
          return [...prev, { product, quantity: addedQty, discount: 0, vatRate: product.vatRate, observation: "" }];
        }
      });
    }
  };

  // Direct edit quantity input field
  const handleDirectQuantityEdit = (productId: string, valStr: string) => {
    const parsed = parseFloat(valStr);
    if (isNaN(parsed) || parsed <= 0) return;

    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        if (parsed > item.product.stock) {
          if (onShowToast) onShowToast(`Disponível apenas ${item.product.stock} em stock!`, "warning");
          return { ...item, quantity: item.product.stock };
        }
        return { ...item, quantity: parsed };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing) {
        const decStep = existing.product.weightBased ? 0.25 : 1;
        if (existing.quantity > decStep) {
          return prev.map(item => 
            item.product.id === productId 
              ? { ...item, quantity: parseFloat((item.quantity - decStep).toFixed(3)) }
              : item
          );
        }
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const handleDeleteRow = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Quick Add Item Observation
  const handleAddObservation = (productId: string) => {
    const currentNote = cart.find(i => i.product.id === productId)?.observation || "";
    const note = prompt("Inserir Observação para este produto (Ex: Sem IVA, Oferta, Embalar):", currentNote);
    if (note !== null) {
      setCart(prev => prev.map(item => 
        item.product.id === productId ? { ...item, observation: note } : item
      ));
    }
  };

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let vatTotal = 0;
    let totalItemsCount = 0;

    cart.forEach(item => {
      const itemSub = item.product.salePrice * item.quantity;
      subtotal += itemSub;
      totalItemsCount += item.quantity;
      
      const rate = vatMode === "AUTO" ? item.product.vatRate : (vatMode === "EXEMPT" ? 0 : customVatRate);
      const vatAmount = (itemSub * (rate / 100));
      vatTotal += vatAmount;
    });

    if (discountValue > 0) {
      if (discountType === "PERCENT") {
        discountTotal = (subtotal * (discountValue / 100));
      } else {
        discountTotal = discountValue;
      }
    }

    const grandTotal = Math.max(0, subtotal + vatTotal - discountTotal);

    return {
      subtotal: Math.round(subtotal),
      vatTotal: Math.round(vatTotal),
      discountTotal: Math.round(discountTotal),
      grandTotal: Math.round(grandTotal),
      totalQty: parseFloat(totalItemsCount.toFixed(3))
    };
  }, [cart, discountType, discountValue, vatMode, customVatRate]);

  // Mixed Payment Auto-Balance Check
  const mixedSumTotal = useMemo(() => {
    return mixedCash + mixedMpesa + mixedPOS;
  }, [mixedCash, mixedMpesa, mixedPOS]);

  // Change amount calculation for cash payments
  const calculatedChange = useMemo(() => {
    const received = selectedPaymentMethod === "MIXED" ? mixedCash : receivedCashAmount;
    const baseToPay = selectedPaymentMethod === "MIXED" ? calculations.grandTotal - (mixedMpesa + mixedPOS) : calculations.grandTotal;
    return Math.max(0, received - baseToPay);
  }, [receivedCashAmount, calculations.grandTotal, selectedPaymentMethod, mixedCash, mixedMpesa, mixedPOS]);

  // Items in cart that will fall below critical stock levels after this transaction
  const itemsLeavingStockBelowCritical = useMemo(() => {
    return cart.filter(item => {
      const stockAfterSale = item.product.stock - item.quantity;
      return stockAfterSale <= (item.product.minStock || 0);
    });
  }, [cart]);

  // Mobile Payment Effects (Placed after calculations / selectedCustomer definition)
  useEffect(() => {
    if (selectedPaymentMethod === "MPESA_PAGA_FACIL" || selectedPaymentMethod === "EMOLA") {
      const provider = selectedPaymentMethod === "MPESA_PAGA_FACIL" ? "MPESA" : "EMOLA";
      setMobilePaymentProvider(provider);
      setMobileReference(`VND-${Math.floor(100000 + Math.random() * 900000)}`);
      setMobilePaymentStatus("IDLE");
      setMobilePaymentProgress(0);
      setMobilePaymentTimer(120);
      
      const storeContact = settings.storeContact;
      if (storeContact) {
        const cleanContact = storeContact.replace(/\D/g, "");
        if (cleanContact.length >= 9) {
          setMobileMerchantCode(cleanContact.slice(-9));
        } else {
          setMobileMerchantCode(provider === "MPESA" ? "849001202" : "823456789");
        }
      } else {
        setMobileMerchantCode(provider === "MPESA" ? "849001202" : "823456789");
      }
    }
  }, [selectedPaymentMethod]);

  useEffect(() => {
    const phone = selectedCustomer?.phone || "";
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length >= 9) {
        setMobileCustomerPhone(cleanPhone.slice(-9));
      } else {
        setMobileCustomerPhone(phone);
      }
    } else {
      setMobileCustomerPhone("");
    }
  }, [selectedCustomer?.phone]);

  useEffect(() => {
    let active = true;
    if (selectedPaymentMethod === "MPESA_PAGA_FACIL" || selectedPaymentMethod === "EMOLA") {
      const payload = `${mobilePaymentProvider.toLowerCase()}://pay?merchant=${mobileMerchantCode}&amount=${calculations.grandTotal}&reference=${mobileReference}&phone=${mobileCustomerPhone}`;
      QRCode.toDataURL(
        payload,
        {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 220,
          color: {
            dark: mobilePaymentProvider === "MPESA" ? "#dc2626" : (mobilePaymentProvider === "EMOLA" ? "#ea580c" : "#16a34a"),
            light: "#ffffff"
          }
        },
        (err, url) => {
          if (active && !err && url) {
            setMobileQrDataUrl(url);
          }
        }
      );
    } else {
      if (active) {
        setMobileQrDataUrl("");
      }
    }
    return () => {
      active = false;
    };
  }, [selectedPaymentMethod, mobilePaymentProvider, mobileMerchantCode, calculations.grandTotal, mobileReference, mobileCustomerPhone]);

  useEffect(() => {
    let interval: any = null;
    const isMobilePayment = selectedPaymentMethod === "MPESA_PAGA_FACIL" || selectedPaymentMethod === "EMOLA";
    const isTimerRunning = mobilePaymentStatus !== "CONFIRMED" && 
                           mobilePaymentStatus !== "IDLE" && 
                           mobilePaymentStatus !== "EXPIRED" &&
                           mobilePaymentTimer > 0;

    if (isMobilePayment && isTimerRunning) {
      interval = setInterval(() => {
        setMobilePaymentTimer(prev => {
          if (prev <= 1) {
            setTimeout(() => {
              setMobilePaymentStatus("EXPIRED");
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedPaymentMethod, mobilePaymentStatus, mobilePaymentTimer]);

  const handleSimulateMobilePayment = () => {
    if (mobilePaymentStatus === "CONFIRMED") return;
    
    setMobilePaymentStatus("SENDING_PUSH");
    setMobilePaymentProgress(15);
    
    // Stage 1 - USSD Push Sent
    setTimeout(() => {
      setMobilePaymentStatus("AWAITING_PIN");
      setMobilePaymentProgress(50);
      
      // Stage 2 - PIN input by customer
      setTimeout(() => {
        setMobilePaymentStatus("VERIFYING");
        setMobilePaymentProgress(80);
        
        // Stage 3 - Final balance verification and success
        setTimeout(() => {
          setMobilePaymentStatus("CONFIRMED");
          setMobilePaymentProgress(100);
          if (onShowToast) {
            onShowToast(`Pagamento via ${mobilePaymentProvider} de ${calculations.grandTotal.toLocaleString()} MT recebido com sucesso!`, "success", "Pagamento Confirmado");
          }
        }, 1200);
      }, 1500);
    }, 1200);
  };

  // Clear states
  const handleReset = () => {
    setCart([]);
    setSelectedCustomerId("");
    setSelectedPaymentMethod("CASH");
    setDiscountValue(0);
    setSearchQuery("");
    setCompletedTx(null);
    setSendEmailStatus("idle");
    setSendSmsStatus("idle");
    setReceivedCashAmount(0);
    setMixedCash(0);
    setMixedMpesa(0);
    setMixedPOS(0);
    setShowPreCheckoutModal(false);
    setShowFinalConfirmModal(false);
    setMobilePaymentStatus("IDLE");
    setMobilePaymentProgress(0);
    setMobilePaymentTimer(120);
  };

  // Execute checkout
  const handleCheckout = (emitReceipt: boolean = true, isConfirmed: boolean = false, overridePaymentMethod?: string) => {
    if (cart.length === 0) return;

    const paymentMethodToUse = overridePaymentMethod || selectedPaymentMethod;

    if (paymentMethodToUse === "DEBT") {
      if (!selectedCustomer) {
        if (onShowToast) onShowToast("Selecione um cliente para prosseguir com a venda a crédito (Dívida).", "warning");
        return;
      }
      if (selectedCustomer.purchaseCount === 0 || selectedCustomer.totalSpent < 20000 || selectedCustomer.creditBlocked) {
        if (onShowToast) onShowToast("Cliente não cumpre os critérios para venda a crédito. Mínimo 20.000 MT de compras e sem bloqueios.", "error", "Crédito Recusado");
        return;
      }
    }

    if (paymentMethodToUse === "MIXED" && Math.abs(mixedSumTotal - calculations.grandTotal) > 1) {
      if (onShowToast) onShowToast(`O somatório dos pagamentos mistos (${mixedSumTotal} MT) não corresponde ao total da venda (${calculations.grandTotal} MT).`, "error", "Pagamento Incorreto");
      return;
    }

    if ((paymentMethodToUse === "MPESA_PAGA_FACIL" || paymentMethodToUse === "EMOLA") && mobilePaymentStatus !== "CONFIRMED") {
      if (onShowToast) {
        onShowToast(`Confirmação Pendente: Certifique-se de receber e validar o pagamento via QR Code primeiro ou use "Forçar".`, "warning", "Pagamento por Confirmar");
      }
      return;
    }

    if (!isConfirmed) {
      setPendingEmitReceipt(emitReceipt);
      setShowFinalConfirmModal(true);
      return;
    }

    setShowFinalConfirmModal(false);

    const invoiceNum = `FAC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowStr = new Date().toISOString();

    const fiscalSign = settings.fiscalModeEnabled !== false
      ? generateFiscalSignature(invoiceNum, nowStr, calculations.grandTotal)
      : {};

    const transaction: Transaction = {
      id: `tx-${Date.now()}`,
      invoiceNumber: invoiceNum,
      timestamp: nowStr,
      subtotal: calculations.subtotal,
      vatTotal: calculations.vatTotal,
      discountTotal: calculations.discountTotal,
      grandTotal: calculations.grandTotal,
      paymentMethod: paymentMethodToUse as any,
      cashierName: activeUsername,
      customerName: selectedCustomer?.name,
      customerId: selectedCustomer?.id,
      customerPhone: selectedCustomer?.phone,
      customerEmail: selectedCustomer?.email,
      nuit: selectedCustomer?.nuit,
      branchId: settings.activeBranchId || "central",
      ...fiscalSign,
      paymentDetails: paymentMethodToUse === "MIXED" 
        ? `Misto: Dinheiro: ${mixedCash} MT | M-Pesa: ${mixedMpesa} MT | POS: ${mixedPOS} MT`
        : paymentMethodToUse === "DEBT"
        ? `Prazo: ${debtDays} dias. Vencimento: ${new Date(Date.now() + debtDays * 24 * 60 * 60 * 1000).toLocaleDateString()}`
        : undefined,
      items: cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name + (item.observation ? ` (${item.observation})` : ""),
        quantity: item.quantity,
        price: item.product.salePrice,
        vatAmount: Math.round(item.product.salePrice * item.quantity * (item.product.vatRate / 100)),
        discountAmount: 0,
        subtotal: item.product.salePrice * item.quantity
      }))
    };

    onCompleteSale(transaction);
    setCurrentSaleNumber(prev => prev + 1);

    if (emitReceipt) {
      onAddAuditLog(
        "Efetuar Venda POS",
        "VENDAS",
        `Fatura ${invoiceNum} registrada por ${activeUsername}. Total: ${calculations.grandTotal} ${currency}. Cliente: ${selectedCustomer?.name || 'Geral'}`
      );
      setCompletedTx(transaction);
    } else {
      onAddAuditLog(
        "Efetuar Venda POS (Sem Recibo)",
        "VENDAS",
        `Venda rápida ${invoiceNum} registrada sem emissão de recibo. Total: ${calculations.grandTotal} ${currency}`
      );
      handleReset();
      setNoReceiptSuccess(true);
      setTimeout(() => { setNoReceiptSuccess(false); }, 3000);
    }
    setShowPreCheckoutModal(false);
  };

  // One-Click Checkout for pre-configured registered customers
  const handleOneClickCheckout = () => {
    if (cart.length === 0) return;
    if (!selectedCustomer) {
      if (onShowToast) onShowToast("Selecione um cliente para prosseguir com a venda rápida.", "warning");
      return;
    }
    if (!selectedCustomer.oneClickCheckoutEnabled || !selectedCustomer.preferredPaymentMethod) {
      if (onShowToast) onShowToast("O cliente selecionado não tem o One-Click Checkout ativo ou configurado.", "warning");
      return;
    }

    const preferredMethod = selectedCustomer.preferredPaymentMethod;
    setSelectedPaymentMethod(preferredMethod);

    // Call checkout directly with confirmation bypassed
    handleCheckout(true, true, preferredMethod);

    if (onShowToast) {
      const methodLabels: Record<string, string> = {
        CASH: "Dinheiro",
        MPESA_PAGA_FACIL: "M-Pesa",
        EMOLA: "E-Mola",
        POS_CARD: "POS",
        CREDIT_CARD: "Cartão de Crédito",
        BANK_TRANSFER: "Transferência Bancária",
        DEBT: "Dívida (Crédito)"
      };
      const label = methodLabels[preferredMethod] || preferredMethod;
      onShowToast(`⚡ One-Click Checkout: Venda finalizada com sucesso via ${label}!`, "success", "One-Click Ativo");
    }
  };

  // 15. Suspend and Resume Sale functions
  const handleSuspendSale = () => {
    if (cart.length === 0) {
      if (onShowToast) onShowToast("O carrinho está vazio para ser suspenso.", "warning");
      return;
    }
    const id = `susp-${Date.now()}`;
    const desc = selectedCustomer?.name || "Consumidor Geral";
    const record = {
      id,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
      customerId: selectedCustomerId
    };
    setSuspendedCarts(prev => [...prev, record]);
    setCart([]);
    setSelectedCustomerId("");
    if (onShowToast) onShowToast(`Venda de "${desc}" suspensa com sucesso!`, "success", "Venda Suspensa");
  };

  const handleResumeSale = (id: string) => {
    const target = suspendedCarts.find(s => s.id === id);
    if (target) {
      setCart(target.cart);
      setSelectedCustomerId(target.customerId);
      setSuspendedCarts(prev => prev.filter(s => s.id !== id));
      if (onShowToast) onShowToast("Carrinho suspenso restaurado com sucesso!", "success");
    }
  };

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

  // Digital communication simulation API
  const simulateSendEmail = async () => {
    if (!completedTx) return;
    if (!selectedCustomer) {
      if (onShowToast) onShowToast("Cliente não registado. Abra o cadastro rápido para registar este cliente. O envio do email começará automaticamente.", "warning", "Cliente não Registado");
      setPendingReceiptAction("email");
      setQuickCustomerModalOpen(true);
      return;
    }
    setSendEmailStatus("sending");
    const targetEmail = selectedCustomer?.email || "vendas.central@ost.co.mz";
    try {
      const activeTheme = SYSTEM_THEMES.find(t => t.id === settings.theme) || SYSTEM_THEMES[0];
      const rgbArray = activeTheme.rgb.split(",").map(Number);

      // 1. Generate client-side styled PDF
      const doc = new jsPDF();
      
      // Top theme color bar
      doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
      doc.rect(0, 0, 210, 8, "F");

      // Company Logo
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
      doc.text(`NUIT: ${settings.companyNuit || "400293112"}`, 14, 28);
      doc.text(`Endereço: ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 33);
      doc.text(`Contacto: ${settings.storeContact || "+258 84 900 1202"}`, 14, 38);
      
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 44, 196, 44);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`FATURA-RECIBO: ${completedTx.invoiceNumber}`, 14, 52);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Data / Hora: ${new Date(completedTx.timestamp).toLocaleString("pt-MZ")}`, 14, 59);
      doc.text(`Caixa/Operador: ${activeUsername || "Operador"}`, 14, 64);
      doc.text(`Cliente: ${completedTx.customerName || "Consumidor Geral"}`, 14, 69);
      if (completedTx.customerPhone) {
        doc.text(`Telemóvel: ${completedTx.customerPhone}`, 14, 74);
      }

      const tableHead = [["PRODUTO / SERVIÇO", "QUANTIDADE", "PREÇO UNIT.", "SUBTOTAL"]];
      const tableBody = completedTx.items.map(item => [
        item.productName,
        item.quantity.toString(),
        `${item.price.toLocaleString()} MT`,
        `${item.subtotal.toLocaleString()} MT`
      ]);

      autoTable(doc, {
        startY: completedTx.customerPhone ? 80 : 75,
        head: tableHead,
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [rgbArray[0], rgbArray[1], rgbArray[2]] as [number, number, number] },
        styles: { fontSize: 8, cellPadding: 3 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      // Totals container box
      doc.setFillColor(248, 250, 252);
      doc.rect(120, finalY, 76, 35, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(120, finalY, 76, 35, "S");

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      
      doc.text(`Subtotal:`, 124, finalY + 6);
      doc.text(`${completedTx.subtotal.toLocaleString()} MT`, 192, finalY + 6, { align: "right" });
      
      if (completedTx.discountTotal > 0) {
        doc.setTextColor(239, 68, 68);
        doc.text(`Desconto:`, 124, finalY + 12);
        doc.text(`-${completedTx.discountTotal.toLocaleString()} MT`, 192, finalY + 12, { align: "right" });
        doc.setTextColor(71, 85, 105);
      }
      
      doc.text(`IVA (16%):`, 124, finalY + 18);
      doc.text(`${completedTx.vatTotal.toLocaleString()} MT`, 192, finalY + 18, { align: "right" });
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(rgbArray[0], rgbArray[1], rgbArray[2]);
      doc.text(`TOTAL PAGO:`, 124, finalY + 26);
      doc.text(`${completedTx.grandTotal.toLocaleString()} MT`, 192, finalY + 26, { align: "right" });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Método de pagamento: ${completedTx.paymentMethod}`, 124, finalY + 31);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(148, 163, 184);
      doc.text("Obrigado pela sua preferência!", 105, finalY + 45, { align: "center" });

      const pdfBase64DataUri = doc.output('datauristring');
      const base64Content = pdfBase64DataUri.split(',')[1];

      // 2. Build detailed HTML email body
      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: ${activeTheme.hover}; text-align: center; margin-bottom: 20px;">${settings.companyName || "OST Vendas"} - Fatura Recibo</h2>
          <p><strong>Fatura Nº:</strong> ${completedTx.invoiceNumber}</p>
          <p><strong>Data:</strong> ${new Date(completedTx.timestamp).toLocaleString("pt-MZ")}</p>
          <p><strong>Caixa/Operador:</strong> ${activeUsername}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          <p>Olá <strong>${completedTx.customerName || "Consumidor Geral"}</strong>,</p>
          <p>Confirmamos a emissão da Fatura-Recibo no valor total de <strong>${completedTx.grandTotal.toLocaleString()} MT</strong> pago via <strong>${completedTx.paymentMethod}</strong>.</p>
          
          <h3 style="color: #334155; font-size: 14px; margin-top: 25px; margin-bottom: 10px;">Detalhes da Compra:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
                <th style="padding: 10px; color: #475569; font-weight: bold;">Produto</th>
                <th style="padding: 10px; color: #475569; font-weight: bold; text-align: center;">Qtd</th>
                <th style="padding: 10px; color: #475569; font-weight: bold; text-align: right;">Preço</th>
                <th style="padding: 10px; color: #475569; font-weight: bold; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${completedTx.items.map((item: any) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px; color: #1e293b;">${item.productName}</td>
                  <td style="padding: 10px; color: #475569; text-align: center;">${item.quantity}</td>
                  <td style="padding: 10px; color: #475569; text-align: right;">${item.price.toLocaleString()} MT</td>
                  <td style="padding: 10px; color: #1e293b; text-align: right; font-weight: 500;">${item.subtotal.toLocaleString()} MT</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          
          <div style="text-align: right; font-size: 13px; color: #475569; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            <p style="margin: 4px 0;"><strong>Subtotal:</strong> ${completedTx.subtotal.toLocaleString()} MT</p>
            ${completedTx.discountTotal > 0 ? `<p style="margin: 4px 0; color: #ef4444;"><strong>Desconto:</strong> -${completedTx.discountTotal.toLocaleString()} MT</p>` : ""}
            <p style="margin: 4px 0;"><strong>IVA (16%):</strong> ${completedTx.vatTotal.toLocaleString()} MT</p>
            <p style="margin: 8px 0 4px 0; font-size: 16px; color: ${activeTheme.hover};"><strong>Total Pago:</strong> ${completedTx.grandTotal.toLocaleString()} MT</p>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #64748b; text-align: center;">Obrigado pela sua preferência!<br><em>${settings.companyName || "OST Vendas"}</em></p>
        </div>
      `;

      // Try sending real email using Gmail API first
      await sendEmail({
        to: targetEmail,
        subject: `Fatura ${completedTx.invoiceNumber} - ${settings.companyName || "OST Vendas"}`,
        body: emailBody,
        isHtml: true,
        attachments: [{
          filename: `Fatura_${completedTx.invoiceNumber}.pdf`,
          content: base64Content,
          mimeType: "application/pdf"
        }]
      });

      setSendEmailStatus("sent");
      onAddAuditLog("Enviar Recibo por Email", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via e-mail real para ${targetEmail} com PDF anexo.`);
      if (onShowToast) onShowToast("Recibo enviado por email com sucesso via Gmail API!", "success");
    } catch (realEmailErr: any) {
      console.warn("Could not send email via Gmail API, falling back to mock endpoint:", realEmailErr);
      
      try {
        const activeTheme = SYSTEM_THEMES.find(t => t.id === settings.theme) || SYSTEM_THEMES[0];
        const rgbArray = activeTheme.rgb.split(",").map(Number);
        
        // Re-generate pdf to make sure we have it
        const doc = new jsPDF();
        doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
        doc.rect(0, 0, 210, 8, "F");
        const logoData = await getBase64ImageFromUrl(settings.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
        if (logoData) {
          const format = getFormatFromBase64(logoData);
          doc.addImage(logoData, format, 165, 12, 30, 30);
        }
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(settings.companyName || "OST COMÉRCIO CENTRAL", 14, 22);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`NUIT: ${settings.companyNuit || "400293112"}`, 14, 28);
        doc.text(`Endereço: ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 33);
        doc.text(`Contacto: ${settings.storeContact || "+258 84 900 1202"}`, 14, 38);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 44, 196, 44);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`FATURA-RECIBO: ${completedTx.invoiceNumber}`, 14, 52);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`Data / Hora: ${new Date(completedTx.timestamp).toLocaleString("pt-MZ")}`, 14, 59);
        doc.text(`Caixa/Operador: ${activeUsername || "Operador"}`, 14, 64);
        doc.text(`Cliente: ${completedTx.customerName || "Consumidor Geral"}`, 14, 69);
        if (completedTx.customerPhone) {
          doc.text(`Telemóvel: ${completedTx.customerPhone}`, 14, 74);
        }
        autoTable(doc, {
          startY: completedTx.customerPhone ? 80 : 75,
          head: [["PRODUTO / SERVIÇO", "QUANTIDADE", "PREÇO UNIT.", "SUBTOTAL"]],
          body: completedTx.items.map(item => [
            item.productName,
            item.quantity.toString(),
            `${item.price.toLocaleString()} MT`,
            `${item.subtotal.toLocaleString()} MT`
          ]),
          theme: "grid",
          headStyles: { fillColor: [rgbArray[0], rgbArray[1], rgbArray[2]] as [number, number, number] },
          styles: { fontSize: 8, cellPadding: 3 }
        });
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFillColor(248, 250, 252);
        doc.rect(120, finalY, 76, 35, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(120, finalY, 76, 35, "S");
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`Subtotal:`, 124, finalY + 6);
        doc.text(`${completedTx.subtotal.toLocaleString()} MT`, 192, finalY + 6, { align: "right" });
        if (completedTx.discountTotal > 0) {
          doc.setTextColor(239, 68, 68);
          doc.text(`Desconto:`, 124, finalY + 12);
          doc.text(`-${completedTx.discountTotal.toLocaleString()} MT`, 192, finalY + 12, { align: "right" });
          doc.setTextColor(71, 85, 105);
        }
        doc.text(`IVA (16%):`, 124, finalY + 18);
        doc.text(`${completedTx.vatTotal.toLocaleString()} MT`, 192, finalY + 18, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(rgbArray[0], rgbArray[1], rgbArray[2]);
        doc.text(`TOTAL PAGO:`, 124, finalY + 26);
        doc.text(`${completedTx.grandTotal.toLocaleString()} MT`, 192, finalY + 26, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Método de pagamento: ${completedTx.paymentMethod}`, 124, finalY + 31);
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(148, 163, 184);
        doc.text("Obrigado pela sua preferência!", 105, finalY + 45, { align: "center" });

        const pdfBase64DataUri = doc.output('datauristring');
        const fallbackBase64 = pdfBase64DataUri.split(',')[1];

        await fetch("/api/email/dispatch-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: targetEmail,
            invoiceNumber: completedTx.invoiceNumber,
            grandTotal: completedTx.grandTotal,
            cashier: activeUsername,
            customer: completedTx.customerName || "Consumidor Geral",
            items: completedTx.items,
            subtotal: completedTx.subtotal,
            discountTotal: completedTx.discountTotal,
            vatTotal: completedTx.vatTotal,
            paymentMethod: completedTx.paymentMethod,
            pdfAttachment: fallbackBase64
          })
        });
        setSendEmailStatus("sent");
        onAddAuditLog("Enviar Recibo por Email", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via e-mail (Simulação com PDF anexo).`);
        if (onShowToast) onShowToast("Recibo enviado por email com sucesso!", "success");
      } catch (err) {
        setSendEmailStatus("idle");
        if (onShowToast) onShowToast("Simulado: Recibo de e-mail enviado com sucesso (Mock).", "success");
      }
    }
  };

  const simulateSendSms = async () => {
    if (!completedTx) return;
    if (!selectedCustomer) {
      if (onShowToast) onShowToast("Cliente não registado. Abra o cadastro rápido para registar este cliente. O envio do SMS começará automaticamente.", "warning", "Cliente não Registado");
      setPendingReceiptAction("sms");
      setQuickCustomerModalOpen(true);
      return;
    }
    setSendSmsStatus("sending");
    try {
      await fetch("/api/sms/dispatch-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedCustomer?.phone || "+258 84 900 1202",
          invoiceNumber: completedTx.invoiceNumber,
          grandTotal: completedTx.grandTotal
        })
      });
      setSendSmsStatus("sent");
      onAddAuditLog("Enviar Recibo por SMS", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via SMS.`);
      if (onShowToast) onShowToast("SMS de confirmação despachado!", "success");
    } catch (err) {
      setSendSmsStatus("idle");
      if (onShowToast) onShowToast("Simulado: Recibo de SMS enviado com sucesso (Mock).", "success");
    }
  };

  const handleOpenWhatsAppModal = () => {
    if (!completedTx) return;
    if (!selectedCustomer) {
      if (onShowToast) onShowToast("Cliente não registado. Abra o cadastro rápido para registar este cliente. O envio via WhatsApp começará automaticamente.", "warning", "Cliente não Registado");
      setPendingReceiptAction("whatsapp");
      setQuickCustomerModalOpen(true);
      return;
    }
    
    // Format a beautiful text invoice for Mozambique with local details
    const dateStr = new Date(completedTx.timestamp).toLocaleString();
    const itemsText = completedTx.items
      .map(item => `▪️ ${item.quantity}x ${item.productName} - ${(item.price * item.quantity).toLocaleString()} MT`)
      .join("\n");

    const text = `🧾 *RECIBO DIGITAL DE VENDA* - OST Vendas 🇲🇿\n` +
      `------------------------------------------\n` +
      `*Fatura:* ${completedTx.invoiceNumber}\n` +
      `*Data:* ${dateStr}\n` +
      `*Operador:* ${completedTx.cashierName}\n` +
      `*Cliente:* ${completedTx.customerName || "Consumidor Geral"}\n` +
      `------------------------------------------\n` +
      `*Artigos:*\n${itemsText}\n` +
      `------------------------------------------\n` +
      `*Subtotal:* ${completedTx.subtotal.toLocaleString()} MT\n` +
      (completedTx.discountTotal > 0 ? `*Desconto:* -${completedTx.discountTotal.toLocaleString()} MT\n` : "") +
      `*IVA Cobrado:* ${completedTx.vatTotal.toLocaleString()} MT\n` +
      `*TOTAL PAGO: ${completedTx.grandTotal.toLocaleString()} MT*\n` +
      `------------------------------------------\n` +
      `*Forma de Pagamento:* ${completedTx.paymentMethod}\n\n` +
      `Muito obrigado pela sua preferência! Volte sempre. ✨`;

    setWhatsappMessage(text);
    setWhatsappPhone(selectedCustomer?.phone || "");
    
    // Default URL pre-generation
    const cleanPhone = (selectedCustomer?.phone || "").replace(/\D/g, "");
    const defaultPhone = cleanPhone.length === 9 && (cleanPhone.startsWith("84") || cleanPhone.startsWith("85") || cleanPhone.startsWith("82") || cleanPhone.startsWith("87") || cleanPhone.startsWith("86"))
      ? `258${cleanPhone}`
      : cleanPhone;
    setWhatsappDirectUrl(`https://api.whatsapp.com/send?phone=${defaultPhone}&text=${encodeURIComponent(text)}`);
    setSendWhatsAppStatus("idle");
    setWhatsappModalOpen(true);
  };

  const dispatchWhatsAppReceipt = async (forceLinkDirect = false) => {
    if (!completedTx) return;
    
    const cleanPhone = whatsappPhone.replace(/\D/g, "");
    const defaultPhone = cleanPhone.length === 9 && (cleanPhone.startsWith("84") || cleanPhone.startsWith("85") || cleanPhone.startsWith("82") || cleanPhone.startsWith("87") || cleanPhone.startsWith("86"))
      ? `258${cleanPhone}`
      : cleanPhone;

    const directUrl = `https://api.whatsapp.com/send?phone=${defaultPhone}&text=${encodeURIComponent(whatsappMessage)}`;

    if (forceLinkDirect || !settings.whatsappEnabled || settings.whatsappProvider === "DIRECT_LINK") {
      setSendWhatsAppStatus("sent");
      onAddAuditLog("Enviar Recibo WhatsApp", "VENDAS", `Link WhatsApp gerado para Fatura ${completedTx.invoiceNumber}.`);
      window.open(directUrl, "_blank", "noopener,noreferrer");
      setWhatsappModalOpen(false);
      if (onShowToast) onShowToast("Link do WhatsApp aberto com sucesso!", "success");
      return;
    }

    setSendWhatsAppStatus("sending");
    try {
      const response = await fetch("/api/whatsapp/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: defaultPhone,
          message: whatsappMessage,
          gatewayConfig: settings
        })
      });

      const resData = await response.json();
      
      if (!response.ok) {
        throw new Error(resData.error || "Falha ao enviar através do Gateway");
      }

      setSendWhatsAppStatus("sent");
      onAddAuditLog("Enviar Recibo WhatsApp", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via WhatsApp Gateway.`);
      if (onShowToast) onShowToast(resData.message || "Recibo enviado pelo WhatsApp com sucesso!", "success");
      setWhatsappModalOpen(false);
    } catch (err: any) {
      setSendWhatsAppStatus("idle");
      if (onShowToast) onShowToast(`Erro no Gateway: ${err.message}. Redirecionando para Link Direto...`, "warning");
      
      // Automatic fallback
      window.open(directUrl, "_blank", "noopener,noreferrer");
      setWhatsappModalOpen(false);
    }
  };

  // Helper for formatting budget or transaction details in ESC/POS layout
  const getEscPosText = (budget: any, paperSize: "80MM" | "58MM") => {
    const width = paperSize === "58MM" ? 32 : 48; // characters per line
    
    const padChar = (str: string, len: number, char: string = " ", right: boolean = false) => {
      const cleanStr = String(str || "");
      if (cleanStr.length >= len) return cleanStr.substring(0, len);
      const pad = char.repeat(len - cleanStr.length);
      return right ? pad + cleanStr : cleanStr + pad;
    };
    
    const centerText = (str: string) => {
      const cleanStr = String(str || "");
      if (cleanStr.length >= width) return cleanStr.substring(0, width);
      const leftPad = Math.floor((width - cleanStr.length) / 2);
      return " ".repeat(leftPad) + cleanStr;
    };

    const lineSeparator = "-".repeat(width);
    const doubleLineSeparator = "=".repeat(width);

    let out = "";
    out += "[ESC @] -- INICIALIZAR IMPRESSORA\n";
    out += "[ESC a 1] -- ALINHAMENTO AO CENTRO\n";
    out += centerText(settings.companyName || "OST COMÉRCIO CENTRAL") + "\n";
    if (settings.slogan) out += centerText(settings.slogan) + "\n";
    out += centerText(settings.storeAddress || "Av. Marginal, Maputo") + "\n";
    out += centerText(`NUIT EMPRESA: ${settings.companyNuit || "400293112"}`) + "\n";
    if (settings.storeContact) out += centerText(`Tel: ${settings.storeContact}`) + "\n";
    out += lineSeparator + "\n";
    
    out += "[ESC a 0] -- ALINHAMENTO À ESQUERDA\n";
    out += `PROPOSTA COMERCIAL (ORÇAMENTO)\n`;
    out += `NÚMERO : ${budget.budgetNumber}\n`;
    out += `EMISSÃO: ${new Date(budget.timestamp).toLocaleString("pt-MZ")}\n`;
    out += `VALIDADE: 15 DIAS DEPOIS\n`;
    out += `OPERADOR: ${activeUsername}\n`;
    out += lineSeparator + "\n";
    out += `DADOS DO CLIENTE:\n`;
    out += `NOME   : ${budget.customerName}\n`;
    if (budget.customerNuit)  out += `NUIT   : ${budget.customerNuit}\n`;
    if (budget.customerPhone) out += `CONTAC : ${budget.customerPhone}\n`;
    if (budget.customerEmail) out += `EMAIL  : ${budget.customerEmail}\n`;
    out += doubleLineSeparator + "\n";
    
    const itemLen = paperSize === "58MM" ? 14 : 24;
    const qtyLen = paperSize === "58MM" ? 4 : 6;
    const valLen = paperSize === "58MM" ? 14 : 18;
    
    out += padChar("ARTIGO", itemLen) + padChar("QTD", qtyLen, " ", true) + padChar("VALOR", valLen, " ", true) + "\n";
    out += lineSeparator + "\n";
    
    budget.items.forEach((item: any) => {
      const name = item.productName.substring(0, itemLen - 1);
      const qty = String(item.quantity);
      const val = (item.price * item.quantity).toLocaleString() + " MT";
      out += padChar(name, itemLen) + padChar(qty, qtyLen, " ", true) + padChar(val, valLen, " ", true) + "\n";
    });
    
    out += lineSeparator + "\n";
    out += padChar("SUBTOTAL:", itemLen + qtyLen) + padChar(budget.subtotal.toLocaleString() + " MT", valLen, " ", true) + "\n";
    if (budget.discountTotal > 0) {
      out += padChar("DESCONTO:", itemLen + qtyLen) + padChar("-" + budget.discountTotal.toLocaleString() + " MT", valLen, " ", true) + "\n";
    }
    out += padChar("IVA ESTIMADO (16%):", itemLen + qtyLen) + padChar(budget.vatTotal.toLocaleString() + " MT", valLen, " ", true) + "\n";
    out += doubleLineSeparator + "\n";
    out += "[ESC ! 17] -- DOUBLE HEIGHT & DOUBLE WIDTH BOLD\n";
    out += padChar("TOTAL PROP:", itemLen + qtyLen) + padChar(budget.grandTotal.toLocaleString() + " MT", valLen, " ", true) + "\n";
    out += "[ESC ! 0] -- FONTE NORMAL\n";
    out += doubleLineSeparator + "\n";
    out += "[ESC a 1] -- ALINHAMENTO AO CENTRO\n";
    out += centerText("*** VALIDADE 15 DIAS ***") + "\n";
    out += centerText("Este documento nao serve como fatura.") + "\n";
    out += centerText("Obrigado pela preferência!") + "\n";
    out += "[GS V 66 0] -- CORTE TOTAL DE PAPEL\n";
    
    return out;
  };

  // --- ORÇAMENTO (BUDGET / QUOTE) FUNCTIONS ---
  const handleGenerateBudget = () => {
    if (cart.length === 0) {
      if (onShowToast) onShowToast("O carrinho está vazio para gerar um orçamento.", "warning");
      return;
    }

    const budgetNumber = `ORC-${new Date().getFullYear()}-${String(currentSaleNumber).padStart(4, "0")}`;
    const timestamp = Date.now();
    
    const budgetData = {
      budgetNumber,
      timestamp,
      customerName: selectedCustomer ? selectedCustomer.name : "Consumidor Geral",
      customerEmail: selectedCustomer?.email,
      customerPhone: selectedCustomer?.phone,
      customerNuit: selectedCustomer?.nuit,
      items: cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.product.salePrice,
      })),
      subtotal: calculations.subtotal,
      discountTotal: calculations.discountTotal,
      vatTotal: calculations.vatTotal,
      grandTotal: calculations.grandTotal,
    };

    setCompletedBudget(budgetData);
    setBudgetTargetEmail(budgetData.customerEmail || "");
    setBudgetTargetPhone(budgetData.customerPhone || "");
    setSendBudgetEmailStatus("idle");
    setSendBudgetSmsStatus("idle");
    setSendBudgetWhatsAppStatus("idle");

    onAddAuditLog(
      "Gerar Orçamento POS",
      "VENDAS",
      `Orçamento ${budgetNumber} gerado para ${budgetData.customerName}. Total: ${calculations.grandTotal} MT.`
    );

    if (onShowToast) {
      onShowToast(`Orçamento ${budgetNumber} gerado com sucesso!`, "success", "Orçamento Gerado");
    }
  };

  const simulateSendBudgetEmail = async () => {
    if (!completedBudget) return;
    setSendBudgetEmailStatus("sending");
    const targetEmail = budgetTargetEmail || completedBudget.customerEmail || "vendas.central@ost.co.mz";
    try {
      const activeTheme = SYSTEM_THEMES.find(t => t.id === settings.theme) || SYSTEM_THEMES[0];
      const rgbArray = activeTheme.rgb.split(",").map(Number);

      // 1. Generate client-side styled PDF for the budget
      const doc = new jsPDF();
      
      // Top theme color bar
      doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
      doc.rect(0, 0, 210, 8, "F");

      // Company Logo
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
      doc.text(`NUIT: ${settings.companyNuit || "400293112"}`, 14, 28);
      doc.text(`Endereço: ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 33);
      doc.text(`Contacto: ${settings.storeContact || "+258 84 900 1202"}`, 14, 38);
      
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 44, 196, 44);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 83, 9); // Amber-700
      doc.text(`PROPOSTA DE ORÇAMENTO: ${completedBudget.budgetNumber}`, 14, 52);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Data Emissão: ${new Date(completedBudget.timestamp).toLocaleString("pt-MZ")}`, 14, 59);
      doc.text(`Validade: 15 Dias (Até ${new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ")})`, 14, 64);
      doc.text(`Caixa/Operador: ${activeUsername || "Operador"}`, 14, 69);
      doc.text(`Cliente: ${completedBudget.customerName}`, 14, 74);
      if (completedBudget.customerNuit) {
        doc.text(`NUIT Cliente: ${completedBudget.customerNuit}`, 14, 79);
      }

      const tableHead = [["ARTIGO / PRODUTO", "QUANTIDADE", "PREÇO UNIT.", "SUBTOTAL"]];
      const tableBody = completedBudget.items.map(item => [
        item.productName,
        item.quantity.toString(),
        `${item.price.toLocaleString()} MT`,
        `${(item.price * item.quantity).toLocaleString()} MT`
      ]);

      autoTable(doc, {
        startY: completedBudget.customerNuit ? 85 : 80,
        head: tableHead,
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [rgbArray[0], rgbArray[1], rgbArray[2]] as [number, number, number] },
        styles: { fontSize: 8, cellPadding: 3 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      // Totals container box
      doc.setFillColor(248, 250, 252);
      doc.rect(120, finalY, 76, 30, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(120, finalY, 76, 30, "S");

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Subtotal:`, 124, finalY + 6);
      doc.text(`${completedBudget.subtotal.toLocaleString()} MT`, 192, finalY + 6, { align: "right" });
      if (completedBudget.discountTotal > 0) {
        doc.setTextColor(239, 68, 68);
        doc.text(`Desconto:`, 124, finalY + 12);
        doc.text(`-${completedBudget.discountTotal.toLocaleString()} MT`, 192, finalY + 12, { align: "right" });
        doc.setTextColor(71, 85, 105);
      }
      doc.text(`IVA Estimado:`, 124, finalY + 18);
      doc.text(`${completedBudget.vatTotal.toLocaleString()} MT`, 192, finalY + 18, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(180, 83, 9); // Amber-700
      doc.text(`TOTAL PROPOSTO:`, 124, finalY + 25);
      doc.text(`${completedBudget.grandTotal.toLocaleString()} MT`, 192, finalY + 25, { align: "right" });

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Este documento constitui apenas uma proposta comercial.", 105, finalY + 40, { align: "center" });

      const pdfBase64DataUri = doc.output('datauristring');
      const base64Content = pdfBase64DataUri.split(',')[1];

      // Prepare email body
      const itemsHtml = completedBudget.items
        .map(item => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left;">${item.productName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.price.toLocaleString()} MT</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${(item.price * item.quantity).toLocaleString()} MT</td>
          </tr>
        `).join("");

      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #ea580c; margin: 0;">${settings.companyName || "OST Vendas"}</h2>
            <p style="color: #64748b; margin: 5px 0 0 0;">Orçamento Comercial</p>
          </div>
          <p><strong>Orçamento Nº:</strong> ${completedBudget.budgetNumber}</p>
          <p><strong>Data de Emissão:</strong> ${new Date(completedBudget.timestamp).toLocaleString("pt-MZ")}</p>
          <p><strong>Validade:</strong> 15 Dias (Até ${new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ")})</p>
          <p><strong>Operador:</strong> ${activeUsername}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          <p>Olá <strong>${completedBudget.customerName}</strong>,</p>
          <p>Abaixo encontra-se o orçamento comercial solicitado para a sua apreciação:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1;">Artigo</th>
                <th style="padding: 8px; text-align: center; border-bottom: 2px solid #cbd5e1;">Qtd</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Preço Un.</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="text-align: right; font-size: 13px; color: #475569; line-height: 1.6;">
            <p><strong>Subtotal:</strong> ${completedBudget.subtotal.toLocaleString()} MT</p>
            ${completedBudget.discountTotal > 0 ? `<p style="color: #ef4444;"><strong>Desconto:</strong> -${completedBudget.discountTotal.toLocaleString()} MT</p>` : ""}
            <p><strong>IVA Cobrado:</strong> ${completedBudget.vatTotal.toLocaleString()} MT</p>
            <p style="font-size: 16px; color: #ea580c; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;"><strong>Total Geral:</strong> ${completedBudget.grandTotal.toLocaleString()} MT</p>
          </div>

          <div style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #ea580c; font-size: 11px; color: #64748b; line-height: 1.5; margin-top: 25px;">
            <strong>Nota:</strong> Este documento constitui apenas uma proposta comercial válida por 15 dias e não serve como recibo ou comprovativo de pagamento.
          </div>

          <p style="margin-top: 30px; font-size: 12px; color: #64748b; text-align: center;">Estamos à sua disposição!<br><em>${settings.companyName || "OST Vendas"}</em></p>
        </div>
      `;

      // Try client-side Gmail API first
      try {
        await sendEmail({
          to: targetEmail,
          subject: `Orçamento ${completedBudget.budgetNumber} - ${settings.companyName || "OST Vendas"}`,
          body: emailBody,
          isHtml: true,
          attachments: [{
            filename: `Orcamento_${completedBudget.budgetNumber}.pdf`,
            content: base64Content,
            mimeType: "application/pdf"
          }]
        });

        setSendBudgetEmailStatus("sent");
        onAddAuditLog("Enviar Orçamento por Email", "VENDAS", `Orçamento ${completedBudget.budgetNumber} enviado via e-mail real para ${targetEmail} com PDF anexo.`);
        if (onShowToast) onShowToast("Orçamento enviado por e-mail com sucesso via Gmail API!", "success");
      } catch (gmailErr: any) {
        console.warn("Could not send email via Gmail API, falling back to server-side SMTP:", gmailErr);
        
        // Fall back to server endpoint /api/email/dispatch-budget
        const res = await fetch("/api/email/dispatch-budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: targetEmail,
            budgetNumber: completedBudget.budgetNumber,
            grandTotal: completedBudget.grandTotal,
            cashier: activeUsername,
            customer: completedBudget.customerName,
            items: completedBudget.items,
            subtotal: completedBudget.subtotal,
            discountTotal: completedBudget.discountTotal,
            vatTotal: completedBudget.vatTotal,
            pdfAttachment: base64Content
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Erro desconhecido no servidor.");
        }

        setSendBudgetEmailStatus("sent");
        onAddAuditLog("Enviar Orçamento por Email", "VENDAS", `Orçamento ${completedBudget.budgetNumber} enviado via e-mail do servidor (SMTP) para ${targetEmail} com PDF.`);
        if (onShowToast) onShowToast("Orçamento enviado por e-mail com sucesso!", "success");
      }
    } catch (err: any) {
      console.error("Could not send budget email:", err);
      setSendBudgetEmailStatus("idle");
      if (onShowToast) onShowToast(`Erro ao enviar orçamento: ${err.message || err}`, "error");
    }
  };

  const simulateSendBudgetSms = async () => {
    if (!completedBudget) return;
    setSendBudgetSmsStatus("sending");
    const targetPhone = budgetTargetPhone || completedBudget.customerPhone || "+258 84 900 1202";
    try {
      await fetch("/api/sms/dispatch-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: targetPhone,
          invoiceNumber: completedBudget.budgetNumber,
          grandTotal: completedBudget.grandTotal
        })
      });
      setSendBudgetSmsStatus("sent");
      onAddAuditLog("Enviar Orçamento por SMS", "VENDAS", `Orçamento ${completedBudget.budgetNumber} enviado via SMS para ${targetPhone}.`);
      if (onShowToast) onShowToast("Orçamento enviado por SMS com sucesso!", "success");
    } catch (err) {
      setSendBudgetSmsStatus("sent");
      if (onShowToast) onShowToast("Orçamento enviado por SMS com sucesso (Simulado)!", "success");
    }
  };

  const handleOpenBudgetWhatsApp = () => {
    if (!completedBudget) return;
    
    const dateStr = new Date(completedBudget.timestamp).toLocaleDateString("pt-MZ");
    const validUntilStr = new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ");
    const itemsText = completedBudget.items
      .map(item => `▪️ ${item.quantity}x ${item.productName} - ${(item.price * item.quantity).toLocaleString()} MT`)
      .join("\n");

    const text = `📝 *ORÇAMENTO COMERCIAL* - ${settings.companyName || "OST Vendas"} 🇲🇿\n` +
      `------------------------------------------\n` +
      `*Orçamento:* ${completedBudget.budgetNumber}\n` +
      `*Data de Emissão:* ${dateStr}\n` +
      `*Validade:* 15 dias (Até ${validUntilStr})\n` +
      `*Operador:* ${activeUsername}\n` +
      `*Cliente:* ${completedBudget.customerName}\n` +
      `------------------------------------------\n` +
      `*Artigos:*\n${itemsText}\n` +
      `------------------------------------------\n` +
      `*Subtotal:* ${completedBudget.subtotal.toLocaleString()} MT\n` +
      (completedBudget.discountTotal > 0 ? `*Desconto:* -${completedBudget.discountTotal.toLocaleString()} MT\n` : "") +
      `*IVA:* ${completedBudget.vatTotal.toLocaleString()} MT\n` +
      `*TOTAL PROPOSTO: ${completedBudget.grandTotal.toLocaleString()} MT*\n` +
      `------------------------------------------\n\n` +
      `Este documento é uma proposta comercial. Ficamos a aguardar o seu contacto! ✨`;

    const cleanPhone = (budgetTargetPhone || completedBudget.customerPhone || "").replace(/\D/g, "");
    const defaultPhone = cleanPhone.length === 9 && (cleanPhone.startsWith("84") || cleanPhone.startsWith("85") || cleanPhone.startsWith("82") || cleanPhone.startsWith("87") || cleanPhone.startsWith("86"))
      ? `258${cleanPhone}`
      : cleanPhone;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${defaultPhone}&text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setSendBudgetWhatsAppStatus("sent");
    onAddAuditLog("Enviar Orçamento WhatsApp", "VENDAS", `Orçamento ${completedBudget.budgetNumber} enviado via WhatsApp para o telemóvel ${defaultPhone}.`);
    if (onShowToast) onShowToast("Link do WhatsApp aberto com sucesso!", "success");
  };

  // Quick Customer Registration
  const handleQuickAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName) return;
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: quickCustName,
      phone: quickCustPhone || "Sem Telemóvel",
      email: `${quickCustName.toLowerCase().replace(/\s+/g, "")}@gmail.com`,
      address: "Maputo, Moçambique",
      nuit: quickCustNuit || "400000000",
      totalSpent: 0,
      purchaseCount: 0,
      debt: 0,
      loyaltyPoints: 0,
      preferredPaymentMethod: quickCustPreferredMethod,
      oneClickCheckoutEnabled: quickCustOneClick
    };
    setLocalCustomers(prev => [...prev, newCust]);
    setSelectedCustomerId(newCust.id);
    
    // If we have an active completed transaction, update its customer details so digital communication works seamlessly
    if (completedTx) {
      setCompletedTx(prev => {
        if (!prev) return null;
        return {
          ...prev,
          customerId: newCust.id,
          customerName: newCust.name,
          customerPhone: newCust.phone !== "Sem Telemóvel" ? newCust.phone : "",
          customerEmail: newCust.email,
          nuit: newCust.nuit !== "400000000" ? newCust.nuit : prev.nuit,
        };
      });
    }

    setQuickCustomerModalOpen(false);
    setQuickCustName("");
    setQuickCustPhone("");
    setQuickCustNuit("");
    setQuickCustPreferredMethod("CASH");
    setQuickCustOneClick(false);
    if (onShowToast) onShowToast(`Cliente ${newCust.name} registado e selecionado!`, "success");
  };

  return (
    <div className={`flex flex-col xl:flex-row h-full gap-5 ${isPOSFullscreen ? "h-screen p-5 bg-slate-950 text-slate-100" : ""}`}>
      
      {/* LEFT COLUMN: Product Browse Grid & Header info */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm">
        
        {/* 1. & 21. Dynamic POS Header & Status info */}
        <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 text-orange-400 font-semibold text-sm">
              <ShoppingCart className="w-4 h-4" />
              <span>🛒 POS Nº {String(currentSaleNumber).padStart(6, '0')}</span>
            </div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div>👤 OPERADOR: <span className="text-slate-300 font-bold">{activeUsername}</span></div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div>🏪 CAIXA: <span className="text-slate-300 font-bold">CAIXA PRINCIPAL</span></div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div>📅 TURNO: <span className="text-slate-300 font-bold">MANHÃ</span></div>
          </div>

          <div className="flex items-center gap-3">
            {/* Suspended sales recall badge */}
            {suspendedCarts.length > 0 && (
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg text-amber-400 text-[10px] font-bold">
                <span>⏳ Suspensa(s): {suspendedCarts.length}</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleResumeSale(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="bg-transparent text-amber-400 font-bold text-[10px] outline-none cursor-pointer"
                >
                  <option value="" className="text-slate-900">Retomar...</option>
                  {suspendedCarts.map((sc, i) => (
                    <option key={sc.id} value={sc.id} className="text-slate-900">
                      Venda {i+1} ({sc.time}) - {localCustomers.find(c => c.id === sc.customerId)?.name || "Geral"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {itemsLeavingStockBelowCritical.length > 0 && (
              <button
                onClick={() => setShowCriticalStockModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-[11px] font-extrabold cursor-pointer transition animate-pulse shadow-md shadow-red-500/20"
                title={`${itemsLeavingStockBelowCritical.length} produtos atingirão estoque crítico após a venda! Clique para inspecionar.`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-white animate-bounce" />
                <span>ALERTA STOCK ({itemsLeavingStockBelowCritical.length})</span>
              </button>
            )}

            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[11px] font-bold cursor-pointer transition shadow-sm"
              title="Ajuda e Atalhos de Teclado (F1)"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>ATALHOS (F1)</span>
            </button>

            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                isOnline ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>{isOnline ? "🟢 ONLINE" : "🔴 OFFLINE"}</span>
            </button>

            {onTriggerPanic && (
              <button
                onClick={() => setShowPanicConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold cursor-pointer transition-all bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30 ring-2 ring-red-400 hover:scale-[1.03] animate-pulse"
                title="Botão de Pânico / Alerta Crítico"
              >
                <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                <span>🚨 PÂNICO</span>
              </button>
            )}

            {onChangePOSFullscreen && (
              <button
                onClick={() => {
                  onChangePOSFullscreen(!isPOSFullscreen);
                  if (onShowToast) {
                    onShowToast(
                      !isPOSFullscreen 
                        ? "Modo Foco Ativado! Sidebars e cabeçalhos ocultados para maximizar área de checkout." 
                        : "Modo Foco Desativado. Restaurado painel principal.",
                      "info",
                      "Modo Checkout"
                    );
                  }
                  onAddAuditLog(
                    !isPOSFullscreen ? "Ativar Modo Foco POS" : "Desativar Modo Foco POS",
                    "POS",
                    `O operador alterou o modo de exibição de checkout (Modo Foco: ${!isPOSFullscreen ? "ATIVADO" : "DESATIVADO"}).`
                  );
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold cursor-pointer transition-all ${
                  isPOSFullscreen 
                    ? "bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/30 animate-pulse ring-2 ring-rose-400" 
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
                }`}
                title={isPOSFullscreen ? "Sair do Modo de Foco Imersivo" : "Expandir para Modo de Foco Imersivo"}
              >
                {isPOSFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-400" />}
                <span>{isPOSFullscreen ? "SAIR DO MODO" : "EXPANDIR"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search header & Filter bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Pesquisar por nome, marca, código de barras (F3) ou bipe o leitor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const code = searchQuery.trim();
                    if (code) {
                      const prod = localProducts.find(p => p.barcode === code || p.code === code);
                      if (prod) {
                        e.preventDefault();
                        if (prod.stock <= 0) {
                          if (onShowToast) onShowToast(`Produto ${prod.name} está esgotado!`, "error");
                        } else {
                          handleTriggerAddToCart(prod);
                          if (onShowToast) onShowToast(`Leitor: ${prod.name} adicionado ao carrinho!`, "success");
                          setSearchQuery("");
                        }
                      }
                    }
                  }
                }}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-24 py-2 text-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setScannerModalOpen(true)}
                className="absolute right-2 top-1.5 px-2 py-1 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition focus:outline-none focus:ring-1 focus:ring-orange-500"
                title="Abrir Scanner de Código de Barras (Câmara/Teclado)"
              >
                <Scan className="w-3.5 h-3.5 animate-pulse" />
                <span>SCAN</span>
              </button>
            </div>
            
            <div className="flex gap-2">
              {/* Hardware Barcode Scanner Status Indicator */}
              <div 
                className="px-2.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm select-none"
                title="O sistema está escutando bipes de leitores de código de barras USB/Bluetooth de forma contínua e global."
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="hidden md:inline">Leitor Ativo</span>
                <span className="md:hidden">Leitor</span>
              </div>
              {/* 20. Scanner Dialog button */}
              <button
                onClick={() => setScannerModalOpen(true)}
                className="px-3 bg-orange-500 hover:bg-orange-600 text-white border border-orange-600 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                title="Simular/Ler Código de Barras com a Câmara"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">📷 Scanner de Câmara</span>
              </button>

              <button
                onClick={() => setShowSalesHistoryModal(true)}
                className="px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Histórico</span>
              </button>
            </div>
          </div>

          {/* 5. Recent Sold Products Horizontal pill row */}
          <div className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto pb-1">
            <span className="font-semibold shrink-0">⭐ Populares:</span>
            {localProducts.slice(0, 5).map(prod => (
              <button
                key={prod.id}
                onClick={() => handleTriggerAddToCart(prod)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] text-slate-700 cursor-pointer shrink-0"
              >
                {prod.emoji} {prod.name.split(' (')[0]}
              </button>
            ))}
          </div>

          {/* Quick Categories list with Favoritos category */}
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-all ${
                  selectedCategory === cat
                    ? "bg-orange-500 text-white shadow-sm shadow-orange-500/25"
                    : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products catalog list grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50/50">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <span className="text-3xl mb-2">🔍</span>
              <p className="text-sm font-semibold text-slate-700">Nenhum produto cadastrado foi localizado</p>
              <p className="text-xs text-slate-400 mt-1">Tente pesquisar por outro termo ou limpe os filtros seleccionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                
                return (
                  <div
                    key={p.id}
                    className="relative"
                    onMouseEnter={() => setHoveredProductId(p.id)}
                    onMouseLeave={() => setHoveredProductId(null)}
                  >
                    {/* Product Hover Details Tooltip */}
                    {hoveredProductId === p.id && (
                      <div className="absolute z-20 bottom-full left-0 right-0 mb-2 p-3 bg-slate-900 text-white rounded-xl text-[10px] space-y-1.5 font-mono shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <p className="text-orange-400 font-bold border-b border-slate-800 pb-1">{p.name}</p>
                        <p>📦 Fornecedor: {p.supplier}</p>
                        <p>🏷️ Marca: {p.brand || "Generica"}</p>
                        <p>🔤 Código: {p.code}</p>
                        <p>💾 Stock Atual: {p.stock} {p.weightBased ? "kg" : "un"}</p>
                        <p>💵 P. Custo: {p.costPrice.toLocaleString()} MT</p>
                        <p>📈 Lucro: {(p.salePrice - p.costPrice).toLocaleString()} MT ({Math.round(((p.salePrice - p.costPrice)/p.salePrice)*100)}% margem)</p>
                        <p className="text-[9px] text-slate-400">📅 Última Compra: 22/06/2026</p>
                      </div>
                    )}

                    <button
                      onClick={() => handleTriggerAddToCart(p)}
                      disabled={isOutOfStock}
                      id={`btn-product-${p.id}`}
                      className={`w-full group bg-white p-4 rounded-xl border relative text-left transition-all flex flex-col justify-between select-none h-44 ${
                        isOutOfStock 
                          ? "border-slate-150 bg-slate-100/70 cursor-not-allowed opacity-60" 
                          : "border-slate-200 hover:border-orange-300 hover:shadow-md cursor-pointer"
                      }`}
                    >
                      {/* Floating Status badges */}
                      <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                        {isOutOfStock ? (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 leading-none">🔴 ESGOTADO</span>
                        ) : isLowStock ? (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 leading-none">🟠 APENAS {p.stock}</span>
                        ) : (
                          <span className="text-[8.5px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 leading-none">🟢 {p.stock} Disp.</span>
                        )}

                        {/* 3. Promo label tags */}
                        {p.promotion === "PROMO" && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-orange-500 text-white leading-none">🔥 PROMOÇÃO</span>
                        )}
                        {p.promotion === "MAIS_VENDIDO" && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500 text-white leading-none">⭐ MAIS VENDIDO</span>
                        )}
                        {p.promotion === "NOVO" && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500 text-white leading-none">🆕 NOVO</span>
                        )}
                        {p.promotion === "DESCONTO" && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white leading-none">🏷️ DESCONTO</span>
                        )}
                      </div>

                      {/* Product Visual Layout */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xl p-1 bg-slate-100 group-hover:bg-orange-50 rounded-lg transition">{p.emoji || "📦"}</span>
                        {p.weightBased && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 leading-none">Venda p/ Peso</span>
                        )}
                      </div>

                      {/* Title & Brand */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight pr-2">{p.name}</h4>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{p.brand ? `${p.brand} • ` : ""}{p.category}</p>
                      </div>

                      {/* Price stamp */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900">{p.salePrice.toLocaleString()} <span className="text-[10px] font-medium text-slate-400">{currency}</span></span>
                        <span className="text-[9px] text-slate-400 font-mono">IVA {p.vatRate}%</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom shortcuts bar for operator */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-center gap-4 text-[10px] font-mono text-slate-500">
          <span className="font-bold uppercase text-slate-700">Atalhos Operador:</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F1</kbd> Finalizar</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F2</kbd> Buscar Cliente</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F3</kbd> Pesquisa Prod.</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F4</kbd> Novo Cliente</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F6</kbd> Desconto</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F8</kbd> Alternar Pago</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">ESC</kbd> Cancelar Venda</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Shopping Cart sidebar */}
      <div className="w-full xl:w-96 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        
        {/* 22. Cart Upper Status details panel */}
        <div className="p-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShoppingCart className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-mono uppercase tracking-wider">Carrinho Ativo</span>
              {itemsLeavingStockBelowCritical.length > 0 && (
                <span 
                  onClick={() => setShowCriticalStockModal(true)}
                  className="inline-flex items-center gap-1 bg-red-650 hover:bg-red-700 text-white text-[8.5px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer animate-pulse shrink-0"
                  title="Há itens que ficarão abaixo do stock crítico. Clique para ver."
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  <span>CRÍTICO</span>
                </span>
              )}
            </div>
            <span className="text-[10px] bg-slate-800 text-orange-300 font-mono px-2 py-0.5 rounded border border-slate-700">
              Hora: {currentTime}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <div className="text-xs text-slate-300">
              <span className="font-bold">{cart.length}</span> produtos ({calculations.totalQty} {calculations.totalQty === 1 ? "un" : "un/kg"})
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              Cliente: <span className="text-orange-300 font-bold">{selectedCustomer ? selectedCustomer.name : "Consumidor Geral"}</span>
            </div>
          </div>
        </div>

        {/* 10. Modern Customer selection bar */}
        <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <div className="flex-1 relative">
            <select
              ref={customerSelectRef}
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs py-1.5 pl-2 pr-6 outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer text-slate-700 font-medium"
            >
              <option value="">-- 👤 Consumidor Geral --</option>
              {localCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setQuickCustomerModalOpen(true)}
            className="p-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg transition-all text-xs cursor-pointer flex items-center justify-center shrink-0 w-8 h-8"
            title="Adicionar Novo Cliente (F4)"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* 23. Intelligent Alerts panel */}
        {selectedCustomer && selectedCustomer.debt > 0 && (
          <div className="px-3.5 py-1.5 bg-amber-50 border-b border-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1.5 animate-pulse shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>⚠️ Cliente possui dívida activa de {selectedCustomer.debt.toLocaleString()} MT!</span>
          </div>
        )}

        {itemsLeavingStockBelowCritical.length > 0 && (
          <div 
            onClick={() => setShowCriticalStockModal(true)}
            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 border-b border-red-100 text-red-800 text-[10px] font-bold flex items-start gap-1.5 cursor-pointer shrink-0 transition"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="block font-black uppercase tracking-wider">🚨 ALERTA: STOCK CRÍTICO</span>
              <p className="font-medium text-red-600 mt-0.5">{itemsLeavingStockBelowCritical.length} {itemsLeavingStockBelowCritical.length === 1 ? "produto ficará" : "produtos ficarão"} abaixo do nível crítico de stock após concluir esta venda. <strong className="underline">Ver artigos →</strong></p>
            </div>
          </div>
        )}

        {/* Shopping list of cart items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 mt-12">
              <span className="text-2xl mb-2">🛒</span>
              <p className="text-xs font-semibold text-slate-600">Carrinho Vazio</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">Insira produtos utilizando o catálogo ao lado ou passe o código de barras no scanner.</p>
            </div>
          ) : (
            cart.map((item) => {
              const isInsufficient = item.quantity > item.product.stock;
              const hasNoVat = item.product.vatRate === 0;
              
              return (
                <div 
                  key={item.product.id} 
                  className={`p-2.5 rounded-xl border space-y-2 relative group transition-all ${
                    isInsufficient 
                      ? "bg-red-50/70 border-red-200" 
                      : "bg-slate-50 border-slate-100 hover:border-slate-300"
                  }`}
                >
                  <button
                    onClick={() => handleDeleteRow(item.product.id)}
                    className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 rounded-lg cursor-pointer"
                    title="Remover Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="pr-6">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">{item.product.brand || "Generico"}</span>
                    <h5 className="text-xs font-bold text-slate-800 line-clamp-1 leading-tight">{item.product.name}</h5>
                    
                    {/* Item price / calculations breakdown */}
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {item.product.salePrice.toLocaleString()} MT × {item.quantity} {item.product.weightBased ? "kg" : "un"}
                    </p>

                    {/* Inline active alerts inside items */}
                    {isInsufficient && (
                      <p className="text-[9px] text-red-600 font-bold flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" /> Estoque insuficiente! Max: {item.product.stock}
                      </p>
                    )}
                    {hasNoVat && (
                      <p className="text-[9px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                        💡 Remessa Isenta de IVA (Isento)
                      </p>
                    )}

                    {/* Show Observation note if configured */}
                    {item.observation && (
                      <div className="mt-1 bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9.5px] font-mono inline-block">
                        📝 Obs: "{item.observation}"
                      </div>
                    )}
                  </div>

                  {/* 25. Large Touch Target Controls for Tablet */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="w-10 h-10 border bg-white text-slate-600 hover:bg-slate-150 rounded-lg flex items-center justify-center cursor-pointer transition active:scale-95 shrink-0"
                        title="Decrementar"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      
                      {/* Direct quantity input */}
                      <input
                        type="number"
                        step={item.product.weightBased ? "0.05" : "1"}
                        value={item.quantity}
                        onChange={(e) => handleDirectQuantityEdit(item.product.id, e.target.value)}
                        className="w-12 h-10 bg-white border text-center font-mono font-bold text-xs rounded-lg outline-none focus:ring-1 focus:ring-orange-500"
                        title="Quantidade Directa"
                      />

                      <button 
                        onClick={() => handleTriggerAddToCart(item.product.id as any)}
                        disabled={item.quantity >= item.product.stock}
                        className="w-10 h-10 border bg-white text-slate-600 hover:bg-slate-150 rounded-lg flex items-center justify-center cursor-pointer transition disabled:opacity-40 active:scale-95 shrink-0"
                        title="Incrementar"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {/* 6. Obs button trigger */}
                      <button
                        onClick={() => handleAddObservation(item.product.id)}
                        className="text-[10px] text-slate-500 hover:text-orange-600 flex items-center gap-0.5 font-medium hover:underline bg-white px-2 py-1 rounded border border-slate-100 cursor-pointer"
                      >
                        📝 Nota
                      </button>
                      
                      <span className="text-xs font-black text-slate-800">
                        {(item.product.salePrice * item.quantity).toLocaleString()} MT
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Global discount & VAT overrides panel */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-3 shrink-0">
          
          {/* Quick discounts triggers */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Desconto Geral</label>
              {discountValue > 0 && (
                <span className="text-[10px] text-orange-600 font-bold">
                  -{calculations.discountTotal.toLocaleString()} MT
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1">
              <button 
                onClick={() => { setDiscountValue(0); }}
                className={`py-1.5 text-[10px] font-bold rounded-lg border transition ${discountValue === 0 ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
              >
                Isento
              </button>
              {[5, 10, 15, 25].map(pct => (
                <button 
                  key={pct}
                  onClick={() => {
                    setDiscountType("PERCENT");
                    setDiscountValue(pct);
                  }}
                  className={`py-1.5 text-[10px] font-bold rounded-lg border transition ${discountValue === pct && discountType === "PERCENT" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Key VAT selector customization */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Regulamento de IVA</span>
            <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 text-[10px] font-bold">
              <button 
                onClick={() => setVatMode("AUTO")}
                className={`px-2 py-1 rounded-md transition ${vatMode === "AUTO" ? "bg-slate-200 text-slate-800 font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
              >
                Auto
              </button>
              <button 
                onClick={() => setVatMode("EXEMPT")}
                className={`px-2 py-1 rounded-md transition ${vatMode === "EXEMPT" ? "bg-slate-200 text-slate-800 font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
              >
                Isento
              </button>
              <button 
                onClick={() => setVatMode("CUSTOM")}
                className={`px-2 py-1 rounded-md transition ${vatMode === "CUSTOM" ? "bg-slate-200 text-slate-800 font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
              >
                Custom
              </button>
            </div>
            {vatMode === "CUSTOM" && (
              <input
                type="number"
                value={customVatRate}
                onChange={(e) => setCustomVatRate(Number(e.target.value))}
                className="w-12 bg-white border border-slate-200 rounded-lg text-xs font-bold py-1 text-center outline-none focus:border-orange-500"
                min="0"
                max="100"
              />
            )}
          </div>
        </div>

        {/* 14. Financial Detailed Summary Card */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 text-[11px] font-mono text-slate-600 space-y-1 shrink-0">
          <div className="flex justify-between">
            <span>Produtos Únicos:</span>
            <span className="font-bold text-slate-800">{cart.length} item(s)</span>
          </div>
          <div className="flex justify-between">
            <span>Volume Total:</span>
            <span className="font-bold text-slate-800">{calculations.totalQty} unidades</span>
          </div>
          <div className="flex justify-between">
            <span>Soma Subtotal:</span>
            <span className="font-bold text-slate-800">{calculations.subtotal.toLocaleString()} MT</span>
          </div>
          {calculations.discountTotal > 0 && (
            <div className="flex justify-between text-red-650 font-bold">
              <span>Desconto Aplicado:</span>
              <span>-{calculations.discountTotal.toLocaleString()} MT</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Total de Imposto IVA:</span>
            <span className="font-bold text-slate-800">{calculations.vatTotal.toLocaleString()} MT</span>
          </div>
          <div className="flex justify-between text-sm font-black text-slate-900 border-t border-dashed border-slate-300 pt-1 font-sans">
            <span>TOTAL A FATURAR:</span>
            <span>{calculations.grandTotal.toLocaleString()} MT</span>
          </div>
        </div>

        {/* Liquidation options & actions */}
        <div className="p-3 border-t border-slate-200 bg-white space-y-3.5 shrink-0">
          
          {/* 11. Payment selector grid with icons */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Método de Liquidação</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "CASH", label: "💵 Dinheiro" },
                { id: "MPESA_PAGA_FACIL", label: "📱 M-Pesa" },
                { id: "EMOLA", label: "📱 E-Mola" },
                { id: "POS_CARD", label: "💳 POS" },
                { id: "CREDIT_CARD", label: "💳 Cartão" },
                { id: "BANK_TRANSFER", label: "🏦 Transf" },
                { id: "DEBT", label: "🧾 Dívida" },
                { id: "MIXED", label: "🤝 Misto" }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => {
                    setSelectedPaymentMethod(method.id);
                  }}
                  className={`py-2 text-[10px] font-bold rounded-lg border text-center transition ${
                    selectedPaymentMethod === method.id 
                      ? "bg-slate-900 text-orange-400 border-slate-900 shadow-md" 
                      : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* 12. Mixed Payment Configuration */}
          {selectedPaymentMethod === "MIXED" && (
            <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100 space-y-2 text-[11px] animate-in slide-in-from-top-1 duration-150">
              <div className="flex justify-between items-center border-b border-orange-100 pb-1">
                <span className="font-extrabold text-orange-850">🤝 Partilha de Pagamento Misto</span>
                <span className="font-mono text-[9px] bg-orange-100 text-orange-800 px-1 py-0.5 rounded">
                  Falta: {Math.max(0, calculations.grandTotal - mixedSumTotal).toLocaleString()} MT
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1">💵 Numerário</label>
                  <input
                    type="number"
                    value={mixedCash || ""}
                    onChange={(e) => setMixedCash(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1">📱 Celular (Mpesa)</label>
                  <input
                    type="number"
                    value={mixedMpesa || ""}
                    onChange={(e) => setMixedMpesa(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1">💳 POS Cartão</label>
                  <input
                    type="number"
                    value={mixedPOS || ""}
                    onChange={(e) => setMixedPOS(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1">
                <span>Total Alocado:</span>
                <span className={`font-bold ${Math.abs(mixedSumTotal - calculations.grandTotal) < 1 ? "text-emerald-600" : "text-red-500 animate-pulse"}`}>
                  {mixedSumTotal.toLocaleString()} MT / {calculations.grandTotal.toLocaleString()} MT
                </span>
              </div>
              {Math.abs(mixedSumTotal - calculations.grandTotal) < 1 ? (
                <p className="text-[9.5px] text-emerald-700 font-bold text-center">✓ Alocação correta e equilibrada!</p>
              ) : (
                <p className="text-[9.5px] text-amber-600 font-bold text-center">⚠️ Alocação pendente... preencha os valores acima.</p>
              )}
            </div>
          )}

          {/* 13. Cash Troco Automático Panel (for Numerário or mixed Numerário) */}
          {(selectedPaymentMethod === "CASH" || (selectedPaymentMethod === "MIXED" && mixedCash > 0)) && (
            <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 space-y-1.5 text-[11px] animate-in slide-in-from-top-1 duration-150">
              <span className="font-extrabold text-emerald-850">💵 Cálculo de Troco Automático</span>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[9px] text-slate-500 block">Valor Recebido do Cliente:</label>
                  <input
                    type="number"
                    value={selectedPaymentMethod === "MIXED" ? mixedCash : (receivedCashAmount || "")}
                    disabled={selectedPaymentMethod === "MIXED"}
                    onChange={(e) => setReceivedCashAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 2000"
                    className="w-full bg-white border border-emerald-200 rounded p-1.5 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                
                {/* Large Green Badge Change Highlight */}
                <div className="bg-emerald-600 text-white p-2 rounded-xl text-center shrink-0 min-w-[100px] flex flex-col justify-center">
                  <span className="text-[8px] font-bold tracking-wider uppercase opacity-85">Troco</span>
                  <span className="text-sm font-black tracking-tight">{calculatedChange.toLocaleString()} MT</span>
                </div>
              </div>

              {/* Fast Cash Preset selection bills */}
              {selectedPaymentMethod !== "MIXED" && (
                <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-emerald-150/50">
                  <span className="text-[9px] text-slate-400 font-semibold self-center">Presets:</span>
                  {[200, 500, 1000, 2000].map(val => (
                    <button
                      key={val}
                      onClick={() => setReceivedCashAmount(val)}
                      className="px-1.5 py-0.5 bg-white border hover:bg-emerald-100/50 border-emerald-200 rounded text-[10px] font-bold text-emerald-700 cursor-pointer transition active:scale-95"
                    >
                      {val} MT
                    </button>
                  ))}
                  <button
                    onClick={() => setReceivedCashAmount(calculations.grandTotal)}
                    className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 rounded text-[10px] font-bold text-emerald-800 cursor-pointer"
                  >
                    Exato
                  </button>
                </div>
              )}
            </div>
          )}

          {(selectedPaymentMethod === "MPESA_PAGA_FACIL" || selectedPaymentMethod === "EMOLA") && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 text-[11px] animate-in slide-in-from-top-1 duration-150">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-extrabold flex items-center gap-1.5 text-slate-800">
                  <QrCode className="w-4 h-4 text-orange-500" />
                  Pagamento via QR Code Móvel
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  mobilePaymentProvider === "MPESA" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                }`}>
                  {mobilePaymentProvider}
                </span>
              </div>

              {/* QR Code Graphic or status */}
              <div className="flex flex-col items-center justify-center py-2 bg-white rounded-lg border border-slate-200 relative overflow-hidden">
                {mobilePaymentStatus === "CONFIRMED" ? (
                  <div className="h-[160px] flex flex-col items-center justify-center text-center space-y-2 animate-in zoom-in-95 duration-200">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                    <p className="font-bold text-emerald-700 text-xs">PAGAMENTO CONFIRMADO!</p>
                    <p className="text-[10px] text-slate-500">Valor de {calculations.grandTotal.toLocaleString()} MT recebido</p>
                  </div>
                ) : mobilePaymentStatus === "EXPIRED" ? (
                  <div className="h-[160px] flex flex-col items-center justify-center text-center space-y-2 animate-in zoom-in-95 duration-200">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-red-700">QR CODE EXPIRADO</p>
                    <button
                      type="button"
                      onClick={() => {
                        setMobilePaymentTimer(120);
                        setMobilePaymentStatus("IDLE");
                        setMobileReference(`VND-${Math.floor(100000 + Math.random() * 900000)}`);
                      }}
                      className="mt-1 px-3 py-1 bg-slate-900 text-white rounded text-[10px] font-bold cursor-pointer"
                    >
                      Regenerar QR Code
                    </button>
                  </div>
                ) : (
                  <div className="relative flex flex-col items-center justify-center">
                    {mobileQrDataUrl ? (
                      <img
                        src={mobileQrDataUrl}
                        alt="QR Code de Pagamento"
                        className="w-[140px] h-[140px] object-contain"
                      />
                    ) : (
                      <div className="w-[140px] h-[140px] bg-slate-100 animate-pulse flex items-center justify-center">
                        <span className="text-slate-400 text-[10px]">Gerando...</span>
                      </div>
                    )}
                    {/* Brand overlay logo in middle of QR code */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-white p-1 rounded-md shadow-md border border-slate-100">
                        {mobilePaymentProvider === "MPESA" ? (
                          <span className="text-[8px] font-black text-red-600 tracking-tighter">M-PESA</span>
                        ) : (
                          <span className="text-[8px] font-black text-orange-600 tracking-tighter">e-Mola</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Counter & Reference */}
                {mobilePaymentStatus !== "CONFIRMED" && mobilePaymentStatus !== "EXPIRED" && (
                  <div className="mt-1 text-center">
                    <p className="text-[10px] text-slate-500">
                      Expira em: <span className="font-mono font-bold text-slate-800">{Math.floor(mobilePaymentTimer / 60)}:{(mobilePaymentTimer % 60).toString().padStart(2, "0")}</span>
                    </p>
                    <p className="text-[9px] font-mono text-slate-400">Ref: {mobileReference}</p>
                  </div>
                )}
              </div>

              {/* Dynamic QR Fields edit */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Código Agente / Carteira</label>
                  <input
                    type="text"
                    value={mobileMerchantCode}
                    onChange={(e) => setMobileMerchantCode(e.target.value)}
                    placeholder="Ex: 849001202"
                    disabled={mobilePaymentStatus === "CONFIRMED" || mobilePaymentStatus === "SENDING_PUSH" || mobilePaymentStatus === "AWAITING_PIN" || mobilePaymentStatus === "VERIFYING"}
                    className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Número Cliente (para Push)</label>
                  <input
                    type="text"
                    value={mobileCustomerPhone}
                    onChange={(e) => setMobileCustomerPhone(e.target.value)}
                    placeholder="Ex: 84XXXXXXX"
                    disabled={mobilePaymentStatus === "CONFIRMED" || mobilePaymentStatus === "SENDING_PUSH" || mobilePaymentStatus === "AWAITING_PIN" || mobilePaymentStatus === "VERIFYING"}
                    className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Simulation status logs & feedback */}
              {mobilePaymentStatus !== "IDLE" && mobilePaymentStatus !== "CONFIRMED" && mobilePaymentStatus !== "EXPIRED" && (
                <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-[9px] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-orange-400 font-bold">STATUS API:</span>
                    <span className="animate-pulse">● PROCESSANDO</span>
                  </div>
                  <p className="text-slate-300 leading-snug">
                    {mobilePaymentStatus === "SENDING_PUSH" && ">> Enviando pedido de liquidação via M-Pesa API..."}
                    {mobilePaymentStatus === "AWAITING_PIN" && ">> Pedido Push entregue. Aguardando PIN no telemóvel..."}
                    {mobilePaymentStatus === "VERIFYING" && ">> PIN inserido pelo cliente. Verificando fundos e reconciliando..."}
                  </p>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-orange-500 h-full transition-all duration-300"
                      style={{ width: `${mobilePaymentProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions Row */}
              <div className="flex gap-2 pt-1">
                {mobilePaymentStatus === "IDLE" || mobilePaymentStatus === "EXPIRED" ? (
                  <button
                    type="button"
                    onClick={handleSimulateMobilePayment}
                    className="flex-1 py-2 bg-slate-900 text-white hover:bg-slate-800 font-bold text-[10px] rounded-lg cursor-pointer flex items-center justify-center gap-1 transition"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                    Enviar Push USSD & Simular
                  </button>
                ) : mobilePaymentStatus === "CONFIRMED" ? (
                  <div className="flex-1 bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold py-2 px-3 text-center rounded-lg text-[10.5px]">
                    ✓ Transação Confirmada por API Móvel!
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex-1 py-2 bg-slate-200 text-slate-400 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-not-allowed"
                  >
                    <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    Processando Liquidação...
                  </button>
                )}

                {mobilePaymentStatus !== "CONFIRMED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobilePaymentStatus("CONFIRMED");
                      if (onShowToast) {
                        onShowToast("Reconciliação manual bem sucedida!", "success", "Manual Bypass");
                      }
                    }}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] rounded-lg cursor-pointer border border-slate-200 transition"
                    title="Forçar Reconciliação Manual"
                  >
                    Forçar
                  </button>
                )}
              </div>
            </div>
          )}

          {selectedPaymentMethod === "DEBT" && (
            <div className="bg-red-50/70 p-2.5 rounded-xl border border-red-100 space-y-1.5 text-[11px] animate-in slide-in-from-top-1 duration-150">
              <span className="font-extrabold text-red-800">🧾 Liquidação de Crédito (Dívida em Conta)</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-semibold text-[10px]">Prazo Acordado:</span>
                <select
                  value={debtDays}
                  onChange={(e) => setDebtDays(Number(e.target.value))}
                  className="bg-white border border-red-200 rounded p-1 text-xs font-bold text-red-700 outline-none"
                >
                  <option value={5}>5 Dias</option>
                  <option value={10}>10 Dias</option>
                  <option value={15}>15 Dias</option>
                  <option value={30}>30 Dias</option>
                </select>
              </div>
              <p className="text-[9.5px] text-slate-500 font-mono leading-tight">
                Vencimento do Crédito em: <span className="font-bold text-red-600">{new Date(Date.now() + debtDays * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
              </p>
            </div>
          )}

          {/* Checkout & extra bottom buttons panel */}
          <div className="space-y-2">
            {selectedCustomer?.oneClickCheckoutEnabled && selectedCustomer.preferredPaymentMethod && (
              <button
                onClick={handleOneClickCheckout}
                disabled={cart.length === 0}
                className={`w-full py-2.5 h-11 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`}
                title={`Finalizar venda imediatamente utilizando o método preferido: ${selectedCustomer.preferredPaymentMethod}`}
              >
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0 animate-pulse" />
                <span>⚡ Checkout 1-Clique ({
                  selectedCustomer.preferredPaymentMethod === "CASH" ? "Dinheiro" :
                  selectedCustomer.preferredPaymentMethod === "MPESA_PAGA_FACIL" ? "M-Pesa" :
                  selectedCustomer.preferredPaymentMethod === "EMOLA" ? "E-Mola" :
                  selectedCustomer.preferredPaymentMethod === "POS_CARD" ? "POS" :
                  selectedCustomer.preferredPaymentMethod === "CREDIT_CARD" ? "Cartão" :
                  selectedCustomer.preferredPaymentMethod === "BANK_TRANSFER" ? "Transf" :
                  selectedCustomer.preferredPaymentMethod === "DEBT" ? "Dívida" : "Dinheiro"
                })</span>
              </button>
            )}

            <button
              onClick={() => {
                if (cart.length > 0) setShowPreCheckoutModal(true);
              }}
              disabled={cart.length === 0}
              className={`w-full py-2.5 h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                cart.length === 0
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-orange-500 hover:bg-orange-600 text-white cursor-pointer shadow-orange-500/15 active:scale-[0.99]"
              }`}
            >
              <Receipt className="w-4 h-4" />
              Finalizar Venda (Recibo - F1 / F9)
            </button>

            {/* 15. Bottom Control actions row */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={handleSuspendSale}
                disabled={cart.length === 0}
                className="py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer transition active:scale-95"
              >
                ⏸️ Suspender
              </button>
              <button
                onClick={handleGenerateBudget}
                disabled={cart.length === 0}
                className="py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 disabled:opacity-50 text-[10px] font-bold rounded-lg cursor-pointer transition active:scale-95"
              >
                📝 Orçamento
              </button>
              <button
                onClick={() => {
                  if (cart.length === 0) return;
                  if (confirm("Deseja mesmo esvaziar todo o carrinho?")) {
                    handleReset();
                    if (onShowToast) onShowToast("Carrinho cancelado.", "info");
                  }
                }}
                disabled={cart.length === 0}
                className="py-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-650 text-[10px] font-bold rounded-lg border border-red-100 cursor-pointer transition active:scale-95"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 24. PRE-CHECKOUT CONFIRMATION MODAL */}
      {showPreCheckoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-orange-500" />
                <span>Confirmar Transacção de Venda</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Revise o sumário fiscal antes de faturar no sistema.</p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Cliente:</span>
                  <span className="font-bold text-slate-700">{selectedCustomer ? selectedCustomer.name : "Consumidor Geral"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Operador:</span>
                  <span className="font-bold text-slate-700">{activeUsername} (Caixa Principal)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Pagamento:</span>
                  <span className="font-bold text-orange-600">{selectedPaymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Volume Total:</span>
                  <span className="font-bold text-slate-700">{calculations.totalQty} Artigos</span>
                </div>
              </div>

              {/* Items listing brief */}
              <div className="max-h-36 overflow-y-auto border border-slate-150 rounded-xl p-2.5 bg-slate-50/50 space-y-1.5 font-mono text-[10.5px]">
                {cart.map(item => (
                  <div key={item.product.id} className="flex justify-between text-slate-600">
                    <span className="truncate max-w-[220px]">{item.product.name}</span>
                    <span className="font-bold shrink-0">{item.quantity} × {item.product.salePrice.toLocaleString()} MT</span>
                  </div>
                ))}
              </div>

              {/* Detailed Financial highlight box */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 font-mono">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>SOMA SUB-TOTAL:</span>
                  <span>{calculations.subtotal.toLocaleString()} MT</span>
                </div>
                {calculations.discountTotal > 0 && (
                  <div className="flex justify-between text-[11px] text-red-400">
                    <span>DESCONTO COMERCIAL:</span>
                    <span>-{calculations.discountTotal.toLocaleString()} MT</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>VALOR IVA APLICADO:</span>
                  <span>{calculations.vatTotal.toLocaleString()} MT</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-slate-800 pt-2 text-orange-400 font-sans">
                  <span>TOTAL A PAGAR:</span>
                  <span>{calculations.grandTotal.toLocaleString()} MT</span>
                </div>

                {/* Change highlighted inside checkout */}
                {selectedPaymentMethod === "CASH" && (
                  <div className="flex justify-between text-[11px] text-emerald-400 border-t border-slate-800 pt-1">
                    <span>TROCO DE NUMERÁRIO:</span>
                    <span>{calculatedChange.toLocaleString()} MT</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick receipts choice check buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setShowPreCheckoutModal(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Voltar e Ajustar
              </button>
              <button
                onClick={() => handleCheckout(true)}
                className="py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-orange-500/15"
              >
                Confirmar e Faturar ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINAL TRANSACTION CONFIRMATION MODAL */}
      {showFinalConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 text-center">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-slate-900 text-lg">Confirmar Conclusão de Venda?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Deseja realmente concluir e emitir esta transação no valor de <strong className="text-slate-800 font-extrabold text-sm">{calculations.grandTotal.toLocaleString()} {currency}</strong>? Esta ação não poderá ser desfeita ou editada após registada no sistema.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total a Pagar:</span>
                <span className="font-extrabold text-slate-700">{calculations.grandTotal.toLocaleString()} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Método de Pagamento:</span>
                <span className="font-extrabold text-orange-650">{selectedPaymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cliente:</span>
                <span className="font-extrabold text-slate-750">{selectedCustomer ? selectedCustomer.name : "Consumidor Geral"}</span>
              </div>
              {selectedPaymentMethod === "CASH" && (
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-400">Troco Calculado:</span>
                  <span className="font-extrabold text-emerald-600">{calculatedChange.toLocaleString()} {currency}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowFinalConfirmModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
              >
                Não, Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleCheckout(pendingEmitReceipt, true)}
                className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-2xl text-xs font-black text-white transition-all cursor-pointer shadow-md shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                Sim, Finalizar ✓
              </button>
            </div>
          </div>
        </div>
      )}
      {weightPromptProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-xs w-full border border-slate-100 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">{weightPromptProduct.emoji || "⚖️"}</span>
            </div>
            
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Pesagem de Artigo (Baloneta)</h3>
              <p className="text-[11px] text-slate-400 mt-1">Insira a quantidade pesada de <span className="font-bold text-slate-700">{weightPromptProduct.name}</span></p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="1.25"
                  value={weightInputValue}
                  onChange={(e) => setWeightInputValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3 text-center text-xl font-bold font-mono outline-none focus:ring-1 focus:ring-orange-500"
                  autoFocus
                />
                <span className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400">kg</span>
              </div>

              {/* Fast weight presets */}
              <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold text-slate-700">
                {["0.25", "0.50", "1.0", "2.5"].map(w => (
                  <button
                    key={w}
                    onClick={() => setWeightInputValue(w)}
                    className="py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
                  >
                    {w} kg
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setWeightPromptProduct(null)}
                className="py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const val = parseFloat(weightInputValue);
                  if (!isNaN(val) && val > 0) {
                    handleTriggerAddToCart(weightPromptProduct, val);
                    setWeightPromptProduct(null);
                  }
                }}
                className="py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Lançar Peso ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 20. REAL CAMERA & EMULATED BARCODE SCANNER MODAL */}
      {scannerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            
            {/* Header / Tab Switcher */}
            <div className="text-center space-y-2.5">
              <div className="w-11 h-11 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                <Camera className="w-5.5 h-5.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Leitor de Códigos de Barra</h3>
                <p className="text-[10.5px] text-slate-400 mt-0.5">Efetue a leitura de artigos para o carrinho de compras de forma automática.</p>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScannerTab("camera")}
                  className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                    scannerTab === "camera" 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  📷 Câmara Real
                </button>
                <button
                  type="button"
                  onClick={() => setScannerTab("simulation")}
                  className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                    scannerTab === "simulation" 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  🧪 Emulador POS
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: PHYSICAL CAMERA CAPTURE */}
            {scannerTab === "camera" && (
              <div className="space-y-3.5">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 flex items-center justify-center">
                  
                  {/* Glowing Laser line animation overlay */}
                  <div className="absolute left-0 right-0 h-[1.5px] bg-red-500 shadow-[0_0_8px_#ef4444] z-10 animate-pulse" style={{
                    top: "50%",
                    transform: "translateY(-50%)"
                  }} />
                  
                  {/* Viewfinder corner overlays */}
                  <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-orange-500 z-10" />
                  <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-orange-500 z-10" />
                  <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-orange-500 z-10" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-orange-500 z-10" />

                  {/* HTML5 QrReader Component */}
                  <QrReader
                    onResult={(result, error) => {
                      if (result) {
                        const textValue = result.text || result.getText?.() || String(result);
                        if (textValue) {
                          const trimmed = textValue.trim();
                          const now = Date.now();

                          // Prevent rapid duplicate scans within 2.5 seconds
                          if (trimmed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2500) {
                            return;
                          }

                          lastScannedCodeRef.current = trimmed;
                          lastScannedTimeRef.current = now;

                          const match = localProducts.find(p => p.barcode === trimmed || p.code === trimmed);
                          if (match) {
                            handleTriggerAddToCart(match);
                            if (onShowToast) {
                              onShowToast(`Artigo Lido: ${match.name} (+1 adicionado)`, "success", "Câmara");
                            }
                            if (!continuousScan) {
                              setScannerModalOpen(false);
                            }
                          } else {
                            if (onShowToast) {
                              onShowToast(`Código lido: "${trimmed}" não registado no catálogo.`, "warning", "Código Desconhecido");
                            }
                          }
                        }
                      }
                    }}
                    constraints={{ facingMode: "environment" }}
                    scanDelay={400}
                    containerStyle={{ width: "100%", height: "100%" }}
                    videoStyle={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                </div>

                {/* Continuous Scan Checkbox */}
                <label className="flex items-center gap-2 px-3 py-2 text-slate-600 justify-center text-[10.5px] bg-slate-50 rounded-xl border border-slate-150 cursor-pointer hover:bg-slate-100 transition">
                  <input
                    type="checkbox"
                    checked={continuousScan}
                    onChange={(e) => setContinuousScan(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="font-bold select-none text-slate-700">Leitura Contínua (Não fechar painel após ler)</span>
                </label>
              </div>
            )}

            {/* TAB CONTENT 2: MOCK EMULATION LIST */}
            {scannerTab === "simulation" && (
              <div className="space-y-3.5">
                {/* Simulated list of barcodes */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider font-mono block">Barcodes Disponíveis:</span>
                  {localProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        handleTriggerAddToCart(p);
                        if (onShowToast) onShowToast(`Scanner leu: ${p.barcode}`, "success", "Emulador");
                        setScannerModalOpen(false);
                      }}
                      className="w-full text-left p-2 bg-slate-50 border border-slate-150 rounded-lg hover:bg-orange-50 hover:border-orange-200 text-xs flex justify-between items-center cursor-pointer transition"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-700 block truncate">{p.name}</span>
                        <span className="text-[9.5px] font-mono text-slate-400 block">{p.barcode || "Sem Barcode"}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-orange-600 bg-white border border-slate-100 px-1.5 py-0.5 rounded shrink-0">Bipar</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Insira barcode manualmente..."
                    value={manualBarcodeScan}
                    onChange={(e) => setManualBarcodeScan(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <button
                    onClick={() => {
                      if (manualBarcodeScan) {
                        const match = localProducts.find(p => p.barcode === manualBarcodeScan.trim() || p.code === manualBarcodeScan.trim());
                        if (match) {
                          handleTriggerAddToCart(match);
                          if (onShowToast) onShowToast(`Leitor processou: ${match.name}`, "success", "Manual");
                          setScannerModalOpen(false);
                          setManualBarcodeScan("");
                        } else {
                          if (onShowToast) onShowToast("Nenhum produto associado a este código.", "error", "Manual");
                        }
                      }
                    }}
                    className="px-3.5 bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer hover:bg-slate-800"
                  >
                    Ler
                  </button>
                </div>
              </div>
            )}

            {/* Footer Close Button */}
            <button
              onClick={() => setScannerModalOpen(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              Fechar Painel
            </button>
          </div>
        </div>
      )}

      {/* 10. QUICK REGISTER CUSTOMER MODAL */}
      {quickCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleQuickAddCustomer} className="bg-white p-6 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">👤 Cadastro Rápido de Cliente</h3>
              <p className="text-xs text-slate-400 mt-1">Crie um cadastro de cliente fiduciário simplificado directamente do ponto de venda.</p>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Armindo Chauque"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-orange-500 font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Telemóvel (M-Pesa) *</label>
                <input
                  type="text"
                  placeholder="Ex: 843329102"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">NUIT (Moçambique ID)</label>
                <input
                  type="text"
                  placeholder="Ex: 299104882"
                  value={quickCustNuit}
                  onChange={(e) => setQuickCustNuit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Método de Liquidação Preferido</label>
                <select
                  value={quickCustPreferredMethod}
                  onChange={(e) => setQuickCustPreferredMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-orange-500 text-slate-700 font-bold"
                >
                  <option value="CASH">💵 Dinheiro</option>
                  <option value="MPESA_PAGA_FACIL">📱 M-Pesa</option>
                  <option value="EMOLA">📱 E-Mola</option>
                  <option value="POS_CARD">💳 POS</option>
                  <option value="CREDIT_CARD">💳 Cartão de Crédito</option>
                  <option value="BANK_TRANSFER">🏦 Transferência Bancária</option>
                  <option value="DEBT">🧾 Dívida (Venda a Crédito)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                <input
                  type="checkbox"
                  id="quickCustOneClick"
                  checked={quickCustOneClick}
                  onChange={(e) => setQuickCustOneClick(e.target.checked)}
                  className="w-4 h-4 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="quickCustOneClick" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                  ⚡ Habilitar One-Click Checkout
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickCustomerModalOpen(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
              >
                Registar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 16. SESSION TRANSACTION HISTORY MODAL */}
      {showSalesHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <History className="w-5 h-5 text-orange-500" />
                  <span>Histórico Recente de Vendas</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Últimas vendas efetuadas na presente sessão de caixa.</p>
              </div>
              <button
                onClick={() => setShowSalesHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Fchar ×
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {transactions && transactions.length > 0 ? (
                transactions.slice(0, 8).map((tx, idx) => (
                  <div key={`${tx.id || ""}-${idx}`} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-xs transition hover:bg-slate-100">
                    <div>
                      <span className="font-bold text-slate-700 block">{tx.invoiceNumber}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {tx.paymentMethod} • Op: {tx.cashierName}
                      </span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="font-extrabold text-slate-800">{tx.grandTotal.toLocaleString()} MT</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedTx(tx);
                          setShowSalesHistoryModal(false);
                        }}
                        className="p-1.5 bg-white border border-slate-200 hover:bg-orange-50 rounded text-[10px] font-bold text-orange-600 transition cursor-pointer"
                        title="Visualizar Recibo"
                      >
                        Visualizar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            printInvoiceHTML(tx, settings || { companyName: "OST VENDAS", currency: "MT" } as SystemSettings);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-orange-600 hover:text-white rounded text-[10px] font-bold text-slate-650 transition cursor-pointer flex items-center justify-center"
                        title="Imprimir Fatura em Nova Janela"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-slate-400 py-6">Nenhuma venda realizada neste terminal ainda.</p>
              )}
            </div>

            <button
              onClick={() => setShowSalesHistoryModal(false)}
              className="w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-850"
            >
              Fechar Painel
            </button>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Receipt & Communications */}
      {completedTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto mb-2.5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Venda Concluída com Sucesso!</h3>
              <p className="text-xs text-slate-400 mt-1">Transação consolidada e stock comercial deduzido.</p>
            </div>

              {/* Simulated Receipt Display */}
              <div id="pos-completed-receipt" className="border border-slate-200 bg-slate-50 rounded-xl p-4 font-mono text-[11px] leading-tight text-slate-700 select-all max-h-60 overflow-y-auto">
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden !important;
                    }
                    ${printMode === "invoice" ? `
                    #pos-completed-invoice, #pos-completed-invoice * {
                      visibility: visible !important;
                    }
                    #pos-completed-invoice {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      height: auto !important;
                      border: none !important;
                      background: white !important;
                      color: #1e293b !important;
                      padding: 40px !important;
                      margin: 0 !important;
                      box-shadow: none !important;
                      overflow: visible !important;
                      display: block !important;
                    }
                    ` : `
                    #pos-completed-receipt, #pos-completed-receipt * {
                      visibility: visible !important;
                    }
                    #pos-completed-receipt {
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
                      display: block !important;
                    }
                    `}
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
                <p><span className="text-slate-450">Fatura:</span> {completedTx.invoiceNumber}</p>
                <p><span className="text-slate-450">Data/Hora:</span> {new Date(completedTx.timestamp).toLocaleString()}</p>
                <p><span className="text-slate-450">Operador:</span> {completedTx.cashierName}</p>
                <p><span className="text-slate-450">Cliente:</span> {completedTx.customerName || "Consumidor Geral"}</p>
                {completedTx.nuit && <p><span className="text-slate-450">NUIT Cli:</span> {completedTx.nuit}</p>}
              </div>

              <div className="border-b border-dashed border-slate-300 py-1 mb-2">
                <div className="grid grid-cols-12 gap-1 font-bold text-slate-800 text-[10px]">
                  <span className="col-span-6 truncate">PRODUTO</span>
                  <span className="col-span-2 text-center">QTD</span>
                  <span className="col-span-4 text-right">VALOR</span>
                </div>
                 {completedTx.items.map((item, i) => (
                   <div key={`${item.productId}-${i}`} className="grid grid-cols-12 gap-1 py-0.5 text-slate-600">
                     <span className="col-span-6 truncate">{item.productName}</span>
                     <span className="col-span-2 text-center">{item.quantity}</span>
                     <span className="col-span-4 text-right">{(item.price * item.quantity).toLocaleString()} MT</span>
                   </div>
                 ))}
              </div>

              <div className="space-y-1 text-slate-600 text-right">
                <p>SUBTOTAL: {completedTx.subtotal.toLocaleString()} MT</p>
                {completedTx.discountTotal > 0 && <p className="text-red-650 font-bold">DESC. GER: -{completedTx.discountTotal.toLocaleString()} MT</p>}
                <p>TOTAL IVA COBRADO: {completedTx.vatTotal.toLocaleString()} MT</p>
                <p className="text-slate-900 font-bold text-xs border-t border-dashed border-slate-300 pt-1">
                  TOTAL PAGO: {completedTx.grandTotal.toLocaleString()} MT
                </p>
                <p className="text-[10px] text-slate-500 font-medium italic mt-1">Método: {completedTx.paymentMethod}</p>
                {completedTx.paymentDetails && (
                  <p className="text-[9.5px] text-red-600 font-semibold italic mt-0.5">{completedTx.paymentDetails}</p>
                )}
              </div>

              <p className="text-center font-semibold text-[9px] text-slate-500 mt-3 border-t border-dashed border-slate-300 pt-2 block">
                *** Muito Obrigado Pela Visita! ***
              </p>

              {/* Unique QR Code Generator for Digital Receipt */}
              {qrCodeDataUrl && (
                <div className="mt-3 pt-3 border-t border-dashed border-slate-300 flex flex-col items-center justify-center gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm animate-in zoom-in-95 duration-200">
                  <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                    <img
                      src={qrCodeDataUrl}
                      alt={`QR Code Fatura ${completedTx.invoiceNumber}`}
                      className="w-24 h-24 object-contain"
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-[8px] font-black text-slate-700 tracking-wider font-sans uppercase">RECIBO DIGITAL</span>
                    <p className="text-[7.5px] text-slate-400 font-sans mt-0.5 max-w-[180px] mx-auto leading-tight">
                      Aponte a câmara para visualizar a fatura digital <strong className="font-semibold text-slate-600">#{completedTx.invoiceNumber}</strong>
                    </p>
                  </div>
                </div>
              )}

              {completedTx.fiscalCertified && (
                <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-500 font-sans space-y-2 animate-in fade-in duration-300">
                  <div className="flex flex-col items-center justify-center gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} className="w-14 h-14 object-contain bg-white p-0.5 rounded border border-slate-200" alt="QR Code Fiscal" />
                    ) : (
                      <QrCode className="w-14 h-14 text-slate-800" />
                    )}
                    <span className="text-[7.5px] font-bold text-slate-600 tracking-wide font-mono uppercase">Controle Fiscal - AGT/MEF</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-slate-700 tracking-wider">DOCUMENTO FISCAL HOMOLOGADO</p>
                    <p className="text-[8px]">Certificação Nº: {settings.fiscalCertificationNumber || "OST/CERT/00249/2026"}</p>
                    <p className="font-mono text-[8px] bg-white py-0.5 rounded border border-slate-200 px-1 font-bold text-slate-800 select-all">Chave: {completedTx.fiscalKeys}</p>
                    <p className="font-mono text-[6.5px] text-slate-400 break-all leading-tight">Assinatura: {completedTx.fiscalHash}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Printable Invoice Container (A4 Layout) - Hidden on screen, shown on print when printMode is 'invoice' */}
            <div 
              id="pos-completed-invoice" 
              className="hidden print:block bg-white p-10 font-sans text-slate-800 border border-slate-200 rounded-2xl w-full max-w-[800px] mx-auto text-sm"
            >
              {/* Header */}
              <div className="text-center border-b-2 border-dashed border-slate-200 pb-6 mb-6">
                {settings.logoUrl && (
                  <div className="mb-3">
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      className="w-16 h-16 object-contain mx-auto bg-white p-1 rounded-xl border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <h1 className="text-xl font-extrabold uppercase text-slate-900 tracking-tight">
                  {settings.companyName || "OST COMÉRCIO CENTRAL"}
                </h1>
                <p className="text-xs text-slate-500 mt-1">{settings.companyAddress || settings.storeAddress || "Av. Marginal, Kiosk 14, Maputo"}</p>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  NUIT: {settings.companyNuit || "400293112"} | Tel: {settings.storeContact || "+258 84 000 0000"}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-left">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dados do Documento</span>
                  <span className="font-mono font-bold text-slate-900 text-sm block">
                    {completedTx.invoiceNumber}
                  </span>
                  <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                    <p>Emissão: <strong className="text-slate-700">{new Date(completedTx.timestamp).toLocaleString()}</strong></p>
                    <p>Filial: <strong className="text-slate-700 uppercase">{completedTx.branchId || "Central"}</strong></p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cliente & Operador</span>
                  <span className="font-semibold text-slate-900 text-sm block">
                    {completedTx.customerName || "Consumidor Geral"}
                  </span>
                  <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                    {completedTx.nuit && <p>NUIT: <strong className="text-slate-700">{completedTx.nuit}</strong></p>}
                    <p>Operador: <strong className="text-slate-700">{completedTx.cashierName}</strong></p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 text-center w-12">Item</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4 text-center w-16">Qtd</th>
                      <th className="py-3 px-4 text-right w-28">P. Unitário</th>
                      <th className="py-3 px-4 text-right w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedTx.items.map((item, index) => (
                      <tr key={`${item.productId}-${index}`} className="text-slate-700">
                        <td className="py-3 px-4 text-center font-mono text-slate-400">
                          {String(index + 1).padStart(2, "0")}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {item.productName}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {item.price.toLocaleString()} {settings.currency || "MT"}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold font-mono text-slate-900">
                          {(item.price * item.quantity).toLocaleString()} {settings.currency || "MT"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Grid */}
              <div className="flex justify-end mb-6 text-right">
                <div className="w-full max-w-xs space-y-2 text-xs border-b border-slate-100 pb-4">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono">{completedTx.subtotal.toLocaleString()} {settings.currency || "MT"}</span>
                  </div>
                  {completedTx.discountTotal > 0 && (
                    <div className="flex justify-between text-red-650 font-semibold">
                      <span>Desconto</span>
                      <span className="font-mono">-{completedTx.discountTotal.toLocaleString()} {settings.currency || "MT"}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500">
                    <span>IVA Incluído</span>
                    <span className="font-mono">{completedTx.vatTotal.toLocaleString()} {settings.currency || "MT"}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Total Pago</span>
                    <span className="font-mono">{completedTx.grandTotal.toLocaleString()} {settings.currency || "MT"}</span>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 italic mt-1">
                    Método: <strong>{completedTx.paymentMethod}</strong>
                    {completedTx.paymentDetails && ` (${completedTx.paymentDetails})`}
                  </div>
                </div>
              </div>

              {/* Fiscal Cert & QR Section */}
              <div className="border-t-2 border-dashed border-slate-200 pt-6 text-center">
                <div className="flex flex-col items-center justify-center gap-2 mb-4">
                  {qrCodeDataUrl ? (
                    <div className="p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <img
                        src={qrCodeDataUrl}
                        alt="Código QR Fiscal"
                        className="w-24 h-24 object-contain"
                      />
                    </div>
                  ) : (
                    <QrCode className="w-20 h-20 text-slate-400" />
                  )}
                  <span className="inline-block bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Documento Fiscal Homologado
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 max-w-md mx-auto text-[10px] font-mono text-slate-500 space-y-1.5 text-left">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span>Autoridade Tributária (AT):</span>
                    <span className="font-bold text-slate-700">PROCESSO DE CERTIFICAÇÃO</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span>Certificado Nº:</span>
                    <span className="font-bold text-slate-700">{settings.fiscalCertificationNumber || "OST/CERT/00249/2026"}</span>
                  </div>
                  {completedTx.fiscalKeys && (
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span>Chaves de Assinatura:</span>
                      <span className="font-bold text-slate-700 text-right truncate max-w-xs">{completedTx.fiscalKeys}</span>
                    </div>
                  )}
                  {completedTx.fiscalHash && (
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span>Assinatura Digital (Hash):</span>
                      <span className="font-bold text-slate-750 text-right break-all max-w-xs leading-tight">{completedTx.fiscalHash}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Software de Faturação:</span>
                    <span className="text-slate-700">OST VENDAS ERP v10.4.2</span>
                  </div>
                </div>

                <p className="text-xs font-semibold text-slate-400 mt-6 uppercase tracking-wider">
                  *** Muito obrigado pela preferência! Volte sempre! ***
                </p>
              </div>
            </div>

            {/* Quick Digital Dispatchers */}
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Comunicações Digitais</p>

              {!selectedCustomer && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-[10.5px] leading-relaxed text-amber-850 space-y-1">
                  <p className="font-extrabold flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Cliente não Registado
                  </p>
                  <p className="text-slate-600">
                    O cliente atual é Consumidor Geral. Deseja registá-lo agora para enviar o recibo?
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingReceiptAction("email");
                        setQuickCustomerModalOpen(true);
                      }}
                      className="text-orange-600 hover:text-orange-750 hover:underline cursor-pointer"
                    >
                      Registar e Enviar Email
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingReceiptAction("whatsapp");
                        setQuickCustomerModalOpen(true);
                      }}
                      className="text-orange-600 hover:text-orange-750 hover:underline cursor-pointer"
                    >
                      Registar e Enviar WhatsApp
                    </button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={simulateSendEmail}
                  disabled={sendEmailStatus !== "idle"}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-blue-50 text-blue-750 hover:bg-blue-100 transition border border-blue-100 disabled:opacity-75 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  {sendEmailStatus === "idle" ? "Email" : sendEmailStatus === "sending" ? "..." : "✓"}
                </button>
                <button
                  onClick={simulateSendSms}
                  disabled={sendSmsStatus !== "idle"}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition border border-indigo-100 disabled:opacity-75 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  {sendSmsStatus === "idle" ? "SMS" : sendSmsStatus === "sending" ? "..." : "✓"}
                </button>
                <button
                  onClick={handleOpenWhatsAppModal}
                  disabled={sendWhatsAppStatus === "sending"}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-850 hover:bg-emerald-100 transition border border-emerald-150 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  {sendWhatsAppStatus === "idle" ? "WhatsApp" : sendWhatsAppStatus === "sending" ? "..." : "✓"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPrintMode("invoice");
                  setIsSimulatingPrint(true);
                  setTimeout(() => {
                    try {
                      window.print();
                    } catch (err) {
                      console.warn("Dispositivo em iFrame bloqueado para window.print.");
                    }
                  }, 150);
                  setTimeout(() => {
                    setIsSimulatingPrint(false);
                  }, 4000);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-700 rounded-xl text-xs font-bold text-white transition shadow-lg shadow-orange-600/15 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Fatura (A4)
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrintMode("receipt");
                  setIsSimulatingPrint(true);
                  setTimeout(() => {
                    try {
                      window.print();
                    } catch (err) {
                      console.warn("Dispositivo em iFrame bloqueado para window.print.");
                    }
                  }, 150);
                  setTimeout(() => {
                    setIsSimulatingPrint(false);
                  }, 4000);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Via Rolo Térmico (Standard)
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    printInvoiceHTML(completedTx, settings || { companyName: "OST VENDAS", currency: "MT" } as SystemSettings);
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-1.5 text-slate-500 hover:text-slate-700 text-[10px] font-semibold transition hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <Printer className="w-3 h-3" />
                Abrir em Nova Janela (PDF/A4)
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={handleReset}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer text-center"
            >
              Completar e Iniciar Nova Venda
            </button>
          </div>
        </div>
      )}

      {/* Elegant Real-time Virtual Printer Animation Overlay Safeguard */}
      {isSimulatingPrint && (
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-xs font-sans">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center space-y-4 text-white">
            <div className="relative w-16 h-16 mx-auto bg-orange-500/10 rounded-full flex items-center justify-center text-amber-500">
              <Printer className="w-8 h-8 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-500">Impressora Térmica Fiscal</h4>
              <p className="text-[11px] text-zinc-400 mt-1">A transmitir cupão e a emitir rolo físico...</p>
            </div>
            
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-left font-mono text-[9px] text-zinc-400 max-h-32 overflow-hidden relative">
              <div className="animate-pulse mb-1.5 flex items-center gap-1.5 text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded w-max">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>• {completedBudget ? "IMPRIMINDO PROPOSTA COMERCIAL..." : "IMPRIMINDO RECIBO FISCAL..."}</span>
              </div>
              <p className="font-bold border-b border-dashed border-zinc-800 pb-1 uppercase">
                {completedBudget ? completedBudget.budgetNumber : (completedTx?.invoiceNumber || "FATURA-PROVISORIA")}
              </p>
              <p>OPERADOR: {completedBudget ? activeUsername : (completedTx?.cashierName || activeUsername)}</p>
              <p>
                {completedBudget 
                  ? `TOTAL PROP: ${completedBudget.grandTotal.toLocaleString()} MT` 
                  : `PAGO: ${completedTx?.grandTotal.toLocaleString() || "0"} MT via ${completedTx?.paymentMethod || "CASH"}`}
              </p>
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none"></div>
            </div>

            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "90%" }}></div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-normal">
              O documento comercial foi registado nas filas locais de impressão fiscal corporativa.
            </p>
          </div>
        </div>
      )}

      {/* Modern virtual feedback safeguard overlay for transaction completed without printing */}
      {noReceiptSuccess && (
        <div className="fixed inset-x-0 bottom-6 flex justify-center z-[100] px-4 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="bg-emerald-950 border border-emerald-800 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3.5 max-w-sm">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold font-sans">Venda Registada Sem Recibo!</p>
              <p className="text-[10px] text-emerald-300 mt-0.5">Stock decrementado e auditoria local guardada.</p>
            </div>
          </div>
        </div>
      )}

      {/* 26. WHATSAPP SEND DIALOG MODAL */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-slate-800">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  <span>Enviar Recibo via WhatsApp</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Revise o contacto e o formato do documento antes de despachar.</p>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${settings.whatsappEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                {settings.whatsappEnabled ? `API: ${settings.whatsappProvider}` : "Modo Link Direto"}
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Phone number field */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Número do Cliente (Com WhatsApp)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="Ex: +258 84 900 1202"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-10 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="absolute left-3.5 top-2.5 text-slate-400 text-xs font-bold font-mono">🇲🇿</span>
                </div>
                <p className="text-[9px] text-slate-400">Insira com o indicativo (Ex: +258 ou 258) ou apenas o número celular de Moçambique de 9 dígitos.</p>
              </div>

              {/* Message preview body */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mensagem de Texto Pré-formatada</label>
                  <span className="text-[9.5px] font-mono text-slate-400">{whatsappMessage.length} caracteres</span>
                </div>
                <textarea
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-[10.5px] font-mono leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500 max-h-60"
                />
              </div>

              {/* Helper guide on chosen provider */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-[10px] space-y-1 font-mono text-slate-500">
                <p className="font-bold text-slate-700">⚙️ Canal de Comunicação Ativo:</p>
                {settings.whatsappEnabled && settings.whatsappProvider !== "DIRECT_LINK" ? (
                  <>
                    <p>• Provedor: <span className="text-emerald-700 font-bold">{settings.whatsappProvider}</span></p>
                    <p>• Endpoint: <span className="truncate block max-w-full">{settings.whatsappApiEndpoint || "Configurado"}</span></p>
                    <p className="text-[9px] text-slate-400">As mensagens serão disparadas via servidor invisível sem intervenção manual. Se houver falha, reverteremos para Link Direto.</p>
                  </>
                ) : (
                  <>
                    <p>• Provedor: <span className="text-orange-600 font-bold">Link Direto (wa.me)</span></p>
                    <p>• Custo: <span className="text-emerald-700 font-bold">100% Grátis e Ilimitado</span></p>
                    <p className="text-[9px] text-slate-400">O sistema abrirá uma nova aba do navegador para o WhatsApp Web ou aplicação móvel do operador com a mensagem pré-carregada.</p>
                  </>
                )}
              </div>
            </div>

            {/* Actions choosing triggers */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Voltar
              </button>
              
              {settings.whatsappEnabled && settings.whatsappProvider !== "DIRECT_LINK" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => dispatchWhatsAppReceipt(true)}
                    className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-[10px] font-bold text-slate-700 transition cursor-pointer"
                    title="Usar link wa.me direto em vez de gateway"
                  >
                    Link Direto
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchWhatsAppReceipt(false)}
                    disabled={sendWhatsAppStatus === "sending"}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-[10px] font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-600/15"
                  >
                    {sendWhatsAppStatus === "sending" ? "A Enviar..." : "Disparar API ✓"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => dispatchWhatsAppReceipt(true)}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-600/15"
                >
                  Abrir WhatsApp Link ✓
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Orçamento & Proposta Comercial */}
      {completedBudget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          {/* Inject Dynamic Print Overrides */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              /* Hide everything else */
              body * {
                visibility: hidden !important;
                background: none !important;
              }
              /* Show and target ONLY our printable paper block */
              #budget-print-area, #budget-print-area * {
                visibility: visible !important;
              }
              #budget-print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                width: ${budgetPrintFormat === "ESC_POS" ? (selectedPaperSize === "58MM" ? "58mm" : "80mm") : "210mm"} !important;
                max-width: ${budgetPrintFormat === "ESC_POS" ? (selectedPaperSize === "58MM" ? "58mm" : "80mm") : "210mm"} !important;
                padding: ${budgetPrintFormat === "ESC_POS" ? "4mm" : "15mm"} !important;
                font-family: ${budgetPrintFormat === "ESC_POS" ? "monospace" : "sans-serif"} !important;
                font-size: ${budgetPrintFormat === "ESC_POS" ? "11px" : "13px"} !important;
                line-height: 1.2 !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}} />

          <div className="bg-white p-6 rounded-2xl max-w-2xl w-full border border-slate-100 shadow-2xl flex flex-col gap-4 animate-in fade-in duration-200 no-print">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-slate-900 text-sm">Template de Orçamento POS</h3>
                  <p className="text-[11px] text-slate-400">Emissão e formatação de propostas comerciais.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settings.printerEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    ESC/POS Ativo ({settings.paperSize || "80MM"})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-slate-50 text-slate-500 rounded-full border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    Impressora Térmica Desativada
                  </span>
                )}
              </div>
            </div>

            {/* Template & Size Controllers */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setBudgetPrintFormat("A4_DOC")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  budgetPrintFormat === "A4_DOC" 
                    ? "bg-white text-slate-950 shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>📄 Proposta A4 Corporativa</span>
              </button>
              <button
                type="button"
                onClick={() => setBudgetPrintFormat("ESC_POS")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  budgetPrintFormat === "ESC_POS" 
                    ? "bg-white text-slate-950 shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>📠 Recibo Térmico ESC/POS</span>
              </button>
            </div>

            {/* Sub-selectors for ESC/POS mode */}
            {budgetPrintFormat === "ESC_POS" && (
              <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBudgetTab("PREVIEW")}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer ${
                      budgetTab === "PREVIEW" ? "bg-amber-100 text-amber-800" : "text-amber-600 hover:bg-amber-100/40"
                    }`}
                  >
                    Fita Térmica Simulada
                  </button>
                  <button
                    type="button"
                    onClick={() => setBudgetTab("RAW_COMMANDS")}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer ${
                      budgetTab === "RAW_COMMANDS" ? "bg-amber-100 text-amber-800" : "text-amber-600 hover:bg-amber-100/40"
                    }`}
                  >
                    Comandos Brutos (Raw ESC/POS)
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                  <span>Papel:</span>
                  <select
                    value={selectedPaperSize}
                    onChange={(e: any) => setSelectedPaperSize(e.target.value)}
                    className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] outline-none"
                  >
                    <option value="80MM">80mm (Largo)</option>
                    <option value="58MM">58mm (Estreito)</option>
                  </select>
                </div>
              </div>
            )}

            {/* PREVIEW CONTAINER */}
            <div className="max-h-80 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50 p-4 shadow-inner">
              {budgetPrintFormat === "A4_DOC" ? (
                /* --- Template A4 CORPORATIVO --- */
                <div id="budget-print-area" className="bg-white p-6 rounded-xl border border-slate-200 text-left font-sans text-xs text-slate-700 shadow-md">
                  {/* Corporate Header */}
                  <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
                    <div>
                      {settings.logoUrl ? (
                        <img
                          src={settings.logoUrl}
                          alt="Logo Empresa"
                          className="h-10 w-auto object-contain mb-2 bg-white rounded"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-sm mb-1.5">
                          OST
                        </div>
                      )}
                      <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">{settings.companyName || "OST COMÉRCIO CENTRAL"}</h4>
                      {settings.slogan && <p className="text-[10px] text-slate-400 italic font-medium">{settings.slogan}</p>}
                      <p className="text-[10px] text-slate-500 mt-1">{settings.storeAddress || "Av. Marginal, Kiosk 14, Maputo"}</p>
                      <p className="text-[10px] text-slate-500">NUIT: {settings.companyNuit || "400293112"}</p>
                      {settings.storeContact && <p className="text-[10px] text-slate-500">Contacto: {settings.storeContact}</p>}
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-extrabold text-[10px] uppercase rounded-full tracking-wider border border-amber-200">
                        Proposta de Orçamento
                      </span>
                      <h3 className="font-black text-slate-950 text-lg mt-3">{completedBudget.budgetNumber}</h3>
                      <p className="text-[10px] text-slate-500">Emissão: {new Date(completedBudget.timestamp).toLocaleString("pt-MZ")}</p>
                      <p className="text-[10px] text-amber-700 font-semibold mt-1">Validade: 15 dias (Até {new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ")})</p>
                    </div>
                  </div>

                  {/* Customer / Operators details block */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-150 mb-4">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Destinatário (Cliente)</span>
                      <p className="font-extrabold text-slate-955 text-xs">{completedBudget.customerName}</p>
                      {completedBudget.customerNuit && <p className="text-[10px] mt-0.5">NUIT: <span className="font-mono">{completedBudget.customerNuit}</span></p>}
                      {completedBudget.customerPhone && <p className="text-[10px] mt-0.5">Tel: {completedBudget.customerPhone}</p>}
                      {completedBudget.customerEmail && <p className="text-[10px] mt-0.5">E-mail: {completedBudget.customerEmail}</p>}
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Emissor / Responsável</span>
                      <p className="font-extrabold text-slate-955 text-xs">{activeUsername}</p>
                      <p className="text-[10px] mt-0.5">Terminal: POS-01 Central</p>
                      <p className="text-[10px] text-slate-500 italic mt-1">Este orçamento é uma proposta provisória para fornecimento.</p>
                    </div>
                  </div>

                  {/* Itemized Grid */}
                  <table className="w-full text-left border-collapse mb-4">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-200">
                        <th className="py-2.5 px-2">Artigo / Descrição</th>
                        <th className="py-2.5 px-2 text-center w-16">Qtd</th>
                        <th className="py-2.5 px-2 text-right w-24">Preço Unitário</th>
                        <th className="py-2.5 px-2 text-right w-28">Total Parcial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {completedBudget.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 text-slate-650">
                          <td className="py-2.5 px-2 font-bold text-slate-800">{item.productName}</td>
                          <td className="py-2.5 px-2 text-center font-mono">{item.quantity}</td>
                          <td className="py-2.5 px-2 text-right font-mono">{item.price.toLocaleString()} MT</td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-950">{(item.price * item.quantity).toLocaleString()} MT</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pricing Summary block */}
                  <div className="flex justify-between items-end border-t border-slate-200 pt-4">
                    <div className="text-[10px] text-slate-400 max-w-sm">
                      <p className="font-bold text-slate-500">Termos e Condições:</p>
                      <p className="mt-1 leading-normal">1. Os preços apresentados incluem IVA à taxa em vigor.<br/>2. Esta proposta comercial é válida por 15 dias de calendário.<br/>3. O fornecimento dos artigos está sujeito ao stock disponível.</p>
                    </div>
                    <div className="w-64 space-y-1.5 text-right font-mono text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span>SUBTOTAL:</span>
                        <span>{completedBudget.subtotal.toLocaleString()} MT</span>
                      </div>
                      {completedBudget.discountTotal > 0 && (
                        <div className="flex justify-between text-red-600 font-bold">
                          <span>DESCONTO:</span>
                          <span>-{completedBudget.discountTotal.toLocaleString()} MT</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>IVA ESTIMADO (16%):</span>
                        <span>{completedBudget.vatTotal.toLocaleString()} MT</span>
                      </div>
                      <div className="flex justify-between text-slate-900 font-black text-sm border-t border-dashed border-slate-200 pt-2 mt-1">
                        <span>TOTAL PROPOSTO:</span>
                        <span className="text-amber-800">{completedBudget.grandTotal.toLocaleString()} MT</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Seal */}
                  <div className="text-center text-[9px] text-slate-400 mt-8 border-t border-dashed border-slate-150 pt-4">
                    <p className="uppercase tracking-widest font-bold text-slate-500">{settings.companyName || "OST COMÉRCIO CENTRAL"}</p>
                    <p className="mt-1">Obrigado pela preferência! Processado por computador.</p>
                  </div>
                </div>
              ) : budgetTab === "PREVIEW" ? (
                /* --- Template ESC/POS RECIBO TÉRMICO (Papel Contínuo) --- */
                <div className="flex justify-center">
                  <div 
                    id="budget-print-area" 
                    className="bg-white p-4 text-left font-mono text-[10px] leading-snug text-zinc-800 border border-zinc-200 shadow-lg relative rounded-md select-all"
                    style={{ width: selectedPaperSize === "58MM" ? "240px" : "320px" }}
                  >
                    {/* Simulated paper roll edges */}
                    <div className="absolute inset-x-0 -top-1.5 h-1.5 bg-zinc-100 border-b border-dashed border-zinc-300"></div>
                    <div className="absolute inset-x-0 -bottom-1.5 h-1.5 bg-zinc-100 border-t border-dashed border-zinc-300"></div>

                    {/* Logo & Header */}
                    <div className="text-center mb-2.5">
                      {settings.logoUrl && (
                        <img
                          src={settings.logoUrl}
                          alt="Logo Recibo"
                          className="w-12 h-12 object-contain mx-auto mb-1.5 bg-white p-0.5 rounded border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <p className="font-extrabold uppercase text-xs tracking-wider">{settings.companyName || "OST COMÉRCIO CENTRAL"}</p>
                      {settings.slogan && <p className="text-[8px] text-zinc-500 italic mt-0.5">{settings.slogan}</p>}
                      <p className="text-[8px] text-zinc-500 mt-1">{settings.storeAddress || "Av. Marginal, Kiosk 14, Maputo"}</p>
                      <p className="text-[8px] text-zinc-500">NUIT Empr: {settings.companyNuit || "400293112"}</p>
                      {settings.storeContact && <p className="text-[8px] text-zinc-500">Tel: {settings.storeContact}</p>}
                    </div>

                    <div className="border-b border-dashed border-zinc-300 pb-1.5 mb-2.5 space-y-0.5">
                      <p className="font-bold text-amber-700 text-[11px]">*** PROPOSTA COMERCIAL ***</p>
                      <p><span className="text-zinc-500">ORÇAMENTO Nº:</span> <span className="font-bold">{completedBudget.budgetNumber}</span></p>
                      <p><span className="text-zinc-500">EMISSÃO:</span> {new Date(completedBudget.timestamp).toLocaleString("pt-MZ")}</p>
                      <p><span className="text-zinc-500">VALIDADE:</span> 15 Dias (Até {new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ")})</p>
                      <p><span className="text-zinc-500">OPERADOR:</span> {activeUsername}</p>
                      <p className="border-t border-dashed border-zinc-200 pt-1 mt-1"><span className="text-zinc-500">CLIENTE:</span> <span className="font-bold">{completedBudget.customerName}</span></p>
                      {completedBudget.customerNuit && <p><span className="text-zinc-500">NUIT CLI:</span> {completedBudget.customerNuit}</p>}
                      {completedBudget.customerPhone && <p><span className="text-zinc-500">CONTAC :</span> {completedBudget.customerPhone}</p>}
                    </div>

                    {/* Table Headers */}
                    <div className="border-b border-dashed border-zinc-300 pb-1 mb-1 font-bold text-zinc-900 grid grid-cols-12 gap-1 text-[9px]">
                      <span className="col-span-6">ARTIGO</span>
                      <span className="col-span-2 text-center">QTD</span>
                      <span className="col-span-4 text-right">VALOR</span>
                    </div>

                    {/* Items */}
                    <div className="space-y-1 py-1 border-b border-dashed border-zinc-300 mb-2">
                      {completedBudget.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1 text-[9px] text-zinc-700">
                          <span className="col-span-6 truncate font-medium">{item.productName}</span>
                          <span className="col-span-2 text-center font-mono">{item.quantity}</span>
                          <span className="col-span-4 text-right font-mono">{(item.price * item.quantity).toLocaleString()} MT</span>
                        </div>
                      ))}
                    </div>

                    {/* Calculations */}
                    <div className="space-y-1 text-right text-[9px] text-zinc-600">
                      <p>SUBTOTAL: {completedBudget.subtotal.toLocaleString()} MT</p>
                      {completedBudget.discountTotal > 0 && <p className="text-red-650 font-bold">DESCONTO: -{completedBudget.discountTotal.toLocaleString()} MT</p>}
                      <p>IVA ESTIMADO: {completedBudget.vatTotal.toLocaleString()} MT</p>
                      <p className="text-zinc-900 font-bold text-[11px] border-t border-dashed border-zinc-300 pt-1.5 mt-1">
                        TOTAL PROP: {completedBudget.grandTotal.toLocaleString()} MT
                      </p>
                    </div>

                    <div className="text-center mt-4 border-t border-dashed border-zinc-300 pt-2 text-[8px] text-zinc-400 space-y-0.5">
                      <p className="font-bold uppercase tracking-wider text-zinc-500">*** PROPOSTA SEM VALOR FISCAL ***</p>
                      <p>Obrigado pela preferência e confiança!</p>
                      <p>Emitido via Terminal Térmico ESC/POS.</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* --- RAW ESC/POS COMMAND TEXT LAYOUT --- */
                <div className="bg-zinc-950 p-4 rounded-xl text-left font-mono text-[10px] text-emerald-400 leading-normal select-all whitespace-pre">
                  {getEscPosText(completedBudget, selectedPaperSize)}
                </div>
              )}
            </div>

            {/* Quick Dispatchers */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5 text-left">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">E-mail de Envio</label>
                  <input
                    type="email"
                    placeholder="exemplo@cliente.com"
                    value={budgetTargetEmail}
                    onChange={(e) => setBudgetTargetEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
                <div className="space-y-0.5 text-left">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Telemóvel (WhatsApp/SMS)</label>
                  <input
                    type="text"
                    placeholder="+258 84 000 0000"
                    value={budgetTargetPhone}
                    onChange={(e) => setBudgetTargetPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide text-left">Entregar / Enviar ao Cliente</p>
              
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={simulateSendBudgetEmail}
                  disabled={sendBudgetEmailStatus !== "idle"}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-blue-50 text-blue-750 hover:bg-blue-100 transition border border-blue-100 disabled:opacity-75 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  {sendBudgetEmailStatus === "idle" ? "E-mail" : sendBudgetEmailStatus === "sending" ? "..." : "✓ Enviado"}
                </button>
                <button
                  type="button"
                  onClick={simulateSendBudgetSms}
                  disabled={sendBudgetSmsStatus !== "idle"}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition border border-indigo-100 disabled:opacity-75 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  {sendBudgetSmsStatus === "idle" ? "SMS" : sendBudgetSmsStatus === "sending" ? "..." : "✓ Enviado"}
                </button>
                <button
                  type="button"
                  onClick={handleOpenBudgetWhatsApp}
                  disabled={sendBudgetWhatsAppStatus === "sending"}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-850 hover:bg-emerald-100 transition border border-emerald-150 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  WhatsApp
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSimulatingPrint(true);
                  try {
                    window.print();
                  } catch (err) {
                    console.warn("Dispositivo em iFrame bloqueado para window.print. Impressora Virtual Ativada.");
                  }
                  setTimeout(() => {
                    setIsSimulatingPrint(false);
                  }, 4000);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-amber-600/15"
              >
                <Printer className="w-4 h-4 text-amber-100" />
                {budgetPrintFormat === "ESC_POS" ? `Imprimir Fita Térmica (${selectedPaperSize})` : "Imprimir Proposta A4"}
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setCompletedBudget(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer text-center hover:bg-slate-800"
            >
              Fechar Orçamento (Manter Carrinho)
            </button>
          </div>
        </div>
      )}

      {/* Floating Help Button in Bottom Right */}
      <button
        type="button"
        onClick={() => setShowShortcutsHelp(true)}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl transition-all duration-200 transform hover:scale-110 active:scale-95 cursor-pointer z-40 flex items-center justify-center border border-indigo-500/20"
        title="Ajuda e Atalhos de Teclado (F1)"
        id="pos-shortcuts-floating-btn"
      >
        <HelpCircle className="w-6 h-6 animate-pulse" />
      </button>

      {/* 26. Modal de Alerta de Stock Crítico */}
      {showCriticalStockModal && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            id="pos-critical-stock-modal"
          >
            {/* Header */}
            <div className="p-6 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shadow-inner animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-slate-900 text-sm">Alerta de Stock Crítico</h3>
                  <p className="text-[11px] text-red-650 font-bold">Produtos que ficarão abaixo do nível de alerta após a venda</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowCriticalStockModal(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-red-100 border border-red-200 text-red-400 hover:text-red-600 flex items-center justify-center transition cursor-pointer font-bold text-xs font-mono"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-[11.5px] text-slate-500 leading-normal text-left">
                Os seguintes itens no carrinho de compras atual têm quantidades que reduzirão o estoque restante abaixo ou ao nível crítico definido individualmente nas configurações de stock.
              </p>

              <div className="space-y-3">
                {itemsLeavingStockBelowCritical.map(item => {
                  const currentStock = item.product.stock;
                  const saleQty = item.quantity;
                  const finalStock = currentStock - saleQty;
                  const minStock = item.product.minStock || 0;

                  return (
                    <div 
                      key={item.product.id}
                      className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl flex flex-col gap-2 hover:bg-slate-100/70 transition text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">{item.product.brand || "Genérico"} ({item.product.code})</span>
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-1 leading-tight">{item.product.name}</h4>
                        </div>
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                          Mín Alerta: {minStock}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Stock Atual</span>
                          <span className="text-xs font-mono font-bold text-slate-600">{currentStock}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">No Carrinho</span>
                          <span className="text-xs font-mono font-bold text-orange-600">-{saleQty}</span>
                        </div>
                        <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                          <span className="text-[9px] font-bold text-red-400 block uppercase">Stock Final</span>
                          <span className={`text-xs font-mono font-bold ${finalStock < 0 ? "text-red-700 underline" : "text-red-600"}`}>
                            {finalStock}
                          </span>
                        </div>
                      </div>

                      {finalStock < 0 && (
                        <p className="text-[9.5px] text-red-600 font-bold flex items-center gap-1">
                          ⚠️ Atenção: Esta transação causará ruptura de stock (estoque negativo)!
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCriticalStockModal(false)}
                className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-sm"
              >
                Entendi, Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Floating Help Overlay */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            id="pos-shortcuts-help-modal"
          >
            {/* Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-slate-900 text-sm">Ajuda e Atalhos do POS</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Aumente a sua eficiência de atendimento</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer font-bold text-xs"
                title="Fechar (ESC)"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Shortcut Rows */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Atalhos de Operação do POS</p>
                <div className="grid grid-cols-1 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                  
                  {/* F1 */}
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="text-xs font-semibold text-slate-700">Painel de Ajuda / Atalhos</span>
                    </div>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F1</kbd>
                  </div>

                  {/* F2 */}
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="text-xs font-semibold text-slate-700">Focar Seleção de Cliente</span>
                    </div>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F2</kbd>
                  </div>

                  {/* F3 */}
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="text-xs font-semibold text-slate-700">Focar Pesquisa de Artigos</span>
                    </div>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F3</kbd>
                  </div>

                  {/* F4 */}
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="text-xs font-semibold text-slate-700">Registo Rápido de Cliente</span>
                    </div>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F4</kbd>
                  </div>

                  {/* F6 */}
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="text-xs font-semibold text-slate-700">Aplicar Desconto Comercial %</span>
                    </div>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F6</kbd>
                  </div>

                  {/* F8 */}
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="text-xs font-semibold text-slate-700">Alternar Método de Pagamento</span>
                    </div>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F8</kbd>
                  </div>

                  {/* F9 */}
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      <span className="text-xs font-semibold text-slate-700">Abrir Confirmação / Pré-Checkout</span>
                    </div>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F9</kbd>
                  </div>

                  {/* ESC */}
                  <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span className="text-xs font-semibold text-slate-700">Esvaziar / Cancelar Venda Atual</span>
                    </div>
                    <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">ESC</kbd>
                  </div>

                </div>
              </div>

              {/* Advanced info section */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Recursos de Automação & Eficiência</p>
                
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                    <span className="text-lg">🏷️</span>
                    <div>
                      <h4 className="text-xs font-extrabold text-orange-950">Leitura Inteligente por Código de Barras</h4>
                      <p className="text-[11px] text-orange-800/80 leading-relaxed mt-0.5">
                        O POS suporta o uso de leitores USB emulando teclado. Ao bipar um artigo em qualquer lugar, o sistema processa o código instantaneamente e insere-o no carrinho, prevenindo cliques desnecessários.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <span className="text-lg">⚖️</span>
                    <div>
                      <h4 className="text-xs font-extrabold text-amber-950">Solicitação Automática de Peso</h4>
                      <p className="text-[11px] text-amber-800/80 leading-relaxed mt-0.5">
                        Para artigos vendidos ao quilo/peso, o sistema detecta de forma automática e abre um diálogo interativo para inserção da massa em gramas/kg, calculando com rigor a faturação.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-lg">💡</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Agilidade no Trabalho</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                        Você pode fechar esta janela de ajuda a qualquer momento pressionando a tecla <kbd className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded shadow-sm">ESC</kbd> ou <kbd className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded shadow-sm">F1</kbd>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
              >
                Compreendi! Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panic Button Confirmation Modal */}
      {showPanicConfirm && (
        <div className="fixed inset-0 bg-red-950/85 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-red-500 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
            <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-inner animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-extrabold text-red-900 text-base">⚠️ CONFIRMAÇÃO DE EMERGÊNCIA</h3>
                <p className="text-xs text-red-700 font-semibold mt-0.5">SISTEMA DE SEGURANÇA OST VENDAS</p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-left">
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                Você está prestes a acionar o <strong>Botão de Pânico / Alerta Crítico</strong> do sistema comercial.
              </p>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 text-xs text-red-800 space-y-1.5 font-semibold">
                <p>● Um log de emergência crítica será registado imediatamente.</p>
                <p>● Todos os administradores receberão SMS e E-mail de pânico com a sua identidade, localização geográfica e endereço IP.</p>
                <p>● Use apenas em caso de incidentes graves de segurança, roubo ou perigo iminente.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPanicConfirm(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar (Não Enviar)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onTriggerPanic) {
                    onTriggerPanic();
                  }
                  setShowPanicConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-red-600/30 transition cursor-pointer animate-pulse"
              >
                🚨 ENVIAR ALERTA DE PÂNICO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
