import {
  Transaction,
  Product,
  Customer,
  CashFlowEntry,
  SystemSettings,
  Employee,
  ProductBatch
} from "../types";
import { generateEntityId, generateDeterministicCreditNoteNumber } from "../lib/deterministic";

export interface ProcessSaleResult {
  updatedProducts: Product[];
  updatedBatches: ProductBatch[];
  updatedCustomers?: Customer[];
  cashFlowEntry?: CashFlowEntry;
  lowStockAlerts: {
    productName: string;
    currentStock: number;
    minThreshold: number;
  }[];
}

export function processSaleDeductions(
  transaction: Transaction,
  products: Product[],
  settings: SystemSettings,
  activeUser: Employee | null
): ProcessSaleResult {
  const activeBranch = transaction.branchId || settings.activeBranchId || "central";
  const localBatches = [...(settings.batches || [])];
  const lowStockAlerts: { productName: string; currentStock: number; minThreshold: number }[] = [];

  const updatedProducts = products.map(prod => {
    const prodIdStr = String(prod.id || "").trim().toLowerCase();
    const prodCodeStr = prod.code ? String(prod.code).trim().toLowerCase() : "";
    const prodBarcodeStr = prod.barcode ? String(prod.barcode).trim().toLowerCase() : "";

    const matchingItems = (transaction.items || []).filter(item => {
      const itemIdStr = String(item.productId || "").trim().toLowerCase();
      return (
        (itemIdStr && itemIdStr === prodIdStr) ||
        (prodCodeStr && itemIdStr === prodCodeStr) ||
        (prodBarcodeStr && itemIdStr === prodBarcodeStr)
      );
    });

    if (matchingItems.length > 0) {
      const totalSoldQty = matchingItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
      const updatedStock = Math.max(0, prod.stock - totalSoldQty);

      // Geographical Branch Stock deduction
      const updatedBranchStocks = { ...(prod.branchStocks || {}) };
      const currentBranchStock = updatedBranchStocks[activeBranch] !== undefined 
        ? updatedBranchStocks[activeBranch] 
        : prod.stock;
      updatedBranchStocks[activeBranch] = Math.max(0, currentBranchStock - totalSoldQty);

      // LIFO / FIFO Batch deduction
      let remainingToDeduct = totalSoldQty;
      const prodBatches = localBatches
        .filter(b => (String(b.productId || "").trim().toLowerCase() === prodIdStr || (prodCodeStr && String(b.productId || "").trim().toLowerCase() === prodCodeStr)) && b.quantity > 0)
        .sort((a, b) => {
          if (settings.inventoryStrategy === "LIFO") {
            return new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime();
          } else {
            return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
          }
        });

      for (const pb of prodBatches) {
        if (remainingToDeduct <= 0) break;
        const matchIdx = localBatches.findIndex(b => b.id === pb.id);
        if (matchIdx > -1) {
          const batch = localBatches[matchIdx];
          const deduct = Math.min(batch.quantity, remainingToDeduct);
          remainingToDeduct -= deduct;
          localBatches[matchIdx] = {
            ...batch,
            quantity: batch.quantity - deduct
          };
        }
      }

      // Check alert thresholds
      const individualThreshold = (prod.minStock !== undefined && prod.minStock > 0)
        ? prod.minStock
        : (settings.smsStockThreshold !== undefined ? settings.smsStockThreshold : 5);

      if (updatedStock <= individualThreshold && prod.stock > individualThreshold) {
        lowStockAlerts.push({
          productName: prod.name,
          currentStock: updatedStock,
          minThreshold: individualThreshold
        });
      }

      return {
        ...prod,
        stock: updatedStock,
        branchStocks: updatedBranchStocks,
        updatedAt: new Date().toISOString()
      };
    }
    return prod;
  });

  let cashFlowEntry: CashFlowEntry | undefined;
  if (transaction.paymentMethod !== "DEBT") {
    cashFlowEntry = {
      id: `cf-sale-${transaction.id}`,
      timestamp: transaction.timestamp || new Date().toISOString(),
      type: "INPUT",
      amount: transaction.grandTotal,
      reason: `Recebimento Venda POS - Fatura ${transaction.invoiceNumber}`,
      responsibleUser: transaction.cashierName || activeUser?.name || "Operador",
      paymentMethod: (transaction.paymentMethod as CashFlowEntry["paymentMethod"]) || "CASH",
      category: "OUTRO",
      reference: transaction.invoiceNumber,
      tenantId: activeUser?.tenantId || "default_company"
    };
  }

  return {
    updatedProducts,
    updatedBatches: localBatches,
    cashFlowEntry,
    lowStockAlerts
  };
}

export interface ProcessDevolutionResult {
  creditNoteNum: string;
  refundTotal: number;
  updatedProducts: Product[];
  refundCashEntry?: CashFlowEntry;
  updatedCustomers?: Customer[];
}

export function processDevolutionRestock(
  transaction: Transaction,
  returnedItems: { productId: string; quantity: number; price: number }[],
  returnReason: string,
  refundMethod: string,
  products: Product[],
  settings: SystemSettings,
  activeUser: Employee | null,
  totalTransactionsCount: number
): ProcessDevolutionResult {
  const refundTotal = returnedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const activeBranch = transaction.branchId || settings.activeBranchId || "central";
  const creditNoteNum = generateDeterministicCreditNoteNumber(totalTransactionsCount + 1);

  const updatedProducts = products.map(prod => {
    const prodIdStr = String(prod.id || "").trim().toLowerCase();
    const prodCodeStr = prod.code ? String(prod.code).trim().toLowerCase() : "";
    const prodBarcodeStr = prod.barcode ? String(prod.barcode).trim().toLowerCase() : "";

    const matchingReturns = (returnedItems || []).filter(it => {
      const itIdStr = String(it.productId || "").trim().toLowerCase();
      return (
        (itIdStr && itIdStr === prodIdStr) ||
        (prodCodeStr && itIdStr === prodCodeStr) ||
        (prodBarcodeStr && itIdStr === prodBarcodeStr)
      );
    });

    if (matchingReturns.length > 0) {
      const totalReturnedQty = matchingReturns.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
      const restoredStock = prod.stock + totalReturnedQty;
      const updatedBranchStocks = { ...(prod.branchStocks || {}) };
      const currentBranch = updatedBranchStocks[activeBranch] !== undefined ? updatedBranchStocks[activeBranch] : prod.stock;
      updatedBranchStocks[activeBranch] = currentBranch + totalReturnedQty;

      return {
        ...prod,
        stock: restoredStock,
        branchStocks: updatedBranchStocks,
        updatedAt: new Date().toISOString()
      };
    }
    return prod;
  });

  let refundCashEntry: CashFlowEntry | undefined;
  if (refundMethod !== "DEBT" && refundTotal > 0) {
    refundCashEntry = {
      id: generateEntityId("cf_refund"),
      timestamp: new Date().toISOString(),
      type: "DEVOLUTION",
      amount: refundTotal,
      reason: `Devolução/Estorno de Venda - ${creditNoteNum} (Ref: ${transaction.invoiceNumber}) - Motivo: ${returnReason}`,
      responsibleUser: activeUser?.name || "Supervisor",
      paymentMethod: (refundMethod as CashFlowEntry["paymentMethod"]) || "CASH",
      category: "DEVOLUCAO_VENDA",
      reference: creditNoteNum,
      tenantId: activeUser?.tenantId || "default_company"
    };
  }

  return {
    creditNoteNum,
    refundTotal,
    updatedProducts,
    refundCashEntry
  };
}
