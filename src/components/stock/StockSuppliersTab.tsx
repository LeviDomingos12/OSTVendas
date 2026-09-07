import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Calendar, 
  CheckCircle, 
  X, 
  ShoppingCart, 
  DollarSign, 
  AlertTriangle, 
  Truck, 
  Send, 
  Mail, 
  FileText, 
  TrendingUp, 
  BarChart3, 
  Printer, 
  CreditCard,
  Percent
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product, SystemSettings, Supplier, SupplierOrder } from "../../types";
import { generateEntityId } from "../../lib/deterministic";
import { authenticatedFetch } from "../../lib/apiClient";
import { useConfirm } from "../../hooks/useConfirm";

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

export interface StockSuppliersTabProps {
  products: Product[];
  settings?: SystemSettings;
  currency: string;
  onUpdateSettings?: (settings: Partial<SystemSettings>) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
  onUpdateProduct: (p: Product) => void;
}

export const StockSuppliersTab: React.FC<StockSuppliersTabProps> = ({
  products,
  settings,
  currency,
  onUpdateSettings,
  onAddAuditLog,
  onShowToast,
  onUpdateProduct
}) => {
  const confirm = useConfirm();

  const [supplierSubTab, setSupplierSubTab] = useState<"orders" | "finance" | "config">("orders");
  const [selectedFinanceSupplierId, setSelectedFinanceSupplierId] = useState<string | null>(null);
  const [supplierChartLayout, setSupplierChartLayout] = useState<"grouped" | "stacked">("grouped");

  const registeredSuppliers = useMemo<Supplier[]>(() => settings?.suppliers || [], [settings?.suppliers]);
  const supplierOrders = useMemo<SupplierOrder[]>(() => settings?.supplierOrders || [], [settings?.supplierOrders]);

  const supplierMonthlyChartData = useMemo(() => {
    const paidOrders = supplierOrders.filter((o) => o.paymentStatus === "Pago" && o.status !== "Cancelado");
    const monthLabels: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, "0");
      const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][d.getMonth()];
      monthLabels.push({
        key: `${year}-${monthNum}`,
        label: `${monthShort}/${String(year).slice(-2)}`
      });
    }

    return monthLabels.map(({ key, label }) => {
      const item: Record<string, string | number> = { month: label, rawMonth: key };
      registeredSuppliers.forEach((s) => {
        item[s.name] = 0;
      });
      
      const ordersInMonth = paidOrders.filter((o) => o.requestDate && o.requestDate.startsWith(key));
      ordersInMonth.forEach((o) => {
        const current = (item[o.supplierName] as number) || 0;
        item[o.supplierName] = current + o.totalValue;
      });
      return item;
    });
  }, [supplierOrders, registeredSuppliers]);

  const supplierDependencyStats = useMemo(() => {
    const paidOrders = supplierOrders.filter((o) => o.paymentStatus === "Pago" && o.status !== "Cancelado");
    const totalPaid = paidOrders.reduce((sum: number, o) => sum + o.totalValue, 0);
    
    if (totalPaid === 0) return { totalPaid: 0, items: [], dominant: null };

    const items = registeredSuppliers.map((s) => {
      const paid = paidOrders.filter((o) => o.supplierId === s.id).reduce((sum: number, o) => sum + o.totalValue, 0);
      const percentage = (paid / totalPaid) * 100;
      return {
        id: s.id,
        name: s.name,
        totalPaid: paid,
        percentage
      };
    }).sort((a, b) => b.totalPaid - a.totalPaid);

    const dominant = items[0] && items[0].percentage >= 40 ? items[0] : null;

    return {
      totalPaid,
      items,
      dominant
    };
  }, [supplierOrders, registeredSuppliers]);

  // Form states
  const [supplierNameInput, setSupplierNameInput] = useState("");
  const [supplierPhoneInput, setSupplierPhoneInput] = useState("");
  const [supplierEmailInput, setSupplierEmailInput] = useState("");
  const [supplierAddressInput, setSupplierAddressInput] = useState("");
  const [supplierNuitInput, setSupplierNuitInput] = useState("");
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);

  // Orders states
  const [orderSupplierId, setOrderSupplierId] = useState("");
  const [orderProductId, setOrderProductId] = useState("");
  const [orderQtyRequested, setOrderQtyRequested] = useState<number>(0);
  const [orderUnitCost, setOrderUnitCost] = useState<number>(0);
  const [orderPaymentStatus, setOrderPaymentStatus] = useState<"Pago" | "Crédito" | "Pendente">("Pendente");
  const [orderPaymentDueDate, setOrderPaymentDueDate] = useState("");
  const [orderDispatchChannel, setOrderDispatchChannel] = useState<"WHATSAPP" | "EMAIL" | "NONE">("WHATSAPP");
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);

  // Email modal
  const [isOrderEmailModalOpen, setIsOrderEmailModalOpen] = useState(false);
  const [selectedOrderForEmail, setSelectedOrderForEmail] = useState<SupplierOrder | null>(null);
  const [orderEmailRecipient, setOrderEmailRecipient] = useState("");
  const [orderEmailSubject, setOrderEmailSubject] = useState("");
  const [orderEmailBody, setOrderEmailBody] = useState("");

  // Filters
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState("Todos");
  const [selectedPaymentStatusFilter, setSelectedPaymentStatusFilter] = useState("Todos");
  const [selectedOrderStatusFilter, setSelectedOrderStatusFilter] = useState("Todos");

  const isPaymentOverdue = (order: SupplierOrder & { paymentDueDate?: string }): boolean => {
    if (order.paymentStatus !== "Crédito" && order.paymentStatus !== "Pendente") return false;
    const toleranceDays = settings?.supplierOverdueToleranceDays || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (order.paymentDueDate) {
      const due = new Date(order.paymentDueDate);
      due.setDate(due.getDate() + toleranceDays);
      return due < today;
    }

    if (order.requestDate) {
      const req = new Date(order.requestDate);
      req.setDate(req.getDate() + 30 + toleranceDays);
      return req < today;
    }
    return false;
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierNameInput.trim()) {
      onShowToast?.("O nome do fornecedor é obrigatório.", "error");
      return;
    }

    const currentSuppliers = settings?.suppliers || [];
    let updated: Supplier[];

    if (editingSupplierId) {
      updated = currentSuppliers.map((s) => 
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
      updated = [...currentSuppliers, newSupplier];
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

    const currentSuppliers = settings?.suppliers || [];
    const updated = currentSuppliers.filter((s) => s.id !== suppId);
    onUpdateSettings?.({ suppliers: updated });
    onShowToast?.("Fornecedor removido com sucesso.", "success");
    onAddAuditLog("Eliminar Fornecedor", "STOCK", `Removido fornecedor ${name}.`);
  };

  const handleSendSupplierOrderWhatsApp = (order: SupplierOrder & { paymentDueDate?: string }, supplierOverride?: Supplier) => {
    const currentSuppliers = settings?.suppliers || [];
    const supp = supplierOverride || currentSuppliers.find((s) => s.id === order.supplierId || s.name.toLowerCase() === order.supplierName.toLowerCase());
    const phone = supp?.phone || "";

    if (!phone.trim()) {
      onShowToast?.(`O fornecedor "${order.supplierName}" não possui contacto telefónico/WhatsApp cadastrado.`, "warning");
      return;
    }

    let cleanPhone = phone.replace(/[^\d+]/g, "");
    if (!cleanPhone.startsWith("+") && !cleanPhone.startsWith("258") && cleanPhone.length === 9) {
      cleanPhone = `258${cleanPhone}`;
    } else if (cleanPhone.startsWith("+")) {
      cleanPhone = cleanPhone.substring(1);
    }

    const companyName = settings?.companyName || "OST Vendas";
    const msg = 
`*SOLICITAÇÃO DE MATERIAL / PEDIDO DE COMPRA*
--------------------------------------------
*Empresa:* ${companyName}
*Para Fornecedor:* ${order.supplierName}
*Nº do Pedido:* ${order.id}
*Data:* ${order.requestDate || new Date().toISOString().split("T")[0]}

*Item Solicitado:*
• *Produto:* ${order.productName}
• *Quantidade:* ${order.quantityRequested} un.
• *Preço Unitário de Custo:* ${(order.unitCost || 0).toLocaleString("pt-MZ")} MT
• *Valor Total:* ${(order.totalValue || 0).toLocaleString("pt-MZ")} MT

*Condições de Pagamento:* ${order.paymentStatus || "Pendente"} ${order.paymentDueDate ? `(Vencimento: ${order.paymentDueDate})` : ""}

Por favor, confirme a recepção deste pedido, a disponibilidade do material e a previsão de entrega.

Atenciosamente,
${companyName}`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
    onShowToast?.(`Acessando WhatsApp para enviar pedido a ${order.supplierName}...`, "success");
    onAddAuditLog("Enviar Pedido WhatsApp", "STOCK", `Pedido ${order.id} enviado via WhatsApp para ${order.supplierName}.`);
  };

  const handleGenerateSupplierOrderPDF = async (order: SupplierOrder & { paymentDueDate?: string }, supplierOverride?: Supplier) => {
    const currentSuppliers = settings?.suppliers || [];
    const supp = supplierOverride || currentSuppliers.find((s) => s.id === order.supplierId || s.name.toLowerCase() === order.supplierName.toLowerCase());

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
      } catch (e1) {
        try {
          doc.addImage(logoData, "PNG", 14, 8, 30, 30);
        } catch (e2) {}
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
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 70 },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 29, halign: "right" }
      }
    });

    const finalY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 120) + 10;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, finalY, 182, 38, 2, 2, "F");
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text("INFORMAÇÕES COMERCIAIS & CONDIÇÕES", 18, finalY + 8);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`• Estado do Pedido: ${order.status.toUpperCase()}`, 18, finalY + 16);
    doc.text(`• Condição de Liquidação: ${order.paymentStatus.toUpperCase()}`, 18, finalY + 22);
    if (order.paymentDueDate) {
      doc.text(`• Data Limite de Pagamento: ${order.paymentDueDate}`, 18, finalY + 28);
    }
    doc.text("• Documento gerado e autenticado eletronicamente via sistema OST Vendas ERP.", 18, finalY + 34);

    return doc;
  };

  const handlePrintSupplierOrder = async (order: SupplierOrder & { paymentDueDate?: string }) => {
    try {
      const doc = await handleGenerateSupplierOrderPDF(order);
      const pdfBlobUrl = doc.output("bloburl");
      window.open(pdfBlobUrl, "_blank");
      onShowToast?.("Documento da Ordem de Compra aberto para impressão.", "info");
      onAddAuditLog("Imprimir Ordem de Compra", "STOCK", `Impressão de PDF para o pedido ${order.id}.`);
    } catch (e) {
      console.error(e);
      onShowToast?.("Erro ao gerar PDF da ordem de compra.", "error");
    }
  };

  const handleOpenEmailModal = (order: SupplierOrder & { paymentDueDate?: string }) => {
    const currentSuppliers = settings?.suppliers || [];
    const supp = currentSuppliers.find((s) => s.id === order.supplierId || s.name.toLowerCase() === order.supplierName.toLowerCase());
    
    setSelectedOrderForEmail(order);
    setOrderEmailRecipient(supp?.email || "");
    setOrderEmailSubject(`Ordem de Compra Ref: #${order.id} - ${settings?.companyName || "OST Vendas"}`);
    setOrderEmailBody(
`Exmos. Senhores (${order.supplierName}),

Vimos por este meio formalizar o pedido de fornecimento para o seguinte item:

- Produto: ${order.productName}
- Quantidade: ${order.quantityRequested} un.
- Custo Unitário: ${(order.unitCost || 0).toLocaleString("pt-MZ")} MT
- Total: ${(order.totalValue || 0).toLocaleString("pt-MZ")} MT
- Condição de Pagamento: ${order.paymentStatus} ${order.paymentDueDate ? `(Vencimento: ${order.paymentDueDate})` : ""}

Em anexo, enviamos a respectiva Ordem de Compra oficial com todos os dados da nossa empresa.

Agradecemos a confirmação de disponibilidade e previsão de entrega.

Com os melhores cumprimentos,
${settings?.companyName || "OST Vendas"}`
    );
    setIsOrderEmailModalOpen(true);
  };

  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderEmailRecipient.trim()) {
      onShowToast?.("Introduza o e-mail de destino do fornecedor.", "error");
      return;
    }
    if (!selectedOrderForEmail) return;

    try {
      onShowToast?.("A gerar Ordem de Compra em PDF e a disparar e-mail...", "info");
      
      const doc = await handleGenerateSupplierOrderPDF(selectedOrderForEmail);
      const pdfBase64 = doc.output("datauristring").split(",")[1];

      const res = await authenticatedFetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: orderEmailRecipient,
          subject: orderEmailSubject,
          body: orderEmailBody,
          pdfBase64: pdfBase64,
          pdfFilename: `Ordem_Compra_${selectedOrderForEmail.id}.pdf`
        })
      });

      const json = await res.json();
      if (json.success) {
        onShowToast?.(`Ordem de compra enviada por e-mail para ${orderEmailRecipient}!`, "success");
        onAddAuditLog("Enviar Pedido Email", "STOCK", `Pedido ${selectedOrderForEmail.id} enviado com PDF em anexo para ${orderEmailRecipient}.`);
        setIsOrderEmailModalOpen(false);
      } else {
        onShowToast?.(`Falha no envio: ${json.error || "Verifique as configurações SMTP"}`, "error");
      }
    } catch (err: unknown) {
      console.error(err);
      onShowToast?.("Erro de comunicação ao enviar o e-mail com anexo.", "error");
    }
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderSupplierId || !orderProductId || orderQtyRequested <= 0) {
      onShowToast?.("Por favor, preencha todos os campos obrigatórios.", "error");
      return;
    }

    const supp = registeredSuppliers.find((s) => s.id === orderSupplierId);
    const prod = products.find((p) => p.id === orderProductId);

    if (!supp || !prod) {
      onShowToast?.("Fornecedor ou Produto inválido.", "error");
      return;
    }

    const total = orderQtyRequested * (orderUnitCost || prod.costPrice);
    const newOrder: SupplierOrder & { paymentDueDate?: string } = {
      id: generateEntityId("pcomp"),
      supplierId: supp.id,
      supplierName: supp.name,
      productId: prod.id,
      productName: prod.name,
      quantityRequested: orderQtyRequested,
      unitCost: orderUnitCost || prod.costPrice,
      totalValue: total,
      status: "Pendente",
      paymentStatus: orderPaymentStatus,
      paymentDueDate: orderPaymentDueDate || undefined,
      requestDate: new Date().toISOString().split("T")[0]
    };

    const currentOrders = settings?.supplierOrders || [];
    const updated = [newOrder, ...currentOrders];
    onUpdateSettings?.({ supplierOrders: updated });

    onShowToast?.("Pedido de compra registado com sucesso!", "success");
    onAddAuditLog("Novo Pedido de Compra", "STOCK", `Criado pedido de ${orderQtyRequested} un. de ${prod.name} para ${supp.name}.`);

    if (orderDispatchChannel === "WHATSAPP") {
      handleSendSupplierOrderWhatsApp(newOrder, supp);
    } else if (orderDispatchChannel === "EMAIL") {
      handleOpenEmailModal(newOrder);
    }

    setOrderSupplierId("");
    setOrderProductId("");
    setOrderQtyRequested(0);
    setOrderUnitCost(0);
    setOrderPaymentStatus("Pendente");
    setOrderPaymentDueDate("");
    setIsOrderFormOpen(false);
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: "Pendente" | "Recebido" | "Cancelado") => {
    const currentOrders = settings?.supplierOrders || [];
    const order = currentOrders.find((o) => o.id === orderId);
    if (!order) return;

    if (newStatus === "Recebido" && order.status !== "Recebido") {
      const prod = products.find((p) => p.id === order.productId);
      if (prod) {
        const updatedProd: Product = {
          ...prod,
          stock: prod.stock + order.quantityRequested,
          costPrice: order.unitCost || prod.costPrice
        };
        onUpdateProduct(updatedProd);
        onShowToast?.(`Stock de "${prod.name}" incrementado em +${order.quantityRequested} un.!`, "success");
        onAddAuditLog("Entrada Stock Pedido Fornecedor", "STOCK", `Entrada de ${order.quantityRequested} un. do produto ${prod.name} referente ao pedido ${order.id}.`);
      }
    }

    const updated = currentOrders.map((o) => 
      o.id === orderId 
        ? { ...o, status: newStatus, receivedDate: newStatus === "Recebido" ? new Date().toISOString().split("T")[0] : o.receivedDate }
        : o
    );

    onUpdateSettings?.({ supplierOrders: updated });
    onShowToast?.(`Estado do pedido #${orderId} alterado para "${newStatus}".`, "info");
    onAddAuditLog("Alterar Estado Pedido", "STOCK", `Estado do pedido ${orderId} atualizado para ${newStatus}.`);
  };

  const handleUpdatePaymentStatus = (orderId: string, newPaymentStatus: "Pago" | "Crédito" | "Pendente") => {
    const currentOrders = settings?.supplierOrders || [];
    const updated = currentOrders.map((o) => 
      o.id === orderId ? { ...o, paymentStatus: newPaymentStatus } : o
    );
    onUpdateSettings?.({ supplierOrders: updated });
    onShowToast?.(`Estado financeiro do pedido #${orderId} atualizado para "${newPaymentStatus}".`, "success");
    onAddAuditLog("Liquidação de Fornecedor", "STOCK", `Pedido ${orderId} atualizado para status de pagamento: ${newPaymentStatus}.`);
  };

  const filteredOrders = useMemo(() => {
    return supplierOrders.filter((order: SupplierOrder & { paymentDueDate?: string }) => {
      const matchesQuery = order.productName.toLowerCase().includes(orderSearchQuery.toLowerCase()) || order.supplierName.toLowerCase().includes(orderSearchQuery.toLowerCase());
      const matchesSupplier = selectedSupplierFilter === "Todos" || order.supplierId === selectedSupplierFilter;
      const matchesStatus = selectedOrderStatusFilter === "Todos" || order.status === selectedOrderStatusFilter;
      const matchesPayment = selectedPaymentStatusFilter === "Todos" || order.paymentStatus === selectedPaymentStatusFilter;
      return matchesQuery && matchesSupplier && matchesStatus && matchesPayment;
    });
  }, [supplierOrders, orderSearchQuery, selectedSupplierFilter, selectedOrderStatusFilter, selectedPaymentStatusFilter]);

  const filteredSuppliers = useMemo(() => {
    return registeredSuppliers.filter((s) => 
      s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(supplierSearchQuery)) ||
      (s.email && s.email.toLowerCase().includes(supplierSearchQuery.toLowerCase())) ||
      (s.nuit && s.nuit.includes(supplierSearchQuery))
    );
  }, [registeredSuppliers, supplierSearchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 dark:bg-orange-950/20 dark:text-orange-400">
            <Truck className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Fornecedores</span>
            <span className="text-xl font-black text-slate-800 dark:text-zinc-100">{registeredSuppliers.length}</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 dark:bg-amber-950/20 dark:text-amber-400">
            <ShoppingCart className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Pedidos Pendentes</span>
            <span className="text-xl font-black text-amber-600">{supplierOrders.filter(o => o.status === "Pendente").length}</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-950/20 dark:text-emerald-400">
            <DollarSign className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Pago aos F.</span>
            <span className="text-sm font-black text-slate-800 dark:text-zinc-100">
              {supplierOrders.filter(o => o.paymentStatus === "Pago").reduce((sum, o) => sum + o.totalValue, 0).toLocaleString()} MT
            </span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 dark:bg-red-950/20 dark:text-red-400">
            <AlertTriangle className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total a Crédito</span>
            <span className="text-sm font-black text-red-600">
              {supplierOrders.filter(o => o.paymentStatus === "Crédito").reduce((sum, o) => sum + o.totalValue, 0).toLocaleString()} MT
            </span>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-150 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setSupplierSubTab("orders")}
          className={`pb-2.5 font-extrabold text-xs transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            supplierSubTab === "orders"
              ? "border-orange-500 text-orange-500 dark:text-orange-400 dark:border-orange-400 font-black"
              : "border-transparent text-slate-400 hover:text-slate-650 dark:hover:text-zinc-300"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Encomendas & Pedidos de Stock
        </button>

        <button
          onClick={() => setSupplierSubTab("finance")}
          className={`pb-2.5 font-extrabold text-xs transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            supplierSubTab === "finance"
              ? "border-orange-500 text-orange-500 dark:text-orange-400 dark:border-orange-400 font-black"
              : "border-transparent text-slate-400 hover:text-slate-650 dark:hover:text-zinc-300"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Contas Correntes & Pagamentos
        </button>

        <button
          onClick={() => setSupplierSubTab("config")}
          className={`pb-2.5 font-extrabold text-xs transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            supplierSubTab === "config"
              ? "border-orange-500 text-orange-500 dark:text-orange-400 dark:border-orange-400 font-black"
              : "border-transparent text-slate-400 hover:text-slate-650 dark:hover:text-zinc-300"
          }`}
        >
          <Truck className="w-4 h-4" />
          Diretório de Fornecedores
        </button>
      </div>

      {/* ORDERS SUB-TAB */}
      {supplierSubTab === "orders" && (
        <div className="space-y-4">
          <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-orange-500" />
                  Ordens de Compra & Reposição de Mercadoria
                </h3>
                <p className="text-[11px] text-slate-400">Faça o registo e o acompanhamento de novos fornecimentos.</p>
              </div>

              <button
                onClick={() => {
                  setOrderSupplierId("");
                  setOrderProductId("");
                  setOrderQtyRequested(0);
                  setOrderUnitCost(0);
                  setOrderPaymentStatus("Pendente");
                  setOrderPaymentDueDate("");
                  setIsOrderFormOpen(true);
                }}
                className="py-1.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] rounded-xl flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Nova Solicitação
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative sm:col-span-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Buscar produto/fornecedor..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 pl-9 pr-3 text-xs outline-none focus:border-orange-500 dark:bg-zinc-950 dark:border-zinc-800"
                />
              </div>

              <div>
                <select
                  value={selectedSupplierFilter}
                  onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-xs outline-none cursor-pointer text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                >
                  <option value="Todos">Todos Fornecedores</option>
                  {registeredSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedOrderStatusFilter}
                  onChange={(e) => setSelectedOrderStatusFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-xs outline-none cursor-pointer text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                >
                  <option value="Todos">Todos os Estados</option>
                  <option value="Pendente">Pendentes ⏳</option>
                  <option value="Recebido">Recebidos ✅</option>
                  <option value="Cancelado">Cancelados ❌</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedPaymentStatusFilter}
                  onChange={(e) => setSelectedPaymentStatusFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-xs outline-none cursor-pointer text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                >
                  <option value="Todos">Todas Condições Pagamento</option>
                  <option value="Pago">Liquidado (Pago) 🟢</option>
                  <option value="Crédito">A Crédito (Dívida) 🔴</option>
                  <option value="Pendente">Pendente de Pagamento 🟡</option>
                </select>
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-wider dark:bg-zinc-800/40 dark:border-zinc-800">
                    <th className="py-2.5 px-3">Data / Ref</th>
                    <th className="py-2.5 px-3">Fornecedor</th>
                    <th className="py-2.5 px-3">Produto Solicitado</th>
                    <th className="py-2.5 px-3 text-center">Qtd.</th>
                    <th className="py-2.5 px-3 text-right">Valor Total</th>
                    <th className="py-2.5 px-3 text-center">Entrega</th>
                    <th className="py-2.5 px-3 text-center">Pagamento</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400 font-bold text-xs">
                        Nenhum pedido de compra encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order: SupplierOrder & { paymentDueDate?: string }) => {
                      const isOverdue = isPaymentOverdue(order);
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono text-[10px] text-slate-400 block">{order.id}</span>
                            <span className="font-bold text-slate-700 dark:text-zinc-200 text-[11px]">{order.requestDate}</span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-zinc-100">
                            {order.supplierName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-200">
                            <span className="font-bold block">{order.productName}</span>
                            <span className="text-[10px] text-slate-400">Unit: {order.unitCost?.toLocaleString("pt-MZ")} MT</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-slate-800 dark:text-zinc-100">
                            {order.quantityRequested} un.
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-zinc-100">
                            {order.totalValue.toLocaleString("pt-MZ")} MT
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as "Pendente" | "Recebido" | "Cancelado")}
                              className={`text-[10px] font-black px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                                order.status === "Recebido"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                                  : order.status === "Cancelado"
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                              }`}
                            >
                              <option value="Pendente">Pendente ⏳</option>
                              <option value="Recebido">Recebido ✅</option>
                              <option value="Cancelado">Cancelado ❌</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={order.paymentStatus}
                              onChange={(e) => handleUpdatePaymentStatus(order.id, e.target.value as "Pago" | "Pendente" | "Crédito")}
                              className={`text-[10px] font-black px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                                order.paymentStatus === "Pago"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                                  : isOverdue
                                  ? "bg-red-100 text-red-800 border-red-300 animate-pulse font-black dark:bg-red-950/50 dark:text-red-300 dark:border-red-700"
                                  : order.paymentStatus === "Crédito"
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                              }`}
                            >
                              <option value="Pago">Pago 🟢</option>
                              <option value="Crédito">Crédito 🔴</option>
                              <option value="Pendente">Pendente 🟡</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSendSupplierOrderWhatsApp(order)}
                                title="Enviar via WhatsApp"
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition dark:hover:bg-emerald-950/20"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEmailModal(order)}
                                title="Enviar por E-mail com PDF"
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition dark:hover:bg-blue-950/20"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handlePrintSupplierOrder(order)}
                                title="Imprimir Ordem de Compra PDF"
                                className="p-1 text-slate-600 hover:bg-slate-100 rounded-lg transition dark:text-zinc-400 dark:hover:bg-zinc-800"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* FINANCE SUB-TAB */}
      {supplierSubTab === "finance" && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Evolução de Compras Mensais por Fornecedor (MT)
                  </h3>
                  <p className="text-[11px] text-slate-400">Total liquidado nos últimos 6 meses.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSupplierChartLayout(prev => prev === "grouped" ? "stacked" : "grouped")}
                    className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    {supplierChartLayout === "grouped" ? "Ver Empilhado" : "Ver Agrupado"}
                  </button>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplierMonthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {registeredSuppliers.map((s, index) => {
                      const colors = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#14b8a6", "#a855f7", "#f43f5e"];
                      const color = colors[index % colors.length];
                      return (
                        <Bar 
                          key={s.id} 
                          dataKey={s.name} 
                          fill={color} 
                          stackId={supplierChartLayout === "stacked" ? "a" : undefined}
                          radius={[4, 4, 0, 0]}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Dependency Box */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
              <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Percent className="w-4 h-4 text-orange-500" />
                Matriz de Dependência
              </h3>

              {supplierDependencyStats.dominant && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl dark:bg-red-950/20 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-black text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Alerta de Concentração
                  </div>
                  <p className="text-[11px] text-red-600 mt-1 dark:text-red-300">
                    <strong>{supplierDependencyStats.dominant.name}</strong> concentra <strong>{supplierDependencyStats.dominant.percentage.toFixed(1)}%</strong> das suas compras. Recomenda-se diversificar fornecedores.
                  </p>
                </div>
              )}

              <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                {supplierDependencyStats.items.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-zinc-200">
                      <span>{item.name}</span>
                      <span>{item.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-800">
                      <div 
                        className={`h-full rounded-full ${item.percentage >= 40 ? "bg-red-500" : "bg-orange-500"}`} 
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Supplier Balances List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-500" />
              Contas Correntes por Fornecedor
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {registeredSuppliers.map((supp) => {
                const sOrders = supplierOrders.filter((o) => o.supplierId === supp.id && o.status !== "Cancelado");
                const totalPurchased = sOrders.reduce((sum: number, o) => sum + o.totalValue, 0);
                const paidAmount = sOrders.filter((o) => o.paymentStatus === "Pago").reduce((sum: number, o) => sum + o.totalValue, 0);
                const creditDebt = sOrders.filter((o) => o.paymentStatus === "Crédito").reduce((sum: number, o) => sum + o.totalValue, 0);
                const pendingPayment = sOrders.filter((o) => o.paymentStatus === "Pendente").reduce((sum: number, o) => sum + o.totalValue, 0);

                return (
                  <div key={supp.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3 dark:bg-zinc-800/30 dark:border-zinc-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-slate-800 dark:text-zinc-100 text-xs">{supp.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{supp.phone || "Sem contacto"}</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        creditDebt > 0 ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}>
                        {creditDebt > 0 ? "Dívida Ativa" : "Regularizado"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Total Comprado</span>
                        <span className="font-black text-slate-700 dark:text-zinc-200">{totalPurchased.toLocaleString("pt-MZ")} MT</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Total Pago</span>
                        <span className="font-black text-emerald-600">{paidAmount.toLocaleString("pt-MZ")} MT</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Dívida a Crédito</span>
                        <span className="font-black text-red-600">{creditDebt.toLocaleString("pt-MZ")} MT</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Pendente</span>
                        <span className="font-black text-amber-600">{pendingPayment.toLocaleString("pt-MZ")} MT</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedFinanceSupplierId(supp.id)}
                      className="w-full py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition cursor-pointer dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
                    >
                      Ver Extrato Detalhado
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DIRECTORY SUB-TAB */}
      {supplierSubTab === "config" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-orange-500" />
                  Registo & Diretório de Fornecedores
                </h3>
                <p className="text-[11px] text-slate-400">Cadastre fornecedores para automação de pedidos e cotações.</p>
              </div>

              <button
                onClick={() => {
                  setEditingSupplierId(null);
                  setSupplierNameInput("");
                  setSupplierPhoneInput("");
                  setSupplierEmailInput("");
                  setSupplierAddressInput("");
                  setSupplierNuitInput("");
                  setIsSupplierFormOpen(true);
                }}
                className="py-1.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Fornecedor
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, contacto, e-mail ou NUIT..."
                value={supplierSearchQuery}
                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:border-orange-500 dark:bg-zinc-950 dark:border-zinc-800"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((supp) => (
                <div key={supp.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2 dark:bg-zinc-800/20 dark:border-zinc-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-slate-800 dark:text-zinc-100 text-xs">{supp.name}</h4>
                      {supp.nuit && <span className="text-[10px] text-slate-400 block font-mono">NUIT: {supp.nuit}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditSupplierClick(supp)}
                        className="p-1 text-slate-400 hover:text-orange-500 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(supp.id, supp.name)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-zinc-300 space-y-1">
                    {supp.phone && <p>📞 {supp.phone}</p>}
                    {supp.email && <p>✉️ {supp.email}</p>}
                    {supp.address && <p>📍 {supp.address}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTAR / EDITAR FORNECEDOR */}
      {isSupplierFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-sm text-slate-800 dark:text-zinc-100">
                {editingSupplierId ? "Editar Fornecedor" : "Novo Fornecedor"}
              </h3>
              <button onClick={() => setIsSupplierFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Nome / Razão Social *</label>
                <input
                  type="text"
                  required
                  value={supplierNameInput}
                  onChange={(e) => setSupplierNameInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Contacto Telefónico</label>
                  <input
                    type="text"
                    value={supplierPhoneInput}
                    onChange={(e) => setSupplierPhoneInput(e.target.value)}
                    placeholder="+258 84 000 0000"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">NUIT</label>
                  <input
                    type="text"
                    value={supplierNuitInput}
                    onChange={(e) => setSupplierNuitInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">E-mail</label>
                <input
                  type="email"
                  value={supplierEmailInput}
                  onChange={(e) => setSupplierEmailInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Endereço / Armazém</label>
                <input
                  type="text"
                  value={supplierAddressInput}
                  onChange={(e) => setSupplierAddressInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierFormOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition"
                >
                  Guardar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA ORDEM DE COMPRA */}
      {isOrderFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-sm text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-orange-500" />
                Nova Solicitação de Compra
              </h3>
              <button onClick={() => setIsOrderFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Fornecedor *</label>
                <select
                  required
                  value={orderSupplierId}
                  onChange={(e) => setOrderSupplierId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                >
                  <option value="">Selecione o fornecedor...</option>
                  {registeredSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.phone || "Sem tel"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Produto a Encomendar *</label>
                <select
                  required
                  value={orderProductId}
                  onChange={(e) => {
                    const prodId = e.target.value;
                    setOrderProductId(prodId);
                    const prod = products.find(p => p.id === prodId);
                    if (prod) {
                      setOrderUnitCost(prod.costPrice);
                      if (orderQtyRequested <= 0) setOrderQtyRequested(prod.minStock * 2 || 10);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                >
                  <option value="">Selecione o produto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock Atual: {p.stock})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Quantidade Solicitada *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={orderQtyRequested || ""}
                    onChange={(e) => setOrderQtyRequested(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Preço Unit. de Custo (MT) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={orderUnitCost || ""}
                    onChange={(e) => setOrderUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-orange-50 rounded-xl text-xs font-black text-orange-700 flex justify-between dark:bg-orange-950/20 dark:text-orange-400">
                <span>Total Previsto do Pedido:</span>
                <span>{((orderQtyRequested || 0) * (orderUnitCost || 0)).toLocaleString("pt-MZ")} MT</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Condição de Pagamento</label>
                  <select
                    value={orderPaymentStatus}
                    onChange={(e) => setOrderPaymentStatus(e.target.value as "Pendente" | "Pago" | "Crédito")}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                  >
                    <option value="Pendente">Pendente de Pagamento</option>
                    <option value="Pago">Pago Imediatamente</option>
                    <option value="Crédito">A Crédito (Dívida)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Data Limite de Pagamento</label>
                  <input
                    type="date"
                    value={orderPaymentDueDate}
                    onChange={(e) => setOrderPaymentDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Canal de Disparo Imediato</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderDispatchChannel("WHATSAPP")}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      orderDispatchChannel === "WHATSAPP"
                        ? "bg-emerald-500 text-white border-emerald-600"
                        : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderDispatchChannel("EMAIL")}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      orderDispatchChannel === "EMAIL"
                        ? "bg-blue-500 text-white border-blue-600"
                        : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    E-mail PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderDispatchChannel("NONE")}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      orderDispatchChannel === "NONE"
                        ? "bg-slate-700 text-white border-slate-800 dark:bg-zinc-700"
                        : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    Apenas Salvar
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOrderFormOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition"
                >
                  Confirmar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENVIAR EMAIL COM PDF */}
      {isOrderEmailModalOpen && selectedOrderForEmail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-sm text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                Enviar Ordem de Compra por E-mail
              </h3>
              <button onClick={() => setIsOrderEmailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendEmailSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Destinatário (E-mail do Fornecedor) *</label>
                <input
                  type="email"
                  required
                  value={orderEmailRecipient}
                  onChange={(e) => setOrderEmailRecipient(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Assunto</label>
                <input
                  type="text"
                  value={orderEmailSubject}
                  onChange={(e) => setOrderEmailSubject(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Mensagem</label>
                <textarea
                  rows={4}
                  value={orderEmailBody}
                  onChange={(e) => setOrderEmailBody(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="p-2 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-700 flex items-center gap-2 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-300">
                <FileText className="w-4 h-4 shrink-0 text-blue-500" />
                <span>O ficheiro PDF oficial com o logótipo será anexado automaticamente.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOrderEmailModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar E-mail com PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
