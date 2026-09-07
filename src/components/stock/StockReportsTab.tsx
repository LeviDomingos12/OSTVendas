import React, { useState, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  AlertTriangle 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product, SystemSettings, Transaction, UserRole } from "../../types";

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

export interface StockReportsTabProps {
  products: Product[];
  transactions: Transaction[];
  settings?: SystemSettings;
  currency: string;
  currentRole: UserRole;
  onAddAuditLog: (action: string, module: string, details: string) => void;
}

export const StockReportsTab: React.FC<StockReportsTabProps> = ({
  products,
  transactions,
  settings,
  currency,
  currentRole,
  onAddAuditLog
}) => {
  const [reportType, setReportType] = useState<"VALUATION" | "MOVEMENTS" | "EXPIRATION">("VALUATION");
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [reportCategory, setReportCategory] = useState<string>("Todos");
  const [reportSearchQuery, setReportSearchQuery] = useState<string>("");

  const categoriesList = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return ["Todos", ...Array.from(list)];
  }, [products]);

  const reportsData = useMemo(() => {
    const salesInPeriod: Record<string, { qty: number; totalSalesVal: number; vatVal: number; profitVal: number }> = {};
    
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

    let filteredList = products.filter(p => {
      if (reportCategory !== "Todos" && p.category !== reportCategory) return false;
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
      filteredList = filteredList.filter(p => {
        if (!p.expiryDate) return false;
        return p.expiryDate >= reportStartDate && p.expiryDate <= reportEndDate;
      });
    } else if (reportType === "MOVEMENTS") {
      filteredList = filteredList.filter(p => {
        const sales = salesInPeriod[p.id];
        return sales && sales.qty > 0;
      });
    }

    const items = filteredList.map(p => {
      const sales = salesInPeriod[p.id] || { qty: 0, totalSalesVal: 0, vatVal: 0 };
      const currentStockValCost = p.stock * p.costPrice;
      const currentStockValSale = p.stock * p.salePrice;
      const currentStockProfitPotential = currentStockValSale - currentStockValCost;
      const marginPct = p.costPrice > 0 ? ((p.salePrice - p.costPrice) / p.costPrice) * 100 : 0;
      const costOfSales = sales.qty * p.costPrice;
      const salesProfit = sales.totalSalesVal - costOfSales;
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
    
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("SISTEMA GESTAO COMERCIAL - RELATORIO DE ESTOQUE", 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const reportTitle = 
      reportType === "VALUATION" ? "RELATÓRIO DE AVALIAÇÃO PATRIMONIAL DO ESTOQUE" :
      reportType === "MOVEMENTS" ? "RELATÓRIO DE MOVIMENTAÇÃO E GIRO DE ESTOQUE" :
      "RELATÓRIO DE VALIDADE E VENCIMENTOS DE LOTES";
    
    doc.text(`Tipo de Relatorio: ${reportTitle}`, 14, 22);
    doc.text(`Periodo: ${reportStartDate} ate ${reportEndDate}  |  Categoria: ${reportCategory}`, 14, 27);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 32);

    let headers: string[] = [];
    let body: string[][] = [];

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
    } else {
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

    autoTable(doc, {
      startY: 38,
      head: [headers],
      body: body,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [249, 115, 22] },
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
    let rows: string[][] = [];

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
    } else {
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
      `Exportado relatório CSV (${reportType}) para o período de ${reportStartDate} a ${reportEndDate} por ${currentRole}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls & Filter Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-slate-150 pb-4 dark:border-zinc-800">
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
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo de Relatório</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as "VALUATION" | "MOVEMENTS" | "EXPIRATION")}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-700 dark:text-zinc-200 cursor-pointer"
            >
              <option value="VALUATION">💰 Avaliação Patrimonial</option>
              <option value="MOVEMENTS">📈 Giro & Movimentação</option>
              <option value="EXPIRATION">📅 Validade & Lotes</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Inicial</label>
            <input
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-700 dark:text-zinc-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Final</label>
            <input
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-orange-500 text-slate-700 dark:text-zinc-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Categoria</label>
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

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filtrar por Termo</label>
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

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 dark:bg-orange-950/20 dark:text-orange-400">
            <DollarSign className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Valor em Estoque (Custo)</span>
            <span className="text-base font-black text-slate-800 dark:text-zinc-100">
              {reportsData.totals.totalCostVal.toLocaleString("pt-MZ")} {currency}
            </span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-950/20 dark:text-emerald-400">
            <TrendingUp className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Valor em Estoque (Venda)</span>
            <span className="text-base font-black text-emerald-600">
              {reportsData.totals.totalSaleVal.toLocaleString("pt-MZ")} {currency}
            </span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 dark:bg-blue-950/20 dark:text-blue-400">
            <TrendingUp className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Lucro Potencial Total</span>
            <span className="text-base font-black text-blue-600">
              {reportsData.totals.totalProfitPotential.toLocaleString("pt-MZ")} {currency}
            </span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 dark:bg-amber-950/20 dark:text-amber-400">
            <Calendar className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Itens Analisados</span>
            <span className="text-base font-black text-slate-800 dark:text-zinc-100">
              {reportsData.items.length} produtos ({reportsData.totals.totalStockQty} un.)
            </span>
          </div>
        </div>
      </div>

      {/* Main Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-150 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-wider dark:bg-zinc-800/40 dark:border-zinc-800">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Produto</th>
                <th className="py-3 px-4">Categoria</th>
                {reportType === "VALUATION" && (
                  <>
                    <th className="py-3 px-4 text-center">Stock</th>
                    <th className="py-3 px-4 text-right">P. Custo</th>
                    <th className="py-3 px-4 text-right">P. Venda</th>
                    <th className="py-3 px-4 text-right">Tot. Custo</th>
                    <th className="py-3 px-4 text-right">Tot. Venda</th>
                    <th className="py-3 px-4 text-center">Margem</th>
                  </>
                )}
                {reportType === "MOVEMENTS" && (
                  <>
                    <th className="py-3 px-4 text-center">Stock Atual</th>
                    <th className="py-3 px-4 text-center">Qtd Vendida</th>
                    <th className="py-3 px-4 text-right">Faturado</th>
                    <th className="py-3 px-4 text-right">Lucro no Período</th>
                    <th className="py-3 px-4 text-center">Giro</th>
                  </>
                )}
                {reportType === "EXPIRATION" && (
                  <>
                    <th className="py-3 px-4">Fornecedor</th>
                    <th className="py-3 px-4 text-center">Validade</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                    <th className="py-3 px-4 text-right">Valor Custo</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {reportsData.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 font-bold text-xs">
                    Nenhum registo encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                reportsData.items.map(item => {
                  return (
                    <tr key={item.product.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition">
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{item.product.code}</td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-100">{item.product.name}</td>
                      <td className="py-3 px-4 text-slate-500">{item.product.category}</td>

                      {reportType === "VALUATION" && (
                        <>
                          <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-zinc-300">{item.product.stock} un</td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-zinc-300">{item.product.costPrice.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-zinc-100">{item.product.salePrice.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-zinc-300">{item.currentStockValCost.toLocaleString("pt-MZ")}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">{item.currentStockValSale.toLocaleString("pt-MZ")}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              item.marginPct >= 40 ? "bg-emerald-100 text-emerald-700" : item.marginPct >= 20 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                            }`}>
                              {item.marginPct.toFixed(0)}%
                            </span>
                          </td>
                        </>
                      )}

                      {reportType === "MOVEMENTS" && (
                        <>
                          <td className="py-3 px-4 text-center font-bold">{item.product.stock} un</td>
                          <td className="py-3 px-4 text-center font-black text-orange-600">{item.salesQty} un</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-zinc-100">{item.salesValue.toLocaleString("pt-MZ")} MT</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">{item.salesProfit.toLocaleString("pt-MZ")} MT</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-blue-600">{item.rotationRate.toFixed(1)}%</td>
                        </>
                      )}

                      {reportType === "EXPIRATION" && (
                        <>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{item.product.supplier || "-"}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold">{item.product.expiryDate || "-"}</td>
                          <td className="py-3 px-4 text-center font-bold">{item.product.stock} un</td>
                          <td className="py-3 px-4 text-right font-bold">{item.currentStockValCost.toLocaleString("pt-MZ")} MT</td>
                          <td className="py-3 px-4 text-center">
                            {(() => {
                              const daysLeft = Math.ceil((new Date(item.product.expiryDate || "").getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              return (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  daysLeft < 0 ? "bg-red-100 text-red-700" : daysLeft <= 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {daysLeft < 0 ? "Vencido" : `${daysLeft} dias`}
                                </span>
                              );
                            })()}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
