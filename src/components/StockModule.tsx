import React, { useState, useMemo, memo, useEffect, useRef } from "react";
import { 
  Plus, 
  Upload, 
  Calendar, 
  AlertTriangle, 
  Layers, 
  BarChart3, 
  List, 
  FileSpreadsheet, 
  Truck, 
  MapPin, 
  Sliders, 
  Filter, 
  RefreshCw, 
  Search 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product, UserRole, Transaction, SystemSettings, Supplier, SupplierOrder } from "../types";
import { useConfirm } from "../hooks/useConfirm";
import { PromoFlyerGenerator } from "./PromoFlyerGenerator";
import StockThresholdsSettings from "./StockThresholdsSettings";
import { generateEntityId } from "../lib/deterministic";
import { ModuleShortcutsHelp } from "./common/ModuleShortcutsHelp";

// Submodules
import { StockSuppliersTab } from "./stock/StockSuppliersTab";
import { StockBatchesTab } from "./stock/StockBatchesTab";
import { StockReportsTab } from "./stock/StockReportsTab";
import { StockBranchesTab } from "./stock/StockBranchesTab";
import { StockChartsTab } from "./stock/StockChartsTab";
import { ProductDetailSlideOver } from "./stock/ProductDetailSlideOver";
import { QuickAdjustModal } from "./stock/QuickAdjustModal";
import { ProductFormDrawer } from "./stock/ProductFormDrawer";
import { StockProductsTable } from "./stock/StockProductsTable";
import { SupplierOrderModal, SupplierEmailModal } from "./stock/SupplierOrderModals";
import { StockStatsHeader } from "./stock/StockStatsHeader";
import { StockCsvImportExportModal } from "./stock/StockCsvImportExportModal";

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

export interface StockModuleProps {
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

function StockModule({
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
  
  // Navigation & Sub-tabs
  const [activeModuleTab, setActiveModuleTab] = useState<"list" | "charts" | "reports" | "batches" | "branches" | "suppliers" | "thresholds">("list");
  const [supplierSubTab, setSupplierSubTab] = useState<"orders" | "finance" | "config">("orders");
  const [selectedFinanceSupplierId, setSelectedFinanceSupplierId] = useState<string | null>(null);
  const [supplierChartLayout, setSupplierChartLayout] = useState<"grouped" | "stacked">("grouped");

  // Suppliers & Orders data
  const registeredSuppliers: Supplier[] = useMemo(() => settings?.suppliers || [], [settings?.suppliers]);
  const supplierOrders: SupplierOrder[] = useMemo(() => settings?.supplierOrders || [], [settings?.supplierOrders]);

  // Modals & Panels state
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailedProduct, setDetailedProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"IN" | "OUT">("IN");
  const [flyerProduct, setFlyerProduct] = useState<Product | null>(null);
  const [isFlyerGeneratorOpen, setIsFlyerGeneratorOpen] = useState(false);
  const [showStockShortcutsHelp, setShowStockShortcutsHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Supplier Form state
  const [supplierNameInput, setSupplierNameInput] = useState("");
  const [supplierPhoneInput, setSupplierPhoneInput] = useState("");
  const [supplierEmailInput, setSupplierEmailInput] = useState("");
  const [supplierAddressInput, setSupplierAddressInput] = useState("");
  const [supplierNuitInput, setSupplierNuitInput] = useState("");
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);

  // Supplier Order Modal state
  const [orderSupplierId, setOrderSupplierId] = useState("");
  const [orderProductId, setOrderProductId] = useState("");
  const [orderQtyRequested, setOrderQtyRequested] = useState<number>(0);
  const [orderUnitCost, setOrderUnitCost] = useState<number>(0);
  const [orderPaymentStatus, setOrderPaymentStatus] = useState<"Pago" | "Crédito" | "Pendente">("Pendente");
  const [orderPaymentDueDate, setOrderPaymentDueDate] = useState("");
  const [orderDispatchChannel, setOrderDispatchChannel] = useState<"WHATSAPP" | "EMAIL" | "NONE">("WHATSAPP");
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);

  // Supplier Email Modal state
  const [isOrderEmailModalOpen, setIsOrderEmailModalOpen] = useState(false);
  const [selectedOrderForEmail, setSelectedOrderForEmail] = useState<SupplierOrder | null>(null);
  const [orderEmailRecipient, setOrderEmailRecipient] = useState("");
  const [orderEmailSubject, setOrderEmailSubject] = useState("");
  const [orderEmailBody, setOrderEmailBody] = useState("");

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedSupplier, setSelectedSupplier] = useState("Todos");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW_STOCK" | "OUT_OF_STOCK" | "EXPIRED">("ALL");
  const [minMarginFilter, setMinMarginFilter] = useState<number>(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortField, setSortField] = useState<"name" | "code" | "category" | "salePrice" | "costPrice" | "stock" | "stockValue">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // CSV Import State
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "processing" | "success">("idle");
  const [importedRowCount, setImportedRowCount] = useState(0);

  const canMutate = currentRole === "ADMIN" || currentRole === "SUPERVISOR";

  // Categories & Suppliers list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return ["Todos", ...Array.from(set)];
  }, [products]);

  const suppliersList = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.supplier) set.add(p.supplier); });
    return ["Todos", ...Array.from(set)];
  }, [products]);

  // Overall calculations & stats
  const stats = useMemo(() => {
    let totalItems = products.length;
    let outOfStock = 0;
    let lowStock = 0;
    let upcomingExpiry = 0;
    let totalCostValuation = 0;
    let totalSaleValuation = 0;

    const now = Date.now();

    products.forEach(p => {
      if (p.stock <= 0) outOfStock++;
      else if (p.stock <= p.minStock) lowStock++;

      if (p.expiryDate) {
        const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 30) upcomingExpiry++;
      }

      totalCostValuation += p.stock * p.costPrice;
      totalSaleValuation += p.stock * p.salePrice;
    });

    const totalPotentialProfit = totalSaleValuation - totalCostValuation;
    const avgMarginPct = totalCostValuation > 0 ? Math.round((totalPotentialProfit / totalCostValuation) * 100) : 0;

    return {
      totalItems,
      outOfStock,
      lowStock,
      upcomingExpiry,
      totalCostValuation,
      totalSaleValuation,
      totalPotentialProfit,
      avgMarginPct
    };
  }, [products]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        const matchCat = (p.category || "").toLowerCase().includes(q);
        const matchSupp = (p.supplier || "").toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat && !matchSupp) return false;
      }

      // Category
      if (selectedCategory !== "Todos" && p.category !== selectedCategory) return false;

      // Supplier
      if (selectedSupplier !== "Todos" && p.supplier !== selectedSupplier) return false;

      // Margin
      if (minMarginFilter > 0) {
        const profit = p.salePrice - p.costPrice;
        const margin = p.costPrice > 0 ? (profit / p.costPrice) * 100 : 0;
        if (margin < minMarginFilter) return false;
      }

      // Stock Level Filter
      if (stockFilter === "LOW_STOCK") {
        if (p.stock <= 0 || p.stock > p.minStock) return false;
      } else if (stockFilter === "OUT_OF_STOCK") {
        if (p.stock > 0) return false;
      } else if (stockFilter === "EXPIRED") {
        if (!p.expiryDate) return false;
        const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 30) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: string | number = a[sortField] ?? "";
      let valB: string | number = b[sortField] ?? "";

      if (sortField === "stockValue") {
        valA = a.stock * a.salePrice;
        valB = b.stock * b.salePrice;
      }

      if (typeof valA === "string") {
        return sortDirection === "asc" 
          ? (valA as string).localeCompare(valB as string) 
          : (valB as string).localeCompare(valA as string);
      }
      return sortDirection === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [products, searchQuery, selectedCategory, selectedSupplier, minMarginFilter, stockFilter, sortField, sortDirection]);

  // Paginated slice
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Sorting handler
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    const currentIds = paginatedProducts.map(p => p.id);
    const allSelected = currentIds.every(id => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Stock Request from Supplier
  const handleRequestStockFromSupplier = (product: Product) => {
    setActiveModuleTab("suppliers");
    setOrderProductId(product.id);
    setOrderUnitCost(product.costPrice);
    setOrderQtyRequested(product.minStock * 2 || 10);
    setOrderPaymentDueDate("");
    
    if (product.supplier) {
      const matchSupp = registeredSuppliers.find(s => s.name.toLowerCase() === product.supplier?.toLowerCase());
      setOrderSupplierId(matchSupp ? matchSupp.id : "");
    } else {
      setOrderSupplierId("");
    }
    
    setIsOrderFormOpen(true);
  };

  // Save Supplier Handler
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierNameInput.trim()) {
      onShowToast?.("O nome do fornecedor é obrigatório.", "error");
      return;
    }

    let updated: Supplier[];
    if (editingSupplierId) {
      updated = registeredSuppliers.map(s => 
        s.id === editingSupplierId 
          ? { ...s, name: supplierNameInput, phone: supplierPhoneInput, email: supplierEmailInput, address: supplierAddressInput, nuit: supplierNuitInput }
          : s
      );
      onShowToast?.("Fornecedor atualizado com sucesso!", "success");
      onAddAuditLog("Editar Fornecedor", "STOCK", `Atualizado fornecedor ${supplierNameInput}.`);
    } else {
      const newSupplier: Supplier = {
        id: generateEntityId("supp"),
        name: supplierNameInput,
        phone: supplierPhoneInput,
        email: supplierEmailInput,
        address: supplierAddressInput,
        nuit: supplierNuitInput,
        status: "Ativo"
      };
      updated = [...registeredSuppliers, newSupplier];
      onShowToast?.("Fornecedor registado com sucesso!", "success");
      onAddAuditLog("Registar Fornecedor", "STOCK", `Registado novo fornecedor ${supplierNameInput}.`);
    }

    onUpdateSettings?.({ suppliers: updated });
    
    setSupplierNameInput("");
    setSupplierPhoneInput("");
    setSupplierEmailInput("");
    setSupplierAddressInput("");
    setSupplierNuitInput("");
    setEditingSupplierId(null);
    setIsSupplierFormOpen(false);
  };

  const handleEditSupplierClick = (supp: Supplier) => {
    setEditingSupplierId(supp.id);
    setSupplierNameInput(supp.name);
    setSupplierPhoneInput(supp.phone || "");
    setSupplierEmailInput(supp.email || "");
    setSupplierAddressInput(supp.address || "");
    setSupplierNuitInput(supp.nuit || "");
    setIsSupplierFormOpen(true);
  };

  const handleDeleteSupplier = async (suppId: string, name: string) => {
    const ok = await confirm({
      title: "Eliminar Fornecedor",
      message: `Tem certeza de que deseja remover o fornecedor "${name}"? Os produtos associados não serão removidos.`
    });
    if (!ok) return;

    const updated = registeredSuppliers.filter(s => s.id !== suppId);
    onUpdateSettings?.({ suppliers: updated });
    onShowToast?.("Fornecedor removido com sucesso.", "success");
    onAddAuditLog("Eliminar Fornecedor", "STOCK", `Removido fornecedor ${name}.`);
  };

  // WhatsApp Alert for Product
  const handleSendWhatsAppStockAlert = (p: Product) => {
    const companyName = settings?.companyName || "OST Vendas";
    const msg = `*ALERTA DE STOCK - ${companyName}*\nProduto: ${p.name} (SKU: ${p.code})\nStock Atual: ${p.stock} un | Mínimo: ${p.minStock} un\nPreço Venda: ${p.salePrice} ${currency}\nData: ${new Date().toLocaleDateString("pt-MZ")}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    onShowToast?.("WhatsApp aberto com resumo do produto.", "info");
  };

  // Supplier Order PDF
  const handleGenerateSupplierOrderPDF = async (order: SupplierOrder, supplierOverride?: Supplier) => {
    const supp = supplierOverride || registeredSuppliers.find(s => s.id === order.supplierId || s.name.toLowerCase() === order.supplierName.toLowerCase());

    const doc = new jsPDF();
    const companyName = settings?.companyName || "OST Vendas";
    const storeContact = settings?.storeContact || "";
    const storeAddress = settings?.storeAddress || "";
    const storeNuit = settings?.nuit || settings?.companyNuit || "";
    const storeEmail = settings?.email || settings?.storeEmail || "";

    let logoData = "";
    try {
      const rawLogo = settings?.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg";
      logoData = await getBase64ImageFromUrl(rawLogo);
    } catch (err) {
      console.error("Erro ao carregar logotipo para PDF:", err);
    }

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 48, "F");

    if (logoData) {
      try {
        doc.addImage(logoData, "JPEG", 14, 8, 30, 30);
      } catch {
        try {
          doc.addImage(logoData, "PNG", 14, 8, 30, 30);
        } catch {}
      }
    }

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName.toUpperCase(), 48, 16);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    let yPos = 22;
    if (storeNuit) { doc.text(`NUIT: ${storeNuit}`, 48, yPos); yPos += 4.5; }
    if (storeContact) { doc.text(`Contacto: ${storeContact}`, 48, yPos); yPos += 4.5; }
    if (storeAddress) { doc.text(`Endereço: ${storeAddress}`, 48, yPos); yPos += 4.5; }
    if (storeEmail) { doc.text(`E-mail: ${storeEmail}`, 48, yPos); }

    doc.setFillColor(234, 88, 12);
    doc.rect(130, 10, 66, 30, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text("ORDEM DE COMPRA", 135, 18);
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.text(`Ref: ${order.id}`, 135, 25);
    doc.text(`Data: ${order.requestDate || new Date().toISOString().split("T")[0]}`, 135, 31);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 54, 182, 32, 2, 2, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text("DADOS DO FORNECEDOR / DESTINATÁRIO", 18, 62);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Empresa / Nome: ${supp?.name || order.supplierName}`, 18, 70);
    doc.text(`E-mail: ${supp?.email || orderEmailRecipient || "Não informado"}`, 18, 77);
    doc.text(`Telefone: ${supp?.phone || "Não informado"}`, 115, 70);
    doc.text(`Endereço: ${supp?.address || "Não informado"}`, 115, 77);

    autoTable(doc, {
      startY: 92,
      head: [["Ref / Código", "Descrição do Item Solicitado", "Qtd Solicitada", "Preço Unit. (MT)", "Valor Total (MT)"]],
      body: [
        [
          order.productId || "-",
          order.productName || "Produto Solicitado",
          `${order.quantityRequested} un`,
          `${(order.unitCost || 0).toLocaleString("pt-MZ")} MT`,
          `${(order.totalValue || 0).toLocaleString("pt-MZ")} MT`
        ]
      ],
      theme: "grid",
      headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 8.5, cellPadding: 3.5 }
    });

    return doc;
  };

  // Send Supplier WhatsApp Order
  const handleSendSupplierOrderWhatsApp = (order: SupplierOrder, supplierOverride?: Supplier) => {
    const supp = supplierOverride || registeredSuppliers.find(s => s.id === order.supplierId || s.name.toLowerCase() === order.supplierName.toLowerCase());
    const phone = supp?.phone || "";

    if (!phone.trim()) {
      onShowToast?.(`O fornecedor "${order.supplierName}" não possui contacto telefónico cadastrado.`, "warning");
      return;
    }

    let cleanPhone = phone.replace(/[^\d+]/g, "");
    if (!cleanPhone.startsWith("+") && !cleanPhone.startsWith("258") && cleanPhone.length === 9) {
      cleanPhone = `258${cleanPhone}`;
    } else if (cleanPhone.startsWith("+")) {
      cleanPhone = cleanPhone.substring(1);
    }

    const companyName = settings?.companyName || "OST Vendas";
    const msg = `*SOLICITAÇÃO DE MATERIAL / PEDIDO DE COMPRA*\n--------------------------------------------\n*Empresa:* ${companyName}\n*Para Fornecedor:* ${order.supplierName}\n*Nº do Pedido:* ${order.id}\n*Data:* ${order.requestDate || new Date().toISOString().split("T")[0]}\n\n*Item Solicitado:*\n• *Produto:* ${order.productName}\n• *Quantidade:* ${order.quantityRequested} un.\n• *Preço Unitário de Custo:* ${(order.unitCost || 0).toLocaleString("pt-MZ")} MT\n• *Valor Total:* ${(order.totalValue || 0).toLocaleString("pt-MZ")} MT\n\n*Condições de Pagamento:* ${order.paymentStatus || "Pendente"}\n\nPor favor, confirme a disponibilidade e previsão de entrega.\n\nAtenciosamente,\n${companyName}`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    onShowToast?.(`Acessando WhatsApp para enviar pedido a ${order.supplierName}...`, "success");
    onAddAuditLog("Enviar Pedido WhatsApp", "STOCK", `Pedido ${order.id} enviado via WhatsApp.`);
  };

  // Save Supplier Order Handler
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderSupplierId || !orderProductId || orderQtyRequested <= 0) {
      onShowToast?.("Preencha todos os campos obrigatórios do pedido.", "error");
      return;
    }

    const supp = registeredSuppliers.find(s => s.id === orderSupplierId);
    const prod = products.find(p => p.id === orderProductId);

    if (!supp || !prod) {
      onShowToast?.("Fornecedor ou produto inválido.", "error");
      return;
    }

    const orderId = generateEntityId("pord");
    const totalVal = orderQtyRequested * (orderUnitCost || prod.costPrice);
    const today = new Date().toISOString().split("T")[0];

    let calculatedDueDate = orderPaymentDueDate;
    if (!calculatedDueDate && orderPaymentStatus !== "Pago") {
      const d = new Date();
      d.setDate(d.getDate() + 15);
      calculatedDueDate = d.toISOString().split("T")[0];
    }

    const newOrder: SupplierOrder = {
      id: orderId,
      supplierId: supp.id,
      supplierName: supp.name,
      productId: prod.id,
      productName: prod.name,
      quantityRequested: orderQtyRequested,
      unitCost: orderUnitCost || prod.costPrice,
      totalValue: totalVal,
      requestDate: today,
      status: "Pendente",
      paymentStatus: orderPaymentStatus,
      paymentDueDate: calculatedDueDate || undefined
    };

    const updated = [newOrder, ...supplierOrders];
    onUpdateSettings?.({ supplierOrders: updated });
    onAddAuditLog("Novo Pedido Fornecedor", "STOCK", `Criado pedido de compra #${orderId} (${orderQtyRequested}x ${prod.name}).`);
    onShowToast?.(`Pedido #${orderId} gerado com sucesso!`, "success");

    setIsOrderFormOpen(false);

    if (orderDispatchChannel === "WHATSAPP") {
      handleSendSupplierOrderWhatsApp(newOrder, supp);
    } else if (orderDispatchChannel === "EMAIL") {
      setSelectedOrderForEmail(newOrder);
      setOrderEmailRecipient(supp.email || "");
      setOrderEmailSubject(`Ordem de Compra Ref #${newOrder.id} - ${settings?.companyName || "OST Vendas"}`);
      setOrderEmailBody(`Prezados,\n\nSegue a solicitação de material da empresa ${settings?.companyName || "OST Vendas"}:\n\nPedido #${newOrder.id}\nProduto: ${newOrder.productName}\nQuantidade: ${newOrder.quantityRequested} un.\nPreço Unitário: ${newOrder.unitCost} MT\nTotal: ${newOrder.totalValue} MT\n\nAtenciosamente.`);
      setIsOrderEmailModalOpen(true);
    }
  };

  // CSV Import/Export handlers
  const handleDownloadCSVTemplate = () => {
    const headers = "Código,Nome,Categoria,Preço Custo,Preço Venda,Stock,Stock Mínimo,Fornecedor\n";
    const sample = "SKU-001,Exemplo Produto,Bebidas,50,80,100,20,CDM\n";
    const blob = new Blob([headers + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_produtos_inventario.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleParseAndImportFile = (file: File) => {
    setImportStatus("processing");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setImportStatus("idle");
        onShowToast?.("Ficheiro vazio.", "error");
        return;
      }

      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length <= 1) {
        setImportStatus("idle");
        onShowToast?.("Ficheiro não contém dados de produtos além do cabeçalho.", "warning");
        return;
      }

      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map(p => p.trim());
        if (parts.length >= 2 && parts[1]) {
          const newP: Product = {
            id: generateEntityId("prod"),
            code: parts[0] || generateEntityId("sku"),
            name: parts[1],
            category: parts[2] || "Geral",
            costPrice: Number(parts[3]) || 0,
            salePrice: Number(parts[4]) || 0,
            vatRate: settings?.vatDefaultRate || 16,
            stock: Number(parts[5]) || 0,
            minStock: Number(parts[6]) || 5,
            supplier: parts[7] || undefined
          };
          onAddProduct(newP);
          count++;
        }
      }

      setImportedRowCount(count);
      setImportStatus("success");
      onShowToast?.(`${count} produtos importados com sucesso!`, "success");
      onAddAuditLog("Importar CSV", "STOCK", `Importados ${count} produtos via ficheiro.`);
    };
    reader.readAsText(file);
  };

  // Product CRUD Handlers
  const handleOpenCreateForm = () => {
    setEditingProduct(null);
    setIsFormDrawerOpen(true);
  };

  const handleOpenEditForm = (p: Product) => {
    setEditingProduct(p);
    setIsFormDrawerOpen(true);
  };

  const handleDuplicateProduct = (p: Product) => {
    const duplicated: Product = {
      ...p,
      id: generateEntityId("prod"),
      code: `${p.code}-COPIA`,
      name: `${p.name} (Cópia)`
    };
    onAddProduct(duplicated);
    onShowToast?.(`Produto "${duplicated.name}" duplicado com sucesso!`, "success");
    onAddAuditLog("Duplicar Produto", "STOCK", `Duplicado produto ${p.name} para ${duplicated.name}.`);
  };

  const handleDeleteProductClick = async (productId: string) => {
    const p = products.find(prod => prod.id === productId);
    const ok = await confirm({
      title: "Eliminar Produto",
      message: `Tem a certeza de que deseja eliminar o produto "${p?.name || productId}" do catálogo?`
    });
    if (!ok) return;

    onDeleteProduct(productId);
    onShowToast?.("Produto removido com sucesso.", "success");
    onAddAuditLog("Eliminar Produto", "STOCK", `Removido produto ${p?.name || productId}.`);
  };

  // Keyboard Shortcuts for Stock Module
  useEffect(() => {
    const handleStockKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

      if (e.key === "F1") {
        e.preventDefault();
        setShowStockShortcutsHelp(prev => !prev);
        return;
      }

      if (e.key === "Escape") {
        if (showStockShortcutsHelp) {
          e.preventDefault();
          setShowStockShortcutsHelp(false);
          return;
        }
        if (isFormDrawerOpen) {
          setIsFormDrawerOpen(false);
          return;
        }
        if (detailedProduct) {
          setDetailedProduct(null);
          return;
        }
        if (adjustingProduct) {
          setAdjustingProduct(null);
          return;
        }
        if (showImportPanel) {
          setShowImportPanel(false);
          return;
        }
      }

      // Action shortcuts when not typing in an input
      if (!isInput) {
        if (e.key === "F2" || ((e.ctrlKey || e.metaKey) && (e.key === "n" || e.key === "N"))) {
          e.preventDefault();
          handleOpenCreateForm();
          onShowToast?.("Atalho F2: Novo Produto", "info");
        } else if (e.key === "F3" || e.key === "/") {
          e.preventDefault();
          searchInputRef.current?.focus();
          onShowToast?.("Atalho F3: Pesquisa Focada", "info");
        } else if (e.key === "F4" || ((e.ctrlKey || e.metaKey) && (e.key === "e" || e.key === "E"))) {
          e.preventDefault();
          setShowImportPanel(true);
          onShowToast?.("Atalho F4: Importar / Exportar CSV", "info");
        } else if (e.key === "F8") {
          e.preventDefault();
          setShowAdvancedFilters(prev => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleStockKeyDown);
    return () => window.removeEventListener("keydown", handleStockKeyDown);
  }, [showStockShortcutsHelp, isFormDrawerOpen, detailedProduct, adjustingProduct, showImportPanel, onShowToast]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 pb-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveModuleTab("list")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModuleTab === "list"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <List className="w-4 h-4" />
            Catálogo & Stock
          </button>

          <button
            onClick={() => setActiveModuleTab("batches")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModuleTab === "batches"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            Lotes & Validades
          </button>

          <button
            onClick={() => setActiveModuleTab("suppliers")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModuleTab === "suppliers"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Truck className="w-4 h-4" />
            Fornecedores
          </button>

          <button
            onClick={() => setActiveModuleTab("branches")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModuleTab === "branches"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <MapPin className="w-4 h-4" />
            Filiais & Transferências
          </button>

          <button
            onClick={() => setActiveModuleTab("charts")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModuleTab === "charts"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Gráficos & Análise
          </button>

          <button
            onClick={() => setActiveModuleTab("reports")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModuleTab === "reports"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Relatórios
          </button>

          <button
            onClick={() => setActiveModuleTab("thresholds")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModuleTab === "thresholds"
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Sliders className="w-4 h-4" />
            Alertas & Margens
          </button>
        </div>

        {activeModuleTab === "list" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportPanel(!showImportPanel)}
              className="bg-white border border-slate-200 hover:bg-slate-50 py-2 px-3.5 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Upload className="w-4 h-4" />
              Importar Planilha
            </button>

            {canMutate && (
              <button
                onClick={handleOpenCreateForm}
                className="bg-orange-500 hover:bg-orange-600 py-2 px-4 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-orange-500/10 cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                Novo Produto
              </button>
            )}
          </div>
        )}
      </div>

      {/* SUB-TAB: LIST */}
      {activeModuleTab === "list" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Indicator Cards */}
          <StockStatsHeader
            totalItems={stats.totalItems}
            outOfStockCount={stats.outOfStock}
            lowStockCount={stats.lowStock}
            totalCostValuation={stats.totalCostValuation}
            totalSaleValuation={stats.totalSaleValuation}
            totalPotentialProfit={stats.totalPotentialProfit}
            avgMarginPct={stats.avgMarginPct}
            currency={currency}
            stockFilter={stockFilter === "ALL" ? "ALL" : stockFilter === "LOW_STOCK" ? "LOW" : "OUT"}
            onStockFilterChange={(f) => setStockFilter(f === "ALL" ? "ALL" : f === "LOW" ? "LOW_STOCK" : "OUT_OF_STOCK")}
          />

          {/* Excel Import Panel */}
          <StockCsvImportExportModal
            isOpen={showImportPanel}
            importStatus={importStatus}
            importedRowCount={importedRowCount}
            onClose={() => { setShowImportPanel(false); setImportStatus("idle"); }}
            onParseAndImportFile={handleParseAndImportFile}
            onDownloadCSVTemplate={handleDownloadCSVTemplate}
          />

          {/* Quick Filters Pill bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs flex flex-wrap items-center justify-between gap-3 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStockFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-colors ${
                  stockFilter === "ALL"
                    ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-zinc-900"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400"
                }`}
              >
                Todos ({stats.totalItems})
              </button>

              <button
                onClick={() => setStockFilter("LOW_STOCK")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border flex items-center gap-1.5 transition-colors ${
                  stockFilter === "LOW_STOCK"
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-white border-slate-200 text-amber-700 hover:bg-amber-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-amber-400"
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
                    : "bg-white border-slate-200 text-red-600 hover:bg-red-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-red-400"
                }`}
              >
                Esgotados ({stats.outOfStock})
              </button>

              <button
                onClick={() => setStockFilter("EXPIRED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border flex items-center gap-1.5 transition-colors ${
                  stockFilter === "EXPIRED"
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white border-slate-200 text-purple-700 hover:bg-purple-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-purple-400"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                Vencimento ({stats.upcomingExpiry})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 cursor-pointer transition ${
                  showAdvancedFilters || minMarginFilter > 0 || selectedSupplier !== "Todos"
                    ? "bg-orange-50 border-orange-300 text-orange-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filtros Avançados
                {(minMarginFilter > 0 || selectedSupplier !== "Todos") && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
              </button>
            </div>
          </div>

          {/* Search bar & Advanced filters */}
          <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-xs dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
              <div className="relative w-full md:flex-1 max-w-xl">
                <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Pesquisa por Nome, SKU/Código, Categoria ou Fornecedor..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-orange-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200"
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto items-center">
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

            {showAdvancedFilters && (
              <div className="bg-slate-50/50 p-4 border-b border-slate-150 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-150 dark:bg-zinc-950 dark:border-zinc-800">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fornecedor</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => { setSelectedSupplier(e.target.value); setCurrentPage(1); }}
                    className="bg-white border rounded-xl p-2 text-xs w-full outline-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200"
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
          </div>

          {/* Product Table */}
          <StockProductsTable
            products={filteredProducts}
            paginatedProducts={paginatedProducts}
            selectedProductIds={selectedProductIds}
            sortField={sortField}
            sortDirection={sortDirection}
            canMutate={canMutate}
            currency={currency}
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            settings={settings}
            onSort={handleSort}
            onToggleSelectAll={handleToggleSelectAll}
            onToggleSelectProduct={handleToggleSelectProduct}
            onOpenProductDetail={(p) => setDetailedProduct(p)}
            onOpenQuickAdjust={(p, type) => { setAdjustingProduct(p); setAdjustmentType(type); }}
            onSendWhatsAppAlert={handleSendWhatsAppStockAlert}
            onOpenPromoFlyer={(p) => { setFlyerProduct(p); setIsFlyerGeneratorOpen(true); }}
            onOpenEditForm={handleOpenEditForm}
            onDuplicateProduct={handleDuplicateProduct}
            onDeleteProduct={handleDeleteProductClick}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(num) => { setItemsPerPage(num); setCurrentPage(1); }}
          />
        </div>
      )}

      {/* SUB-TAB: SUPPLIERS */}
      {activeModuleTab === "suppliers" && (
        <div className="animate-in fade-in duration-150">
          <StockSuppliersTab
            registeredSuppliers={registeredSuppliers}
            supplierOrders={supplierOrders}
            currency={currency}
            settings={settings}
            supplierSubTab={supplierSubTab}
            selectedFinanceSupplierId={selectedFinanceSupplierId}
            supplierChartLayout={supplierChartLayout}
            onSupplierSubTabChange={setSupplierSubTab}
            onFinanceSupplierSelect={setSelectedFinanceSupplierId}
            onChartLayoutChange={setSupplierChartLayout}
            onOpenSupplierForm={() => {
              setEditingSupplierId(null);
              setSupplierNameInput("");
              setSupplierPhoneInput("");
              setSupplierEmailInput("");
              setSupplierAddressInput("");
              setSupplierNuitInput("");
              setIsSupplierFormOpen(true);
            }}
            onOpenOrderForm={() => {
              setOrderSupplierId("");
              setOrderProductId("");
              setOrderQtyRequested(0);
              setOrderUnitCost(0);
              setOrderPaymentStatus("Pendente");
              setOrderPaymentDueDate("");
              setIsOrderFormOpen(true);
            }}
            onEditSupplier={handleEditSupplierClick}
            onDeleteSupplier={handleDeleteSupplier}
            onSendWhatsAppOrder={handleSendSupplierOrderWhatsApp}
            onGenerateOrderPDF={async (order) => {
              const doc = await handleGenerateSupplierOrderPDF(order);
              doc.save(`Ordem_de_Compra_${order.id}.pdf`);
            }}
            onOpenOrderEmailModal={(order) => {
              setSelectedOrderForEmail(order);
              const supp = registeredSuppliers.find(s => s.id === order.supplierId || s.name === order.supplierName);
              setOrderEmailRecipient(supp?.email || "");
              setOrderEmailSubject(`Ordem de Compra Ref #${order.id} - ${settings?.companyName || "OST Vendas"}`);
              setOrderEmailBody(`Prezados,\n\nSegue o pedido de compra da empresa ${settings?.companyName || "OST Vendas"}:\n\nPedido #${order.id}\nItem: ${order.productName}\nQuantidade: ${order.quantityRequested} un.\nTotal: ${order.totalValue} MT\n\nAtenciosamente.`);
              setIsOrderEmailModalOpen(true);
            }}
            onUpdateOrderStatus={(orderId, newStatus) => {
              const updated = supplierOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
              onUpdateSettings?.({ supplierOrders: updated });
              onShowToast?.(`Estado do pedido #${orderId} atualizado para ${newStatus}.`, "success");
            }}
            onUpdatePaymentStatus={(orderId, newPaymentStatus) => {
              const updated = supplierOrders.map(o => o.id === orderId ? { ...o, paymentStatus: newPaymentStatus } : o);
              onUpdateSettings?.({ supplierOrders: updated });
              onShowToast?.(`Estado de pagamento do pedido #${orderId} atualizado para ${newPaymentStatus}.`, "success");
            }}
          />
        </div>
      )}

      {/* SUB-TAB: BATCHES */}
      {activeModuleTab === "batches" && (
        <div className="animate-in fade-in duration-150">
          <StockBatchesTab
            products={products}
            settings={settings}
            currency={currency}
            onUpdateSettings={onUpdateSettings}
            onShowToast={onShowToast}
          />
        </div>
      )}

      {/* SUB-TAB: BRANCHES & TRANSFERS */}
      {activeModuleTab === "branches" && (
        <div className="animate-in fade-in duration-150">
          <StockBranchesTab
            products={products}
            settings={settings}
            currency={currency}
            onUpdateProduct={onUpdateProduct}
            onUpdateSettings={onUpdateSettings}
            onShowToast={onShowToast}
          />
        </div>
      )}

      {/* SUB-TAB: CHARTS */}
      {activeModuleTab === "charts" && (
        <div className="animate-in fade-in duration-150">
          <StockChartsTab
            products={products}
            transactions={transactions}
            currency={currency}
          />
        </div>
      )}

      {/* SUB-TAB: REPORTS */}
      {activeModuleTab === "reports" && (
        <div className="animate-in fade-in duration-150">
          <StockReportsTab
            products={products}
            settings={settings}
            currency={currency}
            onShowToast={onShowToast}
          />
        </div>
      )}

      {/* SUB-TAB: THRESHOLDS */}
      {activeModuleTab === "thresholds" && (
        <div className="animate-in fade-in duration-150">
          <StockThresholdsSettings
            products={products}
            settings={settings || ({} as SystemSettings)}
            onUpdateSettings={onUpdateSettings || (() => {})}
            onUpdateProduct={onUpdateProduct}
            onAddAuditLog={onAddAuditLog}
            onShowToast={onShowToast}
            currentRole={currentRole}
            currency={currency}
          />
        </div>
      )}

      {/* Modals and Drawers */}
      <ProductFormDrawer
        isOpen={isFormDrawerOpen}
        onClose={() => setIsFormDrawerOpen(false)}
        editingProduct={editingProduct}
        categoriesList={categoriesList.filter(c => c !== "Todos")}
        suppliersList={registeredSuppliers.map(s => s.name)}
        currency={currency}
        onSaveProduct={(prodData) => {
          if (editingProduct) {
            onUpdateProduct({ ...editingProduct, ...prodData });
            onShowToast?.("Produto atualizado com sucesso!", "success");
            onAddAuditLog("Editar Produto", "STOCK", `Atualizado produto ${prodData.name}.`);
          } else {
            const newProd: Product = {
              id: generateEntityId("prod"),
              code: prodData.code || generateEntityId("sku"),
              name: prodData.name,
              category: prodData.category,
              costPrice: prodData.costPrice,
              salePrice: prodData.salePrice,
              vatRate: prodData.vatRate || settings?.vatDefaultRate || 16,
              stock: prodData.stock,
              minStock: prodData.minStock,
              supplier: prodData.supplier,
              image: prodData.image,
              expiryDate: prodData.expiryDate,
              emoji: prodData.emoji
            };
            onAddProduct(newProd);
            onShowToast?.("Produto cadastrado com sucesso!", "success");
            onAddAuditLog("Cadastrar Produto", "STOCK", `Criado produto ${newProd.name}.`);
          }
          setIsFormDrawerOpen(false);
        }}
      />

      <ProductDetailSlideOver
        product={detailedProduct}
        onClose={() => setDetailedProduct(null)}
        currency={currency}
        onEditProduct={(p) => {
          setDetailedProduct(null);
          handleOpenEditForm(p);
        }}
        onQuickAdjust={(p, type) => {
          setDetailedProduct(null);
          setAdjustingProduct(p);
          setAdjustmentType(type);
        }}
        onRequestStock={handleRequestStockFromSupplier}
      />

      <QuickAdjustModal
        product={adjustingProduct}
        type={adjustmentType}
        onClose={() => setAdjustingProduct(null)}
        onSaveAdjustment={(pId, delta, reason) => {
          const prod = products.find(p => p.id === pId);
          if (!prod) return;
          const newStock = Math.max(0, prod.stock + delta);
          onUpdateProduct({ ...prod, stock: newStock });
          onShowToast?.(`Stock de "${prod.name}" ajustado com sucesso (${newStock} un).`, "success");
          onAddAuditLog("Ajuste Rápido de Stock", "STOCK", `${delta > 0 ? "+" : ""}${delta} un em ${prod.name}. Motivo: ${reason}`);
          setAdjustingProduct(null);
        }}
      />

      <SupplierOrderModal
        isOpen={isOrderFormOpen}
        onClose={() => setIsOrderFormOpen(false)}
        registeredSuppliers={registeredSuppliers}
        products={products}
        orderSupplierId={orderSupplierId}
        orderProductId={orderProductId}
        orderQtyRequested={orderQtyRequested}
        orderUnitCost={orderUnitCost}
        orderPaymentStatus={orderPaymentStatus}
        orderPaymentDueDate={orderPaymentDueDate}
        orderDispatchChannel={orderDispatchChannel}
        onSupplierChange={setOrderSupplierId}
        onProductChange={(pId) => {
          setOrderProductId(pId);
          const p = products.find(prod => prod.id === pId);
          if (p) setOrderUnitCost(p.costPrice);
        }}
        onQtyChange={setOrderQtyRequested}
        onUnitCostChange={setOrderUnitCost}
        onPaymentStatusChange={setOrderPaymentStatus}
        onDueDateChange={setOrderPaymentDueDate}
        onDispatchChannelChange={setOrderDispatchChannel}
        onSubmit={handleSaveOrder}
      />

      <SupplierEmailModal
        isOpen={isOrderEmailModalOpen}
        onClose={() => setIsOrderEmailModalOpen(false)}
        selectedOrder={selectedOrderForEmail}
        orderEmailRecipient={orderEmailRecipient}
        orderEmailSubject={orderEmailSubject}
        orderEmailBody={orderEmailBody}
        onRecipientChange={setOrderEmailRecipient}
        onSubjectChange={setOrderEmailSubject}
        onBodyChange={setOrderEmailBody}
        onReDownloadPDF={async () => {
          if (selectedOrderForEmail) {
            const doc = await handleGenerateSupplierOrderPDF(selectedOrderForEmail);
            doc.save(`Ordem_de_Compra_${selectedOrderForEmail.id}.pdf`);
            onShowToast?.("PDF baixado com sucesso!", "success");
          }
        }}
        onConfirmSendEmail={() => {
          const mailto = `mailto:${orderEmailRecipient}?subject=${encodeURIComponent(orderEmailSubject)}&body=${encodeURIComponent(orderEmailBody)}`;
          window.location.href = mailto;
          setIsOrderEmailModalOpen(false);
        }}
        onCopyText={() => {
          navigator.clipboard.writeText(orderEmailBody);
          onShowToast?.("Texto do pedido copiado!", "info");
        }}
      />

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

      {/* Small Help / Info Button in Bottom Corner & Shortcuts Modal */}
      <ModuleShortcutsHelp
        moduleName="Gestão de Stock & Inventário"
        moduleCode="STOCK"
        isOpen={showStockShortcutsHelp}
        onOpenChange={setShowStockShortcutsHelp}
      />
    </div>
  );
}

export default memo(StockModule);
