import { Transaction } from "../types";
import { generateEntityId } from "./deterministic";

/**
 * Normaliza qualquer objeto de transação (seja do Supabase PostgreSQL snake_case,
 * IndexedDB em cache, ou modelo de memória camelCase) para a interface estrita Transaction.
 */
export function normalizeTransaction(raw: unknown): Transaction {
  if (!raw || typeof raw !== "object") {
    return {
      id: generateEntityId("venda"),
      invoiceNumber: "FAT-0000",
      timestamp: new Date().toISOString(),
      grandTotal: 0,
      subtotal: 0,
      vatTotal: 0,
      discountTotal: 0,
      paymentMethod: "CASH",
      cashierName: "Operador Geral",
      items: []
    };
  }

  const r = raw as Record<string, unknown>;

  const grand = Number(r.grandTotal ?? r.grand_total ?? r.amount_paid ?? r.total ?? 0) || 0;
  const vat = Number(r.vatTotal ?? r.vat_total ?? 0) || 0;
  const disc = Number(r.discountTotal ?? r.discount_total ?? 0) || 0;
  const sub = Number(r.subtotal ?? r.sub_total ?? (grand - vat + disc)) || grand;

  // Timestamp extraction seguro e robusto
  let timeStr = r.timestamp || r.created_at || r.createdAt || r.date;
  if (!timeStr) {
    timeStr = new Date().toISOString();
  } else if (timeStr instanceof Date) {
    timeStr = timeStr.toISOString();
  } else {
    timeStr = String(timeStr).trim();
  }

  let parsedItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    vatAmount: number;
    discountAmount: number;
    subtotal: number;
    costPrice?: number;
  }> = [];

  if (Array.isArray(r.items)) {
    parsedItems = (r.items as Record<string, unknown>[]).map((it) => {
      const q = Number(it.quantity ?? it.qty ?? 1) || 1;
      const p = Number(it.price ?? it.unitPrice ?? it.salePrice ?? 0) || 0;
      const subT = Number(it.subtotal ?? (p * q)) || (p * q);
      const vatA = Number(it.vatAmount ?? it.vat_amount ?? 0) || 0;
      const discA = Number(it.discountAmount ?? it.discount_amount ?? 0) || 0;
      const costP = it.costPrice !== undefined ? Number(it.costPrice) : (it.cost_price !== undefined ? Number(it.cost_price) : undefined);

      return {
        productId: String(it.productId || it.product_id || it.id || ""),
        productName: String(it.productName || it.product_name || it.name || "Produto"),
        quantity: q,
        price: p,
        vatAmount: vatA,
        discountAmount: discA,
        subtotal: subT,
        ...(costP !== undefined && !isNaN(costP) ? { costPrice: costP } : {})
      };
    });
  } else if (typeof r.items === "string") {
    try {
      const decoded = JSON.parse(r.items);
      if (Array.isArray(decoded)) {
        parsedItems = decoded.map((it: Record<string, unknown>) => ({
          productId: String(it.productId || it.product_id || it.id || ""),
          productName: String(it.productName || it.product_name || it.name || "Produto"),
          quantity: Number(it.quantity || it.qty || 1) || 1,
          price: Number(it.price || it.unitPrice || 0) || 0,
          vatAmount: Number(it.vatAmount || 0) || 0,
          discountAmount: Number(it.discountAmount || 0) || 0,
          subtotal: Number(it.subtotal || 0) || 0
        }));
      }
    } catch {
      parsedItems = [];
    }
  }

  const validPaymentMethods: Transaction["paymentMethod"][] = [
    "CASH",
    "MPESA_PAGA_FACIL",
    "EMOLA",
    "POS_CARD",
    "CREDIT_CARD",
    "BANK_TRANSFER",
    "MIXED",
    "DEBT"
  ];
  const pmRaw = String(r.paymentMethod || r.payment_method || "CASH");
  const paymentMethod = validPaymentMethods.includes(pmRaw as Transaction["paymentMethod"])
    ? (pmRaw as Transaction["paymentMethod"])
    : "CASH";

  return {
    id: String(r.id || r.saleId || r.sale_id || generateEntityId("venda")),
    invoiceNumber: String(r.invoiceNumber || r.invoice_number || r.id || "FAT-0000"),
    timestamp: String(timeStr),
    grandTotal: grand,
    subtotal: sub,
    vatTotal: vat,
    discountTotal: disc,
    paymentMethod,
    paymentDetails: r.paymentDetails ? String(r.paymentDetails) : (r.payment_details ? String(r.payment_details) : (r.notes ? String(r.notes) : undefined)),
    cashierName: String(r.cashierName || r.operator_name || r.seller_name || r.sellerName || "Operador Geral"),
    customerName: String(r.customerName || r.customer_name || "Consumidor Final"),
    customerId: r.customerId ? String(r.customerId) : (r.customer_id ? String(r.customer_id) : undefined),
    customerPhone: r.customerPhone ? String(r.customerPhone) : (r.customer_phone ? String(r.customer_phone) : undefined),
    customerEmail: r.customerEmail ? String(r.customerEmail) : (r.customer_email ? String(r.customer_email) : undefined),
    nuit: r.nuit ? String(r.nuit) : (r.customerNuit ? String(r.customerNuit) : (r.customer_nuit ? String(r.customer_nuit) : undefined)),
    branchId: String(r.branchId || r.branch_id || "central"),
    status: (r.status || "COMPLETED") as Transaction["status"],
    items: parsedItems
  };
}

/**
 * Extrai a string no formato 'YYYY-MM-DD' de forma segura a partir de qualquer string de data,
 * ISO com ou sem fuso horário, timestamp do PostgreSQL com espaço, ou objeto Date.
 */
export function extractDateOnly(val: string | Date | undefined | null): string {
  if (!val) return "";
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, "0");
    const day = String(val.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const s = String(val).trim();
  // Se já for exatamente 'YYYY-MM-DD' puro (sem horário e sem T/Z), preserva como data civil
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Tenta interpretar com new Date(s) para converter timestamps UTC/ISO para o dia local do utilizador
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fallback se falhar parsing
  }

  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return s.split("T")[0].split(" ")[0] || "";
}
