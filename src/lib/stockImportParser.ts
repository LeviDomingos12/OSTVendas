/**
 * @file src/lib/stockImportParser.ts
 * Utilitário de Alta Tolerância para Importação de Stock / Catálogo de Produtos.
 * Suporta nativamente:
 *  - Ficheiros Excel (.xlsx, .xls) via SheetJS
 *  - Ficheiros CSV com delimitador automático (ponto e vírgula ';', vírgula ',', tabulação '\t', pipe '|')
 *  - Ficheiros de texto plano (.txt, .tsv)
 *  - Formatação monetária e decimal moçambicana e internacional (ex: "1.250,50 MT", "80,00", "50.00")
 *  - Mapeamento inteligente de cabeçalhos (Nome, Código/SKU, Preço Venda, Preço Custo, Stock, Categoria, Fornecedor)
 */

import * as XLSX from "xlsx";
import { Product } from "../types";
import { generateEntityId } from "./deterministic";

export interface StockImportResult {
  success: boolean;
  products: Product[];
  totalRows: number;
  validRows: number;
  message: string;
  error?: string;
}

/**
 * Remove acentos, caracteres especiais e converte para minúsculas para comparação tolerante.
 */
function normalizeHeaderKey(key: string): string {
  return String(key || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Converte strings monetárias/numéricas complexas em número decimal válido.
 * Trata: "1.500,50 MT", "1,500.50", "80,00", "150 MT", "-5", etc.
 */
export function parseLocalizedNumber(val: unknown, defaultVal = 0): number {
  if (val === null || val === undefined || val === "") return defaultVal;
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;

  let str = String(val).trim();
  // Remover unidades e símbolos (MT, MZN, $, €, R$, un, etc.)
  str = str.replace(/[A-Za-z$€]/g, "").trim();

  // Tratamento de separadores
  if (str.includes(",") && str.includes(".")) {
    // Ex: "1.500,50" -> ponto é milhar, vírgula é decimal
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Ex: "1,500.50" -> vírgula é milhar, ponto é decimal
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    // Ex: "120,50" -> vírgula decimal
    str = str.replace(",", ".");
  }

  const result = parseFloat(str);
  return isNaN(result) ? defaultVal : result;
}

/**
 * Mapeia cabeçalhos conhecidos para colunas padrão.
 */
interface ColumnMapping {
  nameIdx: number;
  codeIdx: number;
  salePriceIdx: number;
  costPriceIdx: number;
  stockIdx: number;
  minStockIdx: number;
  categoryIdx: number;
  supplierIdx: number;
  vatRateIdx: number;
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    nameIdx: -1,
    codeIdx: -1,
    salePriceIdx: -1,
    costPriceIdx: -1,
    stockIdx: -1,
    minStockIdx: -1,
    categoryIdx: -1,
    supplierIdx: -1,
    vatRateIdx: -1
  };

  headers.forEach((h, idx) => {
    const norm = normalizeHeaderKey(h);
    if (!norm) return;

    // Nome / Descrição / Artigo / Produto
    if (
      mapping.nameIdx === -1 &&
      (norm.includes("nome") ||
        norm.includes("name") ||
        norm.includes("descricao") ||
        norm.includes("artigo") ||
        norm.includes("produto") ||
        norm.includes("designacao") ||
        norm === "item" ||
        norm === "titulo")
    ) {
      mapping.nameIdx = idx;
      return;
    }

    // Código / SKU / Barras
    if (
      mapping.codeIdx === -1 &&
      (norm.includes("cod") ||
        norm.includes("sku") ||
        norm.includes("barra") ||
        norm.includes("barcode") ||
        norm.includes("ref") ||
        norm === "code" ||
        norm === "id")
    ) {
      mapping.codeIdx = idx;
      return;
    }

    // Preço de Venda
    if (
      mapping.salePriceIdx === -1 &&
      (norm.includes("preco_venda") ||
        norm.includes("preco_unit") ||
        norm.includes("preco") ||
        norm.includes("sale_price") ||
        norm.includes("pvp") ||
        norm.includes("venda") ||
        norm === "price" ||
        norm === "valor")
    ) {
      mapping.salePriceIdx = idx;
      return;
    }

    // Preço de Custo
    if (
      mapping.costPriceIdx === -1 &&
      (norm.includes("preco_custo") ||
        norm.includes("custo") ||
        norm.includes("cost_price") ||
        norm.includes("cost") ||
        norm.includes("compra") ||
        norm === "pc")
    ) {
      mapping.costPriceIdx = idx;
      return;
    }

    // Stock / Quantidade
    if (
      mapping.stockIdx === -1 &&
      (norm.includes("stock") ||
        norm.includes("estoque") ||
        norm.includes("quant") ||
        norm.includes("qtd") ||
        norm.includes("existencia") ||
        norm === "qty" ||
        norm === "saldo")
    ) {
      mapping.stockIdx = idx;
      return;
    }

    // Stock Mínimo
    if (
      mapping.minStockIdx === -1 &&
      (norm.includes("min") || norm.includes("stock_min") || norm.includes("alerta"))
    ) {
      mapping.minStockIdx = idx;
      return;
    }

    // Categoria
    if (
      mapping.categoryIdx === -1 &&
      (norm.includes("categ") || norm.includes("familia") || norm.includes("grupo") || norm.includes("setor"))
    ) {
      mapping.categoryIdx = idx;
      return;
    }

    // Fornecedor
    if (
      mapping.supplierIdx === -1 &&
      (norm.includes("fornec") || norm.includes("suppl") || norm.includes("marca") || norm.includes("distrib"))
    ) {
      mapping.supplierIdx = idx;
      return;
    }

    // IVA
    if (mapping.vatRateIdx === -1 && (norm.includes("iva") || norm.includes("vat") || norm.includes("taxa"))) {
      mapping.vatRateIdx = idx;
      return;
    }
  });

  return mapping;
}

/**
 * Tenta inferir se a linha é um cabeçalho ou linha de dados.
 */
function isHeaderRow(row: unknown[]): boolean {
  const text = row.map(c => String(c || "").toLowerCase()).join(" ");
  return (
    text.includes("nome") ||
    text.includes("artigo") ||
    text.includes("produto") ||
    text.includes("código") ||
    text.includes("codigo") ||
    text.includes("preco") ||
    text.includes("preço") ||
    text.includes("stock") ||
    text.includes("quantidade") ||
    text.includes("sku")
  );
}

/**
 * Função principal para ler ficheiros XLS, XLSX, CSV, TSV e TXT.
 */
export async function parseStockImportFile(
  file: File,
  defaultVatRate = 16
): Promise<StockImportResult> {
  try {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".ods");

    let rawMatrix: unknown[][] = [];

    if (isExcel) {
      // Ler ficheiro binário do Excel
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return {
          success: false,
          products: [],
          totalRows: 0,
          validRows: 0,
          message: "O ficheiro Excel não contém planilhas legíveis.",
          error: "EMPTY_WORKBOOK"
        };
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rawMatrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: "" }) as unknown[][];
    } else {
      // Tentar ler texto para CSV / TSV / TXT
      const text = await file.text();
      // Remover UTF-8 BOM se presente
      const cleanText = text.replace(/^\uFEFF/, "");

      if (!cleanText.trim()) {
        return {
          success: false,
          products: [],
          totalRows: 0,
          validRows: 0,
          message: "O ficheiro fornecido está vazio.",
          error: "EMPTY_FILE"
        };
      }

      // Tentar passar primeiro via SheetJS para suporte perfeito a delimitadores e aspas
      try {
        const workbook = XLSX.read(cleanText, { type: "string" });
        if (workbook.SheetNames && workbook.SheetNames.length > 0) {
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
        }
      } catch {
        // Fallback para parser manual com deteção de separador
      }

      // Se a matriz estiver vazia ou com uma única linha sem separação
      if (rawMatrix.length === 0 || (rawMatrix.length > 0 && rawMatrix[0].length <= 1)) {
        const lines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 0) {
          const firstLine = lines[0];
          const semiCount = (firstLine.match(/;/g) || []).length;
          const commaCount = (firstLine.match(/,/g) || []).length;
          const tabCount = (firstLine.match(/\t/g) || []).length;
          const pipeCount = (firstLine.match(/\|/g) || []).length;

          let delimiter = ",";
          if (semiCount > commaCount && semiCount >= tabCount) delimiter = ";";
          else if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";
          else if (pipeCount > commaCount) delimiter = "|";

          rawMatrix = lines.map(line => {
            // Suporte a campos com aspas
            const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*)"|([^"${delimiter}]*))`, "g");
            const row: string[] = [];
            let match;
            while ((match = regex.exec(line)) !== null) {
              row.push(match[1] !== undefined ? match[1].trim() : (match[2] || "").trim());
            }
            return row;
          });
        }
      }
    }

    if (rawMatrix.length === 0) {
      return {
        success: false,
        products: [],
        totalRows: 0,
        validRows: 0,
        message: "Não foram encontradas linhas de dados no ficheiro.",
        error: "NO_ROWS"
      };
    }

    // Filtrar linhas completamente vazias
    const nonEmptyRows = rawMatrix.filter(row => row && row.some(cell => String(cell || "").trim().length > 0));

    if (nonEmptyRows.length === 0) {
      return {
        success: false,
        products: [],
        totalRows: 0,
        validRows: 0,
        message: "O ficheiro contém apenas células vazias.",
        error: "ONLY_EMPTY_CELLS"
      };
    }

    // Determinar índice do cabeçalho
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(nonEmptyRows.length, 5); i++) {
      if (isHeaderRow(nonEmptyRows[i])) {
        headerRowIdx = i;
        break;
      }
    }

    let mapping: ColumnMapping;
    let dataStartIdx = 0;

    if (headerRowIdx !== -1) {
      const headers = nonEmptyRows[headerRowIdx].map(c => String(c || ""));
      mapping = detectColumnMapping(headers);
      dataStartIdx = headerRowIdx + 1;
    } else {
      // Sem cabeçalho detetado, usar posições padrão:
      // [0: Código, 1: Nome, 2: Categoria, 3: Preço Custo, 4: Preço Venda, 5: Stock, 6: Min Stock, 7: Fornecedor]
      mapping = {
        codeIdx: 0,
        nameIdx: 1,
        categoryIdx: 2,
        costPriceIdx: 3,
        salePriceIdx: 4,
        stockIdx: 5,
        minStockIdx: 6,
        supplierIdx: 7,
        vatRateIdx: -1
      };
      dataStartIdx = 0;
    }

    // Se o mapeamento não encontrou coluna de nome, tentar inferir pela primeira coluna com texto alfabético
    if (mapping.nameIdx === -1) {
      mapping.nameIdx = 1; // Fallback
    }

    const parsedProducts: Product[] = [];
    const rowsToProcess = nonEmptyRows.slice(dataStartIdx);

    rowsToProcess.forEach((row, rowIdx) => {
      // Obter nome
      let rawName = mapping.nameIdx >= 0 ? String(row[mapping.nameIdx] || "").trim() : "";
      // Se não encontrou no nameIdx, procurar primeira coluna com texto não numérico
      if (!rawName) {
        for (let col = 0; col < row.length; col++) {
          const val = String(row[col] || "").trim();
          if (val.length > 1 && isNaN(Number(val)) && !val.match(/^SKU|^REF|^[0-9]/i)) {
            rawName = val;
            break;
          }
        }
      }

      // Se ainda não tem nome, pular linha vazia
      if (!rawName) return;

      // Código / SKU
      let rawCode = mapping.codeIdx >= 0 ? String(row[mapping.codeIdx] || "").trim() : "";
      if (!rawCode) {
        rawCode = `SKU-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}-${rowIdx + 1}`;
      }

      // Preços e Stocks
      const salePrice = mapping.salePriceIdx >= 0 ? parseLocalizedNumber(row[mapping.salePriceIdx], 0) : 0;
      const costPrice = mapping.costPriceIdx >= 0 ? parseLocalizedNumber(row[mapping.costPriceIdx], 0) : 0;
      const stock = mapping.stockIdx >= 0 ? parseLocalizedNumber(row[mapping.stockIdx], 0) : 0;
      const minStock = mapping.minStockIdx >= 0 ? parseLocalizedNumber(row[mapping.minStockIdx], 5) : 5;
      const category = mapping.categoryIdx >= 0 ? String(row[mapping.categoryIdx] || "").trim() || "Geral" : "Geral";
      const supplier = mapping.supplierIdx >= 0 ? String(row[mapping.supplierIdx] || "").trim() || undefined : undefined;
      const vatRate = mapping.vatRateIdx >= 0 ? parseLocalizedNumber(row[mapping.vatRateIdx], defaultVatRate) : defaultVatRate;

      const product: Product = {
        id: generateEntityId("prod"),
        code: rawCode,
        barcode: rawCode,
        name: rawName,
        category,
        costPrice: Math.max(0, costPrice),
        salePrice: Math.max(0, salePrice),
        stock: Math.max(0, stock),
        minStock: Math.max(0, minStock),
        vatRate,
        supplier,
        unit: "un"
      };

      parsedProducts.push(product);
    });

    if (parsedProducts.length === 0) {
      return {
        success: false,
        products: [],
        totalRows: rowsToProcess.length,
        validRows: 0,
        message: "Nenhum produto válido encontrado. Verifique se o ficheiro possui colunas com o Nome e Stock do artigo.",
        error: "NO_VALID_PRODUCTS"
      };
    }

    return {
      success: true,
      products: parsedProducts,
      totalRows: rowsToProcess.length,
      validRows: parsedProducts.length,
      message: `${parsedProducts.length} produto(s) lido(s) com sucesso a partir do ficheiro!`
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      products: [],
      totalRows: 0,
      validRows: 0,
      message: `Erro ao processar ficheiro: ${msg}`,
      error: msg
    };
  }
}
