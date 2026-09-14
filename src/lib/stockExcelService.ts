/**
 * @file src/lib/stockExcelService.ts
 * Utilitário de Geração e Exportação de Planilhas Excel (.xlsx) e CSV para o Módulo de Stock.
 * Substitui arquivos brutos com ponto-e-vírgula por planilhas Microsoft Excel nativas,
 * com colunas organizadas, cabeçalhos estilizados, larguras automáticas e dados de exemplo.
 */

import * as XLSX from "xlsx";
import { Product } from "../types";

/**
 * Cria e descarrega um modelo oficial do Excel (.xlsx) organizado em colunas normais,
 * com cabeçalho formatado, larguras de coluna ajustadas e linhas de amostra realistas.
 */
export function downloadStockTemplateExcel(): void {
  const wb = XLSX.utils.book_new();

  // 1. Cabeçalhos e linhas de exemplo realistas para Moçambique / Internacional
  const headers = [
    "Código (SKU)",
    "Nome do Produto",
    "Categoria",
    "Preço de Custo (MT)",
    "Preço de Venda (MT)",
    "Stock Inicial",
    "Stock Mínimo",
    "Fornecedor",
    "Código de Barras",
    "Data de Validade"
  ];

  const sampleRows = [
    ["BEB-001", "Água Mineral 500ml", "Bebidas", 15, 25, 200, 30, "Fontes de Moçambique", "5601234567890", "2026-12-31"],
    ["ALM-002", "Arroz Nacional Tipo 1 25kg", "Alimentação", 1250, 1600, 45, 10, "Armazéns Beira", "5601234567891", "2027-06-30"],
    ["ALM-003", "Óleo Alimentar 5L", "Alimentação", 420, 550, 80, 15, "Distribuidora Central", "5601234567892", "2027-03-15"],
    ["HIG-004", "Sabão em Barra 1kg", "Higiene", 65, 95, 150, 25, "Produtos Limpeza Lda", "5601234567893", ""],
    ["BEB-005", "Refrigerante 330ml Lata", "Bebidas", 35, 50, 300, 50, "Cervejas de Moçambique", "5601234567894", "2026-11-20"]
  ];

  const data = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Definir larguras ideais de colunas para facilitar o preenchimento sem cortes no Excel
  ws["!cols"] = [
    { wch: 16 }, // Código (SKU)
    { wch: 34 }, // Nome do Produto
    { wch: 18 }, // Categoria
    { wch: 20 }, // Preço Custo
    { wch: 20 }, // Preço Venda
    { wch: 16 }, // Stock Inicial
    { wch: 16 }, // Stock Mínimo
    { wch: 26 }, // Fornecedor
    { wch: 20 }, // Código de Barras
    { wch: 18 }  // Data de Validade
  ];

  // Adicionar folha principal
  XLSX.utils.book_append_sheet(wb, ws, "Modelo Stock");

  // 2. Folha de Instruções de Preenchimento
  const instructionsData = [
    ["GUIA DE PREENCHIMENTO DO MODELO DE STOCK — OST VENDAS"],
    [""],
    ["Coluna", "Obrigatório?", "Descrição e Exemplo"],
    ["Código (SKU)", "Opcional", "Código interno ou referência do artigo (ex: PROD-001). Se vazio, é gerado automaticamente."],
    ["Nome do Produto", "OBRIGATÓRIO", "Nome comercial completo do produto (ex: Arroz Nacional 25kg)."],
    ["Categoria", "Recomendado", "Classificação do artigo (ex: Mercearia, Bebidas, Limpeza, Talho, Padaria)."],
    ["Preço de Custo (MT)", "Recomendado", "Valor pago na aquisição ou custo unitário (ex: 1250)."],
    ["Preço de Venda (MT)", "OBRIGATÓRIO", "Preço final cobrado ao cliente no POS (ex: 1600)."],
    ["Stock Inicial", "OBRIGATÓRIO", "Quantidade física existente no armazém ou prateleira (ex: 50)."],
    ["Stock Mínimo", "Recomendado", "Nível de alerta de reposição automática (ex: 10)."],
    ["Fornecedor", "Opcional", "Nome da empresa ou distribuidor parceiro (ex: Armazéns Beira)."],
    ["Código de Barras", "Opcional", "Código EAN-13 ou numérico para leitura com scanner laser."],
    ["Data de Validade", "Opcional", "Formato AAAA-MM-DD (ex: 2026-12-31) para controlo de lotes e alertas."],
    [""],
    ["DICA IMPORTANTE:"],
    ["Pode preencher quantas linhas quiser. Depois de preencher, basta salvar e arrastar este mesmo ficheiro para a área de importação do OST Vendas!"]
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instruções");

  // Gravação direta com extensão .xlsx
  XLSX.writeFile(wb, "modelo_produtos_inventario.xlsx");
}

/**
 * Cria e descarrega um modelo CSV padrão UTF-8 com separação por vírgula compatível com Excel,
 * sem bagunça de caracteres e com aspas adequadas.
 */
export function downloadStockTemplateCSV(): void {
  const headers = "Código (SKU),Nome do Produto,Categoria,Preço Custo (MT),Preço Venda (MT),Stock Inicial,Stock Mínimo,Fornecedor,Código de Barras,Data de Validade\n";
  const sample = [
    '"BEB-001","Água Mineral 500ml","Bebidas",15,25,200,30,"Fontes de Moçambique","5601234567890","2026-12-31"',
    '"ALM-002","Arroz Nacional Tipo 1 25kg","Alimentação",1250,1600,45,10,"Armazéns Beira","5601234567891","2027-06-30"',
    '"ALM-003","Óleo Alimentar 5L","Alimentação",420,550,80,15,"Distribuidora Central","5601234567892","2027-03-15"',
    '"HIG-004","Sabão em Barra 1kg","Higiene",65,95,150,25,"Produtos Limpeza Lda","5601234567893",""',
    '"BEB-005","Refrigerante 330ml Lata","Bebidas",35,50,300,50,"Cervejas de Moçambique","5601234567894","2026-11-20"'
  ].join("\n");

  const blob = new Blob(["\uFEFF" + headers + sample], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "modelo_produtos_inventario.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta todo o inventário atual da empresa para uma planilha Excel (.xlsx) perfeitamente estruturada.
 */
export function exportCurrentStockToExcel(products: Product[], currency = "MT"): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    "Código (SKU)",
    "Nome do Produto",
    "Categoria",
    `Preço Custo (${currency})`,
    `Preço Venda (${currency})`,
    "Margem Lucro (%)",
    "Stock Atual",
    "Stock Mínimo",
    `Valor em Stock Custo (${currency})`,
    `Valor em Stock Venda (${currency})`,
    "Estado do Stock",
    "Fornecedor",
    "Código de Barras",
    "Data de Validade"
  ];

  const rows = products.map((p) => {
    const profitMargin = p.costPrice > 0 ? Math.round(((p.salePrice - p.costPrice) / p.costPrice) * 100) : 0;
    const costVal = p.stock * p.costPrice;
    const saleVal = p.stock * p.salePrice;
    const status = p.stock <= 0 ? "Esgotado" : p.stock <= p.minStock ? "Stock Baixo" : "Normal";

    return [
      p.code || "-",
      p.name,
      p.category || "Geral",
      p.costPrice,
      p.salePrice,
      `${profitMargin}%`,
      p.stock,
      p.minStock,
      costVal,
      saleVal,
      status,
      p.supplier || "-",
      p.barcode || "-",
      p.expiryDate || "-"
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [
    { wch: 16 }, // Código
    { wch: 34 }, // Nome
    { wch: 18 }, // Categoria
    { wch: 18 }, // Preço Custo
    { wch: 18 }, // Preço Venda
    { wch: 16 }, // Margem
    { wch: 14 }, // Stock Atual
    { wch: 14 }, // Stock Mínimo
    { wch: 22 }, // Valor Custo
    { wch: 22 }, // Valor Venda
    { wch: 16 }, // Estado
    { wch: 24 }, // Fornecedor
    { wch: 20 }, // Código de Barras
    { wch: 16 }  // Validade
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Inventário de Stock");

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `inventario_stock_ost_${dateStr}.xlsx`);
}
