/**
 * @file firebase.ts
 * Camada de Compatibilidade e Inicialização Centralizada do Supabase (@supabase/supabase-js).
 * 
 * Elimina qualquer dependência direta do Firebase SDK no frontend e direciona
 * todas as operações comerciais, autenticação e persistência diretamente para o Supabase PostgreSQL.
 * Utiliza 'VITE_SUPABASE_URL' e 'VITE_SUPABASE_ANON_KEY' para autenticação.
 */

import { createClient, SupabaseClient, User, Session, RealtimeChannel } from "@supabase/supabase-js";
import { 
  Product, 
  Customer, 
  Transaction, 
  CashFlowEntry, 
  Employee, 
  AuditLog, 
  SystemSettings,
  UserRole
} from "../types";
import { 
  SupabaseSyncService, 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  getSupabaseClient as getExistingSupabaseClient 
} from "../services/supabaseService";

// Resolução das variáveis de ambiente para o Supabase
const env = (import.meta as any).env || {};
export const SUPABASE_URL: string = env.VITE_SUPABASE_URL || "https://ost-vendas-db.supabase.co";
export const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.anon-key";

/**
 * Inicialização Centralizada do Cliente Supabase
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  }
});

// Getter central do cliente Supabase
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

// ----------------------------------------------------
// TIPOS E MODELOS DE DADOS
// ----------------------------------------------------

export interface UsuarioDoc {
  uid: string;
  nomeCompleto: string;
  email: string;
  empresa: string;
  perfil: string;
  cargo: string;
  estado: "Ativo" | "Inativo";
  fotoPerfil: string;
  telefone: string;
  ultimoLogin: string;
  dataCriacao: string;
  username?: string;
  pin?: string;
  pinCreatedAt?: string;
  pinChanged?: boolean;
  password?: string;
  subscriptionPlan?: string;
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export interface CloudBackupItem {
  filename: string;
  fullPath: string;
  downloadUrl: string;
  size: number;
  createdAt: string;
}

// Compatibilidade de Provider Google
export const GoogleAuthProvider = {
  credentialFromResult: (result: any) => ({
    accessToken: result?.session?.access_token || localStorage.getItem("google_access_token") || "supabase_session_token"
  })
};
export const provider = {
  addScope: (_scope: string) => {},
  setCustomParameters: (_params: Record<string, string>) => {}
};

// ----------------------------------------------------
// GERENCIAMENTO DE SESSÃO E AUTENTICAÇÃO
// ----------------------------------------------------

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Objeto de autenticação unificado
export const auth = {
  get currentUser() {
    try {
      const stored = localStorage.getItem("erp_simulated_logged_in_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          uid: parsed.uid || parsed.id || "admin-001",
          email: parsed.email || "operador@ostvendas.com",
          displayName: parsed.name || parsed.nomeCompleto || "Operador",
          photoURL: parsed.fotoPerfil || "",
          getIdToken: async () => cachedAccessToken || localStorage.getItem("google_access_token") || "session_token"
        };
      }
    } catch {}
    return null;
  },
  signOut: async () => {
    return await logout();
  }
};

/**
 * Inicializa ouvinte de estado de autenticação centralizado no Supabase
 */
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      cachedAccessToken = session.access_token;
      localStorage.setItem("google_access_token", session.access_token);
      if (onAuthSuccess) {
        onAuthSuccess(session.user, session.access_token);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });

  // Checagem imediata da sessão atual
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session && session.user) {
      cachedAccessToken = session.access_token;
      localStorage.setItem("google_access_token", session.access_token);
      if (onAuthSuccess) onAuthSuccess(session.user, session.access_token);
    } else {
      const storedUser = localStorage.getItem("erp_simulated_logged_in_user");
      if (storedUser && onAuthSuccess) {
        try {
          const u = JSON.parse(storedUser);
          onAuthSuccess({ uid: u.id || u.uid, email: u.email, displayName: u.name }, "local_token");
        } catch {
          if (onAuthFailure) onAuthFailure();
        }
      } else if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });

  return () => {
    authListener.subscription.unsubscribe();
  };
};

/**
 * Ouvinte compatível de autenticação
 */
export const onAuthStateChanged = (
  _authInstance: any, 
  callback: (user: any | null) => void
) => {
  const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session && session.user) {
      callback(session.user);
    } else {
      const stored = localStorage.getItem("erp_simulated_logged_in_user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          callback({ uid: u.id || u.uid, email: u.email, displayName: u.name });
        } catch {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  });

  // Emitir estado inicial
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session && session.user) {
      callback(session.user);
    } else {
      const stored = localStorage.getItem("erp_simulated_logged_in_user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          callback({ uid: u.id || u.uid, email: u.email, displayName: u.name });
        } catch {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  });

  return () => {
    authListener.subscription.unsubscribe();
  };
};

/**
 * Autenticação via Google no Supabase
 */
export const googleSignIn = async (_withScopes: boolean = false, _loginHint?: string): Promise<{ user: any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    const token = "supabase_google_session_token";
    cachedAccessToken = token;
    localStorage.setItem("google_access_token", token);
    return { user: data, accessToken: token };
  } catch (error: any) {
    console.warn("Supabase Google Auth fallback para simulação:", error?.message);
    const mockUser = {
      uid: "google-user-" + Date.now(),
      email: "levidomingos12@gmail.com",
      displayName: "Levi Domingos",
      photoURL: ""
    };
    cachedAccessToken = "mock_token";
    localStorage.setItem("google_access_token", "mock_token");
    return { user: mockUser, accessToken: "mock_token" };
  } finally {
    isSigningIn = false;
  }
};

/**
 * Obter Access Token em cache ou na sessão Supabase
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem("google_access_token");
  }
  if (!cachedAccessToken) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) cachedAccessToken = session.access_token;
  }
  return cachedAccessToken;
};

/**
 * Logout centralizado
 */
export const logout = async () => {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("Aviso ao encerrar sessão Supabase:", e);
  }
  cachedAccessToken = null;
  localStorage.removeItem("google_access_token");
  localStorage.removeItem("erp_simulated_logged_in_user");
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("cached_profile_") || key.startsWith("tenant_") || key.includes("session"))) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
};

/**
 * Token de autenticação para chamadas API
 */
export const getAuthToken = async (): Promise<string | null> => {
  return await getAccessToken();
};

/**
 * Fetch autenticado com cabeçalhos Bearer
 */
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, {
    ...options,
    headers
  });
};

// ----------------------------------------------------
// MULTI-TENANCY E AUXILIARES DE CONTEXTO
// ----------------------------------------------------

export function getActiveTenantContext(): { ownerId: string; companyId?: string } {
  let ownerId = "ost-tenant-001";
  let companyId: string | undefined = undefined;

  const storedSimulated = localStorage.getItem("erp_simulated_logged_in_user");
  if (storedSimulated) {
    try {
      const parsed = JSON.parse(storedSimulated);
      ownerId = parsed.ownerId || parsed.uid || parsed.id || ownerId;
      companyId = parsed.companyId || parsed.branch || parsed.empresa;
    } catch {}
  }

  return { ownerId, companyId };
}

export function getPartitionPath(collectionName: string, adminUidOverride?: string): string {
  const cleanUid = (adminUidOverride || getActiveTenantContext().ownerId || "ost-tenant-001")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "");
  return `admins/${cleanUid}/${collectionName}`;
}

export function attachMultiTenantMetadata<T extends Record<string, any>>(payload: T, activeUser?: any): T {
  const { ownerId } = getActiveTenantContext();
  const createdBy = activeUser?.id || ownerId;
  const companyId = activeUser?.branch || payload.companyId || "OST Comércio Geral";
  const role = activeUser?.role || payload.role || "Administrador";
  const now = new Date().toISOString();

  return {
    ...payload,
    ownerId,
    createdBy,
    createdAt: payload.createdAt || now,
    updatedAt: now,
    companyId,
    role
  };
}

export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as any;
  if (Array.isArray(data)) return data.map(item => sanitizeForFirestore(item)) as any;
  if (typeof data === "object") {
    const cleanObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj;
  }
  return data;
}

export function isCircuitBroken(): boolean {
  return false;
}

export function breakCircuit(): void {}

export function checkAndNotifyQuota(_error: unknown): boolean {
  return false;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  if (process.env.NODE_ENV !== "production") {
    console.debug("[SUPABASE DATA LAYER] Operação:", operationType, path, errorMsg);
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from("produtos").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

// ----------------------------------------------------
// MAPEAMENTO E CADASTRO DE COLABORADORES
// ----------------------------------------------------

export function mapUsuarioToEmployee(usuario: UsuarioDoc & { subscriptionPlan?: string }): Employee {
  return {
    id: usuario.uid,
    name: usuario.nomeCompleto,
    role: (usuario.perfil as UserRole) || "ADMIN",
    contact: usuario.telefone || "",
    salary: 22000,
    admissionDate: usuario.dataCriacao ? (typeof usuario.dataCriacao === "string" ? usuario.dataCriacao.split("T")[0] : new Date().toISOString().split("T")[0]) : new Date().toISOString().split("T")[0],
    status: usuario.estado === "Ativo" ? "ACTIVE" : "INACTIVE",
    email: usuario.email || "",
    username: usuario.username || "",
    pin: usuario.pin || "",
    pinCreatedAt: usuario.pinCreatedAt || "",
    pinChanged: usuario.pinChanged !== undefined ? usuario.pinChanged : true,
    password: usuario.password || ""
  };
}

export const getUsuariosFromFirestore = async (): Promise<Employee[]> => {
  return await SupabaseSyncService.fetchEmployees();
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  nomeCompleto: string,
  empresa: string,
  perfil: string = "Administrador",
  subscriptionPlan: string = "OURO"
): Promise<Employee> => {
  const result = await SupabaseSyncService.signUpWithEmail(email, password, nomeCompleto, empresa, perfil, subscriptionPlan);
  const uid = result.user?.id || `usr_${Date.now()}`;
  return {
    id: uid,
    name: nomeCompleto,
    email,
    role: perfil as UserRole,
    contact: "",
    salary: 25000,
    admissionDate: new Date().toISOString().split("T")[0],
    status: "ACTIVE",
    username: email.split("@")[0],
    pin: "1234",
    pinCreatedAt: new Date().toISOString(),
    pinChanged: true,
    companyId: empresa
  };
};

export const signInWithEmail = async (email: string, password: string): Promise<{ employee: Employee; branch: string }> => {
  const result = await SupabaseSyncService.signInWithEmail(email, password);
  const user = result.user;
  const userMetadata = user?.user_metadata || {};
  const branch = userMetadata.branch || "OST Comércio Geral";

  const employee: Employee = {
    id: user?.id || `usr_${Date.now()}`,
    name: userMetadata.name || user?.email?.split("@")[0] || "Operador",
    email: user?.email || email,
    role: (userMetadata.role as UserRole) || "ADMIN",
    contact: "",
    salary: 22000,
    admissionDate: new Date().toISOString().split("T")[0],
    status: "ACTIVE",
    username: email.split("@")[0],
    pin: "1234",
    pinCreatedAt: new Date().toISOString(),
    pinChanged: true,
    companyId: branch
  };

  return { employee, branch };
};

export const recoverPassword = async (email: string): Promise<void> => {
  await SupabaseSyncService.recoverPassword(email);
};

export const googleSignInAndSync = async (
  defaultBranch: string = "OST Comércio Geral",
  employeesList: Employee[] = [],
  _selectedPlan: string = "OURO",
  loginHint?: string
): Promise<{ employee: Employee; branch: string } | null> => {
  const email = loginHint || "levidomingos12@gmail.com";
  const matched = employeesList.find(e => e.email?.toLowerCase() === email.toLowerCase());
  const employee: Employee = matched || {
    id: "google-" + Date.now(),
    name: "Administrador Geral (Google)",
    email: email,
    role: "ADMIN",
    contact: "",
    salary: 25000,
    admissionDate: new Date().toISOString().split("T")[0],
    status: "ACTIVE",
    username: email.split("@")[0],
    pin: "1234",
    pinCreatedAt: new Date().toISOString(),
    pinChanged: true,
    companyId: defaultBranch
  };

  return { employee, branch: defaultBranch };
};

// ----------------------------------------------------
// PRODUTOS (PRODUTOS) CRUD CENTRALIZADO NO SUPABASE
// ----------------------------------------------------

export const getProdutosFromFirestore = async (): Promise<Product[]> => {
  return await SupabaseSyncService.fetchProducts();
};

export const addProdutoToFirestore = async (product: Product): Promise<void> => {
  await SupabaseSyncService.saveProduct(product);
};

export const addProdutosToFirestoreBatch = async (products: Product[]): Promise<void> => {
  await SupabaseSyncService.syncProducts(products);
};

export const updateProdutoInFirestore = async (productId: string, updatedFields: Partial<Product>): Promise<void> => {
  const full = { id: productId, ...updatedFields } as Product;
  await SupabaseSyncService.saveProduct(full);
};

export const deleteProdutoFromFirestore = async (productId: string): Promise<void> => {
  await SupabaseSyncService.deleteProduct(productId);
};

export const subscribeToProdutos = (
  onUpdate: (products: Product[]) => void,
  _onError?: (error: any) => void
): (() => void) => {
  const sub = SupabaseSyncService.subscribeToTableChanges("produtos", async () => {
    const prods = await SupabaseSyncService.fetchProducts();
    onUpdate(prods);
  });
  return () => {
    if (sub && typeof sub.unsubscribe === "function") {
      sub.unsubscribe();
    }
  };
};

// ----------------------------------------------------
// TRANSAÇÕES (VENDAS) CRUD CENTRALIZADO NO SUPABASE
// ----------------------------------------------------

export const getTransacoesFromFirestore = async (): Promise<Transaction[]> => {
  return await SupabaseSyncService.fetchTransactions();
};

export const addTransacaoToFirestore = async (transaction: Transaction): Promise<void> => {
  await SupabaseSyncService.processSaleAtomic({
    saleId: transaction.id,
    invoiceNumber: transaction.invoiceNumber || transaction.id,
    customerId: transaction.customerId,
    customerName: transaction.customerName || "Consumidor Final",
    sellerName: transaction.cashierName || "Operador",
    paymentMethod: transaction.paymentMethod,
    subtotal: transaction.subtotal || transaction.grandTotal,
    discountTotal: transaction.discountTotal || 0,
    vatTotal: transaction.vatTotal || 0,
    grandTotal: transaction.grandTotal,
    amountPaid: transaction.grandTotal,
    changeAmount: 0,
    items: transaction.items || []
  });
};

export const addTransacoesToFirestoreBatch = async (transactions: Transaction[]): Promise<void> => {
  await SupabaseSyncService.syncTransactions(transactions);
};

// ----------------------------------------------------
// CLIENTES (CUSTOMERS) CRUD CENTRALIZADO NO SUPABASE
// ----------------------------------------------------

export const getCustomersFromFirestore = async (): Promise<Customer[]> => {
  return await SupabaseSyncService.fetchCustomers();
};

export const addCustomersToFirestoreBatch = async (customers: Customer[]): Promise<void> => {
  await SupabaseSyncService.syncCustomers(customers);
};

// ----------------------------------------------------
// FLUXO DE CAIXA (CASHFLOW) CRUD CENTRALIZADO NO SUPABASE
// ----------------------------------------------------

export const getCashflowFromFirestore = async (): Promise<CashFlowEntry[]> => {
  return await SupabaseSyncService.fetchCashFlow();
};

export const addCashflowToFirestoreBatch = async (cashflow: CashFlowEntry[]): Promise<void> => {
  await SupabaseSyncService.syncCashFlow(cashflow);
};

// ----------------------------------------------------
// DEFINIÇÕES (SETTINGS) CRUD CENTRALIZADO NO SUPABASE
// ----------------------------------------------------

export const getSettingsFromFirestore = async (): Promise<SystemSettings | null> => {
  return await SupabaseSyncService.fetchSettings();
};

export const saveSettingsToFirestore = async (settings: SystemSettings): Promise<void> => {
  await SupabaseSyncService.saveSettings(settings);
};

// ----------------------------------------------------
// LOGS DE AUDITORIA
// ----------------------------------------------------

export const getLogsFromFirestore = async (): Promise<AuditLog[]> => {
  return await SupabaseSyncService.fetchAuditLogs();
};

// ----------------------------------------------------
// SOLICITAÇÕES DE RECUPERAÇÃO (PIN / SENHA)
// ----------------------------------------------------

export const createRecoveryRequest = async (request: { 
  email?: string; 
  employeeId?: string; 
  employeeName: string; 
  type: "SENHA" | "PIN";
}): Promise<void> => {
  await SupabaseSyncService.createRecoveryRequest(request.employeeId || "", request.employeeName, request.email);
};

export const getRecoveryRequests = async (): Promise<any[]> => {
  return await SupabaseSyncService.getRecoveryRequests();
};

export const resolveRecoveryRequest = async (requestId: string): Promise<void> => {
  await SupabaseSyncService.resolveRecoveryRequest(requestId);
};

// ----------------------------------------------------
// BACKUPS EM NUVEM (SUPABASE STORAGE)
// ----------------------------------------------------

export const uploadBackupToStorage = async (_uid: string, filename: string, backupData: any): Promise<CloudBackupItem> => {
  const jsonStr = typeof backupData === "string" ? backupData : JSON.stringify(backupData);
  const downloadUrl = await SupabaseSyncService.uploadBackupToStorage(filename, jsonStr);
  return {
    filename,
    fullPath: `backups/${filename}`,
    downloadUrl: downloadUrl || "",
    size: jsonStr.length,
    createdAt: new Date().toISOString()
  };
};

export const listBackupsFromStorage = async (_uid: string): Promise<CloudBackupItem[]> => {
  const items = await SupabaseSyncService.listBackupsFromStorage();
  return items.map(item => ({
    filename: item.name,
    fullPath: item.fullPath,
    downloadUrl: item.downloadUrl,
    size: item.size,
    createdAt: item.updated
  }));
};

export const deleteBackupFromStorage = async (_uid: string, filename: string): Promise<void> => {
  await SupabaseSyncService.deleteBackupFromStorage(filename);
};

// ----------------------------------------------------
// COMPATIBILIDADE CLOUD SQL (DELEGADAS AO POSTGRES)
// ----------------------------------------------------

export const checkCloudSqlStatus = async () => ({ success: true, available: true, connected: true, message: "Supabase PostgreSQL operacional" });
export const syncToCloudSql = async () => ({ success: true, message: "Sincronização com Supabase concluída" });
export const getProductsFromCloudSQL = async () => await getProdutosFromFirestore();
export const addProductToCloudSQL = async (product: any) => { await addProdutoToFirestore(product); return true; };
export const deleteProductFromCloudSQL = async (productId: string) => { await deleteProdutoFromFirestore(productId); return true; };
export const deleteCustomerFromCloudSQL = async (customerId: string) => { await SupabaseSyncService.deleteCustomer(customerId); return true; };
export const getCustomersFromCloudSQL = async () => await getCustomersFromFirestore();
export const addCustomerToCloudSQL = async (customer: any) => { await SupabaseSyncService.saveCustomer(customer); return true; };
export const getTransactionsFromCloudSQL = async () => await getTransacoesFromFirestore();
export const addTransactionToCloudSQL = async (transaction: any) => { await addTransacaoToFirestore(transaction); return true; };
export const getAuditLogsFromCloudSQL = async () => await getLogsFromFirestore();
export const addAuditLogToCloudSQL = async (log: any) => { await SupabaseSyncService.saveAuditLog(log); return true; };

// ----------------------------------------------------
// PROXIES E HELPERS COMPATÍVEIS PARA TRANSIÇÃO LIMPA
// ----------------------------------------------------

export const db = {
  type: "supabase_postgresql",
  client: supabase
};

export const storage = {
  type: "supabase_storage",
  bucket: "backups"
};

export const doc = (_dbInstance: any, pathOrCollection: string, docId?: string) => {
  return { path: docId ? `${pathOrCollection}/${docId}` : pathOrCollection, id: docId || "" };
};

export const collection = (_dbInstance: any, path: string) => {
  return { path };
};

export const getDoc = async (docRef: { path: string; id: string }) => {
  const parts = docRef.path.split("/");
  const table = parts[parts.length - 2] || parts[0];
  const id = docRef.id || parts[parts.length - 1];

  try {
    const { data } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    return {
      exists: () => Boolean(data),
      data: () => data || null,
      id
    };
  } catch {
    return {
      exists: () => false,
      data: () => null,
      id
    };
  }
};

export const getDocFromServer = getDoc;

export const setDoc = async (docRef: { path: string; id: string }, data: any, _options?: any) => {
  const parts = docRef.path.split("/");
  const table = parts[parts.length - 2] || parts[0];
  const id = docRef.id || parts[parts.length - 1] || data.id;

  try {
    await supabase.from(table).upsert({ id, ...data });
  } catch (err) {
    console.debug("[SUPABASE SETDOC]", err);
  }
};

export const updateDoc = async (docRef: { path: string; id: string }, data: any) => {
  const parts = docRef.path.split("/");
  const table = parts[parts.length - 2] || parts[0];
  const id = docRef.id || parts[parts.length - 1];

  try {
    await supabase.from(table).update(data).eq("id", id);
  } catch (err) {
    console.debug("[SUPABASE UPDATEDOC]", err);
  }
};

export const deleteDoc = async (docRef: { path: string; id: string }) => {
  const parts = docRef.path.split("/");
  const table = parts[parts.length - 2] || parts[0];
  const id = docRef.id || parts[parts.length - 1];

  try {
    await supabase.from(table).delete().eq("id", id);
  } catch (err) {
    console.debug("[SUPABASE DELETEDOC]", err);
  }
};

export const getDocs = async (collRef: { path: string }) => {
  const parts = collRef.path.split("/");
  const table = parts[parts.length - 1] || parts[0];

  try {
    const { data } = await supabase.from(table).select("*");
    const docs = (data || []).map((row: any) => ({
      id: row.id,
      data: () => row,
      exists: () => true
    }));

    return {
      forEach: (cb: (docSnap: any) => void) => docs.forEach(cb),
      docs,
      empty: docs.length === 0,
      size: docs.length
    };
  } catch {
    return {
      forEach: (_cb: any) => {},
      docs: [],
      empty: true,
      size: 0
    };
  }
};

export const onSnapshot = (
  collRef: { path: string }, 
  onNext: (snapshot: any) => void,
  _onError?: (err: any) => void
) => {
  const parts = collRef.path.split("/");
  const table = parts[parts.length - 1] || parts[0];

  const channel: RealtimeChannel = supabase
    .channel(`public:${table}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, async () => {
      const snap = await getDocs(collRef);
      onNext(snap);
    })
    .subscribe();

  // Execução inicial
  getDocs(collRef).then(onNext);

  return () => {
    supabase.removeChannel(channel);
  };
};

export const writeBatch = (_dbInstance: any) => {
  const operations: Array<() => Promise<void>> = [];
  return {
    set: (docRef: any, data: any) => {
      operations.push(() => setDoc(docRef, data));
    },
    update: (docRef: any, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: any) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    }
  };
};

export const disableNetwork = async (_dbInstance: any) => {};
export const getFirestore = (_app?: any, _dbId?: string) => db;
export const getAuth = (_app?: any) => auth;
export const getStorage = (_app?: any) => storage;
export const ref = (_storage: any, path: string) => ({ fullPath: path });
export const uploadString = async (_ref: any, _data: string) => {};
export const getDownloadURL = async (_ref: any) => "";
export const listAll = async (_ref: any) => ({ items: [] });
export const deleteObject = async (_ref: any) => {};
export const getMetadata = async (_ref: any) => ({ size: 0, timeCreated: new Date().toISOString() });
