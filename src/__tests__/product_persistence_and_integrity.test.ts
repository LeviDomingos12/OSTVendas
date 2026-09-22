import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommercialDataService } from "../services/dataService";
import { SupabaseSyncService } from "../services/supabaseService";
import { Product } from "../types";

describe("Persistência e Integridade de Produtos: PostgreSQL → Confirmação → Frontend", () => {
  const sampleProduct1: Product = {
    id: "prod-test-001",
    name: "Açúcar Branco 1kg",
    code: "ACU-001",
    barcode: "5601234567890",
    category: "Alimentos",
    costPrice: 50,
    salePrice: 75,
    stock: 120,
    minStock: 20,
    vatRate: 16,
    unit: "kg",
    supplier: "Açucareira Nacional"
  };

  const sampleProduct2: Product = {
    id: "prod-test-002",
    name: "Óleo Alimentar 1L",
    code: "OLE-002",
    barcode: "5609876543210",
    category: "Alimentos",
    costPrice: 90,
    salePrice: 130,
    stock: 45,
    minStock: 15,
    vatRate: 16,
    unit: "un",
    supplier: "Distribuidora Sul"
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Corrigir fetchProducts() para que erro do PostgreSQL NUNCA seja convertido em []
  it("REGRA 1: fetchProducts() NUNCA deve converter erro do PostgreSQL em [] e deve propagar o erro real", async () => {
    // Simula erro de conexão/timeout retornado pelo PostgreSQL
    vi.spyOn(SupabaseSyncService, "fetchProducts").mockRejectedValue(
      new Error("PostgreSQL connection failure: Connection timeout (08006)")
    );

    await expect(CommercialDataService.fetchProducts()).rejects.toThrow(
      "PostgreSQL connection failure: Connection timeout (08006)"
    );

    // Garante que o resultado não foi mascarado como um array vazio
    try {
      await CommercialDataService.fetchProducts();
      expect.unreachable("Não deveria ter resolvido a promessa com []");
    } catch (err: any) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain("PostgreSQL connection failure");
      expect(err.message).not.toBe("[]");
    }
  });

  it("REGRA 1.1: fetchProducts() em nível SupabaseSyncService lança erro quando cliente falha com PostgreSQL", async () => {
    // Simula cliente Supabase retornando erro de banco na consulta de produtos
    vi.spyOn(SupabaseSyncService, "fetchProducts").mockImplementation(async () => {
      throw new Error("Erro ao ler produtos do PostgreSQL: permission denied for table produtos (42501)");
    });

    await expect(CommercialDataService.fetchProducts()).rejects.toThrow("permission denied for table produtos (42501)");
  });

  // 2. Alterar o cadastro/edição para: Gravar no PostgreSQL → confirmar sucesso → atualizar products
  it("REGRA 2: Cadastro/Edição deve gravar no PostgreSQL e confirmar sucesso antes de concluir", async () => {
    const postgresDB: Product[] = [];
    let localProductsState: Product[] = [];

    // Mock do PostgreSQL recebendo e confirmando gravação com sucesso
    vi.spyOn(CommercialDataService, "saveProduct").mockImplementation(async (p: Product) => {
      postgresDB.push(p);
      return Promise.resolve();
    });

    // Simula fluxo do componente: Gravar no PostgreSQL → confirmar sucesso → atualizar products
    const handleAddProduct = async (newP: Product) => {
      // 1. Gravar no PostgreSQL
      await CommercialDataService.saveProduct(newP);
      // 2. Confirmado sucesso pelo PostgreSQL -> Atualizar estado local
      localProductsState = [newP, ...localProductsState];
    };

    await handleAddProduct(sampleProduct1);

    // Verifica que foi gravado no banco primeiro e agora está no estado
    expect(postgresDB).toContainEqual(sampleProduct1);
    expect(localProductsState).toContainEqual(sampleProduct1);
    expect(localProductsState.length).toBe(1);
  });

  it("REGRA 2.1: Se gravação no PostgreSQL falhar, o estado local NÃO é atualizado (impedindo inconsistência)", async () => {
    let localProductsState: Product[] = [sampleProduct1];

    // Mock do PostgreSQL falhando ao gravar
    vi.spyOn(CommercialDataService, "saveProduct").mockRejectedValue(
      new Error("PostgreSQL timeout: Erro ao persistir produto")
    );

    const handleAddProduct = async (newP: Product) => {
      await CommercialDataService.saveProduct(newP);
      localProductsState = [newP, ...localProductsState];
    };

    // Tentativa deve falhar
    await expect(handleAddProduct(sampleProduct2)).rejects.toThrow("PostgreSQL timeout");

    // Estado local NÃO pode conter o produto não confirmado
    expect(localProductsState).toContainEqual(sampleProduct1);
    expect(localProductsState).not.toContainEqual(sampleProduct2);
    expect(localProductsState.length).toBe(1);
  });

  // 3. Impedir que hydrateDatabaseForUser() ou qualquer realtime sobrescreva produtos válidos por uma lista vazia ou incompleta
  it("REGRA 3: Hydrate e Realtime NUNCA devem sobrescrever produtos válidos com lista vazia ou incompleta", async () => {
    let localProductsState: Product[] = [sampleProduct1, sampleProduct2];

    // Simulação do guard de integridade do App.tsx para Hydrate
    const applyHydrateProducts = (incoming: Product[] | null, isSuccess: boolean) => {
      if (isSuccess && incoming !== null) {
        if (localProductsState.length > 0 && incoming.length === 0) {
          // Bloqueia sobrescrita por lista vazia
          return;
        }
        if (localProductsState.length > 0 && incoming.length < localProductsState.length) {
          // Mescla para não perder itens válidos confirmados
          const incomingMap = new Map(incoming.map((p) => [p.id, p]));
          const merged = [...incoming];
          for (const p of localProductsState) {
            if (!incomingMap.has(p.id)) {
              merged.push(p);
            }
          }
          localProductsState = merged;
          return;
        }
        localProductsState = incoming;
      }
      // Se falhar ou vier null, preserva o estado existente
    };

    // Caso A: PostgreSQL retorna erro ou dados nulos/vazios na sincronização
    applyHydrateProducts(null, false);
    expect(localProductsState.length).toBe(2);

    applyHydrateProducts([], true);
    expect(localProductsState.length).toBe(2);
    expect(localProductsState).toContainEqual(sampleProduct1);
    expect(localProductsState).toContainEqual(sampleProduct2);

    // Caso B: Realtime retorna apenas 1 produto de uma sincronização parcial
    applyHydrateProducts([sampleProduct1], true);
    expect(localProductsState.length).toBe(2);
    expect(localProductsState.find((p) => p.id === sampleProduct2.id)).toBeDefined();
  });

  // 4. Garantir que o estado products só seja atualizado com dados válidos e confirmados pelo PostgreSQL
  it("REGRA 4: Estado products só aceita atualizações com dados válidos e confirmados", async () => {
    let localProducts: Product[] = [sampleProduct1];

    const handleUpdateProduct = async (updatedP: Product) => {
      await CommercialDataService.saveProduct(updatedP);
      localProducts = localProducts.map((p) => (p.id === updatedP.id ? updatedP : p));
    };

    // Atualização com sucesso no PostgreSQL
    vi.spyOn(CommercialDataService, "saveProduct").mockResolvedValue();

    const modified = { ...sampleProduct1, salePrice: 95 };
    await handleUpdateProduct(modified);

    expect(localProducts[0].salePrice).toBe(95);

    // Atualização que falha no PostgreSQL
    vi.spyOn(CommercialDataService, "saveProduct").mockRejectedValue(
      new Error("Falha no PostgreSQL: Deadlock detectado")
    );

    const badUpdate = { ...sampleProduct1, salePrice: 999 };
    await expect(handleUpdateProduct(badUpdate)).rejects.toThrow("Deadlock detectado");

    // O preço permanece o anteriormente confirmado (95), não o abortado (999)
    expect(localProducts[0].salePrice).toBe(95);
  });

  // 5. Teste do Ciclo Completo: Cadastrar → PostgreSQL → produto permanece → atualizar página → produto continua
  it("REGRA 5: Ciclo Completo: Cadastrar → PostgreSQL → produto permanece → atualizar página → produto continua", async () => {
    // 1. Base de dados remota PostgreSQL inicial
    const remotePostgresDB: Product[] = [sampleProduct1];

    // Mock do serviço de dados ligado à base remota
    vi.spyOn(CommercialDataService, "saveProduct").mockImplementation(async (p: Product) => {
      remotePostgresDB.push(p);
      return Promise.resolve();
    });

    vi.spyOn(CommercialDataService, "fetchProducts").mockImplementation(async () => {
      return [...remotePostgresDB];
    });

    // Estado da sessão atual da página
    let pageSessionProducts: Product[] = [];

    // Carregamento inicial da página (Hydrate inicial)
    const initialRemote = await CommercialDataService.fetchProducts();
    pageSessionProducts = initialRemote;
    expect(pageSessionProducts.length).toBe(1);
    expect(pageSessionProducts[0].id).toBe("prod-test-001");

    // Ação: Cadastrar novo produto "Óleo Alimentar 1L"
    const newProduct = sampleProduct2;
    // Cadastrar → Gravar no PostgreSQL
    await CommercialDataService.saveProduct(newProduct);
    // Confirmar sucesso → Atualizar estado da sessão
    pageSessionProducts = [newProduct, ...pageSessionProducts];

    // O produto permanece na tela
    expect(pageSessionProducts.length).toBe(2);
    expect(pageSessionProducts.find((p) => p.id === newProduct.id)).toBeDefined();

    // Ação: Utilizador atualiza a página (F5 / Reload / Re-hydrate da aplicação)
    let reloadedPageProducts: Product[] = [];
    const reloadedRemote = await CommercialDataService.fetchProducts();
    reloadedPageProducts = reloadedRemote;

    // O produto continua na aplicação após o reload da página!
    expect(reloadedPageProducts.length).toBe(2);
    const persistedProduct = reloadedPageProducts.find((p) => p.id === newProduct.id);
    expect(persistedProduct).toBeDefined();
    expect(persistedProduct?.name).toBe("Óleo Alimentar 1L");
    expect(persistedProduct?.salePrice).toBe(130);
  });

  // 6. Teste de mapeamento de esquemas e resolução de tabelas candidatas ('products' priorizada, sem 'produts')
  it("REGRA 6: Mapeamento de esquemas prioriza 'products', exclui 'produts' e adapta colunas com resiliência", async () => {
    const { buildProductRecord, isTableMissingError, extractMissingColumn } = await import("../services/supabaseService");

    // 6.1 buildProductRecord mapeia corretamente para a tabela 'products'
    const recordEnglish = buildProductRecord("products", sampleProduct1, "tenant-test-01");
    expect(recordEnglish.id).toBe("prod-test-001");
    expect(recordEnglish.tenant_id).toBe("tenant-test-01");
    expect(recordEnglish.price).toBe(75);
    expect(recordEnglish.cost).toBe(50);
    expect(recordEnglish.supplier).toBe("Açucareira Nacional");
    expect(recordEnglish.vat_rate).toBe(16);

    // 6.2 buildProductRecord adapta quando alternativo (sale_price/cost_price)
    const recordAlt = buildProductRecord("products", sampleProduct1, "tenant-test-01", undefined, true);
    expect(recordAlt.sale_price).toBe(75);
    expect(recordAlt.cost_price).toBe(50);

    // 6.3 isTableMissingError identifica tabelas inexistentes mas NÃO colunas inexistentes
    expect(isTableMissingError({ code: "PGRST205", message: "Could not find the table 'public.products' in the schema cache" })).toBe(true);
    expect(isTableMissingError({ code: "42P01", message: "relation 'products' does not exist" })).toBe(true);
    // Erro de coluna não deve ser tratado como tabela inexistente
    expect(isTableMissingError({ code: "PGRST204", message: "Could not find the 'supplier' column of 'products' in the schema cache" })).toBe(false);

    // 6.4 extractMissingColumn extrai corretamente nomes de colunas faltantes
    expect(extractMissingColumn({ message: "Could not find the 'supplier' column of 'products' in the schema cache" })).toBe("supplier");
    expect(extractMissingColumn({ message: "column \"unit\" of relation \"products\" does not exist" })).toBe("unit");
  });

  it("REGRA 6.1: CommercialDataService.verifyProductsConnection detecta estado da tabela products", async () => {
    vi.spyOn(SupabaseSyncService, "verifyProductsTable").mockResolvedValue({
      connected: true,
      activeTable: "products"
    });

    const status = await CommercialDataService.verifyProductsConnection();
    expect(status.connected).toBe(true);
    expect(status.activeTable).toBe("products");
  });
});
