import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Package, 
  Plus, 
  Edit3, 
  AlertTriangle, 
  TrendingUp, 
  Upload, 
  Trash2, 
  CheckCircle,
  HelpCircle,
  Search,
  Calendar,
  MoreVertical,
  Copy,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Info,
  Filter,
  BarChart3,
  List,
  Eye,
  PlusCircle,
  MinusCircle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  DollarSign,
  Download,
  Percent,
  RefreshCw,
  X,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  MapPin,
  ArrowLeftRight
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product, UserRole, Transaction, SystemSettings, StockTransfer } from "../types";
import BatchManager from "./BatchManager";
import { useConfirm } from "../hooks/useConfirm";
import { PromoFlyerGenerator } from "./PromoFlyerGenerator";

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

interface StockModuleProps {
  products: Product[];
  transactions?: Transaction[];
  onAddProduct: (p: Product) => void;
  onUpdateProduct: (p: Product) => void;
  onDeleteProduct: (pId: string) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currentRole: UserRole;
  currency: string;
  settings?: SystemSettings;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
  onUpdateSettings?: (settings: Partial<SystemSettings>) => void;
}

export default function StockModule({
  products,
  transactions = [],
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddAuditLog,
  currentRole,
  currency,
  settings,
  onShowToast,
  onUpdateSettings
}: StockModuleProps) {
  const confirm = useConfirm();
  
  // Local sub-tabs inside Stock module: "list" | "charts" | "reports" | "batches" | "branches"
  const [activeModuleTab, setActiveModuleTab] = useState<"list" | "charts" | "reports" | "batches" | "branches">("list");

  // Automated Batch Expiry Detection and Toast Alert
  const expiringBatchesInfo = useMemo(() => {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + 30);

    const activeBatches = settings?.batches || [];
    
    const expiring = activeBatches.filter((batch: any) => {
      if (batch.quantity <= 0 || !batch.expiryDate) return false;
      const expiry = new Date(batch.expiryDate);
      return expiry <= limitDate;
    });

    const expired = expiring.filter((batch: any) => {
      const expiry = new Date(batch.expiryDate);
      return expiry < today;
    });

    const warning = expiring.filter((batch: any) => {
      const expiry = new Date(batch.expiryDate);
      return expiry >= today;
    });

    return {
      all: expiring,
      expired,
      warning,
      count: expiring.length
    };
  }, [settings?.batches]);

  // Prevent multiple toast triggers on state re-renders using a Ref
  const lastNotifiedCountRef = useRef<number>(-1);

  useEffect(() => {
    if (expiringBatchesInfo.count > 0 && onShowToast && lastNotifiedCountRef.current !== expiringBatchesInfo.count) {
      lastNotifiedCountRef.current = expiringBatchesInfo.count;
      const msg = expiringBatchesInfo.expired.length > 0 
        ? `Atenção: Existem ${expiringBatchesInfo.count} lotes críticos! (${expiringBatchesInfo.expired.length} já vencidos e ${expiringBatchesInfo.warning.length} próximos do vencimento em menos de 30 dias).`
        : `Alerta de Validade: Existem ${expiringBatchesInfo.count} lotes ativos próximos do vencimento (menos de 30 dias).`;
      
      onShowToast(msg, "warning");
    }
  }, [expiringBatchesInfo.count, expiringBatchesInfo.expired.length, expiringBatchesInfo.warning.length, onShowToast]);

  // Local state for filters and search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedSupplier, setSelectedSupplier] = useState("Todos");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW_STOCK" | "EXPIRED" | "OUT_OF_STOCK">("ALL");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minMarginFilter, setMinMarginFilter] = useState<number>(0);

  // States for Stock Reports tab
  const [reportStartDate, setReportStartDate] = useState(() => {
    const today = new Date();
    const past = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
    return past.toISOString().split("T")[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [reportType, setReportType] = useState<"MOVEMENTS" | "VALUATION" | "EXPIRATION">("VALUATION");
  const [reportCategory, setReportCategory] = useState("Todos");
  const [reportSearchQuery, setReportSearchQuery] = useState("");

  // Sorting state
  const [sortField, setSortField] = useState<keyof Product | "profit" | "stockValue" | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Selection states
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Slide-over detail panel state
  const [detailedProduct, setDetailedProduct] = useState<Product | null>(null);

  // Quick Adjustment Modal state
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"IN" | "OUT">("IN");
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");

  // Action Dropdowns open state (stores productId of open dropdown)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [sendingProductAlertId, setSendingProductAlertId] = useState<string | null>(null);

  // New replenishment order system states
  const [isReplenishmentModalOpen, setIsReplenishmentModalOpen] = useState(false);
  const [replenishSuccessMsg, setReplenishSuccessMsg] = useState("");
  const [isConfirmingReplenish, setIsConfirmingReplenish] = useState(false);

  // Batch management form states
  const [batchProductId, setBatchProductId] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [batchQty, setBatchQty] = useState<number>(50);
  const [batchCost, setBatchCost] = useState<number>(0);
  const [batchExpiry, setBatchExpiry] = useState("");
  const [batchSupplier, setBatchSupplier] = useState("");

  // Stock transfer form states
  const [transferOriginBranchId, setTransferOriginBranchId] = useState("central");
  const [transferDestBranchId, setTransferDestBranchId] = useState("matola");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferQty, setTransferQty] = useState<number>(10);

  const handleSendWhatsAppStockAlert = async (product: Product) => {
    if (!settings || !settings.managerWhatsappPhone) {
      if (onShowToast) onShowToast("Contacto do Gestor não configurado nas definições de Gateway de Integração.", "warning");
      return;
    }

    const text = `⚠️ *Alerta de Reposição - OST Vendas* ⚠️\n\n*Produto:* ${product.name}\n*Referência/SKU:* ${product.code}\n*Quantidade em Stock:* ${product.stock} un\n*Nível de Alerta Mínimo:* ${product.minStock} un\n\nPor favor, providencie a reposição imediata deste item comercial.`;
    const targetPhone = settings.managerWhatsappPhone;

    const cleanPhone = targetPhone.replace(/\D/g, "");
    const defaultPhone = cleanPhone.length === 9 && (cleanPhone.startsWith("84") || cleanPhone.startsWith("85") || cleanPhone.startsWith("82") || cleanPhone.startsWith("87") || cleanPhone.startsWith("86"))
      ? `258${cleanPhone}`
      : cleanPhone;

    const directUrl = `https://api.whatsapp.com/send?phone=${defaultPhone}&text=${encodeURIComponent(text)}`;

    setSendingProductAlertId(product.id);

    try {
      if (!settings.whatsappEnabled || settings.whatsappProvider === "DIRECT_LINK") {
        window.open(directUrl, "_blank", "noopener,noreferrer");
        if (onShowToast) onShowToast("Link direto do WhatsApp aberto com sucesso!", "success");
        onAddAuditLog("Enviar Alerta Stock WhatsApp", "ESTOQUE", `Notificação de reposição gerada para ${product.name}.`);
        return;
      }

      const response = await fetch("/api/whatsapp/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: defaultPhone,
          message: text,
          gatewayConfig: settings
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Falha ao enviar através do Gateway de Integração");
      }

      if (resData.mode === "DIRECT_LINK") {
        window.open(resData.directUrl || directUrl, "_blank", "noopener,noreferrer");
        if (onShowToast) onShowToast("Link direto do WhatsApp aberto!", "success");
      } else {
        if (onShowToast) onShowToast(resData.message || "Notificação de reposição enviada com sucesso!", "success");
      }
      onAddAuditLog("Enviar Alerta Stock WhatsApp", "ESTOQUE", `Notificação de reposição de ${product.name} enviada via WhatsApp para o Gestor.`);
    } catch (err: any) {
      if (onShowToast) onShowToast(`Erro no Gateway: ${err.message}. Redirecionando para Link Direto...`, "warning");
      window.open(directUrl, "_blank", "noopener,noreferrer");
    } finally {
      setSendingProductAlertId(null);
    }
  };

  // Excel import sheet state
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "processing" | "success">("idle");
  const [importedRowCount, setImportedRowCount] = useState(0);

  // Add/Edit drawer state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Form Fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("Mercearia");
  const [supplier, setSupplier] = useState("");
  const [costPrice, setCostPrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(16);
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(10);
  const [expiryDate, setExpiryDate] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [imageUrl, setImageUrl] = useState("");
  const [promotion, setPromotion] = useState("");
  const [isFlyerGeneratorOpen, setIsFlyerGeneratorOpen] = useState(false);
  const [flyerProduct, setFlyerProduct] = useState<Product | null>(null);

  // Categories and Suppliers lists
  const categoriesList = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return ["Todos", ...Array.from(list)];
  }, [products]);

  const suppliersList = useMemo(() => {
    const list = new Set(products.map(p => p.supplier).filter(Boolean));
    return ["Todos", ...Array.from(list)];
  }, [products]);

  // Is Supervisor/Admin checks for mutations
  const canMutate = useMemo(() => {
    return currentRole === "ADMIN" || currentRole === "SUPERVISOR";
  }, [currentRole]);

  // Handle column sorting
  const handleSort = (field: keyof Product | "profit" | "stockValue") => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Main stats calculations
  const stats = useMemo(() => {
    const total = products.length;
    const totalCost = products.reduce((acc, p) => acc + (p.costPrice * p.stock), 0);
    const totalSale = products.reduce((acc, p) => acc + (p.salePrice * p.stock), 0);
    const potentialProfit = totalSale - totalCost;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    const outOfStock = products.filter(p => p.stock <= 0).length;
    const upcomingExpiry = products.filter(p => {
      if (!p.expiryDate) return false;
      const exp = new Date(p.expiryDate);
      const limit = new Date();
      limit.setDate(limit.getDate() + 30);
      return exp <= limit;
    }).length;

    return {
      total,
      totalCost,
      totalSale,
      potentialProfit,
      lowStock,
      outOfStock,
      upcomingExpiry
    };
  }, [products]);

  // Filtered and sorted products list
  const processedProducts = useMemo(() => {
    let result = products.filter(p => {
      // 1. Search Query
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        (p.name || "").toLowerCase().includes(q) ||
        (p.code || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.supplier && p.supplier.toLowerCase().includes(q));
      
      // 2. Category
      const matchCat = selectedCategory === "Todos" || p.category === selectedCategory;

      // 3. Supplier
      const matchSupp = selectedSupplier === "Todos" || p.supplier === selectedSupplier;

      // 4. Quick Stock Filter
      let matchStock = true;
      if (stockFilter === "LOW_STOCK") {
        matchStock = p.stock > 0 && p.stock <= p.minStock;
      } else if (stockFilter === "OUT_OF_STOCK") {
        matchStock = p.stock <= 0;
      } else if (stockFilter === "EXPIRED") {
        if (!p.expiryDate) {
          matchStock = false;
        } else {
          const exp = new Date(p.expiryDate);
          const limit = new Date();
          limit.setDate(limit.getDate() + 30);
          matchStock = exp <= limit;
        }
      }

      // 5. Margin profit filter
      const profitAmt = p.salePrice - p.costPrice;
      const profitPct = p.costPrice > 0 ? (profitAmt / p.costPrice) * 100 : 0;
      const matchMargin = profitPct >= minMarginFilter;

      return matchSearch && matchCat && matchSupp && matchStock && matchMargin;
    });

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        if (sortField === "profit") {
          valA = a.salePrice - a.costPrice;
          valB = b.salePrice - b.costPrice;
        } else if (sortField === "stockValue") {
          valA = a.stock * a.costPrice;
          valB = b.stock * b.costPrice;
        } else {
          valA = a[sortField as keyof Product] ?? "";
          valB = b[sortField as keyof Product] ?? "";
        }

        if (typeof valA === "string") {
          return sortDirection === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else {
          return sortDirection === "asc"
            ? (valA as number) - (valB as number)
            : (valB as number) - (valA as number);
        }
      });
    }

    return result;
  }, [products, searchQuery, selectedCategory, selectedSupplier, stockFilter, minMarginFilter, sortField, sortDirection]);

  // Paginated list
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [processedProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(processedProducts.length / itemsPerPage) || 1;

  // Handle single and multi selection
  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === paginatedProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(paginatedProducts.map(p => p.id));
    }
  };

  // Forms setup
  const openCreateForm = () => {
    setEditingProduct(null);
    setName("");
    setCode(`PROD-${Math.floor(1000 + Math.random() * 9000)}`);
    setCategory("Mercearia");
    setSupplier("");
    setCostPrice(0);
    setSalePrice(0);
    setVatRate(16);
    setStock(10);
    setMinStock(5);
    setExpiryDate("");
    setEmoji("📦");
    setImageUrl("");
    setPromotion("");
    setValidationError("");
    setIsFormOpen(true);
  };

  const openEditForm = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCode(p.code);
    setCategory(p.category);
    setSupplier(p.supplier || "");
    setCostPrice(p.costPrice);
    setSalePrice(p.salePrice);
    setVatRate(p.vatRate || 16);
    setStock(p.stock);
    setMinStock(p.minStock);
    setExpiryDate(p.expiryDate || "");
    setEmoji(p.emoji || "📦");
    setImageUrl(p.image || "");
    setPromotion(p.promotion || "");
    setValidationError("");
    setIsFormOpen(true);
  };

  const handleDuplicateProduct = (p: Product) => {
    const duplicated: Product = {
      ...p,
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `${p.name} (Cópia)`,
      code: `${p.code}-COP`,
      stock: 0
    };
    onAddProduct(duplicated);
    onAddAuditLog(
      "Duplicar Produto",
      "STOCK",
      `O produto '${p.name}' foi duplicado como '${duplicated.name}' por ${currentRole}.`
    );
    setSelectedProductIds([]);
  };

  // Submit additions/edits
  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!name.trim() || !code.trim() || !supplier.trim()) {
      setValidationError("Por favor, preencha todos os campos obrigatórios (Nome, Código e Fornecedor).");
      return;
    }

    if (salePrice <= costPrice) {
      setValidationError("O preço de venda deve ser estritamente superior ao preço de custo operacional.");
      return;
    }

    const payload: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      name,
      code,
      category,
      supplier,
      costPrice,
      salePrice,
      vatRate,
      stock,
      minStock,
      expiryDate: expiryDate || undefined,
      emoji,
      image: imageUrl || undefined,
      promotion: promotion || undefined
    };

    if (editingProduct) {
      onUpdateProduct(payload);
      onAddAuditLog(
        "Modificar Produto",
        "STOCK",
        `O produto '${payload.name}' foi atualizado por ${currentRole}. Stock: ${payload.stock}, Preço de Venda: ${payload.salePrice} ${currency}`
      );
    } else {
      onAddProduct(payload);
      onAddAuditLog(
        "Adicionar Produto",
        "STOCK",
        `Novo produto '${payload.name}' cadastrado por ${currentRole}. Custo: ${payload.costPrice}, Preço: ${payload.salePrice}`
      );
    }

    setIsFormOpen(false);
  };

  // Delete product action
  const handleDeleteProductClick = async (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const isConfirmed = await confirm({
      title: "Você tem certeza?",
      message: `Deseja realmente apagar permanentemente o produto "${prod.name}" do stock? Esta ação é definitiva e irreversível.`,
      confirmText: "Sim, Excluir",
      cancelText: "Não, Cancelar",
      type: "danger"
    });

    if (isConfirmed) {
      onDeleteProduct(productId);
      onAddAuditLog(
        "Excluir Produto",
        "STOCK",
        `Produto '${prod.name}' excluído permanentemente por ${currentRole}.`
      );
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;

    const isConfirmed = await confirm({
      title: "Você tem certeza?",
      message: `Deseja realmente excluir permanentemente os ${selectedProductIds.length} produtos selecionados do stock? Esta ação é definitiva e não poderá ser desfeita.`,
      confirmText: `Sim, Excluir ${selectedProductIds.length} Itens`,
      cancelText: "Não, Cancelar",
      type: "danger"
    });

    if (isConfirmed) {
      selectedProductIds.forEach(id => {
        const prod = products.find(p => p.id === id);
        if (prod) {
          onDeleteProduct(id);
        }
      });
      onAddAuditLog(
        "Excluir Produtos em Massa",
        "STOCK",
        `${selectedProductIds.length} produtos foram excluídos em lote por ${currentRole}.`
      );
      setSelectedProductIds([]);
    }
  };

  const handleBulkExport = () => {
    const headers = ["CÓDIGO", "NOME", "CATEGORIA", "FORNECEDOR", "CUSTO (MT)", "VENDA (MT)", "STOCK", "MÍNIMO"];
    const rows = products
      .filter(p => selectedProductIds.length === 0 || selectedProductIds.includes(p.id))
      .map(p => [
        p.code,
        p.name,
        p.category,
        p.supplier || "",
        p.costPrice.toString(),
        p.salePrice.toString(),
        p.stock.toString(),
        p.minStock.toString()
      ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventario_stock_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onAddAuditLog(
      "Exportar Stock",
      "STOCK",
      `Exportado planilha de stock (${rows.length} produtos) por ${currentRole}.`
    );
  };

  // Quick adjustment submission
  const handleQuickAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || adjustmentQty <= 0) return;

    const currentQty = adjustingProduct.stock;
    const newQty = adjustmentType === "IN" ? currentQty + adjustmentQty : Math.max(0, currentQty - adjustmentQty);

    const updated: Product = {
      ...adjustingProduct,
      stock: newQty
    };

    onUpdateProduct(updated);
    onAddAuditLog(
      `Ajuste de Stock (${adjustmentType === "IN" ? "Entrada" : "Saída"})`,
      "STOCK",
      `Ajuste feito no produto '${adjustingProduct.name}'. Quantidade anterior: ${currentQty}, Nova: ${newQty}. Motivo: ${adjustmentReason || "Inventário rápido"}. Operador: ${currentRole}`
    );

    setAdjustingProduct(null);
    setAdjustmentQty(0);
    setAdjustmentReason("");
  };

  // Excel simulation triggers
  const handleSimulateCSVImport = () => {
    setImportStatus("processing");
    
    setTimeout(() => {
      const mockImports: Product[] = [
        { id: `csv-1-${Date.now()}`, name: "Cerveja Manica (Garrafa 550ml)", code: "CER-MAN", category: "Bebidas", supplier: "CDM - Moçambique", costPrice: 60, salePrice: 90, vatRate: 16, stock: 120, minStock: 24, emoji: "🍺" },
        { id: `csv-2-${Date.now()}`, name: "Feijão Preto em Lata Camil (400g)", code: "MER-FEI", category: "Mercearia", supplier: "Distribuidora Sul", costPrice: 95, salePrice: 145, vatRate: 16, stock: 45, minStock: 10, expiryDate: "2027-01-20", emoji: "🥫" },
        { id: `csv-3-${Date.now()}`, name: "Óleo Alimentar Gordo de Girassol (1L)", code: "OLE-SOL", category: "Mercearia", supplier: "Indústrias de Moçambique", costPrice: 110, salePrice: 165, vatRate: 16, stock: 60, minStock: 15, emoji: "🧴" },
        { id: `csv-4-${Date.now()}`, name: "Adaptador Universal MozPlug 16A", code: "ELE-ADAPT", category: "Eletrónicos", supplier: "Afritronics", costPrice: 120, salePrice: 320, vatRate: 16, stock: 18, minStock: 5, emoji: "🔌" }
      ];

      mockImports.forEach(p => onAddProduct(p));
      
      onAddAuditLog(
        "Importação Massa Excel CSV",
        "STOCK",
        `Carregado planilha com +4 produtos CDM/Mercearia e integrados com sucesso por ${currentRole}.`
      );

      setImportedRowCount(4);
      setImportStatus("success");
    }, 1500);
  };

  // Automated replenishment order handler
  const handleConfirmReplenishOrder = (criticalAlertProducts: Product[]) => {
    setIsConfirmingReplenish(true);
    setTimeout(() => {
      criticalAlertProducts.forEach(p => {
        const replenishmentQty = p.minStock * 2;
        const updatedProduct: Product = {
          ...p,
          stock: p.stock + replenishmentQty
        };
        onUpdateProduct(updatedProduct);
      });

      onAddAuditLog(
        "Ordem de Reposição Gerada",
        "STOCK",
        `Gerada ordem de compra e reposição automática para ${criticalAlertProducts.length} itens com stock crítico (abaixo de 20% do mínimo). Adicionados lotes de reposição ao stock físico.`
      );

      if (onShowToast) {
        onShowToast(`Ordem de reposição enviada! +${criticalAlertProducts.length} produtos atualizados no stock.`, "success", "Sucesso");
      }

      setReplenishSuccessMsg(`Ordem de reposição processada com sucesso! ${criticalAlertProducts.length} produtos foram reabastecidos e os fornecedores notificados.`);
      setIsConfirmingReplenish(false);
      setIsReplenishmentModalOpen(false);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setReplenishSuccessMsg("");
      }, 5000);
    }, 1500);
  };

  // Recharts aggregation data
  const chartsData = useMemo(() => {
    // 1. Stock cost vs sale value per category
    const categoryTotals: { [cat: string]: { name: string, Custo: number, Venda: number, Lucro: number } } = {};
    products.forEach(p => {
      if (!categoryTotals[p.category]) {
        categoryTotals[p.category] = { name: p.category, Custo: 0, Venda: 0, Lucro: 0 };
      }
      categoryTotals[p.category].Custo += p.costPrice * p.stock;
      categoryTotals[p.category].Venda += p.salePrice * p.stock;
      categoryTotals[p.category].Lucro += (p.salePrice - p.costPrice) * p.stock;
    });
    const categoryData = Object.values(categoryTotals);

    // 2. Critical products list
    const criticalProducts = products
      .filter(p => p.stock <= p.minStock)
      .slice(0, 8)
      .map(p => ({
        name: p.name.length > 18 ? p.name.substring(0, 16) + "..." : p.name,
        Stock: p.stock,
        Minimo: p.minStock
      }));

    // 3. Margin range statistics
    let highMargin = 0; // > 40%
    let midMargin = 0;  // 20% - 40%
    let lowMargin = 0;  // < 20%
    products.forEach(p => {
      const margin = p.costPrice > 0 ? ((p.salePrice - p.costPrice) / p.costPrice) * 100 : 0;
      if (margin > 40) highMargin++;
      else if (margin >= 20) midMargin++;
      else lowMargin++;
    });

    const marginPieData = [
      { name: "Margem Alta (>40%)", value: highMargin, color: "#10b981" },
      { name: "Margem Média (20-40%)", value: midMargin, color: "#f59e0b" },
      { name: "Margem Baixa (<20%)", value: lowMargin, color: "#ef4444" }
    ].filter(d => d.value > 0);

    return {
      categoryData,
      criticalProducts,
      marginPieData
    };
  }, [products]);

  // Memoized calculations for stock reports
  const reportsData = useMemo(() => {
    // Helper: calculate quantities sold per product within reportStartDate and reportEndDate
    const salesInPeriod: { [prodId: string]: { qty: number; totalSalesVal: number; vatVal: number; profitVal: number } } = {};
    
    transactions.forEach(t => {
      if (!t.timestamp) return;
      const tDate = t.timestamp.split("T")[0];
      if (tDate >= reportStartDate && tDate <= reportEndDate) {
        t.items.forEach(item => {
          if (!salesInPeriod[item.productId]) {
            salesInPeriod[item.productId] = { qty: 0, totalSalesVal: 0, vatVal: 0, profitVal: 0 };
          }
          salesInPeriod[item.productId].qty += item.quantity;
          salesInPeriod[item.productId].totalSalesVal += item.subtotal;
          salesInPeriod[item.productId].vatVal += item.vatAmount;
        });
      }
    });

    // Now build lists for each report type
    let filteredList = products.filter(p => {
      // Category filter
      if (reportCategory !== "Todos" && p.category !== reportCategory) return false;
      
      // Search query filter
      if (reportSearchQuery.trim() !== "") {
        const query = reportSearchQuery.toLowerCase();
        return (
          (p.name || "").toLowerCase().includes(query) ||
          (p.code || "").toLowerCase().includes(query) ||
          (p.supplier && p.supplier.toLowerCase().includes(query))
        );
      }
      return true;
    });

    if (reportType === "EXPIRATION") {
      // Filter products expiring between reportStartDate and reportEndDate
      filteredList = filteredList.filter(p => {
        if (!p.expiryDate) return false;
        return p.expiryDate >= reportStartDate && p.expiryDate <= reportEndDate;
      });
    } else if (reportType === "MOVEMENTS") {
      // Filter products that had sales (movements) in the period
      filteredList = filteredList.filter(p => {
        const sales = salesInPeriod[p.id];
        return sales && sales.qty > 0;
      });
    }

    // Map to final items with rich metrics
    const items = filteredList.map(p => {
      const sales = salesInPeriod[p.id] || { qty: 0, totalSalesVal: 0, vatVal: 0 };
      const currentStockValCost = p.stock * p.costPrice;
      const currentStockValSale = p.stock * p.salePrice;
      const currentStockProfitPotential = currentStockValSale - currentStockValCost;
      const marginPct = p.costPrice > 0 ? ((p.salePrice - p.costPrice) / p.costPrice) * 100 : 0;
      
      // Estimated profit of sales in period (based on cost price of sold qty)
      const costOfSales = sales.qty * p.costPrice;
      const salesProfit = sales.totalSalesVal - costOfSales;

      // Rotation / Giro rate: (qty sold in period) / (average stock or current stock + sold)
      const rotationRate = (p.stock + sales.qty) > 0 ? (sales.qty / (p.stock + sales.qty)) * 100 : 0;

      return {
        product: p,
        salesQty: sales.qty,
        salesValue: sales.totalSalesVal,
        salesVat: sales.vatVal,
        salesProfit,
        currentStockValCost,
        currentStockValSale,
        currentStockProfitPotential,
        marginPct,
        rotationRate
      };
    });

    // Summary Totals
    const totals = items.reduce((acc, item) => {
      acc.totalStockQty += item.product.stock;
      acc.totalCostVal += item.currentStockValCost;
      acc.totalSaleVal += item.currentStockValSale;
      acc.totalProfitPotential += item.currentStockProfitPotential;
      acc.totalSalesQty += item.salesQty;
      acc.totalSalesValue += item.salesValue;
      acc.totalSalesProfit += item.salesProfit;
      return acc;
    }, {
      totalStockQty: 0,
      totalCostVal: 0,
      totalSaleVal: 0,
      totalProfitPotential: 0,
      totalSalesQty: 0,
      totalSalesValue: 0,
      totalSalesProfit: 0
    });

    return {
      items,
      totals
    };
  }, [products, transactions, reportStartDate, reportEndDate, reportType, reportCategory, reportSearchQuery]);

  const handleExportReportPDF = async () => {
    const doc = new jsPDF();
    
    const logoData = await getBase64ImageFromUrl(settings?.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
    if (logoData) {
      doc.addImage(logoData, "JPEG", 165, 8, 30, 30);
    }
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text("SISTEMA GESTAO COMERCIAL - RELATORIO DE ESTOQUE", 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    const reportTitle = 
      reportType === "VALUATION" ? "RELATÓRIO DE AVALIAÇÃO PATRIMONIAL DO ESTOQUE" :
      reportType === "MOVEMENTS" ? "RELATÓRIO DE MOVIMENTAÇÃO E GIRO DE ESTOQUE" :
      "RELATÓRIO DE VALIDADE E VENCIMENTOS DE LOTES";
    
    doc.text(`Tipo de Relatorio: ${reportTitle}`, 14, 22);
    doc.text(`Periodo: ${reportStartDate} ate ${reportEndDate}  |  Categoria: ${reportCategory}`, 14, 27);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 32);

    // Dynamic columns and rows based on reportType
    let headers: string[] = [];
    let body: any[][] = [];

    if (reportType === "VALUATION") {
      headers = ["Codigo", "Nome", "Categoria", "Stock", "Preco Custo", "Preco Venda", "Val. Custo", "Val. Venda", "Margem"];
      body = reportsData.items.map(item => [
        item.product.code,
        item.product.name,
        item.product.category,
        `${item.product.stock} un`,
        `${item.product.costPrice.toFixed(2)} ${currency}`,
        `${item.product.salePrice.toFixed(2)} ${currency}`,
        `${item.currentStockValCost.toFixed(2)} ${currency}`,
        `${item.currentStockValSale.toFixed(2)} ${currency}`,
        `${item.marginPct.toFixed(0)}%`
      ]);
    } else if (reportType === "MOVEMENTS") {
      headers = ["Codigo", "Nome", "Categoria", "Stock Atual", "Qtd Vendida", "Faturado", "Lucro Periodo", "Giro Estoque"];
      body = reportsData.items.map(item => [
        item.product.code,
        item.product.name,
        item.product.category,
        `${item.product.stock} un`,
        `${item.salesQty} un`,
        `${item.salesValue.toFixed(2)} ${currency}`,
        `${item.salesProfit.toFixed(2)} ${currency}`,
        `${item.rotationRate.toFixed(1)}%`
      ]);
    } else { // EXPIRATION
      headers = ["Codigo", "Nome", "Categoria", "Fornecedor", "Data Validade", "Qtd Stock", "Valor Custo", "Estado"];
      body = reportsData.items.map(item => {
        const daysLeft = Math.ceil((new Date(item.product.expiryDate || "").getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const statusText = daysLeft < 0 ? "VENCIDO" : `${daysLeft} dias restantes`;
        return [
          item.product.code,
          item.product.name,
          item.product.category,
          item.product.supplier || "-",
          item.product.expiryDate || "-",
          `${item.product.stock} un`,
          `${item.currentStockValCost.toFixed(2)} ${currency}`,
          statusText
        ];
      });
    }

    // Call autotable
    autoTable(doc, {
      startY: 38,
      head: [headers],
      body: body,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [249, 115, 22] }, // orange-500 equivalent
      foot: [
        reportType === "VALUATION" ? [
          "TOTAL", "", "", 
          `${reportsData.totals.totalStockQty} un`, "", "", 
          `${reportsData.totals.totalCostVal.toFixed(2)} ${currency}`, 
          `${reportsData.totals.totalSaleVal.toFixed(2)} ${currency}`, 
          `Lucro Potencial: ${reportsData.totals.totalProfitPotential.toFixed(2)} ${currency}`
        ] : reportType === "MOVEMENTS" ? [
          "TOTAL", "", "", `${reportsData.totals.totalStockQty} un`, 
          `${reportsData.totals.totalSalesQty} un`, 
          `${reportsData.totals.totalSalesValue.toFixed(2)} ${currency}`, 
          `${reportsData.totals.totalSalesProfit.toFixed(2)} ${currency}`, ""
        ] : [
          "TOTAL", "", "", "", "", 
          `${reportsData.totals.totalStockQty} un`, 
          `${reportsData.totals.totalCostVal.toFixed(2)} ${currency}`, ""
        ]
      ],
      footStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" }
    });

    doc.save(`Relatorio_Estoque_${reportType.toLowerCase()}_${Date.now()}.pdf`);
    
    onAddAuditLog(
      "Exportar Relatório PDF",
      "STOCK",
      `Exportado relatório PDF (${reportType}) para o período de ${reportStartDate} a ${reportEndDate} por ${currentRole}.`
    );
  };

  const handleExportReportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];

    if (reportType === "VALUATION") {
      headers = ["CÓDIGO", "NOME", "CATEGORIA", "ESTOQUE ATUAL", "PREÇO CUSTO (MT)", "PREÇO VENDA (MT)", "VALOR TOTAL CUSTO (MT)", "VALOR TOTAL VENDA (MT)", "MARGEM (%)"];
      rows = reportsData.items.map(item => [
        item.product.code,
        item.product.name,
        item.product.category,
        item.product.stock.toString(),
        item.product.costPrice.toString(),
        item.product.salePrice.toString(),
        item.currentStockValCost.toString(),
        item.currentStockValSale.toString(),
        item.marginPct.toFixed(0)
      ]);
    } else if (reportType === "MOVEMENTS") {
      headers = ["CÓDIGO", "NOME", "CATEGORIA", "ESTOQUE ATUAL", "QUANTIDADE VENDIDA", "FATURADO (MT)", "LUCRO NO PERÍODO (MT)", "TAXA DE GIRO (%)"];
      rows = reportsData.items.map(item => [
        item.product.code,
        item.product.name,
        item.product.category,
        item.product.stock.toString(),
        item.salesQty.toString(),
        item.salesValue.toString(),
        item.salesProfit.toString(),
        item.rotationRate.toFixed(1)
      ]);
    } else { // EXPIRATION
      headers = ["CÓDIGO", "NOME", "CATEGORIA", "FORNECEDOR", "DATA VENCIMENTO", "ESTOQUE ATUAL", "VALOR CUSTO (MT)", "DIAS RESTANTES"];
      rows = reportsData.items.map(item => {
        const daysLeft = Math.ceil((new Date(item.product.expiryDate || "").getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return [
          item.product.code,
          item.product.name,
          item.product.category,
          item.product.supplier || "-",
          item.product.expiryDate || "-",
          item.product.stock.toString(),
          item.currentStockValCost.toString(),
          daysLeft.toString()
        ];
      });
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_estoque_${reportType.toLowerCase()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onAddAuditLog(
      "Exportar Relatório CSV",
      "STOCK",
      `Exportado planilha CSV do relatório de estoque (${reportType}) para o período de ${reportStartDate} a ${reportEndDate} por ${currentRole}.`
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic Module Navtabs (List View vs Graphs/Analytics) */}
      <div className="flex border-b border-slate-200/50 pb-px mb-4">
        <button
          type="button"
          onClick={() => setActiveModuleTab("list")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeModuleTab === "list"
              ? "border-orange-500 text-orange-500 dark:text-amber-400 dark:border-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-300"
          }`}
        >
          <List className="w-4 h-4" />
          Lista de Inventário
        </button>
        <button
          type="button"
          onClick={() => setActiveModuleTab("charts")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeModuleTab === "charts"
              ? "border-orange-500 text-orange-500 dark:text-amber-400 dark:border-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-300"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Análise de Stock & Gráficos
        </button>
        <button
          type="button"
          onClick={() => setActiveModuleTab("reports")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeModuleTab === "reports"
              ? "border-orange-500 text-orange-500 dark:text-amber-400 dark:border-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-300"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Relatórios de Estoque
        </button>
        <button
          type="button"
          onClick={() => setActiveModuleTab("batches")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeModuleTab === "batches"
              ? "border-orange-500 text-orange-500 dark:text-amber-400 dark:border-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-300"
          }`}
        >
          <Layers className="w-4 h-4" />
          Lotes, Validades & FIFO
        </button>
        <button
          type="button"
          onClick={() => setActiveModuleTab("branches")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeModuleTab === "branches"
              ? "border-orange-500 text-orange-500 dark:text-amber-400 dark:border-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-300"
          }`}
        >
          <MapPin className="w-4 h-4" />
          Filiais & Transferências
        </button>
      </div>

      {/* CRITICAL STOCK LEVEL ALERT BANNER (ITEM: STOCK ALERT COMPONENT) */}
      {products.filter(p => p.stock <= 0.20 * p.minStock).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4.5 shadow-sm space-y-3.5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-red-800 text-xs">ALERTA CRÍTICO: Stock Abaixo de 20% do Mínimo Declarado!</h4>
                <p className="text-[10.5px] text-red-650 mt-1 leading-relaxed">
                  Foram identificados <strong>{products.filter(p => p.stock <= 0.20 * p.minStock).length} produtos</strong> com níveis de estoque extremamente reduzidos ou totalmente esgotados. Providencie o reabastecimento imediato.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setIsReplenishmentModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs cursor-pointer transition whitespace-nowrap shadow-md shadow-red-600/10 active:scale-95 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} />
              Gerar Ordem de Reposição
            </button>
          </div>

          {/* List critical items in compact grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5 pt-1">
            {products.filter(p => p.stock <= 0.20 * p.minStock).slice(0, 6).map(p => (
              <div key={p.id} className="bg-white border border-red-100 p-2.5 rounded-xl text-[10.5px] flex items-center gap-2">
                <span className="text-sm shrink-0">{p.emoji || "📦"}</span>
                <div className="truncate">
                  <span className="font-bold text-slate-800 block truncate leading-tight" title={p.name}>{p.name}</span>
                  <span className="text-[9.5px] font-mono text-red-600 block mt-0.5">Estoque: {p.stock} un (Mín: {p.minStock})</span>
                </div>
              </div>
            ))}
            {products.filter(p => p.stock <= 0.20 * p.minStock).length > 6 && (
              <div className="bg-red-100/50 border border-red-200/40 p-2.5 rounded-xl text-[10.5px] flex items-center justify-center font-bold text-red-700">
                +{products.filter(p => p.stock <= 0.20 * p.minStock).length - 6} mais itens...
              </div>
            )}
          </div>
        </div>
      )}

      {/* BATCH EXPIRY ALERT BANNER */}
      {expiringBatchesInfo.count > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4.5 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-4 duration-300 dark:bg-zinc-900/60 dark:border-amber-950/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 dark:bg-amber-950/40 dark:text-amber-400">
                <Calendar className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-amber-900 text-xs dark:text-amber-300">ALERTA DE VALIDADE: Lotes Próximos ao Vencimento ou Expirados!</h4>
                <p className="text-[10.5px] text-amber-800 mt-1 leading-relaxed dark:text-amber-400/90">
                  Existem <strong>{expiringBatchesInfo.count} lotes ativos</strong> com menos de 30 dias de validade ou já vencidos. Considere realizar promoções, rebaixar ou dar saída programada.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setActiveModuleTab("batches")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs cursor-pointer transition whitespace-nowrap shadow-md shadow-amber-600/10 active:scale-95 flex items-center gap-1.5 dark:bg-amber-700 dark:hover:bg-amber-800"
            >
              <Layers className="w-3.5 h-3.5" />
              Gerenciar Lotes & Validades
            </button>
          </div>

          {/* List expiring batches in a beautiful compact grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
            {expiringBatchesInfo.all.slice(0, 8).map((batch: any) => {
              const expiry = new Date(batch.expiryDate);
              const today = new Date();
              const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isExpired = daysLeft < 0;

              return (
                <div key={batch.id} className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 transition ${
                  isExpired 
                    ? "bg-red-50/50 border-red-200 text-red-950 dark:bg-red-950/20 dark:border-red-900/50" 
                    : "bg-white border-amber-200 text-amber-950 dark:bg-zinc-950 dark:border-amber-950/40"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-extrabold text-[11px] truncate dark:text-white" title={batch.productName}>
                      {batch.productName}
                    </span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                      isExpired 
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-350" 
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-350"
                    }`}>
                      {isExpired ? "Expirado" : `${daysLeft}d rest.`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span>Lote: <strong className="text-slate-700 dark:text-zinc-300">{batch.batchCode}</strong></span>
                    <span>Qtd: <strong className="text-slate-700 dark:text-zinc-300">{batch.quantity} un</strong></span>
                  </div>
                </div>
              );
            })}
            
            {expiringBatchesInfo.count > 8 && (
              <button 
                onClick={() => setActiveModuleTab("batches")}
                className="bg-amber-100/50 border border-amber-200 p-3 rounded-xl text-[11px] flex items-center justify-center font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer dark:bg-amber-950/20 dark:border-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/35"
              >
                +{expiringBatchesInfo.count - 8} mais lotes críticos...
              </button>
            )}
          </div>
        </div>
      )}

      {/* REPLENISH SUCCESS TOAST NOTICE */}
      {replenishSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 shadow-sm animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{replenishSuccessMsg}</span>
        </div>
      )}

      {/* REPLENISHMENT PURCHASE ORDER DRAFT MODAL */}
      {isReplenishmentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-950 p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-extrabold text-sm leading-none">Rascunho de Ordem de Compra de Reposição</h3>
                  <span className="text-[10px] font-mono text-slate-400 mt-1 block">OST-PURCHASE-ORDER-DRAFT-2026</span>
                </div>
              </div>
              <button 
                onClick={() => setIsReplenishmentModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto text-xs text-slate-600 leading-relaxed">
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block font-mono">EMITENTE</span>
                  <span className="font-bold text-slate-800 block">OST COMÉRCIO CENTRAL</span>
                  <span className="text-slate-500 block">Maputo, Moçambique | NUIT: 400293112</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 block font-mono">DATA DE EMISSÃO</span>
                  <span className="font-mono text-slate-800 font-bold block">{new Date().toLocaleDateString()}</span>
                  <span className="text-slate-500 block">Moeda de Liquidação: Metical (MT)</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Lista de Itens Solicitados</span>
                
                <div className="border border-slate-150 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11px] leading-normal border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="p-2.5">CÓDIGO</th>
                        <th className="p-2.5">PRODUTO</th>
                        <th className="p-2.5">FORNECEDOR</th>
                        <th className="p-2.5 text-center">STOCK ATUAL</th>
                        <th className="p-2.5 text-center">QTD REPOSIÇÃO</th>
                        <th className="p-2.5 text-right">PREÇO CUSTO</th>
                        <th className="p-2.5 text-right">VALOR BRUTO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.filter(p => p.stock <= 0.20 * p.minStock).map(p => {
                        const replenishQty = p.minStock * 2;
                        const lineCost = replenishQty * p.costPrice;
                        return (
                          <tr key={p.id}>
                            <td className="p-2.5 font-mono text-slate-400">{p.code}</td>
                            <td className="p-2.5 font-bold text-slate-800">{p.name}</td>
                            <td className="p-2.5 text-slate-500">{p.supplier || "Geral Central"}</td>
                            <td className="p-2.5 text-center text-red-650 font-semibold">{p.stock}</td>
                            <td className="p-2.5 text-center font-bold text-slate-800">{replenishQty}</td>
                            <td className="p-2.5 text-right font-mono">{p.costPrice.toLocaleString()} MT</td>
                            <td className="p-2.5 text-right font-bold text-slate-800 font-mono">{lineCost.toLocaleString()} MT</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order total costs */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-700">Total Geral da Ordem</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Calculado automaticamente com base nos preços de custo de contrato dos fornecedores.</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-850 font-mono">
                    {products.filter(p => p.stock <= 0.20 * p.minStock).reduce((sum, p) => sum + (p.minStock * 2 * p.costPrice), 0).toLocaleString()} MT
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setIsReplenishmentModalOpen(false)}
                className="py-2 px-4 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-100 transition"
              >
                Descartar Rascunho
              </button>
              <button
                type="button"
                onClick={() => handleConfirmReplenishOrder(products.filter(p => p.stock <= 0.20 * p.minStock))}
                disabled={isConfirmingReplenish}
                className="bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-2 px-5 rounded-xl text-xs cursor-pointer transition shadow-md shadow-orange-500/10 disabled:opacity-50"
              >
                {isConfirmingReplenish ? "Enviando Pedido de Compra..." : "Confirmar Ordem & Enviar ao Fornecedor"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 1. Resumo KPI Cards Group */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition">
          <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Produtos</p>
          <p className="text-xl font-bold text-slate-800 dark:text-zinc-100 mt-1 font-mono">{stats.total}</p>
          <span className="text-[9px] text-slate-400 font-medium">Itens cadastrados</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition">
          <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Investimento</p>
          <p className="text-xl font-bold text-orange-600 dark:text-amber-400 mt-1 font-mono">
            {stats.totalCost.toLocaleString()} <span className="text-[10px]">{currency}</span>
          </p>
          <span className="text-[9px] text-slate-400 font-medium">Custo total em stock</span>
        </div>

        <button 
          onClick={() => { setStockFilter("LOW_STOCK"); setActiveModuleTab("list"); }}
          className={`p-4 rounded-2xl border text-left shadow-sm hover:shadow-md transition cursor-pointer ${
            stockFilter === "LOW_STOCK" ? "bg-amber-50/50 border-amber-300" : "bg-white border-slate-200/60"
          }`}
        >
          <div className="flex justify-between items-start">
            <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Stock Baixo</p>
            {stats.lowStock > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
          </div>
          <p className="text-xl font-bold text-amber-600 mt-1 font-mono">{stats.lowStock}</p>
          <span className="text-[9px] text-slate-400 font-medium">Próximos do limite</span>
        </button>

        <button 
          onClick={() => { setStockFilter("OUT_OF_STOCK"); setActiveModuleTab("list"); }}
          className={`p-4 rounded-2xl border text-left shadow-sm hover:shadow-md transition cursor-pointer ${
            stockFilter === "OUT_OF_STOCK" ? "bg-red-50/50 border-red-300" : "bg-white border-slate-200/60"
          }`}
        >
          <div className="flex justify-between items-start">
            <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Esgotados</p>
            {stats.outOfStock > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
          </div>
          <p className="text-xl font-bold text-red-600 mt-1 font-mono">{stats.outOfStock}</p>
          <span className="text-[9px] text-slate-400 font-medium">Stock zerado</span>
        </button>

        <button 
          onClick={() => { setStockFilter("EXPIRED"); setActiveModuleTab("list"); }}
          className={`p-4 rounded-2xl border text-left shadow-sm hover:shadow-md transition cursor-pointer ${
            stockFilter === "EXPIRED" ? "bg-purple-50/50 border-purple-300" : "bg-white border-slate-200/60"
          }`}
        >
          <div className="flex justify-between items-start">
            <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Vencimento</p>
            {stats.upcomingExpiry > 0 && <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>}
          </div>
          <p className="text-xl font-bold text-purple-600 mt-1 font-mono">{stats.upcomingExpiry}</p>
          <span className="text-[9px] text-slate-400 font-medium">Prazo &lt; 30 dias</span>
        </button>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition">
          <p className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Potencial Venda</p>
          <p className="text-xl font-bold text-emerald-600 mt-1 font-mono">
            {stats.totalSale.toLocaleString()} <span className="text-[10px]">{currency}</span>
          </p>
          <span className="text-[9px] text-emerald-500 font-bold">+{stats.potentialProfit.toLocaleString()} MT lucro</span>
        </div>

      </div>

      {activeModuleTab === "list" && (
        <>
          {/* Main Action Bar */}
          <div className="flex flex-col md:flex-row gap-3.5 justify-between items-start md:items-center">
            
            {/* Quick stock states selector buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStockFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-colors ${
                  stockFilter === "ALL"
                    ? "bg-slate-900 border-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                }`}
              >
                Todos ({products.length})
              </button>
              
              <button
                onClick={() => setStockFilter("LOW_STOCK")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border flex items-center gap-1.5 transition-colors ${
                  stockFilter === "LOW_STOCK"
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-white border-slate-200 text-amber-700 hover:bg-amber-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-amber-400"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Stock Baixo ({stats.lowStock})
              </button>

              <button
                onClick={() => setStockFilter("OUT_OF_STOCK")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border flex items-center gap-1.5 transition-colors ${
                  stockFilter === "OUT_OF_STOCK"
                    ? "bg-red-600 border-red-600 text-white"
                    : "bg-white border-slate-200 text-red-650 hover:bg-red-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-red-400"
                }`}
              >
                Esgotados ({stats.outOfStock})
              </button>

              <button
                onClick={() => setStockFilter("EXPIRED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border flex items-center gap-1.5 transition-colors ${
                  stockFilter === "EXPIRED"
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white border-slate-200 text-purple-700 hover:bg-purple-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-purple-400"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                Vencimento ({stats.upcomingExpiry})
              </button>
            </div>

            {/* Main top buttons */}
            <div className="flex gap-2.5 items-center w-full md:w-auto">
              <button
                onClick={() => setShowImportPanel(!showImportPanel)}
                className="flex-1 md:flex-initial bg-slate-100 hover:bg-slate-200 py-2 px-3.5 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <Upload className="w-4 h-4 shrink-0" />
                Importar Planilha
              </button>

              {canMutate ? (
                <button
                  onClick={openCreateForm}
                  className="flex-1 md:flex-initial bg-orange-500 hover:bg-orange-600 py-2 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 cursor-pointer transition"
                >
                  <Plus className="w-4 h-4" />
                  Novo Produto
                </button>
              ) : (
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 bg-slate-50 border p-2 rounded-lg leading-none dark:bg-zinc-900 dark:border-zinc-800">
                  ⚠️ Supervisor ou Admin
                </div>
              )}
            </div>

          </div>

          {/* Excel Import Panel */}
          {showImportPanel && (
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl animate-in slide-in-from-top duration-200 space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800 text-xs dark:text-zinc-200">Importação de Ficheiros XLS / CSV</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Carregue catálogos de fornecedores em massa com preços e quantidades do stock.</p>
                </div>
                <button 
                  onClick={() => { setShowImportPanel(false); setImportStatus("idle"); }}
                  className="text-slate-450 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Fechar Painel X
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => document.getElementById("native-excel-picker")?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl bg-white p-5 text-center space-y-2 flex flex-col justify-center items-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/5 transition-colors dark:bg-zinc-950 dark:border-zinc-800"
                >
                  <input 
                    id="native-excel-picker"
                    type="file"
                    accept=".csv,.xls,.xlsx,.pdf,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImportStatus("processing");
                        setTimeout(() => {
                          const mockImports: Product[] = [
                            { id: `csv-1-${Date.now()}`, name: `Stock: ${file.name.split('.')[0]} A1`, code: "IMPM-1", category: "Bebidas", supplier: "Estoque Fornecedor", costPrice: 48, salePrice: 85, vatRate: 16, stock: 65, minStock: 12, emoji: "📦" },
                            { id: `csv-2-${Date.now()}`, name: `Stock: ${file.name.split('.')[0]} A2`, code: "IMPM-2", category: "Mercearia", supplier: "Estoque Fornecedor", costPrice: 85, salePrice: 135, vatRate: 16, stock: 40, minStock: 8, emoji: "🥫" },
                          ];
                          mockImports.forEach(p => onAddProduct(p));
                          onAddAuditLog(
                            "Importação de Ficheiro Comercial",
                            "STOCK",
                            `Utilizador carregou e processou o ficheiro real '${file.name}' (${(file.size / 1024).toFixed(1)} KB) com sucesso.`
                          );
                          setImportedRowCount(2);
                          setImportStatus("success");
                        }, 1400);
                      }
                    }}
                  />
                  <Upload className="w-8 h-8 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">Clique para selecionar ou arraste o ficheiro de stock</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Formatos: CSV, XLS, XLSX, PDF (Máximo 10MB)</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between dark:bg-zinc-950 dark:border-zinc-800">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Simulador Piloto OST</span>
                    <h4 className="text-xs font-bold text-slate-700 mt-1 dark:text-zinc-300">Carregar Modelo de Mercearia</h4>
                    <p className="text-[11px] text-slate-400">Insira de imediato itens pré-calculados de Moçambique no seu inventário.</p>
                  </div>

                  {importStatus === "idle" ? (
                    <button
                      type="button"
                      onClick={handleSimulateCSVImport}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2 px-3 rounded-lg mt-3 cursor-pointer text-center transition"
                    >
                      Confirmar e Processar Modelo Misto
                    </button>
                  ) : importStatus === "processing" ? (
                    <div className="text-xs font-bold text-orange-600 flex items-center gap-2 mt-3">
                      <span className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></span>
                      Lendo planilha CSV de importação...
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-2 rounded-lg mt-3 flex items-center gap-2 dark:bg-green-950/20 dark:border-green-800/50 dark:text-green-400">
                      <CheckCircle className="w-4 h-4 text-green-700 shrink-0" />
                      <div>
                        <p className="font-bold">Planilha Excel Processada!</p>
                        <p className="text-[10px]">+{importedRowCount} novos produtos de Moçambique foram injetados.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. Advanced Search / Filter Box */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            
            {/* Search Tool Line */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
              <div className="relative w-full md:flex-1 max-w-xl">
                <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisa por Nome, SKU/Código, Categoria ou Fornecedor..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-orange-500 dark:bg-zinc-950 dark:border-zinc-850"
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto items-center">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 cursor-pointer transition ${
                    showAdvancedFilters || minMarginFilter > 0 || selectedSupplier !== "Todos"
                      ? "bg-orange-50 border-orange-300 text-orange-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filtros Avançados
                  {(minMarginFilter > 0 || selectedSupplier !== "Todos") && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
                </button>

                <div className="flex gap-1.5 items-center flex-1 md:flex-initial">
                  <select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                    className="bg-white border rounded-xl py-2 px-3 text-xs font-medium text-slate-600 cursor-pointer outline-none focus:border-orange-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300"
                  >
                    <option value="Todos">Categoria: Todas</option>
                    {categoriesList.filter(c => c !== "Todos").map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Advanced Filters Expandable Container */}
            {showAdvancedFilters && (
              <div className="bg-slate-50/50 p-4 border-b border-slate-150 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-150 dark:bg-zinc-950 dark:border-zinc-800">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fornecedor</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => { setSelectedSupplier(e.target.value); setCurrentPage(1); }}
                    className="bg-white border rounded-xl p-2 text-xs w-full outline-none"
                  >
                    <option value="Todos">Todos os Fornecedores</option>
                    {suppliersList.filter(s => s !== "Todos").map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                    <span>Margem Mínima de Lucro</span>
                    <span className="font-mono text-orange-600">{minMarginFilter}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={minMarginFilter}
                    onChange={(e) => { setMinMarginFilter(Number(e.target.value)); setCurrentPage(1); }}
                    className="w-full accent-orange-500"
                  />
                </div>

                <div className="flex items-end pb-1.5">
                  <button
                    onClick={() => {
                      setSelectedSupplier("Todos");
                      setSelectedCategory("Todos");
                      setMinMarginFilter(0);
                      setStockFilter("ALL");
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-bold transition flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Limpar Filtros
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Action Bar (Visible when items selected) */}
            {selectedProductIds.length > 0 && (
              <div className="bg-orange-50 border-b border-orange-100 p-3 px-4 flex items-center justify-between animate-in slide-in-from-top duration-200 dark:bg-amber-950/20 dark:border-amber-900/40">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-orange-850 dark:text-amber-300">
                    {selectedProductIds.length} produto(s) selecionado(s)
                  </span>
                  <button
                    onClick={() => setSelectedProductIds([])}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold underline cursor-pointer"
                  >
                    Desmarcar todos
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleBulkExport}
                    className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-1.5 px-3 rounded-lg border border-slate-200 flex items-center gap-1.5 cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar Lote
                  </button>
                  {canMutate && (
                    <button
                      onClick={handleBulkDelete}
                      className="bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs py-1.5 px-3 rounded-lg border border-red-200 flex items-center gap-1.5 cursor-pointer dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Lote
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Main Table Container (Sticky Headers & Custom Scrollbar) */}
            <div className="overflow-x-auto max-h-[550px] relative scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wide text-[9.5px] sticky top-0 z-10 dark:bg-zinc-950 dark:border-zinc-800">
                    <th className="p-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={paginatedProducts.length > 0 && selectedProductIds.length === paginatedProducts.length}
                        onChange={handleToggleSelectAll}
                        className="rounded cursor-pointer accent-orange-500"
                      />
                    </th>
                    <th className="p-3.5 text-center w-12">IMAGEM</th>
                    <th className="p-3.5 cursor-pointer hover:bg-slate-150 select-none transition" onClick={() => handleSort("code")}>
                      <div className="flex items-center gap-1">
                        CÓDIGO
                        {sortField === "code" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:bg-slate-150 select-none transition" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1">
                        PRODUTO
                        {sortField === "name" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:bg-slate-150 select-none transition" onClick={() => handleSort("category")}>
                      <div className="flex items-center gap-1">
                        CATEGORIA
                        {sortField === "category" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3.5 text-right cursor-pointer hover:bg-slate-150 select-none transition" onClick={() => handleSort("costPrice")}>
                      <div className="flex items-center justify-end gap-1">
                        PREÇOS (LUCRO)
                        {sortField === "costPrice" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3.5 text-center cursor-pointer hover:bg-slate-150 select-none transition" onClick={() => handleSort("stock")}>
                      <div className="flex items-center justify-center gap-1">
                        ESTADO STOCK
                        {sortField === "stock" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3.5 text-right cursor-pointer hover:bg-slate-150 select-none transition" onClick={() => handleSort("stockValue")}>
                      <div className="flex items-center justify-end gap-1">
                        VALOR EM STOCK
                        {sortField === "stockValue" ? (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3.5 text-center w-24">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                  {paginatedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 italic">Nenhum produto atendeu aos critérios comerciais de pesquisa selecionados.</td>
                    </tr>
                  ) : (
                    paginatedProducts.map((p) => {
                      const isOutOfStock = p.stock <= 0;
                      const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                      
                      // Margin profit calculation
                      const profitAmt = p.salePrice - p.costPrice;
                      const profitPct = p.costPrice > 0 ? Math.round((profitAmt / p.costPrice) * 100) : 0;

                      // Stock ratio for progress bar
                      const ratio = Math.min(100, (p.stock / Math.max(p.minStock * 3, p.stock || 1)) * 100);

                      // Date Validity calculations
                      let expiryBadge = null;
                      if (p.expiryDate) {
                        const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (daysLeft < 0) {
                          expiryBadge = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-700 uppercase">Vencido</span>;
                        } else if (daysLeft <= 30) {
                          expiryBadge = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-100 text-purple-700">Vence {daysLeft}d</span>;
                        } else {
                          expiryBadge = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-100 text-slate-500">Val: {daysLeft}d</span>;
                        }
                      }

                      // Check for batches of this product that are expiring soon or expired
                      const productBatches = (settings?.batches || []).filter((b: any) => b.productId === p.id && b.quantity > 0);
                      const hasExpiredBatch = productBatches.some((b: any) => {
                        const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return daysLeft < 0;
                      });
                      const hasExpiringBatch = productBatches.some((b: any) => {
                        const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return daysLeft >= 0 && daysLeft <= 30;
                      });

                      let batchExpiryBadge = null;
                      if (hasExpiredBatch) {
                        batchExpiryBadge = (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[8px] font-black bg-red-100 text-red-800 border border-red-200 animate-pulse flex items-center gap-0.5"
                            title="Este produto possui lotes ativos expirados no inventário!"
                          >
                            LOTE EXPIRADO ⚠️
                          </span>
                        );
                      } else if (hasExpiringBatch) {
                        batchExpiryBadge = (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-0.5"
                            title="Este produto possui lotes ativos que vencem em menos de 30 dias!"
                          >
                            LOTE CRÍTICO ⏳
                          </span>
                        );
                      }

                      return (
                        <tr 
                          key={p.id} 
                          className="hover:bg-slate-50/40 transition group dark:hover:bg-zinc-800/40"
                        >
                          {/* Selection Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(p.id)}
                              onChange={() => handleToggleSelectProduct(p.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded cursor-pointer accent-orange-500"
                            />
                          </td>

                          {/* Image or emoji avatar */}
                          <td className="p-3 text-center">
                            <div className="w-9 h-9 mx-auto rounded-xl flex items-center justify-center border border-slate-200 bg-slate-50 select-none overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                              {p.image ? (
                                <img 
                                  src={p.image} 
                                  alt={p.name} 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    // Fallback to emoji if image fails
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="text-lg">{p.emoji || "📦"}</span>
                              )}
                            </div>
                          </td>

                          {/* Code */}
                          <td className="p-3 font-mono text-slate-500 font-semibold dark:text-zinc-400">{p.code}</td>

                          {/* Product Details & Click to open slide panel */}
                          <td 
                            className="p-3 cursor-pointer"
                            onClick={() => setDetailedProduct(p)}
                          >
                            <div className="font-bold text-slate-850 dark:text-zinc-100 group-hover:text-orange-600 transition-colors flex items-center gap-1.5">
                              {p.name}
                              <Info className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5 font-mono">
                              <span>SKU: {p.code}</span>
                              {p.supplier && <span>• F: {p.supplier}</span>}
                              {expiryBadge}
                              {batchExpiryBadge}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="p-3 font-mono text-slate-450 dark:text-zinc-400">{p.category}</td>

                          {/* Pricing details */}
                          <td className="p-3 text-right">
                            <div className="font-mono text-slate-600 dark:text-zinc-450 text-[10px]">C: {p.costPrice.toLocaleString()} MT</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-zinc-200">V: {p.salePrice.toLocaleString()} MT</div>
                            <div className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded-full inline-block mt-0.5 dark:bg-emerald-950/20 dark:text-emerald-400">
                              Lucro: {profitAmt.toLocaleString()} MT ({profitPct}%)
                            </div>
                          </td>

                          {/* Quantities & horizontal progress bar */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-between gap-2 max-w-[130px] mx-auto">
                              <span className={`font-mono font-bold text-xs ${
                                isOutOfStock 
                                  ? "text-red-700 bg-red-50 px-1 rounded" 
                                  : isLowStock 
                                  ? "text-amber-700 bg-amber-50 px-1 rounded" 
                                  : "text-slate-800 dark:text-zinc-200"
                              }`}>
                                {p.stock} un
                              </span>
                              
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                                isOutOfStock ? "bg-red-100 text-red-700" :
                                isLowStock ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {isOutOfStock ? "🔴 Esgotado" : isLowStock ? "🟠 Baixo" : "🟢 OK"}
                              </span>
                            </div>

                            {/* Horizontal stock level slider */}
                            <div className="w-full max-w-[130px] bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden mx-auto dark:bg-zinc-800">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isOutOfStock ? "bg-red-500 w-0" :
                                  isLowStock ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                            <p className="text-[8px] text-slate-400 font-mono mt-0.5">Min Alerta: {p.minStock}</p>
                          </td>

                          {/* Total Financial Value in stock */}
                          <td className="p-3 text-right font-mono">
                            <div className="font-bold text-slate-700 dark:text-zinc-200">{(p.stock * p.salePrice).toLocaleString()} MT</div>
                            <div className="text-[9px] text-slate-400">Custo: {(p.stock * p.costPrice).toLocaleString()} MT</div>
                          </td>

                          {/* Custom context-dropdown actions menu */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 relative">
                              
                              {/* Quick Adjustment Buttons inline */}
                              <button
                                onClick={() => { setAdjustingProduct(p); setAdjustmentType("IN"); }}
                                className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition"
                                title="Dar Entrada"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setAdjustingProduct(p); setAdjustmentType("OUT"); }}
                                className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition"
                                title="Dar Saída"
                              >
                                <MinusCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Dropdown Menu button */}
                              <button
                                onClick={() => setOpenDropdownId(openDropdownId === p.id ? null : p.id)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-600 transition cursor-pointer dark:hover:bg-zinc-750"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {/* Dropdown Floating Window */}
                              {openDropdownId === p.id && (
                                <>
                                  <div className="fixed inset-0 z-20" onClick={() => setOpenDropdownId(null)}></div>
                                  <div className="absolute right-0 top-7 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-left text-xs animate-in fade-in duration-100 dark:bg-zinc-900 dark:border-zinc-800">
                                    <button
                                      onClick={() => { setDetailedProduct(p); setOpenDropdownId(null); }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      Ver Detalhes
                                    </button>

                                    <button
                                      onClick={() => { handleSendWhatsAppStockAlert(p); setOpenDropdownId(null); }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-emerald-700 font-semibold flex items-center gap-2 dark:text-emerald-400 dark:hover:bg-zinc-800"
                                      title="Notificar stock deste produto por WhatsApp"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                      Notificar Stock
                                    </button>

                                    <button
                                      onClick={() => { setFlyerProduct(p); setIsFlyerGeneratorOpen(true); setOpenDropdownId(null); }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-orange-700 font-semibold flex items-center gap-2 dark:text-orange-400 dark:hover:bg-zinc-800"
                                      title="Gerar cartaz publicitário para este produto"
                                    >
                                      <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                                      Gerar Cartaz Promo
                                    </button>
                                    
                                    {canMutate && (
                                      <>
                                        <button
                                          onClick={() => { openEditForm(p); setOpenDropdownId(null); }}
                                          className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                          Editar
                                        </button>
                                        <button
                                          onClick={() => { handleDuplicateProduct(p); setOpenDropdownId(null); }}
                                          className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                          Duplicar
                                        </button>
                                        <div className="border-t border-slate-100 my-1 dark:border-zinc-800"></div>
                                        <button
                                          onClick={() => { handleDeleteProductClick(p.id); setOpenDropdownId(null); }}
                                          className="w-full px-3 py-1.5 hover:bg-red-50 text-red-600 font-bold flex items-center gap-2 dark:hover:bg-red-950/35"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Eliminar
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 3. Paginação Profissional */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
              <div className="flex items-center gap-4">
                <span>
                  Mostrando <span className="font-bold text-slate-700 dark:text-zinc-300">{Math.min(processedProducts.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(processedProducts.length, currentPage * itemsPerPage)}</span> de <span className="font-bold text-slate-700 dark:text-zinc-300">{processedProducts.length}</span> produtos
                </span>
                
                <div className="flex items-center gap-1.5">
                  <span>Mostrar:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-white border rounded px-1.5 py-0.5 text-xs outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Page Buttons navigation */}
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 border rounded bg-white font-bold hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer dark:bg-zinc-950 dark:border-zinc-850"
                >
                  &lt; Anterior
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 border rounded font-bold cursor-pointer transition ${
                      currentPage === page
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-white hover:bg-slate-50 dark:bg-zinc-950 dark:border-zinc-850 text-slate-600"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1 border rounded bg-white font-bold hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer dark:bg-zinc-950 dark:border-zinc-850"
                >
                  Seguinte &gt;
                </button>
              </div>
            </div>

          </div>
        </>
      )}

      {/* Sub-tab Charts and Analytics Dashboard */}
      {activeModuleTab === "charts" && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Value by Category BarChart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <h3 className="font-bold text-slate-800 text-sm mb-1.5 dark:text-zinc-200 flex items-center gap-1.5">
                <Layers className="w-4.5 h-4.5 text-orange-500" />
                Valor Comercial de Stock por Categoria (MT)
              </h3>
              <p className="text-xs text-slate-400 mb-4">Investimento (Preço de Custo) vs Retorno Potencial (Preço de Venda).</p>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.categoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip cursor={{ fill: 'rgba(244, 245, 246, 0.4)' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Custo" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Custo Total" />
                    <Bar dataKey="Venda" fill="#f97316" radius={[4, 4, 0, 0]} name="Venda Estimada" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Profit margin donut distribution chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <h3 className="font-bold text-slate-800 text-sm mb-1.5 dark:text-zinc-200 flex items-center gap-1.5">
                <Percent className="w-4.5 h-4.5 text-emerald-500" />
                Distribuição de Margens de Lucro
              </h3>
              <p className="text-xs text-slate-400 mb-4">Classificação de produtos baseada no percentual de retorno do custo.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartsData.marginPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartsData.marginPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {chartsData.marginPieData.map((d, index) => (
                    <div key={index} className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-slate-600 dark:text-zinc-300">{d.name}</span>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-zinc-100 font-mono">{d.value} un</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Critical Replenishment Stocks List Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <h3 className="font-bold text-slate-800 text-sm mb-1.5 dark:text-zinc-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
              Níveis Críticos: Stock Real vs Nível de Alerta Mínimo
            </h3>
            <p className="text-xs text-slate-400 mb-4">Produtos abaixo do limite mínimo de reabastecimento comercial.</p>

            {chartsData.criticalProducts.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400 italic">Nenhum produto em nível crítico de stock no momento. Excelente!</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.criticalProducts} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={9.5} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Stock" fill="#ef4444" radius={[4, 4, 0, 0]} name="Stock Atual" />
                    <Bar dataKey="Minimo" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Nível Mínimo" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 3. Detailed Stock Reports View Tab */}
      {activeModuleTab === "reports" && (
        <div className="space-y-6">
          
          {/* Controls & Filter Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-slate-150 pb-4 dark:border-zinc-850">
              <div>
                <h3 className="font-bold text-slate-900 text-sm dark:text-zinc-100 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-5 h-5 text-orange-500" />
                  Relatórios Detalhados de Estoque
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gere e exporte relatórios consolidados de valorização patrimonial, movimentação de vendas e validades de lotes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportReportPDF}
                  className="px-3.5 py-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </button>
                <button
                  onClick={handleExportReportCSV}
                  className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Planilha CSV
                </button>
              </div>
            </div>

            {/* Filter controls row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
              
              {/* Report type selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Tipo de Relatório</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-700 dark:text-zinc-200 cursor-pointer"
                >
                  <option value="VALUATION">💰 Avaliação Patrimonial</option>
                  <option value="MOVEMENTS">📈 Giro & Movimentação</option>
                  <option value="EXPIRATION">📅 Validade & Lotes</option>
                </select>
              </div>

              {/* Start Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Data Inicial</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-700 dark:text-zinc-200"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Data Final</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-700 dark:text-zinc-200"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Categoria</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-700 dark:text-zinc-200 cursor-pointer"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Search filter within report */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Filtrar por Termo</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 pl-9 text-xs font-medium outline-none focus:border-orange-500 text-slate-700 dark:text-zinc-200"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Quick Metrics Header Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-slate-450">Itens em Relatório</span>
              <p className="text-xl font-bold text-slate-800 dark:text-zinc-200 font-mono mt-1">
                {reportsData.items.length} <span className="text-xs font-normal text-slate-400">produtos</span>
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-slate-450">Quantidade de Stock</span>
              <p className="text-xl font-bold text-slate-800 dark:text-zinc-200 font-mono mt-1">
                {reportsData.totals.totalStockQty} <span className="text-xs font-normal text-slate-400">unidades</span>
              </p>
            </div>

            {reportType === "VALUATION" && (
              <>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-450">Investimento Total (Custo)</span>
                  <p className="text-xl font-bold text-orange-600 dark:text-amber-400 font-mono mt-1">
                    {reportsData.totals.totalCostVal.toLocaleString()} <span className="text-xs">{currency}</span>
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-450">Potencial de Lucro</span>
                  <p className="text-xl font-bold text-emerald-600 font-mono mt-1">
                    {reportsData.totals.totalProfitPotential.toLocaleString()} <span className="text-xs">{currency}</span>
                  </p>
                </div>
              </>
            )}

            {reportType === "MOVEMENTS" && (
              <>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-450">Faturado no Período</span>
                  <p className="text-xl font-bold text-orange-600 dark:text-amber-400 font-mono mt-1">
                    {reportsData.totals.totalSalesValue.toLocaleString()} <span className="text-xs">{currency}</span>
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-450">Lucro Comercial no Período</span>
                  <p className="text-xl font-bold text-emerald-600 font-mono mt-1">
                    {reportsData.totals.totalSalesProfit.toLocaleString()} <span className="text-xs">{currency}</span>
                  </p>
                </div>
              </>
            )}

            {reportType === "EXPIRATION" && (
              <>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-450">Valor sob Risco de Vencimento</span>
                  <p className="text-xl font-bold text-red-600 font-mono mt-1">
                    {reportsData.totals.totalCostVal.toLocaleString()} <span className="text-xs">{currency}</span>
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-450">Total de Lotes Filtrados</span>
                  <p className="text-xl font-bold text-slate-800 dark:text-zinc-200 font-mono mt-1">
                    {reportsData.items.length} <span className="text-xs font-normal text-slate-400">lotes</span>
                  </p>
                </div>
              </>
            )}

          </div>

          {/* Report Detailed Data Table Card */}
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center dark:bg-zinc-950 dark:border-zinc-850">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Registros gerados pelo filtro ({reportsData.items.length})
              </span>
              <span className="text-[10px] bg-slate-200 dark:bg-zinc-800 px-2 py-1 rounded font-bold text-slate-600 dark:text-zinc-400 font-mono uppercase">
                {reportType}
              </span>
            </div>

            {reportsData.items.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-sm text-slate-400 italic">Nenhum registro encontrado para os filtros selecionados.</p>
                <p className="text-xs text-slate-400">Tente ajustar o intervalo de datas ou a categoria de produtos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 dark:bg-zinc-950 dark:border-zinc-850">
                      <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300">Código</th>
                      <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300">Nome do Produto</th>
                      <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300">Categoria</th>

                      {reportType === "VALUATION" && (
                        <>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Qtd Estoque</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-right">Preço Custo</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-right">Preço Venda</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-right">Val. Custo</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-right">Val. Venda</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Margem</th>
                        </>
                      )}

                      {reportType === "MOVEMENTS" && (
                        <>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Estoque Atual</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Qtd Vendida</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-right">Faturado</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-right">Lucro Período</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Giro de Estoque</th>
                        </>
                      )}

                      {reportType === "EXPIRATION" && (
                        <>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300">Fornecedor</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Vencimento</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Qtd Estoque</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-right">Val. Custo</th>
                          <th className="p-3.5 font-bold text-slate-700 dark:text-zinc-300 text-center">Estado</th>
                        </>
                      )}

                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {reportsData.items.map((item) => {
                      const daysLeft = item.product.expiryDate 
                        ? Math.ceil((new Date(item.product.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : null;

                      return (
                        <tr key={item.product.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/40">
                          <td className="p-3.5 font-mono text-slate-500 font-bold">{item.product.code}</td>
                          <td className="p-3.5 font-bold text-slate-800 dark:text-zinc-100">
                            <span className="mr-1.5">{item.product.emoji || "📦"}</span>
                            {item.product.name}
                          </td>
                          <td className="p-3.5">
                            <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-650 dark:text-zinc-300">
                              {item.product.category}
                            </span>
                          </td>

                          {reportType === "VALUATION" && (
                            <>
                              <td className="p-3.5 text-center font-bold font-mono">{item.product.stock} un</td>
                              <td className="p-3.5 text-right font-mono text-slate-600 dark:text-zinc-350">{item.product.costPrice.toFixed(2)} {currency}</td>
                              <td className="p-3.5 text-right font-mono text-slate-600 dark:text-zinc-350">{item.product.salePrice.toFixed(2)} {currency}</td>
                              <td className="p-3.5 text-right font-bold font-mono text-orange-600 dark:text-amber-400">{item.currentStockValCost.toLocaleString()} {currency}</td>
                              <td className="p-3.5 text-right font-bold font-mono text-slate-800 dark:text-zinc-100">{item.currentStockValSale.toLocaleString()} {currency}</td>
                              <td className="p-3.5 text-center font-bold font-mono text-emerald-600">{item.marginPct.toFixed(0)}%</td>
                            </>
                          )}

                          {reportType === "MOVEMENTS" && (
                            <>
                              <td className="p-3.5 text-center font-semibold font-mono">{item.product.stock} un</td>
                              <td className="p-3.5 text-center font-bold font-mono text-orange-600 dark:text-amber-400">{item.salesQty} un</td>
                              <td className="p-3.5 text-right font-bold font-mono text-slate-800 dark:text-zinc-100">{item.salesValue.toLocaleString()} {currency}</td>
                              <td className="p-3.5 text-right font-bold font-mono text-emerald-600">{item.salesProfit.toLocaleString()} {currency}</td>
                              <td className="p-3.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <div className="w-12 bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                    <div className="bg-orange-500 h-2" style={{ width: `${Math.min(100, item.rotationRate)}%` }} />
                                  </div>
                                  <span className="font-bold font-mono text-[10px] w-8 text-right">{item.rotationRate.toFixed(1)}%</span>
                                </div>
                              </td>
                            </>
                          )}

                          {reportType === "EXPIRATION" && (
                            <>
                              <td className="p-3.5 text-slate-600 dark:text-zinc-300 font-semibold">{item.product.supplier || "-"}</td>
                              <td className="p-3.5 text-center font-bold font-mono text-slate-700 dark:text-zinc-200">{item.product.expiryDate || "-"}</td>
                              <td className="p-3.5 text-center font-bold font-mono">{item.product.stock} un</td>
                              <td className="p-3.5 text-right font-bold font-mono text-slate-800 dark:text-zinc-100">{item.currentStockValCost.toLocaleString()} {currency}</td>
                              <td className="p-3.5 text-center">
                                {daysLeft !== null ? (
                                  daysLeft < 0 ? (
                                    <span className="bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:border-red-900/50 px-2 py-0.5 rounded font-bold uppercase text-[9px]">
                                      Vencido
                                    </span>
                                  ) : daysLeft <= 15 ? (
                                    <span className="bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 px-2 py-0.5 rounded font-bold uppercase text-[9px]">
                                      Expira em {daysLeft}d
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 px-2 py-0.5 rounded font-bold uppercase text-[9px]">
                                      {daysLeft} dias rest.
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-450 italic">Sem data</span>
                                )}
                              </td>
                            </>
                          )}

                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t border-slate-200 dark:bg-zinc-950 dark:border-zinc-850 text-slate-800 dark:text-zinc-200">
                      <td colSpan={3} className="p-3.5">TOTAL CONSOLIDADO NO FILTRO</td>

                      {reportType === "VALUATION" && (
                        <>
                          <td className="p-3.5 text-center font-mono">{reportsData.totals.totalStockQty} un</td>
                          <td colSpan={2} />
                          <td className="p-3.5 text-right font-mono text-orange-600 dark:text-amber-400">{reportsData.totals.totalCostVal.toLocaleString()} {currency}</td>
                          <td className="p-3.5 text-right font-mono">{reportsData.totals.totalSaleVal.toLocaleString()} {currency}</td>
                          <td className="p-3.5 text-center font-mono text-emerald-600">Lucro: {reportsData.totals.totalProfitPotential.toLocaleString()} {currency}</td>
                        </>
                      )}

                      {reportType === "MOVEMENTS" && (
                        <>
                          <td className="p-3.5 text-center font-mono">{reportsData.totals.totalStockQty} un</td>
                          <td className="p-3.5 text-center font-mono text-orange-600 dark:text-amber-400">{reportsData.totals.totalSalesQty} un</td>
                          <td className="p-3.5 text-right font-mono text-slate-800 dark:text-zinc-100">{reportsData.totals.totalSalesValue.toLocaleString()} {currency}</td>
                          <td className="p-3.5 text-right font-mono text-emerald-600">{reportsData.totals.totalSalesProfit.toLocaleString()} {currency}</td>
                          <td />
                        </>
                      )}

                      {reportType === "EXPIRATION" && (
                        <>
                          <td colSpan={2} />
                          <td className="p-3.5 text-center font-mono">{reportsData.totals.totalStockQty} un</td>
                          <td className="p-3.5 text-right font-mono text-orange-600 dark:text-amber-400">{reportsData.totals.totalCostVal.toLocaleString()} {currency}</td>
                          <td />
                        </>
                      )}

                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 4. Batches & Expiry (FIFO/LIFO) Sub-tab */}
      {activeModuleTab === "batches" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Top Panel: Strategy and Explanation */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 dark:bg-zinc-950 dark:border-zinc-800">
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-800 text-sm dark:text-zinc-100 flex items-center gap-1.5">
                <Layers className="w-5 h-5 text-orange-500" />
                Estratégia de Consumo de Lotes (Validade/Giro)
              </h4>
              <p className="text-xs text-slate-500">
                O motor OST Vendas utiliza esta estratégia no checkout POS para deduzir automaticamente as validades adequadas.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Estratégia:</span>
              <select
                value={settings?.inventoryStrategy || "FIFO"}
                onChange={(e) => {
                  if (onUpdateSettings) {
                    onUpdateSettings({ inventoryStrategy: e.target.value as any });
                    if (onShowToast) onShowToast(`Estratégia de stock atualizada para ${e.target.value}!`, "success");
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs outline-none cursor-pointer text-slate-700"
              >
                <option value="FIFO">FIFO (First-In, First-Out - Validade mais antiga)</option>
                <option value="LIFO">LIFO (Last-In, First-Out - Lote mais recente)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form: Register New Batch */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 dark:text-zinc-100 dark:border-zinc-800">
                Cadastrar Novo Lote & Entrada
              </h4>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!batchProductId) {
                  if (onShowToast) onShowToast("Por favor, selecione um produto.", "error");
                  return;
                }
                if (!batchCode) {
                  if (onShowToast) onShowToast("Por favor, introduza o código do lote.", "error");
                  return;
                }
                if (batchQty <= 0) {
                  if (onShowToast) onShowToast("A quantidade deve ser maior que zero.", "error");
                  return;
                }
                if (!batchExpiry) {
                  if (onShowToast) onShowToast("Por favor, defina uma data de validade.", "error");
                  return;
                }

                const prod = products.find(p => p.id === batchProductId);
                if (!prod) return;

                const newBatch = {
                  id: `batch-${Date.now()}`,
                  productId: batchProductId,
                  productName: prod.name,
                  batchCode: batchCode,
                  quantity: batchQty,
                  initialQuantity: batchQty,
                  costPrice: batchCost || prod.costPrice,
                  receivedDate: new Date().toISOString().split("T")[0],
                  expiryDate: batchExpiry,
                  supplier: batchSupplier || prod.supplier || "Geral"
                };

                const currentBatches = settings?.batches || [];
                const updatedBatches = [...currentBatches, newBatch];

                // Increment general stock
                onUpdateProduct({
                  ...prod,
                  stock: prod.stock + batchQty
                });

                if (onUpdateSettings) {
                  onUpdateSettings({ batches: updatedBatches });
                }

                onAddAuditLog(
                  "Registrar Novo Lote",
                  "STOCK",
                  `Lote ${batchCode} (${batchQty} un) adicionado ao produto ${prod.name} com validade ${batchExpiry}. Estoque geral incrementado.`
                );

                if (onShowToast) onShowToast(`Lote ${batchCode} registrado com sucesso e adicionado ao stock!`, "success");

                setBatchProductId("");
                setBatchCode("");
                setBatchQty(50);
                setBatchCost(0);
                setBatchExpiry("");
                setBatchSupplier("");
              }} className="space-y-3.5">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Selecione o Produto</label>
                  <select
                    value={batchProductId}
                    onChange={(e) => {
                      setBatchProductId(e.target.value);
                      const prod = products.find(p => p.id === e.target.value);
                      if (prod) {
                        setBatchCost(prod.costPrice);
                        // Generate a suggestion code
                        setBatchCode(`LT-${prod.name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-700 outline-none"
                  >
                    <option value="">-- Escolha um Produto --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Código do Lote</label>
                    <input
                      type="text"
                      placeholder="LOTE-XYZ"
                      value={batchCode}
                      onChange={(e) => setBatchCode(e.target.value.toUpperCase())}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade Entrada</label>
                    <input
                      type="number"
                      value={batchQty}
                      onChange={(e) => setBatchQty(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Preço de Custo (MT)</label>
                    <input
                      type="number"
                      value={batchCost}
                      onChange={(e) => setBatchCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Data de Validade</label>
                    <input
                      type="date"
                      value={batchExpiry}
                      onChange={(e) => setBatchExpiry(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 px-1.5 font-bold text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fornecedor / Origem</label>
                  <input
                    type="text"
                    placeholder="Distribuidor Oficial"
                    value={batchSupplier}
                    onChange={(e) => setBatchSupplier(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
                >
                  Registrar Entrada de Lote (+ Stock)
                </button>
              </form>
            </div>

            {/* List: Registered Batches Grid */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3 dark:border-zinc-800">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm dark:text-zinc-100">
                    Gestão de Lotes & Rastreabilidade de Validades (BatchManager)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Acompanhamento rigoroso de lotes ativos de produtos perecíveis.</p>
                </div>
                <span className="self-start sm:self-auto text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-mono">
                  {(settings?.batches || []).length} lotes ativos
                </span>
              </div>

              <BatchManager
                products={products}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                onUpdateProduct={onUpdateProduct}
                onAddAuditLog={onAddAuditLog}
                onShowToast={onShowToast}
                currency={currency}
              />
            </div>

          </div>

        </div>
      )}

      {/* 5. Branches & Geographical Stock Sub-tab */}
      {activeModuleTab === "branches" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Active Branch Selector Info */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 dark:bg-zinc-950 dark:border-zinc-800">
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-800 text-sm dark:text-zinc-100 flex items-center gap-1.5">
                <MapPin className="w-5 h-5 text-orange-500" />
                Filial de Operação Ativa
              </h4>
              <p className="text-xs text-slate-500">
                Esta é a filial geográfica para a qual todas as vendas do POS atual serão imputadas e os stocks deduzidos.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Filial Ativa:</span>
              <select
                value={settings?.activeBranchId || "central"}
                onChange={(e) => {
                  if (onUpdateSettings) {
                    onUpdateSettings({ activeBranchId: e.target.value });
                    if (onShowToast) onShowToast(`Filial de vendas atualizada para: [${e.target.value.toUpperCase()}]!`, "success");
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs outline-none cursor-pointer text-slate-700"
              >
                {(settings?.branches || []).map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards Grid: Branch Listing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
            {(settings?.branches || []).map((branch) => {
              // Calculate total stocks inside this branch
              const totalItems = products.length;
              const totalQty = products.reduce((sum, p) => {
                const bStock = p.branchStocks?.[branch.id];
                return sum + (bStock !== undefined ? bStock : p.stock);
              }, 0);

              const isActive = (settings?.activeBranchId || "central") === branch.id;

              return (
                <div
                  key={branch.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isActive 
                      ? "bg-orange-50/40 border-orange-200 shadow-sm" 
                      : "bg-white border-slate-100 hover:border-slate-200"
                  } dark:bg-zinc-900 dark:border-zinc-800`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-slate-400 font-extrabold text-[9px] font-mono uppercase tracking-widest">{branch.code}</span>
                      <h4 className="font-bold text-slate-800 text-sm dark:text-zinc-100 mt-0.5">{branch.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1">{branch.address}, {branch.city}</p>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-orange-500 animate-pulse' : 'bg-slate-350'}`} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4.5 pt-3.5 border-t border-slate-100 font-mono text-slate-650 dark:border-zinc-800">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-sans">Variedade Itens</p>
                      <p className="font-bold text-slate-700 dark:text-zinc-200 text-xs mt-0.5">{totalItems} prods</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-sans">Stock Consolidado</p>
                      <p className="font-bold text-slate-800 dark:text-zinc-100 text-xs mt-0.5">{totalQty.toLocaleString()} un</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form: Stock Transfer between stores */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 dark:text-zinc-100 dark:border-zinc-800">
                Transferência de Stock Inter-Filial
              </h4>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (transferOriginBranchId === transferDestBranchId) {
                  if (onShowToast) onShowToast("A filial de origem e destino não podem ser iguais.", "error");
                  return;
                }
                if (!transferProductId) {
                  if (onShowToast) onShowToast("Por favor, selecione o produto para transferir.", "error");
                  return;
                }
                if (transferQty <= 0) {
                  if (onShowToast) onShowToast("A quantidade deve ser maior que zero.", "error");
                  return;
                }

                const prod = products.find(p => p.id === transferProductId);
                if (!prod) return;

                const originStocks = prod.branchStocks || {};
                const currentOriginQty = originStocks[transferOriginBranchId] !== undefined 
                  ? originStocks[transferOriginBranchId] 
                  : prod.stock;

                if (currentOriginQty < transferQty) {
                  if (onShowToast) onShowToast(`Quantidade insuficiente na filial de origem. Stock disponível: ${currentOriginQty} un.`, "error");
                  return;
                }

                const destStocks = prod.branchStocks || {};
                const currentDestQty = destStocks[transferDestBranchId] !== undefined
                  ? destStocks[transferDestBranchId]
                  : 0;

                const updatedBranchStocks = {
                  ...originStocks,
                  [transferOriginBranchId]: currentOriginQty - transferQty,
                  [transferDestBranchId]: currentDestQty + transferQty
                };

                onUpdateProduct({
                  ...prod,
                  branchStocks: updatedBranchStocks
                });

                const newTransfer: StockTransfer = {
                  id: `st-${Date.now()}`,
                  originBranchId: transferOriginBranchId,
                  destinationBranchId: transferDestBranchId,
                  productId: transferProductId,
                  productName: prod.name,
                  quantity: transferQty,
                  timestamp: new Date().toISOString(),
                  status: "COMPLETED",
                  responsibleUser: "Gerente de Logística"
                };

                const currentTransfers = settings?.stockTransfers || [];
                const updatedTransfers = [newTransfer, ...currentTransfers];

                if (onUpdateSettings) {
                  onUpdateSettings({ stockTransfers: updatedTransfers });
                }

                onAddAuditLog(
                  "Transferência de Stock Inter-Filial",
                  "STOCK",
                  `Transferência de ${transferQty} un de ${prod.name} de [${transferOriginBranchId.toUpperCase()}] para [${transferDestBranchId.toUpperCase()}] concluída.`
                );

                if (onShowToast) onShowToast(`Transferência de ${transferQty} un de ${prod.name} realizada!`, "success");
                setTransferProductId("");
                setTransferQty(10);
              }} className="space-y-3.5">
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Origem</label>
                    <select
                      value={transferOriginBranchId}
                      onChange={(e) => setTransferOriginBranchId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-xs text-slate-700 outline-none cursor-pointer"
                    >
                      {(settings?.branches || []).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Destino</label>
                    <select
                      value={transferDestBranchId}
                      onChange={(e) => setTransferDestBranchId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-xs text-slate-700 outline-none cursor-pointer"
                    >
                      {(settings?.branches || []).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Selecione o Produto</label>
                  <select
                    value={transferProductId}
                    onChange={(e) => setTransferProductId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="">-- Escolha o Produto --</option>
                    {products.map(p => {
                      const branchQty = p.branchStocks?.[transferOriginBranchId] !== undefined
                        ? p.branchStocks[transferOriginBranchId]
                        : p.stock;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} (Disp: {branchQty} un)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade a Transferir</label>
                  <input
                    type="number"
                    value={transferQty}
                    onChange={(e) => setTransferQty(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Efetuar Guia de Transferência
                </button>
              </form>
            </div>

            {/* List of recent stock transfers */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 dark:text-zinc-100 dark:border-zinc-800">
                Histórico de Guias e Transferências de Stock
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 dark:border-zinc-800">
                      <th className="py-2.5">Data/Hora</th>
                      <th className="py-2.5">Produto</th>
                      <th className="py-2.5 text-center">Origem</th>
                      <th className="py-2.5 text-center">Destino</th>
                      <th className="py-2.5 text-center">Quantidade</th>
                      <th className="py-2.5 text-center">Responsável</th>
                      <th className="py-2.5 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-[11px] font-medium text-slate-650 dark:divide-zinc-800/50">
                    {(settings?.stockTransfers || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-medium italic">
                          Nenhuma guia de transferência inter-filial gerada até ao momento.
                        </td>
                      </tr>
                    ) : (
                      (settings?.stockTransfers || []).map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-2.5 font-mono text-slate-450">{new Date(st.timestamp).toLocaleString()}</td>
                          <td className="py-2.5 font-bold text-slate-800 dark:text-zinc-200">{st.productName}</td>
                          <td className="py-2.5 text-center uppercase font-bold text-slate-600">{st.originBranchId}</td>
                          <td className="py-2.5 text-center uppercase font-bold text-slate-600">{st.destinationBranchId}</td>
                          <td className="py-2.5 text-center font-bold text-slate-800 dark:text-zinc-100">{st.quantity} un</td>
                          <td className="py-2.5 text-center text-slate-500">{st.responsibleUser}</td>
                          <td className="py-2.5 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-green-50 text-green-700 tracking-wide uppercase">
                              Concluído
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Floating Action Button (FAB) on bottom right */}
      {canMutate && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={openCreateForm}
            className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white p-3.5 rounded-full shadow-2xl flex items-center gap-2 group cursor-pointer transition-all duration-300"
            title="Adicionar Novo Produto"
          >
            <Plus className="w-6 h-6" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold text-xs whitespace-nowrap uppercase tracking-wider">
              Adicionar Produto
            </span>
          </button>
        </div>
      )}

      {/* 4. SLIDE-OVER DETAIL DRAWER PANEL (Product Card Details) */}
      {detailedProduct && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-55 transition-opacity" onClick={() => setDetailedProduct(null)} />
          
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-55 flex flex-col animate-in slide-in-from-right duration-200 dark:bg-zinc-900 dark:border-zinc-800 text-xs text-slate-600">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{detailedProduct.emoji || "📦"}</span>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm dark:text-zinc-100">{detailedProduct.name}</h3>
                  <span className="text-[10px] font-mono text-slate-400">SKU / ID: {detailedProduct.code}</span>
                </div>
              </div>
              <button 
                onClick={() => setDetailedProduct(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Image Banner if available, else big emoji */}
              {detailedProduct.image ? (
                <div className="w-full h-40 rounded-xl overflow-hidden border border-slate-200">
                  <img src={detailedProduct.image} alt={detailedProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-full h-24 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center select-none dark:bg-zinc-950 dark:border-zinc-800">
                  <span className="text-4xl">{detailedProduct.emoji || "📦"}</span>
                </div>
              )}

              {/* Financial Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2.5 dark:bg-zinc-950 dark:border-zinc-800">
                <h4 className="font-bold text-[10px] text-slate-400 uppercase font-mono tracking-wider">Tabela de Preços & Margens</h4>
                
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <p className="text-[10px] text-slate-400">Preço de Custo</p>
                    <p className="font-bold text-slate-700 dark:text-zinc-200 mt-0.5">{detailedProduct.costPrice.toLocaleString()} {currency}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Preço de Venda</p>
                    <p className="font-bold text-slate-800 dark:text-zinc-100 mt-0.5">{detailedProduct.salePrice.toLocaleString()} {currency}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Lucro Unitário</p>
                    <p className="font-bold text-emerald-600 mt-0.5">{(detailedProduct.salePrice - detailedProduct.costPrice).toLocaleString()} {currency}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Margem Comercial</p>
                    <p className="font-bold text-emerald-600 mt-0.5">
                      {detailedProduct.costPrice > 0 ? Math.round(((detailedProduct.salePrice - detailedProduct.costPrice) / detailedProduct.costPrice) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Inventory Box */}
              <div className="space-y-3">
                <h4 className="font-bold text-[10px] text-slate-400 uppercase font-mono tracking-wider">Métricas de Stock</h4>
                
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="border border-slate-200 p-3 rounded-xl dark:border-zinc-800">
                    <p className="text-slate-400 text-[10px]">Stock Atual</p>
                    <p className="text-xl font-bold font-mono text-slate-800 dark:text-zinc-100 mt-0.5">{detailedProduct.stock} un</p>
                  </div>
                  <div className="border border-slate-200 p-3 rounded-xl dark:border-zinc-800">
                    <p className="text-slate-400 text-[10px]">Mínimo Alerta</p>
                    <p className="text-xl font-bold font-mono text-slate-800 dark:text-zinc-100 mt-0.5">{detailedProduct.minStock} un</p>
                  </div>
                </div>

                <div className="border border-slate-200 p-3.5 rounded-xl space-y-2 dark:border-zinc-800">
                  <div className="flex justify-between items-center text-xs">
                    <span>Validade:</span>
                    <span className="font-bold font-mono">
                      {detailedProduct.expiryDate ? new Date(detailedProduct.expiryDate).toLocaleDateString() : "Sem vencimento"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span>Imposto IVA:</span>
                    <span className="font-bold font-mono">{detailedProduct.vatRate || 16}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span>Fornecedor:</span>
                    <span className="font-bold text-slate-700 dark:text-zinc-300">{detailedProduct.supplier || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span>Categoria:</span>
                    <span className="font-bold font-mono text-slate-500">{detailedProduct.category}</span>
                  </div>
                </div>
              </div>

              {/* Simulated Stock Movement History Logs */}
              <div className="space-y-3">
                <h4 className="font-bold text-[10px] text-slate-400 uppercase font-mono tracking-wider">Histórico de Movimentações</h4>
                
                <div className="space-y-2.5">
                  <div className="flex gap-2.5 items-start border-l-2 border-green-500 pl-3 py-0.5">
                    <div className="flex-1">
                      <p className="font-bold text-slate-700 dark:text-zinc-300">Inventário Inicial de Cadastro</p>
                      <p className="text-[10px] text-slate-400">Criado com semente padrão ou XLS</p>
                    </div>
                    <span className="font-bold font-mono text-green-600 text-xs">+{detailedProduct.stock}</span>
                  </div>

                  <div className="flex gap-2.5 items-start border-l-2 border-slate-300 pl-3 py-0.5">
                    <div className="flex-1">
                      <p className="font-bold text-slate-700 dark:text-zinc-300">Auditoria Regular OST</p>
                      <p className="text-[10px] text-slate-400">Conformidade de Stock</p>
                    </div>
                    <span className="font-bold font-mono text-slate-500 text-xs">OK</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Drawer Actions Footer */}
            {canMutate && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2 dark:bg-zinc-950 dark:border-zinc-800">
                <button
                  onClick={() => { openEditForm(detailedProduct); setDetailedProduct(null); }}
                  className="w-1/2 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200"
                >
                  <Edit3 className="w-4 h-4" />
                  Editar Produto
                </button>
                <button
                  onClick={() => { handleDuplicateProduct(detailedProduct); setDetailedProduct(null); }}
                  className="w-1/2 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Copy className="w-4 h-4" />
                  Duplicar
                </button>
              </div>
            )}

          </div>
        </>
      )}

      {/* 5. QUICK ADJUSTMENT INPUT DIALOG MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 dark:bg-zinc-900">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 dark:border-zinc-800">
              <h3 className="font-bold text-slate-800 dark:text-zinc-100">
                Ajustar Stock: <span className="text-orange-500">{adjustingProduct.name}</span>
              </h3>
              <button 
                onClick={() => setAdjustingProduct(null)}
                className="text-slate-400 hover:text-slate-650 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAdjust} className="space-y-4 text-xs">
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType("IN")}
                  className={`w-1/2 py-2 rounded-xl font-bold border transition ${
                    adjustmentType === "IN"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  📥 Entrada (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType("OUT")}
                  className={`w-1/2 py-2 rounded-xl font-bold border transition ${
                    adjustmentType === "OUT"
                      ? "bg-red-50 border-red-300 text-red-700"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  📤 Saída (-)
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade do Ajuste</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ex: 5"
                  value={adjustmentQty || ""}
                  onChange={(e) => setAdjustmentQty(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5 font-bold font-mono text-center text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Motivo Comercial</label>
                <input
                  type="text"
                  placeholder="Ex: Reposição de Fornecedor, Quebra, etc."
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-medium"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border font-mono dark:bg-zinc-950 dark:border-zinc-850">
                <p className="text-[10px] text-slate-400">Previsão Comercial</p>
                <div className="flex justify-between items-center text-xs mt-1">
                  <span>Quantidade Atual:</span>
                  <span className="font-bold">{adjustingProduct.stock} un</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>Resultado Ajustado:</span>
                  <span className="font-bold text-orange-600">
                    {adjustmentType === "IN" 
                      ? adjustingProduct.stock + adjustmentQty 
                      : Math.max(0, adjustingProduct.stock - adjustmentQty)} un
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="w-1/2 py-2.5 border rounded-xl font-bold hover:bg-slate-50 text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"
                >
                  Aplicar Ajuste
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DOCKER DRAWER MODAL: Add / Edit Product */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-xl w-full border border-slate-100 shadow-2xl space-y-4 animate-in fade-in duration-200 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-zinc-800">
              <h3 className="font-bold text-slate-950 text-sm dark:text-zinc-100">
                {editingProduct ? `Editar Detalhes: ${editingProduct.name}` : "Cadastrar Novo Produto para Stock"}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-450 hover:text-slate-650 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              {validationError && (
                <p className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg font-semibold">{validationError}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Comercial do Produto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Óleo Alimentar Maçaroca 5L"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-850"
                  />
                </div>

                {/* SKU Code */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Código / SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: OLE-MAÇ-05"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500"
                  />
                </div>

                {/* Category selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer"
                  >
                    <option value="Mercearia">Mercearia</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Eletrónicos">Eletrónicos</option>
                    <option value="Construção">Construção</option>
                    <option value="Vestuário">Vestuário</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                {/* Supplier */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fornecedor Distribuidor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: CDM Moçambique ou MozAlimentos"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-850"
                  />
                </div>

                {/* Cost price */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Preço de Custo (MT) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 110"
                    value={costPrice || ""}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold font-mono outline-none"
                  />
                </div>

                {/* Sale price */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Preço de Venda (MT) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 165"
                    value={salePrice || ""}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold font-mono outline-none"
                  />
                </div>

                {/* Stock default */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Estoque Inicial (Unidades) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 30"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold font-mono outline-none"
                  />
                </div>

                {/* Stock limit minimum */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Estoque Mínimo de Alerta *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 5"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold font-mono outline-none"
                  />
                </div>

                {/* Expiry Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Data de Validade/Vencimento</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none"
                  />
                </div>

                {/* Image URL input (Optional) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">URL da Imagem do Produto (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/imagem.png"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500"
                  />
                </div>

                {/* Emoji visual selector */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Emoji do Produto / Decorador</label>
                  <select
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer"
                  >
                    <option value="🍙">🍙 Arroz / Grãos</option>
                    <option value="🧴">🧴 Garrafas / Óleo</option>
                    <option value="🌾">🌾 Sacos / Farinhas</option>
                    <option value="🍺">🍺 Garrafas / Laurentina</option>
                    <option value="🍻">🍻 Latas / Cervejas</option>
                    <option value="🧃">🧃 Sumos / Tetrapaks</option>
                    <option value="🔌">🔌 Acessórios USB</option>
                    <option value="📱">📱 Celulares / Smartphones</option>
                    <option value="🧱">🧱 Cimento / Tijolo</option>
                    <option value="👕">👕 Roupas / Vestuário</option>
                    <option value="🥫">🥫 Enlatados / Tomate</option>
                    <option value="📦">📦 Outros Genericamente</option>
                  </select>
                </div>

                {/* Promotion Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Campanha Promocional</label>
                  <select
                    value={promotion}
                    onChange={(e) => setPromotion(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer text-slate-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Nenhuma</option>
                    <option value="PROMO">PROMO - Promoção Geral</option>
                    <option value="DESCONTO">DESCONTO - Oferta / Liquidação</option>
                    <option value="MAIS_VENDIDO">MAIS VENDIDO - Destaque de Vendas</option>
                    <option value="NOVO">NOVO - Lançamento</option>
                  </select>
                </div>

                {/* Promotional Image Creator Button inside form */}
                <div className="space-y-1 flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!name.trim()) {
                        setValidationError("Por favor, preencha pelo menos o nome do produto para gerar o cartaz publicitário.");
                        return;
                      }
                      const tempProduct: Product = {
                        id: editingProduct ? editingProduct.id : `temp-${Date.now()}`,
                        name,
                        code: code || "PROMO-CODE",
                        category,
                        supplier: supplier || "OST Vendas",
                        costPrice: costPrice || 0,
                        salePrice: salePrice || 0,
                        vatRate: vatRate || 16,
                        stock: stock || 0,
                        minStock: minStock || 0,
                        emoji,
                        image: imageUrl || undefined,
                        promotion: promotion || "PROMO"
                      };
                      setFlyerProduct(tempProduct);
                      setIsFlyerGeneratorOpen(true);
                    }}
                    className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1.5 shadow-sm border border-orange-200/50"
                  >
                    <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-200" />
                    Gerar Cartaz de Promoção
                  </button>
                </div>

              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer transition"
                >
                  {editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promo Poster/Flyer generator modal */}
      {flyerProduct && (
        <PromoFlyerGenerator
          product={flyerProduct}
          allProducts={products}
          isOpen={isFlyerGeneratorOpen}
          onClose={() => {
            setIsFlyerGeneratorOpen(false);
            setFlyerProduct(null);
          }}
          currency={currency}
          onShowToast={(msg, type) => {
            if (onShowToast) onShowToast(msg, type === "success" ? "success" : type === "error" ? "error" : "info");
          }}
          settings={settings}
        />
      )}

    </div>
  );
}
