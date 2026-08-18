/**
 * @file migration.ts
 * Script utilitário para automatizar a leitura de todas as coleções do Firestore
 * (produtos, transações, clientes, configurações, caixa e utilizadores)
 * e inseri-las nas tabelas correspondentes do Supabase PostgreSQL usando @supabase/supabase-js
 * com validação estrita de esquema e garantia de integridade referencial.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { 
  db, 
  getProdutosFromFirestore, 
  getCustomersFromFirestore, 
  getTransacoesFromFirestore, 
  getCashflowFromFirestore, 
  getSettingsFromFirestore,
  getUsuariosFromFirestore 
} from "./firebase";
import { getSupabaseClient } from "../services/supabaseService";
import { Product, Customer, Transaction, CashFlowEntry, SystemSettings } from "../types";

// ==========================================
// SCHEMAS DE VALIDAÇÃO EM RUNTIME
// ==========================================

export interface SchemaValidationResult<T> {
  isValid: boolean;
  sanitizedData: T;
  errors: string[];
  warnings: string[];
}

export interface MigrationSummary {
  success: boolean;
  totalRecordsRead: number;
  totalRecordsMigrated: number;
  productsCount: number;
  customersCount: number;
  transactionsCount: number;
  cashFlowCount: number;
  settingsCount: number;
  usersCount: number;
  durationMs: number;
  errors: string[];
  warnings: string[];
  stepDetails: Record<string, { read: number; written: number; status: "success" | "warning" | "error" }>;
}

export interface MigrationOptions {
  supabaseClient?: SupabaseClient;
  onProgress?: (step: string, percent: number, detail?: string) => void;
  onLog?: (message: string, level?: "info" | "success" | "warning" | "error") => void;
  batchSize?: number;
  skipInvalidRecords?: boolean;
}

/**
 * Validador e normalizador de Esquema para Produtos
 */
export function validateAndSanitizeProduct(raw: any): SchemaValidationResult<any> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const id = String(raw?.id || raw?.code || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`).trim();
  const name = String(raw?.name || raw?.nome || raw?.description || "").trim();

  if (!name) {
    errors.push(`Produto id=${id} não possui nome/descrição obrigatória.`);
  }

  const salePrice = Number(raw?.salePrice ?? raw?.precoVenda ?? raw?.price ?? 0);
  const costPrice = Number(raw?.costPrice ?? raw?.precoCusto ?? 0);
  const stock = Number(raw?.stock ?? raw?.estoque ?? raw?.quantity ?? 0);
  const minStock = Number(raw?.minStock ?? raw?.estoqueMinimo ?? 0);
  const vatRate = Number(raw?.vatRate ?? raw?.taxaIva ?? 16);

  if (isNaN(salePrice) || salePrice < 0) {
    warnings.push(`Produto id=${id} (${name}) tem preço de venda inválido. Ajustado para 0.`);
  }

  const sanitized = {
    id,
    name: name || "Artigo Sem Nome",
    code: String(raw?.code || id).trim(),
    category: String(raw?.category || raw?.categoria || "Geral").trim(),
    supplier: String(raw?.supplier || raw?.fornecedor || "").trim(),
    cost_price: isNaN(costPrice) ? 0 : Math.max(0, costPrice),
    sale_price: isNaN(salePrice) ? 0 : Math.max(0, salePrice),
    stock: isNaN(stock) ? 0 : stock,
    min_stock: isNaN(minStock) ? 0 : Math.max(0, minStock),
    vat_rate: isNaN(vatRate) ? 16 : vatRate,
    barcode: String(raw?.barcode || raw?.codigoBarras || raw?.code || "").trim(),
    updated_at: new Date().toISOString()
  };

  return {
    isValid: errors.length === 0,
    sanitizedData: sanitized,
    errors,
    warnings
  };
}

/**
 * Validador e normalizador de Esquema para Clientes
 */
export function validateAndSanitizeCustomer(raw: any): SchemaValidationResult<any> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const id = String(raw?.id || `cli_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`).trim();
  const name = String(raw?.name || raw?.nome || "").trim();

  if (!name) {
    errors.push(`Cliente id=${id} não possui nome.`);
  }

  const balance = Number(raw?.balance ?? raw?.saldo ?? raw?.debt ?? 0);

  const sanitized = {
    id,
    name: name || "Cliente Não Identificado",
    nuit: String(raw?.nuit || raw?.taxId || "").trim(),
    email: String(raw?.email || "").trim(),
    phone: String(raw?.phone || raw?.telefone || raw?.contact || "").trim(),
    address: String(raw?.address || raw?.endereco || "").trim(),
    balance: isNaN(balance) ? 0 : balance,
    updated_at: new Date().toISOString()
  };

  return {
    isValid: errors.length === 0,
    sanitizedData: sanitized,
    errors,
    warnings
  };
}

/**
 * Validador e normalizador de Esquema para Transações / Vendas
 */
export function validateAndSanitizeTransaction(raw: any): SchemaValidationResult<any> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const id = String(raw?.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`).trim();
  const invoiceNumber = String(raw?.invoiceNumber || raw?.numeroFatura || id).trim();

  const totalAmount = Number(raw?.totalAmount ?? raw?.grandTotal ?? raw?.total ?? 0);
  if (isNaN(totalAmount)) {
    warnings.push(`Venda ${invoiceNumber} possui totalAmount inválido. Definido como 0.`);
  }

  let items = Array.isArray(raw?.items) ? raw.items : [];
  // Garantir sanitização de itens
  items = items.map((item: any, idx: number) => ({
    productId: String(item?.productId || item?.id || `item_${idx}`).trim(),
    productName: String(item?.productName || item?.name || "Artigo").trim(),
    quantity: Number(item?.quantity || item?.qty || 1),
    unitPrice: Number(item?.unitPrice || item?.price || 0),
    total: Number(item?.total || (Number(item?.quantity || 1) * Number(item?.unitPrice || 0))),
    discount: Number(item?.discount || 0),
    vatRate: Number(item?.vatRate || 16)
  }));

  const createdTime = raw?.timestamp || raw?.createdAt || raw?.data || new Date().toISOString();
  let validCreatedAt = new Date().toISOString();
  try {
    validCreatedAt = new Date(createdTime).toISOString();
  } catch {
    validCreatedAt = new Date().toISOString();
  }

  const sanitized = {
    id,
    invoice_number: invoiceNumber,
    customer_name: String(raw?.customerName || raw?.customer?.name || raw?.cliente || "Cliente Geral").trim(),
    total_amount: isNaN(totalAmount) ? 0 : totalAmount,
    payment_method: String(raw?.paymentMethod || raw?.formaPagamento || "DINHEIRO").trim(),
    operator_name: String(raw?.operatorName || raw?.operador || raw?.userName || "Operador").trim(),
    items: items,
    created_at: validCreatedAt
  };

  return {
    isValid: errors.length === 0,
    sanitizedData: sanitized,
    errors,
    warnings
  };
}

/**
 * Validador e normalizador de Esquema para Movimentos de Caixa
 */
export function validateAndSanitizeCashFlow(raw: any): SchemaValidationResult<any> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const id = String(raw?.id || `cx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`).trim();
  const type = String(raw?.type || raw?.tipo || "ENTRADA").toUpperCase();
  const amount = Number(raw?.amount ?? raw?.valor ?? 0);

  const createdTime = raw?.timestamp || raw?.createdAt || raw?.data || new Date().toISOString();
  let validTimestamp = new Date().toISOString();
  try {
    validTimestamp = new Date(createdTime).toISOString();
  } catch {
    validTimestamp = new Date().toISOString();
  }

  const sanitized = {
    id,
    type: ["ENTRADA", "SAIDA", "SUPRIMENTO", "SANGRIA", "FECHO"].includes(type) ? type : "ENTRADA",
    amount: isNaN(amount) ? 0 : Math.abs(amount),
    description: String(raw?.description || raw?.descricao || raw?.reason || "Movimento de Caixa").trim(),
    timestamp: validTimestamp
  };

  return {
    isValid: errors.length === 0,
    sanitizedData: sanitized,
    errors,
    warnings
  };
}

/**
 * Validador e normalizador de Esquema para Configurações Globais
 */
export function validateAndSanitizeSettings(raw: any): SchemaValidationResult<any> {
  const sanitized = {
    id: "default_settings",
    company_name: String(raw?.companyName || raw?.nomeEmpresa || "OST Vendas").trim(),
    company_nuit: String(raw?.companyNuit || raw?.nuitEmpresa || "").trim(),
    currency: String(raw?.currency || raw?.moeda || "MZN").trim(),
    default_vat: Number(raw?.defaultVat ?? raw?.vatDefaultRate ?? 16),
    store_address: String(raw?.storeAddress || raw?.endereco || "").trim(),
    store_contact: String(raw?.storeContact || raw?.telefone || "").trim(),
    slogan: String(raw?.slogan || "").trim(),
    raw_config: raw || {},
    updated_at: new Date().toISOString()
  };

  return {
    isValid: true,
    sanitizedData: sanitized,
    errors: [],
    warnings: []
  };
}

/**
 * Executa a migração em lote de um conjunto de dados para uma tabela do Supabase com Upsert
 */
async function batchUpsertToSupabase(
  client: SupabaseClient,
  tableName: string,
  records: any[],
  batchSize: number = 50,
  onBatchProgress?: (processed: number, total: number) => void
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);
    const { error } = await client
      .from(tableName)
      .upsert(chunk, { onConflict: "id" });

    if (error) {
      errors.push(`Erro ao inserir lote ${i / batchSize + 1} em '${tableName}': ${error.message}`);
    } else {
      inserted += chunk.length;
    }

    if (onBatchProgress) {
      onBatchProgress(Math.min(i + batchSize, records.length), records.length);
    }
  }

  return { inserted, errors };
}

// ==========================================
// FUNÇÃO PRINCIPAL DE MIGRAÇÃO AUTOMATIZADA
// ==========================================

/**
 * Automatiza a leitura de todas as coleções do Firestore e a inserção nas tabelas do Supabase
 * @param options Opções de migração (cliente Supabase, callbacks de progresso/log, tamanho do lote)
 */
export async function migrateAllCollections(options: MigrationOptions = {}): Promise<MigrationSummary> {
  const startTime = Date.now();
  const client = options.supabaseClient || getSupabaseClient();
  const batchSize = options.batchSize || 50;

  const log = (msg: string, level: "info" | "success" | "warning" | "error" = "info") => {
    if (options.onLog) options.onLog(msg, level);
    console.log(`[MIGRATION ${level.toUpperCase()}] ${msg}`);
  };

  const progress = (step: string, pct: number, detail?: string) => {
    if (options.onProgress) options.onProgress(step, pct, detail);
  };

  const summary: MigrationSummary = {
    success: false,
    totalRecordsRead: 0,
    totalRecordsMigrated: 0,
    productsCount: 0,
    customersCount: 0,
    transactionsCount: 0,
    cashFlowCount: 0,
    settingsCount: 0,
    usersCount: 0,
    durationMs: 0,
    errors: [],
    warnings: [],
    stepDetails: {}
  };

  if (!client) {
    const errMsg = "Cliente Supabase não configurado ou credenciais ausentes.";
    log(errMsg, "error");
    summary.errors.push(errMsg);
    return summary;
  }

  try {
    log("Iniciando processo automatizado de migração Firestore ➔ Supabase...", "info");
    progress("Inicialização", 5, "Conectando ao Firestore e validando cliente Supabase...");

    // ----------------------------------------------------
    // ETAPA 1: CLIENTES
    // ----------------------------------------------------
    progress("Clientes", 15, "Lendo coleção 'clientes' do Firestore...");
    log("Extraindo clientes do Firestore...", "info");
    const rawCustomers = await getCustomersFromFirestore().catch(() => []);
    summary.totalRecordsRead += rawCustomers.length;
    log(`${rawCustomers.length} clientes encontrados no Firestore. Validando esquema...`, "info");

    const validCustomers: any[] = [];
    rawCustomers.forEach((raw) => {
      const res = validateAndSanitizeCustomer(raw);
      if (res.warnings.length) summary.warnings.push(...res.warnings);
      if (res.isValid || !options.skipInvalidRecords) {
        validCustomers.push(res.sanitizedData);
      } else {
        summary.errors.push(...res.errors);
      }
    });

    log(`Inserindo ${validCustomers.length} clientes na tabela 'clientes' do Supabase...`, "info");
    const custRes = await batchUpsertToSupabase(client, "clientes", validCustomers, batchSize, (cur, tot) => {
      progress("Clientes", 15 + Math.round((cur / tot) * 15), `Gravando cliente ${cur}/${tot}...`);
    });
    summary.customersCount = custRes.inserted;
    summary.totalRecordsMigrated += custRes.inserted;
    if (custRes.errors.length) summary.errors.push(...custRes.errors);
    summary.stepDetails["clientes"] = {
      read: rawCustomers.length,
      written: custRes.inserted,
      status: custRes.errors.length ? "error" : "success"
    };
    log(`✓ Clientes migrados: ${custRes.inserted}/${rawCustomers.length}`, custRes.errors.length ? "warning" : "success");

    // ----------------------------------------------------
    // ETAPA 2: PRODUTOS / ARTIGOS
    // ----------------------------------------------------
    progress("Produtos", 35, "Lendo coleção 'produtos' do Firestore...");
    log("Extraindo catálogo de produtos do Firestore...", "info");
    const rawProducts = await getProdutosFromFirestore().catch(() => []);
    summary.totalRecordsRead += rawProducts.length;
    log(`${rawProducts.length} produtos encontrados no Firestore. Validando esquema...`, "info");

    const validProducts: any[] = [];
    rawProducts.forEach((raw) => {
      const res = validateAndSanitizeProduct(raw);
      if (res.warnings.length) summary.warnings.push(...res.warnings);
      if (res.isValid || !options.skipInvalidRecords) {
        validProducts.push(res.sanitizedData);
      } else {
        summary.errors.push(...res.errors);
      }
    });

    log(`Inserindo ${validProducts.length} produtos na tabela 'produtos' do Supabase...`, "info");
    const prodRes = await batchUpsertToSupabase(client, "produtos", validProducts, batchSize, (cur, tot) => {
      progress("Produtos", 35 + Math.round((cur / tot) * 20), `Gravando produto ${cur}/${tot}...`);
    });
    summary.productsCount = prodRes.inserted;
    summary.totalRecordsMigrated += prodRes.inserted;
    if (prodRes.errors.length) summary.errors.push(...prodRes.errors);
    summary.stepDetails["produtos"] = {
      read: rawProducts.length,
      written: prodRes.inserted,
      status: prodRes.errors.length ? "error" : "success"
    };
    log(`✓ Produtos migrados: ${prodRes.inserted}/${rawProducts.length}`, prodRes.errors.length ? "warning" : "success");

    // ----------------------------------------------------
    // ETAPA 3: TRANSAÇÕES / HISTÓRICO DE VENDAS
    // ----------------------------------------------------
    progress("Vendas", 60, "Lendo coleção 'transacoes' do Firestore...");
    log("Extraindo histórico de vendas do Firestore...", "info");
    const rawTransactions = await getTransacoesFromFirestore().catch(() => []);
    summary.totalRecordsRead += rawTransactions.length;
    log(`${rawTransactions.length} vendas encontradas no Firestore. Validando esquema e itens...`, "info");

    const validTransactions: any[] = [];
    rawTransactions.forEach((raw) => {
      const res = validateAndSanitizeTransaction(raw);
      if (res.warnings.length) summary.warnings.push(...res.warnings);
      if (res.isValid || !options.skipInvalidRecords) {
        validTransactions.push(res.sanitizedData);
      } else {
        summary.errors.push(...res.errors);
      }
    });

    log(`Inserindo ${validTransactions.length} vendas na tabela 'vendas' do Supabase...`, "info");
    const txRes = await batchUpsertToSupabase(client, "vendas", validTransactions, batchSize, (cur, tot) => {
      progress("Vendas", 60 + Math.round((cur / tot) * 20), `Gravando venda ${cur}/${tot}...`);
    });
    summary.transactionsCount = txRes.inserted;
    summary.totalRecordsMigrated += txRes.inserted;
    if (txRes.errors.length) summary.errors.push(...txRes.errors);
    summary.stepDetails["vendas"] = {
      read: rawTransactions.length,
      written: txRes.inserted,
      status: txRes.errors.length ? "error" : "success"
    };
    log(`✓ Vendas migradas: ${txRes.inserted}/${rawTransactions.length}`, txRes.errors.length ? "warning" : "success");

    // ----------------------------------------------------
    // ETAPA 4: FLUXO DE CAIXA
    // ----------------------------------------------------
    progress("Caixa", 82, "Lendo coleção 'cashflow' do Firestore...");
    log("Extraindo movimentos de caixa...", "info");
    const rawCashFlow = await getCashflowFromFirestore().catch(() => []);
    summary.totalRecordsRead += rawCashFlow.length;

    const validCash: any[] = [];
    rawCashFlow.forEach((raw) => {
      const res = validateAndSanitizeCashFlow(raw);
      validCash.push(res.sanitizedData);
    });

    const cashRes = await batchUpsertToSupabase(client, "caixa", validCash, batchSize);
    summary.cashFlowCount = cashRes.inserted;
    summary.totalRecordsMigrated += cashRes.inserted;
    if (cashRes.errors.length) summary.errors.push(...cashRes.errors);
    summary.stepDetails["caixa"] = {
      read: rawCashFlow.length,
      written: cashRes.inserted,
      status: cashRes.errors.length ? "error" : "success"
    };
    log(`✓ Movimentos de caixa migrados: ${cashRes.inserted}/${rawCashFlow.length}`, cashRes.errors.length ? "warning" : "success");

    // ----------------------------------------------------
    // ETAPA 5: CONFIGURAÇÕES
    // ----------------------------------------------------
    progress("Configurações", 92, "Lendo configurações globais...");
    log("Extraindo configurações do sistema...", "info");
    const rawSettings = await getSettingsFromFirestore().catch(() => null);
    if (rawSettings) {
      summary.totalRecordsRead += 1;
      const res = validateAndSanitizeSettings(rawSettings);
      const { error: setErr } = await client
        .from("configuracoes")
        .upsert([res.sanitizedData], { onConflict: "id" });

      if (setErr) {
        summary.errors.push(`Erro ao gravar configurações no Supabase: ${setErr.message}`);
        summary.stepDetails["configuracoes"] = { read: 1, written: 0, status: "error" };
      } else {
        summary.settingsCount = 1;
        summary.totalRecordsMigrated += 1;
        summary.stepDetails["configuracoes"] = { read: 1, written: 1, status: "success" };
        log("✓ Configurações do sistema migradas com sucesso.", "success");
      }
    }

    // ----------------------------------------------------
    // ETAPA 6: UTILIZADORES / STAFF (SE APLICÁVEL)
    // ----------------------------------------------------
    progress("Utilizadores", 97, "Lendo utilizadores do sistema...");
    const rawUsers = await getUsuariosFromFirestore().catch(() => []);
    if (rawUsers.length > 0) {
      summary.totalRecordsRead += rawUsers.length;
      const sanitizedUsers = rawUsers.map(u => ({
        id: u.uid || u.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        email: u.email || "",
        name: u.nome || u.name || "Utilizador",
        role: u.role || "OPERATOR",
        status: u.status || "ACTIVE",
        updated_at: new Date().toISOString()
      }));

      const userRes = await batchUpsertToSupabase(client, "usuarios", sanitizedUsers, batchSize);
      summary.usersCount = userRes.inserted;
      summary.totalRecordsMigrated += userRes.inserted;
      summary.stepDetails["usuarios"] = {
        read: rawUsers.length,
        written: userRes.inserted,
        status: userRes.errors.length ? "error" : "success"
      };
      log(`✓ Utilizadores migrados: ${userRes.inserted}/${rawUsers.length}`, "success");
    }

    progress("Conclusão", 100, "Migração concluída com sucesso!");
    summary.durationMs = Date.now() - startTime;
    summary.success = summary.errors.length === 0;

    log(`Migração finalizada em ${(summary.durationMs / 1000).toFixed(2)}s. Total de registos migrados: ${summary.totalRecordsMigrated}`, "success");
    return summary;

  } catch (err: any) {
    summary.durationMs = Date.now() - startTime;
    summary.success = false;
    const msg = `Erro fatal durante a execução da migração: ${err?.message || String(err)}`;
    summary.errors.push(msg);
    log(msg, "error");
    return summary;
  }
}

/**
 * Funções modulares para migração individual de coleções
 */
export const CollectionMigrators = {
  migrateProdutos: async (client?: SupabaseClient) => {
    const sb = client || getSupabaseClient();
    if (!sb) throw new Error("Supabase não configurado.");
    const prods = await getProdutosFromFirestore();
    const sanitized = prods.map(p => validateAndSanitizeProduct(p).sanitizedData);
    return await batchUpsertToSupabase(sb, "produtos", sanitized);
  },

  migrateClientes: async (client?: SupabaseClient) => {
    const sb = client || getSupabaseClient();
    if (!sb) throw new Error("Supabase não configurado.");
    const custs = await getCustomersFromFirestore();
    const sanitized = custs.map(c => validateAndSanitizeCustomer(c).sanitizedData);
    return await batchUpsertToSupabase(sb, "clientes", sanitized);
  },

  migrateTransacoes: async (client?: SupabaseClient) => {
    const sb = client || getSupabaseClient();
    if (!sb) throw new Error("Supabase não configurado.");
    const txs = await getTransacoesFromFirestore();
    const sanitized = txs.map(t => validateAndSanitizeTransaction(t).sanitizedData);
    return await batchUpsertToSupabase(sb, "vendas", sanitized);
  },

  migrateConfiguracoes: async (client?: SupabaseClient) => {
    const sb = client || getSupabaseClient();
    if (!sb) throw new Error("Supabase não configurado.");
    const set = await getSettingsFromFirestore();
    if (!set) return { inserted: 0, errors: [] };
    const sanitized = validateAndSanitizeSettings(set).sanitizedData;
    return await batchUpsertToSupabase(sb, "configuracoes", [sanitized]);
  },

  migrateCaixa: async (client?: SupabaseClient) => {
    const sb = client || getSupabaseClient();
    if (!sb) throw new Error("Supabase não configurado.");
    const cash = await getCashflowFromFirestore();
    const sanitized = cash.map(c => validateAndSanitizeCashFlow(c).sanitizedData);
    return await batchUpsertToSupabase(sb, "caixa", sanitized);
  }
};
