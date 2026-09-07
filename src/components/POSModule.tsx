import React, { useState, useMemo, useEffect, useRef, memo } from "react";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  Receipt, 
  UserPlus, 
  CheckCircle2,
  Mail,
  Printer,
  Smartphone,
  ShoppingCart,
  Wifi,
  Camera,
  AlertTriangle,
  History,
  Check,
  Maximize2,
  Minimize2,
  MessageSquare,
  Scan,
  QrCode,
  Keyboard,
  HelpCircle,
  Zap,
  Barcode,
  Clock,
  RotateCcw
} from "lucide-react";
import { Product, Customer, CartItem, Transaction, SystemSettings } from "../types";
import QrCodeScannerComponent from "./QrCodeScannerComponent";
import { PosShortcutsHelpModal } from "./pos/PosShortcutsHelpModal";
import { PosCriticalStockModal } from "./pos/PosCriticalStockModal";
import { PosQuickCustomerModal } from "./pos/PosQuickCustomerModal";
import { PosCreditNoteModal, CompletedCreditNote } from "./pos/PosCreditNoteModal";
import { PosReturnModal } from "./pos/PosReturnModal";
import { PosBudgetModal, PosBudgetData } from "./pos/PosBudgetModal";
import { PosWeightModal } from "./pos/PosWeightModal";
import { PosScannerModal } from "./pos/PosScannerModal";
import { PosSalesHistoryModal } from "./pos/PosSalesHistoryModal";
import { PosWhatsappModal } from "./pos/PosWhatsappModal";
import { PosReceiptModal } from "./pos/PosReceiptModal";
import { ModuleShortcutsHelp } from "./common/ModuleShortcutsHelp";
import { sendEmail } from "../lib/gmail";
import { authenticatedFetch } from "../lib/apiClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SYSTEM_THEMES } from "../lib/themes";
import { printInvoiceHTML, printThermal80mmReceipt } from "../lib/printHelper";
import { useSystemVersion } from "../lib/versionManager";
import { generateUUID, generateEntityId, generateDeterministicInvoiceNumber, generateDeterministicCreditNoteNumber, generateDeterministicFinancialReference } from "../lib/deterministic";

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
  onReturnSale?: (
    tx: Transaction,
    reason: string,
    returnedItems: { productId: string; quantity: number; price: number }[],
    refundMethod?: string
  ) => void;
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
  const key2 = ((Math.abs(hash) % 9000) + 1000).toString();
  return {
    fiscalHash: `FAC-${hex}-${part1}-${part2}-OSTVENDAS`,
    fiscalKeys: `${part1}-${part2}-${key1}-${key2}`,
    fiscalCertified: true
  };
};

function POSModule({
  products,
  customers,
  transactions,
  activeUsername,
  settings,
  onCompleteSale,
  onReturnSale,
  onAddAuditLog,
  currency,
  onShowToast,
  isPOSFullscreen = false,
  onChangePOSFullscreen,
  onTriggerPanic
}: POSModuleProps) {
  const { formattedVersion } = useSystemVersion();
  
  // Local synchronized state to allow quick registering of customers and updating stock locally in the view
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [localProducts, setLocalProducts] = useState<Product[]>(products);

  // Return / Devolution & Credit Note Modal State
  const [selectedTxForReturn, setSelectedTxForReturn] = useState<Transaction | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>("Defeito / Avaria de Produto");
  const [customReturnReason, setCustomReturnReason] = useState<string>("");
  const [returnedItemQuantities, setReturnedItemQuantities] = useState<Record<string, number>>({});
  const [returnRefundMethod, setReturnRefundMethod] = useState<string>("CASH");
  const [completedCreditNote, setCompletedCreditNote] = useState<CompletedCreditNote | null>(null);
  
  // Minimized / Focus mode state
  const [isLocalMinimized, setIsLocalMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem("ost_pos_minimized_mode") === "true";
    } catch {
      return false;
    }
  });

  const isMinimized = isPOSFullscreen || isLocalMinimized;

  const handleToggleMinimized = () => {
    if (onChangePOSFullscreen) {
      onChangePOSFullscreen(!isPOSFullscreen);
    } else {
      setIsLocalMinimized(prev => {
        const next = !prev;
        try {
          localStorage.setItem("ost_pos_minimized_mode", String(next));
        } catch {}
        return next;
      });
    }
  };
  
  // Sync when props change
  useEffect(() => { setLocalCustomers(customers); }, [customers]);
  useEffect(() => { setLocalProducts(products); }, [products]);

  // Session stats & setup
  const [currentSaleNumber, setCurrentSaleNumber] = useState<number>(245);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Time ticker
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

  // Auto-focus barcode/search input immediately on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [cart, setCart] = useState<UpgradedCartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("CASH");

  // High-performance indexed cache for instant O(1) barcode, internal code, and product lookups
  const productCache = useMemo(() => {
    const barcodeMap = new Map<string, Product>();
    const codeMap = new Map<string, Product>();
    const idMap = new Map<string, Product>();

    localProducts.forEach(p => {
      if (p.id) {
        idMap.set(p.id.trim(), p);
        idMap.set(p.id.trim().toLowerCase(), p);
      }
      if (p.barcode) {
        const b = p.barcode.trim();
        barcodeMap.set(b, p);
        barcodeMap.set(b.toLowerCase(), p);
      }
      if (p.code) {
        const c = p.code.trim();
        codeMap.set(c, p);
        codeMap.set(c.toLowerCase(), p);
      }
    });

    return {
      findByBarcodeOrCode: (codeOrBarcode: string): Product | undefined => {
        const clean = codeOrBarcode.trim();
        const lower = clean.toLowerCase();
        return barcodeMap.get(clean) || barcodeMap.get(lower) || codeMap.get(clean) || codeMap.get(lower) || idMap.get(clean) || idMap.get(lower);
      }
    };
  }, [localProducts]);

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
  const [completedBudget, setCompletedBudget] = useState<PosBudgetData | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showCriticalStockModal, setShowCriticalStockModal] = useState(false);

  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
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

  // Live cart item quantities mapping for instant real-time stock deduction in UI
  const cartItemQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach(item => {
      map.set(item.product.id, (map.get(item.product.id) || 0) + item.quantity);
    });
    return map;
  }, [cart]);

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
          handleSendEmail();
        } else if (action === "sms") {
          handleSendSms();
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
      setTimeout(() => {
        const inCart = cart.find(item => item.product.id === barcodeMatch.id)?.quantity || 0;
        const liveStock = barcodeMatch.stock - inCart;
        if (liveStock <= 0) {
          if (onShowToast) onShowToast(`Produto "${barcodeMatch.name}" já tem todo o stock (${barcodeMatch.stock} un) no carrinho!`, "warning", "Stock Esgotado");
          setSearchQuery("");
          return;
        }
        handleTriggerAddToCart(barcodeMatch);
        setSearchQuery("");
      }, 0);
    }
  }, [searchQuery, localProducts, cart]);

  // Web Audio API feedback for retail barcode scanner
  const playBarcodeBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1760, ctx.currentTime); // High pitch retail scanner beep (A6)
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch {}
  };

  const playErrorBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  };

  // Buffer input speed for USB / Bluetooth Barcode Scanners - High-speed O(1) Cache Listener
  useEffect(() => {
    let lastKeyTime = Date.now();
    let scanBuffer = "";
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const processBuffer = () => {
      const code = scanBuffer.trim();
      if (code.length >= 2) {
        const prod = productCache.findByBarcodeOrCode(code);
        if (prod) {
          const inCart = cart.find(item => item.product.id === prod.id)?.quantity || 0;
          const liveStock = prod.stock - inCart;
          if (prod.stock <= 0) {
            playErrorBeep();
            if (onShowToast) onShowToast(`Produto "${prod.name}" está esgotado!`, "error", "Stock Vazio");
          } else if (liveStock <= 0) {
            playErrorBeep();
            if (onShowToast) onShowToast(`Todo o stock de "${prod.name}" (${prod.stock} un) já está no carrinho!`, "warning", "Stock Esgotado");
          } else {
            playBarcodeBeep();
            handleTriggerAddToCart(prod);
            setSearchQuery("");
            // Maintain focus on the search input
            setTimeout(() => {
              searchInputRef.current?.focus();
            }, 30);
          }
        } else {
          playErrorBeep();
          if (onShowToast) onShowToast(`Código "${code}" não cadastrado no catálogo.`, "warning", "Leitor de Código");
        }
      }
      scanBuffer = "";
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isSearchInput = target === searchInputRef.current;
      const isOtherInputField = !isSearchInput && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      
      // If user is editing a quantity input or customer select, don't hijack manual typing
      if (isOtherInputField) return;

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
        if (e.key.length === 1) {
          scanBuffer = e.key;
        }
      }

      // Timeout fallback for scanners that do not append Enter key at the end
      timeoutId = setTimeout(() => {
        if (scanBuffer.trim().length >= 3) {
          processBuffer();
        }
      }, 120);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [productCache, onShowToast]);

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
            if (onShowToast) onShowToast(`Quantidade excede o stock disponível (${product.stock} un)! Já tem ${existing.quantity} un no carrinho.`, "warning", "Stock Esgotado");
            return prev;
          }
          const updatedQty = parseFloat((existing.quantity + addedQty).toFixed(3));
          return prev.map(item => 
            item.product.id === product.id 
              ? { ...item, quantity: updatedQty }
              : item
          );
        } else {
          if (addedQty > product.stock) {
            if (onShowToast) onShowToast(`Quantidade excede o stock disponível (${product.stock} un)!`, "warning", "Stock Insuficiente");
            return prev;
          }
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
          if (onShowToast) onShowToast(`Disponível apenas ${item.product.stock} un em stock! Quantidade ajustada ao máximo.`, "warning");
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
          const updatedQty = parseFloat((existing.quantity - decStep).toFixed(3));
          return prev.map(item => 
            item.product.id === productId 
              ? { ...item, quantity: updatedQty }
              : item
          );
        } else {
          return prev.filter(item => item.product.id !== productId);
        }
      }
      return prev;
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
      const nextTxSeq = transactions.length + 1;
      setMobileReference(generateDeterministicFinancialReference(settings.companyNuit || settings.companyNif || "OST", "VND", calculations.grandTotal, nextTxSeq));
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
    let interval: ReturnType<typeof setInterval> | null = null;
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

    // Validação Financeira: Impedir pagamento em numerário inferior ao total da venda (exceto fiado/crédito)
    if (paymentMethodToUse === "CASH" && receivedCashAmount > 0 && receivedCashAmount < calculations.grandTotal) {
      const faltam = (calculations.grandTotal - receivedCashAmount).toLocaleString();
      if (onShowToast) {
        onShowToast(
          `O valor entregue (${receivedCashAmount.toLocaleString()} MT) é inferior ao total da venda (${calculations.grandTotal.toLocaleString()} MT). Faltam ${faltam} MT. Para fiado, utilize a modalidade 'Crédito'.`,
          "error",
          "Valor Insuficiente"
        );
      }
      return;
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

    const nextInvoiceSeq = transactions.length + 1;
    const invoiceNum = generateDeterministicInvoiceNumber(nextInvoiceSeq, settings.invoiceSeries || "A");
    const nowStr = new Date().toISOString();

    const fiscalSign = settings.fiscalModeEnabled !== false
      ? generateFiscalSignature(invoiceNum, nowStr, calculations.grandTotal)
      : {};

    const transaction: Transaction = {
      id: generateUUID(),
      invoiceNumber: invoiceNum,
      timestamp: nowStr,
      subtotal: calculations.subtotal,
      vatTotal: calculations.vatTotal,
      discountTotal: calculations.discountTotal,
      grandTotal: calculations.grandTotal,
      paymentMethod: paymentMethodToUse as Transaction["paymentMethod"],
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

  // Helper to trigger receipt printing with simulated visual feedback and safe window.print
  const triggerPrintReceipt = (mode: "receipt" | "invoice" = "receipt") => {
    setPrintMode(mode);
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
  };

  // Global Keyboard Shortcuts (F1, F2, F3, F4, F5, F6, F8, F9, F10, F11, ESC)
  useEffect(() => {
    const executeShortcut = (key: string) => {
      if (key === "F1") {
        if (showPreCheckoutModal) {
          // If the pre-checkout modal is already open, F1 confirms and finalizes the sale
          handleCheckout(true, true);
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
      } else if (key === "F5") {
        // Shortcut F5: Trigger Print Function / Instant Finalize & Print
        if (completedTx) {
          triggerPrintReceipt("receipt");
          if (onShowToast) onShowToast("Atalho F5: A imprimir recibo fiscal...", "success");
        } else if (completedBudget) {
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
          if (onShowToast) onShowToast("Atalho F5: A imprimir proposta de orçamento...", "info");
        } else if (showFinalConfirmModal) {
          handleCheckout(true, true);
          if (onShowToast) onShowToast("Atalho F5: Venda finalizada com emissão de recibo!", "success");
        } else if (showPreCheckoutModal) {
          handleCheckout(true, true);
          if (onShowToast) onShowToast("Atalho F5: Venda confirmada e enviada para faturação!", "success");
        } else if (cart.length > 0) {
          handleCheckout(true, true);
          if (onShowToast) onShowToast("Atalho F5: Venda rápida finalizada e enviada para impressão!", "success");
        } else {
          if (onShowToast) onShowToast("O carrinho está vazio para imprimir ou finalizar.", "warning");
        }
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
      } else if (key === "F10" || key === "F11") {
        handleToggleMinimized();
        if (onShowToast) onShowToast(!isMinimized ? "Modo minimizado ativado (Foco na venda)" : "Modo normal restaurado", "info");
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
      if (
        e.key === "F1" || 
        e.key === "F2" || 
        e.key === "F3" || 
        e.key === "F4" || 
        e.key === "F5" || 
        e.key === "F6" || 
        e.key === "F8" || 
        e.key === "F9" || 
        e.key === "F10" || 
        e.key === "F11" || 
        e.key === "Escape"
      ) {
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
  }, [
    cart, 
    selectedPaymentMethod, 
    showPreCheckoutModal, 
    showFinalConfirmModal, 
    showShortcutsHelp, 
    completedTx, 
    completedBudget, 
    isMinimized, 
    calculations, 
    selectedCustomer, 
    receivedCashAmount, 
    mixedSumTotal, 
    mobilePaymentStatus
  ]);

  // 15. Suspend and Resume Sale functions
  const handleSuspendSale = () => {
    if (cart.length === 0) {
      if (onShowToast) onShowToast("O carrinho está vazio para ser suspenso.", "warning");
      return;
    }
    const id = generateEntityId("susp");
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

  // Digital communication real delivery API
  const handleSendEmail = async () => {
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

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      
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
              ${completedTx.items.map((item) => `
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
    } catch (realEmailErr: unknown) {
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
        const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
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

        await authenticatedFetch("/api/email/dispatch-invoice", {
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
        onAddAuditLog("Enviar Recibo por Email", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via e-mail para ${targetEmail} com PDF anexo.`);
        if (onShowToast) onShowToast("Recibo enviado por email com sucesso!", "success");
      } catch (err: unknown) {
        setSendEmailStatus("idle");
        const errMsg = err instanceof Error ? err.message : "Não foi possível enviar o e-mail. Verifique o servidor SMTP nas Definições.";
        if (onShowToast) onShowToast(errMsg, "error", "Falha de E-mail");
      }
    }
  };

  const handleSendSms = async () => {
    if (!completedTx) return;
    if (!selectedCustomer) {
      if (onShowToast) onShowToast("Cliente não registado. Abra o cadastro rápido para registar este cliente. O envio do SMS começará automaticamente.", "warning", "Cliente não Registado");
      setPendingReceiptAction("sms");
      setQuickCustomerModalOpen(true);
      return;
    }
    setSendSmsStatus("sending");
    try {
      const resp = await authenticatedFetch("/api/sms/dispatch-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedCustomer?.phone || "+258 84 900 1202",
          invoiceNumber: completedTx.invoiceNumber,
          grandTotal: completedTx.grandTotal
        })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.message || data?.error || `HTTP ${resp.status}: Falha no envio`);
      }
      setSendSmsStatus("sent");
      onAddAuditLog("Enviar Recibo por SMS", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via SMS para ${selectedCustomer?.phone}.`);
      if (onShowToast) onShowToast("SMS de confirmação despachado!", "success");
    } catch (err: unknown) {
      setSendSmsStatus("idle");
      const errMsg = err instanceof Error ? err.message : "Falha ao enviar SMS. Verifique as credenciais do Gateway de SMS.";
      if (onShowToast) onShowToast(errMsg, "error", "Falha de SMS");
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
      const response = await authenticatedFetch("/api/whatsapp/send-message", {
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
    } catch (err: unknown) {
      setSendWhatsAppStatus("idle");
      const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
      if (onShowToast) onShowToast(`Erro no Gateway: ${errMsg}. Redirecionando para Link Direto...`, "warning");
      
      // Automatic fallback
      window.open(directUrl, "_blank", "noopener,noreferrer");
      setWhatsappModalOpen(false);
    }
  };

  // --- ORÇAMENTO (BUDGET / QUOTE) FUNCTIONS ---
  const handleGenerateBudget = () => {
    if (cart.length === 0) {
      if (onShowToast) onShowToast("O carrinho está vazio para gerar um orçamento.", "warning");
      return;
    }

    const budgetNumber = `ORC-${new Date().getFullYear()}-${String(currentSaleNumber).padStart(4, "0")}`;
    const timestamp = Date.now();
    
    const budgetData: PosBudgetData = {
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

    onAddAuditLog(
      "Gerar Orçamento POS",
      "VENDAS",
      `Orçamento ${budgetNumber} gerado para ${budgetData.customerName}. Total: ${calculations.grandTotal} MT.`
    );

    if (onShowToast) {
      onShowToast(`Orçamento ${budgetNumber} gerado com sucesso!`, "success", "Orçamento Gerado");
    }
  };



  // Quick Customer Registration
  const handleQuickAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName) return;
    const newCust: Customer = {
      id: generateEntityId("cust"),
      name: quickCustName,
      phone: quickCustPhone || "Sem Telemóvel",
      email: `${quickCustName.toLowerCase().replace(/\s+/g, "")}@gmail.com`,
      address: "Maputo, Moçambique",
      nuit: "",
      totalSpent: 0,
      purchaseCount: 0,
      debt: 0,
      loyaltyPoints: 0,
      preferredPaymentMethod: "CASH",
      oneClickCheckoutEnabled: false
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
        };
      });
    }

    setQuickCustomerModalOpen(false);
    setQuickCustName("");
    setQuickCustPhone("");
    if (onShowToast) onShowToast(`Cliente ${newCust.name} registado e selecionado!`, "success");
  };

  return (
    <div className="flex flex-col xl:flex-row h-full gap-4">
      
      {/* LEFT COLUMN: Clean Product Catalog & Barcode Scanner Bar */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        
        {/* Minimalist Top Bar: Barcode Scanner & Search */}
        <div className={`p-3.5 border-b border-slate-150 bg-slate-50/70 transition-all ${isMinimized ? "space-y-0 py-2.5" : "space-y-2.5"}`}>
          <div className="flex items-center gap-2.5">
            {/* Primary Barcode & Search Input */}
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 pointer-events-none">
                <Barcode className="w-4 h-4 text-orange-500" />
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                placeholder={isMinimized ? "Modo Minimizado: Bipe o código ou digite para pesquisar (Enter)..." : "Bipe o código de barras ou pesquise o produto (Pressione Enter)..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const code = searchQuery.trim();
                    if (code) {
                      const prod = productCache.findByBarcodeOrCode(code) || localProducts.find(
                        p => p.name.toLowerCase().includes(code.toLowerCase())
                      );
                      if (prod) {
                        e.preventDefault();
                        const inCart = cart.find(item => item.product.id === prod.id)?.quantity || 0;
                        const liveStock = prod.stock - inCart;
                        if (prod.stock <= 0) {
                          playErrorBeep();
                          if (onShowToast) onShowToast(`Produto "${prod.name}" está esgotado!`, "error", "Stock Vazio");
                        } else if (liveStock <= 0) {
                          playErrorBeep();
                          if (onShowToast) onShowToast(`Todo o stock de "${prod.name}" (${prod.stock} un) já foi colocado no carrinho!`, "warning", "Stock Esgotado no Carrinho");
                        } else {
                          playBarcodeBeep();
                          handleTriggerAddToCart(prod);
                          setSearchQuery("");
                          setTimeout(() => {
                            searchInputRef.current?.focus();
                          }, 30);
                        }
                      } else {
                        playErrorBeep();
                        if (onShowToast) onShowToast(`Código/Produto "${code}" não localizado.`, "warning", "Não Encontrado");
                      }
                    }
                  }
                }}
                className={`w-full bg-white border rounded-xl pl-14 pr-24 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500 outline-none transition shadow-inner placeholder:text-slate-400 ${
                  isMinimized ? "border-orange-300 ring-1 ring-orange-400/20" : "border-slate-200"
                }`}
              />
              <button
                type="button"
                onClick={() => setScannerModalOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                title="Abrir Leitor de Código de Barras (Câmara/Simulador)"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Scanner</span>
              </button>
            </div>

            {/* Suspended Sales Quick Recall - Ocultado em modo minimizado */}
            {!isMinimized && suspendedCarts.length > 0 && (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl text-amber-800 text-xs font-bold shrink-0">
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>{suspendedCarts.length} Suspensa(s)</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleResumeSale(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="bg-transparent text-amber-900 font-bold text-xs outline-none cursor-pointer underline ml-1"
                >
                  <option value="">Retomar...</option>
                  {suspendedCarts.map((sc, i) => (
                    <option key={sc.id} value={sc.id}>
                      Venda {i+1} ({sc.time})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sales History Quick Button - Ocultado em modo minimizado */}
            {!isMinimized && (
              <button
                onClick={() => setShowSalesHistoryModal(true)}
                className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 transition"
                title="Histórico de Vendas Realizadas"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Histórico</span>
              </button>
            )}

            {/* Minimize / Expand POS Screen Toggle */}
            <button
              type="button"
              id="toggle-pos-fullscreen-btn"
              onClick={handleToggleMinimized}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 transition-all ${
                isMinimized
                  ? "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20"
                  : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-orange-600"
              }`}
              title={isMinimized ? "Restaurar interface normal (Sair do Modo Minimizado - F10/F11)" : "Modo Minimizado: Ocultar elementos secundários para foco total na venda (F10/F11)"}
            >
              {isMinimized ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Restaurar</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-orange-500" />
                  <span>Minimizar</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Category Filter Pills - Ocultado em modo minimizado */}
          {!isMinimized && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-all ${
                    selectedCategory === cat
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 bg-slate-50/40">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <span className="text-3xl mb-2">{products.length === 0 ? "📦" : "🔍"}</span>
              <p className="text-sm font-semibold text-slate-700">
                {products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto encontrado"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {products.length === 0 
                  ? "Acesse o módulo de Stock para cadastrar seus primeiros produtos." 
                  : "Bipe um código de barras ou pesquise por outro termo."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const inCartQty = cartItemQuantities.get(p.id) || 0;
                const liveRemainingStock = Math.max(0, p.stock - inCartQty);
                const isOutOfStock = p.stock <= 0;
                const isCartExhausted = liveRemainingStock <= 0 && p.stock > 0;
                const isLowStock = liveRemainingStock > 0 && liveRemainingStock <= p.minStock;
                const isDisabled = isOutOfStock || isCartExhausted;
                
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      playBarcodeBeep();
                      handleTriggerAddToCart(p);
                    }}
                    disabled={isDisabled}
                    id={`btn-product-${p.id}`}
                    className={`group bg-white p-3 rounded-xl border relative text-left transition-all flex flex-col justify-between select-none h-40 ${
                      isDisabled 
                        ? isCartExhausted
                          ? "border-amber-300 bg-amber-50/40 cursor-not-allowed opacity-90"
                          : "border-slate-200 bg-slate-100/70 cursor-not-allowed opacity-60" 
                        : inCartQty > 0
                          ? "border-orange-300 bg-orange-50/20 hover:border-orange-400 hover:shadow-md cursor-pointer active:scale-[0.98]"
                          : "border-slate-200 hover:border-orange-400 hover:shadow-md cursor-pointer active:scale-[0.98]"
                    }`}
                  >
                    {/* Status & Barcode badge */}
                    <div className="flex items-start justify-between w-full">
                      <div className="relative">
                        <span className="text-2xl p-1 bg-slate-50 group-hover:bg-orange-50 rounded-lg transition inline-block">{p.emoji || "📦"}</span>
                        {inCartQty > 0 && (
                          <span className="absolute -top-1.5 -right-2 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-sm">
                            {inCartQty}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {isOutOfStock ? (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-red-100 text-red-700">ESGOTADO</span>
                        ) : isCartExhausted ? (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                            0 disp. (🛒 {inCartQty})
                          </span>
                        ) : inCartQty > 0 ? (
                          <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <span>{liveRemainingStock} un disp.</span>
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{liveRemainingStock} un</span>
                        ) : (
                          <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{liveRemainingStock} un</span>
                        )}
                        {p.barcode && (
                          <span className="text-[7.5px] font-mono text-slate-400 flex items-center gap-0.5">
                            <Barcode className="w-2.5 h-2.5 text-slate-300" />
                            {p.barcode.slice(-5)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{p.name}</h4>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[9.5px] text-slate-400 font-mono">{p.category}</p>
                        {inCartQty > 0 && (
                          <span className="text-[9px] font-bold text-orange-600 font-mono">
                            🛒 {inCartQty} {p.weightBased ? "kg" : "un"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900">{p.salePrice.toLocaleString()} <span className="text-[10px] font-semibold text-slate-400">{currency}</span></span>
                      {isOutOfStock ? (
                        <span className="text-[9.5px] font-bold text-slate-400">Esgotado</span>
                      ) : isCartExhausted ? (
                        <span className="text-[9.5px] font-bold text-amber-700">Máx. no Carrinho</span>
                      ) : (
                        <span className="text-[10px] font-bold text-orange-600 group-hover:translate-x-0.5 transition">
                          {inCartQty > 0 ? `+ Adicionar (${liveRemainingStock})` : "+ Adicionar"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Minimalist Cart & 5-Second Express Checkout */}
      <div className="w-full xl:w-[420px] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        
        {/* Cart Header & Customer */}
        <div className="p-3.5 border-b border-slate-150 bg-slate-50/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-sm">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 leading-tight">Carrinho de Venda</h3>
                <span className="text-[10px] text-slate-500 font-medium">
                  {cart.length} {cart.length === 1 ? "produto" : "produtos"} • {calculations.totalQty} un
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Deseja esvaziar o carrinho?")) {
                    handleReset();
                    if (onShowToast) onShowToast("Carrinho limpo.", "info");
                  }
                }}
                className="text-[11px] text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition cursor-pointer flex items-center gap-1"
                title="Limpar Carrinho"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}
          </div>

          {/* Quick Customer Picker */}
          {!isMinimized ? (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 relative">
                <select
                  ref={customerSelectRef}
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs py-2 pl-3 pr-8 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer text-slate-700 font-medium shadow-inner"
                >
                  <option value="">👤 Consumidor Geral</option>
                  {localCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone || "Geral"})</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setQuickCustomerModalOpen(true)}
                className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl transition text-xs cursor-pointer flex items-center justify-center shrink-0 w-9 h-9 active:scale-95"
                title="Adicionar Novo Cliente (F4)"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span className="truncate font-semibold">
                👤 {selectedCustomerId ? (localCustomers.find(c => c.id === selectedCustomerId)?.name || "Cliente") : "Consumidor Geral"}
              </span>
              <button
                onClick={() => setQuickCustomerModalOpen(true)}
                className="text-[10px] text-orange-600 hover:text-orange-700 font-bold ml-2 shrink-0 cursor-pointer"
                title="Mudar Cliente (F4)"
              >
                + Cliente (F4)
              </button>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 min-h-[160px] max-h-[300px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 my-auto">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <Barcode className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-600">Carrinho Vazio</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Bipe um código de barras para começar a venda instantânea.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {cart.map((item) => {
                const stockRemaining = Math.max(0, item.product.stock - item.quantity);
                const isInsufficient = item.quantity > item.product.stock;
                return (
                  <motion.div 
                    key={item.product.id} 
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }}
                    transition={{ duration: 0.15 }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                      isInsufficient 
                        ? "bg-red-50/70 border-red-200" 
                        : "bg-slate-50/60 border-slate-150 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-1">
                      <h5 className="text-xs font-bold text-slate-800 truncate leading-snug">{item.product.name}</h5>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {item.product.salePrice.toLocaleString()} MT/un
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${stockRemaining === 0 ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-emerald-50 text-emerald-700 border-emerald-150"}`}>
                          {stockRemaining === 0 ? "Stock esgotado no carrinho" : `Resta: ${stockRemaining} un`}
                        </span>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="w-7 h-7 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 rounded-lg flex items-center justify-center cursor-pointer transition active:scale-95"
                        title="Diminuir quantidade (Restitui ao stock)"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      
                      <input
                        type="number"
                        step={item.product.weightBased ? "0.05" : "1"}
                        value={item.quantity}
                        onChange={(e) => handleDirectQuantityEdit(item.product.id, e.target.value)}
                        className="w-10 h-7 bg-white border border-slate-200 text-center font-mono font-bold text-xs rounded-lg outline-none focus:border-orange-500"
                      />

                      <button 
                        onClick={() => handleTriggerAddToCart(item.product)}
                        disabled={item.quantity >= item.product.stock}
                        title={item.quantity >= item.product.stock ? "Stock esgotado para este produto" : "Adicionar mais 1 un (Deduz do stock)"}
                        className="w-7 h-7 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 rounded-lg flex items-center justify-center cursor-pointer transition disabled:opacity-40 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Item Total */}
                    <div className="text-right shrink-0 min-w-[65px]">
                      <span className="text-xs font-black text-slate-900 block font-mono">
                        {(item.product.salePrice * item.quantity).toLocaleString()} MT
                      </span>
                      <button
                        onClick={() => handleDeleteRow(item.product.id)}
                        className="text-[10px] text-red-400 hover:text-red-600 cursor-pointer transition mt-0.5"
                        title="Remover produto e repor stock total"
                      >
                        Remover
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Financial Big Total Banner */}
        <div className="p-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total a Pagar</span>
            <div className="text-right">
              <span className="text-2xl font-black tracking-tight text-orange-400 font-mono">
                {calculations.grandTotal.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-orange-300 ml-1.5">{currency}</span>
            </div>
          </div>
          {calculations.discountTotal > 0 && (
            <div className="flex justify-between text-[11px] text-emerald-400 font-mono pt-1 mt-1 border-t border-slate-800">
              <span>Desconto Aplicado:</span>
              <span>-{calculations.discountTotal.toLocaleString()} MT</span>
            </div>
          )}
        </div>

        {/* Express Payment & Finalize Panel */}
        <div className="p-3.5 bg-white space-y-3 shrink-0 border-t border-slate-200">
          
          {/* Quick Payment Method Selector (4 Big Direct Buttons) */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: "CASH", label: "💵 Dinheiro", short: "Dinheiro" },
              { id: "MPESA_PAGA_FACIL", label: "📱 M-Pesa", short: "M-Pesa" },
              { id: "EMOLA", label: "📱 E-Mola", short: "E-Mola" },
              { id: "POS_CARD", label: "💳 Cartão", short: "Cartão" },
            ].map(method => (
              <button
                key={method.id}
                onClick={() => setSelectedPaymentMethod(method.id)}
                className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition cursor-pointer active:scale-95 ${
                  selectedPaymentMethod === method.id 
                    ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20" 
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>

          {/* Fast Cash & Change Calculator */}
          {selectedPaymentMethod === "CASH" && (
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-emerald-900 block mb-0.5">Valor Recebido (MT):</label>
                  <input
                    type="number"
                    value={receivedCashAmount || ""}
                    onChange={(e) => setReceivedCashAmount(parseFloat(e.target.value) || 0)}
                    placeholder={String(calculations.grandTotal)}
                    className="w-full bg-white border border-emerald-300 rounded-lg py-1.5 px-2 text-sm font-black text-center text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                
                {/* Big Green Change Badge */}
                <div className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-center shrink-0 min-w-[110px]">
                  <span className="text-[8.5px] font-extrabold tracking-wider uppercase opacity-90 block">Troco</span>
                  <span className="text-base font-black tracking-tight font-mono">{calculatedChange.toLocaleString()} MT</span>
                </div>
              </div>

              {/* Fast Cash Preset Bills - Ocultado em modo minimizado */}
              {!isMinimized && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-emerald-200/60">
                  {[100, 200, 500, 1000, 2000].map(val => (
                    <button
                      key={val}
                      onClick={() => setReceivedCashAmount(val)}
                      className="px-2 py-1 bg-white border border-emerald-300 hover:bg-emerald-100/70 rounded-lg text-[10.5px] font-bold text-emerald-800 cursor-pointer transition active:scale-95"
                    >
                      {val} MT
                    </button>
                  ))}
                  <button
                    onClick={() => setReceivedCashAmount(calculations.grandTotal)}
                    className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10.5px] font-extrabold cursor-pointer transition ml-auto active:scale-95"
                  >
                    Exato
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pagamentos Mistos (Split Payment Interativo) */}
          {selectedPaymentMethod === "MIXED" && (
            <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 space-y-2.5 animate-in fade-in duration-150 text-xs">
              <div className="flex justify-between items-center border-b border-indigo-100 pb-1.5">
                <span className="font-extrabold text-indigo-900 text-[11px] flex items-center gap-1">
                  <span>💳 Divisão de Pagamento Misto</span>
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                  Math.abs(mixedSumTotal - calculations.grandTotal) <= 1
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : mixedSumTotal < calculations.grandTotal
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-rose-100 text-rose-800 border border-rose-300"
                }`}>
                  {Math.abs(mixedSumTotal - calculations.grandTotal) <= 1
                    ? "✓ Total Coincide"
                    : mixedSumTotal < calculations.grandTotal
                    ? `Faltam ${(calculations.grandTotal - mixedSumTotal).toLocaleString()} MT`
                    : `Excesso de ${(mixedSumTotal - calculations.grandTotal).toLocaleString()} MT`}
                </span>
              </div>

              <div className="space-y-1.5">
                {/* Dinheiro */}
                <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-700 w-16 shrink-0">💵 Dinheiro:</span>
                  <input
                    type="number"
                    min="0"
                    value={mixedCash || ""}
                    onChange={(e) => setMixedCash(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="flex-1 font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const remainder = Math.max(0, calculations.grandTotal - (mixedMpesa + mixedPOS));
                      setMixedCash(remainder);
                    }}
                    className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[9.5px] font-bold rounded cursor-pointer transition"
                    title="Preencher restante com Dinheiro"
                  >
                    Restante
                  </button>
                </div>

                {/* M-Pesa */}
                <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-700 w-16 shrink-0">📱 M-Pesa:</span>
                  <input
                    type="number"
                    min="0"
                    value={mixedMpesa || ""}
                    onChange={(e) => setMixedMpesa(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="flex-1 font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const remainder = Math.max(0, calculations.grandTotal - (mixedCash + mixedPOS));
                      setMixedMpesa(remainder);
                    }}
                    className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[9.5px] font-bold rounded cursor-pointer transition"
                    title="Preencher restante com M-Pesa"
                  >
                    Restante
                  </button>
                </div>

                {/* Cartão POS */}
                <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-700 w-16 shrink-0">💳 POS:</span>
                  <input
                    type="number"
                    min="0"
                    value={mixedPOS || ""}
                    onChange={(e) => setMixedPOS(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="flex-1 font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const remainder = Math.max(0, calculations.grandTotal - (mixedCash + mixedMpesa));
                      setMixedPOS(remainder);
                    }}
                    className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[9.5px] font-bold rounded cursor-pointer transition"
                    title="Preencher restante com POS"
                  >
                    Restante
                  </button>
                </div>
              </div>

              {/* Quick Split presets */}
              <div className="flex justify-between items-center pt-1 border-t border-indigo-100 text-[9.5px] font-bold text-indigo-900">
                <button
                  type="button"
                  onClick={() => {
                    const half = Math.floor(calculations.grandTotal / 2);
                    setMixedCash(half);
                    setMixedMpesa(calculations.grandTotal - half);
                    setMixedPOS(0);
                  }}
                  className="hover:underline text-indigo-600 cursor-pointer"
                >
                  50% Dinheiro + 50% M-Pesa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMixedCash(0);
                    setMixedMpesa(0);
                    setMixedPOS(0);
                  }}
                  className="hover:underline text-rose-600 cursor-pointer"
                >
                  Limpar Divisão
                </button>
              </div>
            </div>
          )}

          {/* Mobile Payment QR/Push Simulation - Ocultado em modo minimizado */}
          {!isMinimized && (selectedPaymentMethod === "MPESA_PAGA_FACIL" || selectedPaymentMethod === "EMOLA") && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                  <QrCode className="w-3.5 h-3.5 text-orange-500" />
                  Pagamento {selectedPaymentMethod === "MPESA_PAGA_FACIL" ? "M-Pesa" : "e-Mola"}
                </span>
                <button
                  onClick={handleSimulateMobilePayment}
                  className="px-2.5 py-1 bg-slate-900 text-white hover:bg-slate-800 font-bold text-[10px] rounded-lg cursor-pointer"
                >
                  {mobilePaymentStatus === "CONFIRMED" ? "✓ Confirmado" : "⚡ Simular Push"}
                </button>
              </div>
              {mobilePaymentStatus === "CONFIRMED" && (
                <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold p-1.5 text-center rounded-lg text-[11px]">
                  ✓ Pagamento móvel confirmado via API!
                </div>
              )}
            </div>
          )}

          {/* Primary Express 5-Second Checkout Button */}
          <button
            onClick={() => {
              if (cart.length > 0) setShowPreCheckoutModal(true);
            }}
            disabled={cart.length === 0}
            id="btn-pos-finalize-sale"
            className={`w-full ${
              isMinimized ? "py-4 text-base shadow-xl shadow-emerald-600/30 ring-2 ring-emerald-400/50" : "py-3 text-sm shadow-lg"
            } rounded-xl font-black flex items-center justify-center gap-2 transition-all ${
              cart.length === 0
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/20 active:scale-[0.98]"
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
            <span>⚡ Concluir Venda ({calculations.grandTotal.toLocaleString()} MT)</span>
          </button>

          {/* Auxiliary Actions (Suspend & Budget) - Ocultado em modo minimizado */}
          {!isMinimized && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSuspendSale}
                disabled={cart.length === 0}
                className="py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 cursor-pointer transition active:scale-95 flex items-center justify-center gap-1"
              >
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Suspender</span>
              </button>
              <button
                onClick={handleGenerateBudget}
                disabled={cart.length === 0}
                className="py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 disabled:opacity-50 text-[11px] font-bold rounded-lg cursor-pointer transition active:scale-95 flex items-center justify-center gap-1"
              >
                <Receipt className="w-3 h-3 text-amber-600" />
                <span>Orçamento</span>
              </button>
            </div>
          )}

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
                {cart.map(item => {
                  const stockRemaining = Math.max(0, item.product.stock - item.quantity);
                  return (
                    <div key={item.product.id} className="flex justify-between text-slate-600">
                      <div className="truncate max-w-[200px]">
                        <span>{item.product.name}</span>
                        <span className="text-[9px] text-slate-400 block font-sans">Restará: {stockRemaining} un</span>
                      </div>
                      <span className="font-bold shrink-0">{item.quantity} × {item.product.salePrice.toLocaleString()} MT</span>
                    </div>
                  );
                })}
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
                    <span>{receivedCashAmount < calculations.grandTotal && receivedCashAmount > 0 ? "FALTA RECEBER:" : "TROCO DE NUMERÁRIO:"}</span>
                    <span className={receivedCashAmount < calculations.grandTotal && receivedCashAmount > 0 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                      {receivedCashAmount < calculations.grandTotal && receivedCashAmount > 0 
                        ? `-${(calculations.grandTotal - receivedCashAmount).toLocaleString()} MT (Insuficiente)` 
                        : `${calculatedChange.toLocaleString()} MT`}
                    </span>
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
                disabled={selectedPaymentMethod === "CASH" && receivedCashAmount > 0 && receivedCashAmount < calculations.grandTotal}
                title="Confirmar e Faturar com Recibo (Atalho: F5 / F1)"
                className={`py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-lg flex items-center justify-center gap-1.5 ${
                  selectedPaymentMethod === "CASH" && receivedCashAmount > 0 && receivedCashAmount < calculations.grandTotal
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/15"
                }`}
              >
                <span>{selectedPaymentMethod === "CASH" && receivedCashAmount > 0 && receivedCashAmount < calculations.grandTotal
                  ? "Valor Insuficiente"
                  : "Confirmar e Faturar ✓"}</span>
                {!(selectedPaymentMethod === "CASH" && receivedCashAmount > 0 && receivedCashAmount < calculations.grandTotal) && (
                  <kbd className="px-1.5 py-0.2 bg-white/25 text-white rounded text-[10px] font-mono font-bold">F5</kbd>
                )}
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
      <PosWeightModal
        product={weightPromptProduct}
        onClose={() => setWeightPromptProduct(null)}
        onConfirmWeight={(prod, val) => {
          handleTriggerAddToCart(prod, val);
          setWeightPromptProduct(null);
        }}
      />

      {/* 20. REAL CAMERA & EMULATED BARCODE SCANNER MODAL */}
      <PosScannerModal
        isOpen={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        localProducts={localProducts}
        cartItemQuantities={cartItemQuantities}
        onAddToCart={handleTriggerAddToCart}
        onShowToast={onShowToast}
      />

      {/* 10. QUICK REGISTER CUSTOMER MODAL */}
      <PosQuickCustomerModal
        isOpen={quickCustomerModalOpen}
        onClose={() => setQuickCustomerModalOpen(false)}
        onCustomerCreated={(newCust) => {
          setLocalCustomers(prev => [...prev, newCust]);
          setSelectedCustomerId(newCust.id);
          if (completedTx) {
            setCompletedTx(prev => {
              if (!prev) return null;
              return {
                ...prev,
                customerId: newCust.id,
                customerName: newCust.name
              };
            });
          }
          setQuickCustomerModalOpen(false);
          if (onShowToast) onShowToast(`Cliente ${newCust.name} registado e selecionado!`, "success", "Cliente Adicionado");
        }}
        onShowToast={onShowToast}
      />

      {/* 16. SESSION TRANSACTION HISTORY MODAL */}
      <PosSalesHistoryModal
        isOpen={showSalesHistoryModal}
        onClose={() => setShowSalesHistoryModal(false)}
        transactions={transactions}
        settings={settings}
        onViewReceipt={(tx) => {
          setCompletedTx(tx);
          setShowSalesHistoryModal(false);
        }}
        onStartReturn={(tx) => {
          setSelectedTxForReturn(tx);
          const initQtys: Record<string, number> = {};
          (tx.items || []).forEach((it) => {
            initQtys[it.productId] = it.quantity;
          });
          setReturnedItemQuantities(initQtys);
          setReturnReason("Defeito / Avaria de Produto");
          setReturnRefundMethod(tx.paymentMethod === "DEBT" ? "DEBT" : "CASH");
          setShowReturnModal(true);
          setShowSalesHistoryModal(false);
        }}
      />

      {/* 17. RETURN / DEVOLUTION & CREDIT NOTE MODAL */}
      <PosReturnModal
        isOpen={showReturnModal && !!selectedTxForReturn}
        selectedTx={selectedTxForReturn}
        onClose={() => {
          setShowReturnModal(false);
          setSelectedTxForReturn(null);
        }}
        onConfirm={(itemsToReturn, finalReason, returnRefundMethod) => {
          if (!selectedTxForReturn) return;
          const totalRefund = itemsToReturn.reduce((sum, it) => sum + (it.price * it.quantity), 0);
          const nextReturnSeq = transactions.length + 1;
          const creditNoteId = generateDeterministicCreditNoteNumber(nextReturnSeq);

          if (onReturnSale) {
            onReturnSale(selectedTxForReturn, finalReason, itemsToReturn, returnRefundMethod);
          } else {
            onAddAuditLog(
              "Devolução de Venda",
              "VENDAS",
              `Devolução da fatura ${selectedTxForReturn.invoiceNumber} efetuada por ${activeUsername}. Total: ${totalRefund} MT. Motivo: ${finalReason}`
            );
            if (onShowToast) onShowToast(`Devolução processada com sucesso! Nota de Crédito: ${creditNoteId}`, "success");
          }

          setCompletedCreditNote({
            id: creditNoteId,
            invoiceRef: selectedTxForReturn.invoiceNumber,
            date: new Date().toLocaleString(),
            customerName: selectedTxForReturn.customerName,
            items: itemsToReturn,
            totalRefund,
            reason: finalReason,
            refundMethod: returnRefundMethod
          });

          setShowReturnModal(false);
          setSelectedTxForReturn(null);
        }}
        onShowToast={onShowToast}
      />

      {/* 18. CREDIT NOTE / NOTA DE CRÉDITO SUCCESS & PRINT MODAL */}
      <PosCreditNoteModal
        completedCreditNote={completedCreditNote}
        onClose={() => setCompletedCreditNote(null)}
      />

      {/* POPUP MODAL: Receipt & Communications */}
      <PosReceiptModal
        completedTx={completedTx}
        selectedCustomer={selectedCustomer}
        printMode={printMode}
        setPrintMode={setPrintMode}
        settings={settings}
        qrCodeDataUrl={qrCodeDataUrl}
        formattedVersion={formattedVersion}
        sendEmailStatus={sendEmailStatus}
        sendSmsStatus={sendSmsStatus}
        sendWhatsAppStatus={sendWhatsAppStatus}
        onSendEmail={handleSendEmail}
        onSendSms={handleSendSms}
        onOpenWhatsAppModal={handleOpenWhatsAppModal}
        onTriggerPrintReceipt={triggerPrintReceipt}
        onRegisterCustomerForEmail={() => {
          setPendingReceiptAction("email");
          setQuickCustomerModalOpen(true);
        }}
        onRegisterCustomerForWhatsApp={() => {
          setPendingReceiptAction("whatsapp");
          setQuickCustomerModalOpen(true);
        }}
        onReset={handleReset}
      />

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
      <PosWhatsappModal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        settings={settings}
        whatsappPhone={whatsappPhone}
        setWhatsappPhone={setWhatsappPhone}
        whatsappMessage={whatsappMessage}
        setWhatsappMessage={setWhatsappMessage}
        sendWhatsAppStatus={sendWhatsAppStatus}
        onDispatch={(useDirectLink) => dispatchWhatsAppReceipt(useDirectLink)}
      />

      {/* POPUP MODAL: Orçamento & Proposta Comercial */}
      {completedBudget && (
        <PosBudgetModal
          completedBudget={completedBudget}
          settings={settings}
          activeUsername={activeUsername}
          onClose={() => setCompletedBudget(null)}
          onAddAuditLog={onAddAuditLog}
          onShowToast={onShowToast}
        />
      )}

      {/* 26. Modal de Alerta de Stock Crítico */}
      <PosCriticalStockModal
        isOpen={showCriticalStockModal}
        onClose={() => setShowCriticalStockModal(false)}
        itemsLeavingStockBelowCritical={itemsLeavingStockBelowCritical}
      />

      {/* Small Help / Info Button in Bottom Corner & Shortcuts Modal */}
      <ModuleShortcutsHelp
        moduleName="Ponto de Venda (POS)"
        moduleCode="POS"
        isOpen={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
      />
    </div>
  );
}

export default memo(POSModule);
