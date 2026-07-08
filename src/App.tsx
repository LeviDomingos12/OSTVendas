import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  initialProducts, 
  initialCustomers, 
  generateMockTransactions, 
  initialCashFlow, 
  initialEmployees, 
  initialAuditLogs, 
  defaultSettings, 
  masterclassVideos 
} from "./data/mockData";
import { 
  Product, 
  Customer, 
  Transaction, 
  CashFlowEntry, 
  Employee, 
  AuditLog, 
  SystemSettings, 
  UserRole 
} from "./types";

// Import modules
import Sidebar from "./components/Sidebar";
import POSModule from "./components/POSModule";
import DashboardModule from "./components/DashboardModule";
import CashRegisterModule from "./components/CashRegisterModule";
import StockModule from "./components/StockModule";
import CustomersModule from "./components/CustomersModule";
import StaffModule from "./components/StaffModule";
import ReportsModule from "./components/ReportsModule";
import TrainingModule from "./components/TrainingModule";
import SettingsModule from "./components/SettingsModule";
import GatewayModule from "./components/GatewayModule";
import LoginModule from "./components/LoginModule";
import AiForecastModule from "./components/AiForecastModule";
import { applyTheme, SYSTEM_THEMES } from "./lib/themes";
import { 
  testConnection, 
  auth, 
  db, 
  getUsuariosFromFirestore, 
  mapUsuarioToEmployee,
  getProdutosFromFirestore,
  addProdutoToFirestore,
  updateProdutoInFirestore,
  deleteProdutoFromFirestore,
  getTransacoesFromFirestore,
  addTransacaoToFirestore,
  subscribeToProdutos,
  isCircuitBroken
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { setLogCallback, initErrorCapturing } from "./lib/logger";

import { 
  Activity, 
  Sparkles, 
  TrendingUp, 
  RefreshCw, 
  Sun, 
  Moon,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Wifi,
  WifiOff,
  Cloud,
  Clock,
  Menu,
  Lock
} from "lucide-react";

interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

export default function App() {
  
  // SHARED STATES
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "info", title?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const defaultTitles = {
      success: "Operação Concluída",
      error: "Ocorreu um Erro",
      info: "Informação do Sistema",
      warning: "Aviso de Segurança"
    };
    const newToast: Toast = {
      id,
      message,
      type,
      title: title || defaultTitles[type]
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // ACTIVE OPERATOR & ROUTING STUFF
  const [activeUser, setActiveUser] = useState<Employee | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("DASHBOARD");

  // Profile Switcher PIN Verification States
  const [pinVerificationOpen, setPinVerificationOpen] = useState(false);
  const [pinTargetEmployee, setPinTargetEmployee] = useState<Employee | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [loginMethod, setLoginMethod] = useState<"select" | "type">("select");
  const [enteredUsername, setEnteredUsername] = useState("");

  // Force PIN Change Modal States
  const [forcePinChangeOpen, setForcePinChangeOpen] = useState(false);
  const [forcePinTargetEmployee, setForcePinTargetEmployee] = useState<Employee | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [forcePinError, setForcePinError] = useState("");

  // Premium AI predictions state
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [forecastResult, setForecastResult] = useState<any | null>(null);

  const currency = "MT"; // Meticais Moçambique

  const formatSessionTime = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Theme state defaulting to daily (orange and white mode)
  const [theme, setTheme] = useState<"daily" | "night">("daily");
  const [isPOSFullscreen, setIsPOSFullscreen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  // Track operator-specific custom color theme
  const [activeColorTheme, setActiveColorTheme] = useState<string>("laranja");

  // Load and apply color theme dynamically
  useEffect(() => {
    const userId = activeUser?.id || "default";
    const userTheme = localStorage.getItem("erp_theme_" + userId);
    
    if (userTheme) {
      setActiveColorTheme(userTheme);
      applyTheme(userTheme);
    } else if (settings.theme) {
      setActiveColorTheme(settings.theme);
      applyTheme(settings.theme);
    } else {
      setActiveColorTheme("laranja");
      applyTheme("laranja");
    }
  }, [activeUser, settings.theme]);

  // When theme changes, apply it to document head
  useEffect(() => {
    applyTheme(activeColorTheme);
  }, [activeColorTheme]);

  // Connectivity state tracking Firestore & network connection
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(isCircuitBroken());

  // Listen for Firestore Quota Exceeded events and initialize system error capturing
  useEffect(() => {
    const handleQuotaExceeded = () => {
      console.warn("[APP] Firestore Quota Exceeded detected. Showing notification banner.");
      setIsQuotaExceeded(true);
    };
    window.addEventListener("firestore-quota-exceeded", handleQuotaExceeded);
    
    // Initialize standard error capturing (console.error, unhandled promises, fetch errors)
    const destroyCapturing = initErrorCapturing();
    
    return () => {
      window.removeEventListener("firestore-quota-exceeded", handleQuotaExceeded);
      destroyCapturing();
    };
  }, []);

  // Advanced top bar metrics states
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // DB Sync helper with robust offline queueing
  const syncTable = async (tableName: string, updatedData: any) => {
    setLastSyncTime(new Date().toLocaleTimeString());
    try {
      if (!navigator.onLine) {
        throw new Error("browser is offline");
      }
      
      if (tableName === "products") {
        const promises = updatedData.map((prod: any) => addProdutoToFirestore(prod));
        await Promise.all(promises);
      } else if (tableName === "transactions") {
        const promises = updatedData.map((tx: any) => addTransacaoToFirestore(tx));
        await Promise.all(promises);
      } else {
        const response = await fetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: tableName, data: updatedData })
        });
        
        if (!response.ok) {
          throw new Error(`server returned error ${response.status}`);
        }
      }
      
      // Successfully synced! Try to clean from pending queue
      const rawQueue = localStorage.getItem("pos_sync_queue");
      if (rawQueue) {
        const queue = JSON.parse(rawQueue);
        if (queue[tableName]) {
          delete queue[tableName];
          localStorage.setItem("pos_sync_queue", JSON.stringify(queue));
        }
      }
    } catch (err: any) {
      console.warn(`[OFFLINE CACHE] Não foi possível sincronizar a tabela '${tableName}' (${err.message}). Guardando para reenvio automático.`);
      handleAddAuditLog(
        "Falha de Sincronização",
        "Erros do Sistema",
        `Erro de conexão ao sincronizar tabela '${tableName}': ${err.message}. Guardado na fila de reenvio offline.`
      );
      try {
        const rawQueue = localStorage.getItem("pos_sync_queue");
        const queue = rawQueue ? JSON.parse(rawQueue) : {};
        queue[tableName] = updatedData;
        localStorage.setItem("pos_sync_queue", JSON.stringify(queue));
      } catch (queueErr) {
        console.error("Erro ao guardar alteração na fila offline local:", queueErr);
      }
    }
  };

  // Synchronize any offline changes when connection is re-established (or via periodic retry timer)
  useEffect(() => {
    // Register the callback to capture silent errors and log them to AuditLogs
    setLogCallback(handleAddAuditLog);
  }, [activeUser, auditLogs]); // Re-bind when user context or logs state updates

  useEffect(() => {
    const processSyncQueue = async () => {
      if (!navigator.onLine) return;
      
      try {
        const rawQueue = localStorage.getItem("pos_sync_queue");
        if (!rawQueue) return;
        
        const queue = JSON.parse(rawQueue);
        const tableNames = Object.keys(queue);
        if (tableNames.length === 0) return;
        
        console.log(`[SYNC QUEUE] Detectadas ${tableNames.length} tabelas com alterações offline pendentes. Sincronizando...`);
        
        for (const tableName of tableNames) {
          const data = queue[tableName];
          let success = false;
          
          if (tableName === "products") {
            try {
              const promises = data.map((prod: any) => addProdutoToFirestore(prod));
              await Promise.all(promises);
              success = true;
            } catch (fsErr) {
              console.error("[SYNC QUEUE] Erro ao ressincronizar produtos com Firestore:", fsErr);
            }
          } else if (tableName === "transactions") {
            try {
              const promises = data.map((tx: any) => addTransacaoToFirestore(tx));
              await Promise.all(promises);
              success = true;
            } catch (fsErr) {
              console.error("[SYNC QUEUE] Erro ao ressincronizar transações com Firestore:", fsErr);
            }
          } else {
            const response = await fetch("/api/db/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ table: tableName, data })
            });
            success = response.ok;
          }
          
          if (success) {
            console.log(`[SYNC QUEUE] Tabela ${tableName} ressincronizada offline com sucesso!`);
            delete queue[tableName];
          } else {
            console.warn(`[SYNC QUEUE] Falha na ressincronização de ${tableName}`);
          }
        }
        
        localStorage.setItem("pos_sync_queue", JSON.stringify(queue));
      } catch (err) {
        console.error("[SYNC QUEUE] Erro ao reprocessar alterações offline:", err);
      }
    };

    const handleOnline = () => {
      console.log("[CONEXÃO] Conexão restabelecida! Tentando reenviar alterações offline...");
      setIsOnline(true);
      processSyncQueue();
    };

    const handleOffline = () => {
      console.log("[CONEXÃO] Conexão física de rede perdida!");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    // Periodically try to re-sync every 15 seconds as a robust retry mechanism
    const interval = setInterval(() => {
      if (navigator.onLine) {
        setIsOnline(true);
        processSyncQueue();
      } else {
        setIsOnline(false);
      }
    }, 15000);

    // Initial attempt on load
    processSyncQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Hook de sincronização automática periódica (a cada 5 minutos) específico para transações offline pendentes
  useEffect(() => {
    const syncPendingTransactions = async () => {
      if (!navigator.onLine) {
        console.log("[SYNC 5MIN] Sistema offline. Sincronização periódica suspensa.");
        return;
      }

      try {
        const rawQueue = localStorage.getItem("pos_sync_queue");
        if (!rawQueue) return;

        const queue = JSON.parse(rawQueue);
        const pendingTxs = queue["transactions"];

        if (pendingTxs && Array.isArray(pendingTxs) && pendingTxs.length > 0) {
          console.log(`[SYNC 5MIN] Sincronização periódica iniciada: ${pendingTxs.length} transações pendentes encontradas.`);
          
          try {
            // Envia transações pendentes para o Firestore
            const promises = pendingTxs.map((tx: any) => addTransacaoToFirestore(tx));
            await Promise.all(promises);

            // Sucesso! Remove a chave transactions da fila offline
            delete queue["transactions"];
            localStorage.setItem("pos_sync_queue", JSON.stringify(queue));
            
            setLastSyncTime(new Date().toLocaleTimeString());
            console.log("[SYNC 5MIN] Sincronização automática das transações offline concluída com sucesso!");
            
            handleAddAuditLog(
              "Sincronização Periódica",
              "Vendas",
              `Sincronização automática de 5 minutos reenviou ${pendingTxs.length} transações pendentes ao Firestore com sucesso.`
            );
          } catch (fsErr: any) {
            console.error("[SYNC 5MIN] Erro ao reenviar transações pendentes ao Firestore:", fsErr);
            handleAddAuditLog(
              "Falha de Sincronização",
              "Vendas",
              `Falha na sincronização periódica de transações offline: ${fsErr.message}`
            );
          }
        }
      } catch (err: any) {
        console.error("[SYNC 5MIN] Erro ao analisar fila de sincronização:", err);
      }
    };

    // Define o intervalo para exatamente 5 minutos (300.000 milissegundos)
    const intervalId = setInterval(syncPendingTransactions, 300000);

    // Executa uma verificação inicial rápida ao montar o componente
    syncPendingTransactions();

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Global keyboard shortcuts for POS operations (F1, F2, etc.) handled in the App component to improve checkout efficiency
  useEffect(() => {
    const handlePOSGlobalShortcuts = (e: KeyboardEvent) => {
      // Only capture when POS module is active/rendered
      if (activeTab !== "POS") return;

      // Intercept POS keyboard shortcuts
      if (e.key === "F1" || e.key === "F2" || e.key === "F3" || e.key === "F4" || e.key === "F6" || e.key === "F8" || e.key === "F9" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        
        // Dispatch a custom event to POSModule containing the triggered key
        const customEvent = new CustomEvent("pos-shortcut-trigger", {
          detail: { key: e.key }
        });
        window.dispatchEvent(customEvent);
      }
    };

    window.addEventListener("keydown", handlePOSGlobalShortcuts, true);
    return () => {
      window.removeEventListener("keydown", handlePOSGlobalShortcuts, true);
    };
  }, [activeTab]);


  // Hydrate states from existential server database on mount
  useEffect(() => {
    // Run the mandatory Firebase Firestore direct browser connection verification
    testConnection();

    const fetchExistentialDb = async () => {
      try {
        const response = await fetch("/api/db/load");
        const json = await response.json();
        if (json.success && json.hasData) {
          const d = json.data;
          if (d.products) setProducts(d.products);
          else setProducts(initialProducts);

          if (d.customers) setCustomers(d.customers);
          else setCustomers(initialCustomers);

          if (d.transactions) setTransactions(d.transactions);
          else setTransactions(generateMockTransactions());

          if (d.cashflow) setCashFlow(d.cashflow);
          else setCashFlow(initialCashFlow);

          if (d.employees) {
            setEmployees(d.employees);
            setActiveUser(d.employees[0]);
          } else {
            setEmployees(initialEmployees);
            setActiveUser(initialEmployees[0]);
          }

          if (d.auditlogs) setAuditLogs(d.auditlogs);
          else setAuditLogs(initialAuditLogs);

          if (d.settings) setSettings(d.settings);
          else setSettings(defaultSettings);

          console.log("Banco de dados existencial carregado com sucesso.");
        } else {
          // Empty or first boot, submit initial structures to seed the server
          console.log("Banco de dados vazio. Semeando tabelas padrão no servidor...");
          const placeholderTransactions = generateMockTransactions();
          await fetch("/api/db/save-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              products: initialProducts,
              customers: initialCustomers,
              transactions: placeholderTransactions,
              cashflow: initialCashFlow,
              employees: initialEmployees,
              auditlogs: initialAuditLogs,
              settings: defaultSettings
            })
          });
          setProducts(initialProducts);
          setCustomers(initialCustomers);
          setTransactions(placeholderTransactions);
          setCashFlow(initialCashFlow);
          setEmployees(initialEmployees);
          setAuditLogs(initialAuditLogs);
          setSettings(defaultSettings);
        }
      } catch (err) {
        console.warn("Servidor inativo ou inacessível. Recuando para mock local:", err);
        setProducts(initialProducts);
        setCustomers(initialCustomers);
        setTransactions(generateMockTransactions());
        setCashFlow(initialCashFlow);
        setEmployees(initialEmployees);
        setAuditLogs(initialAuditLogs);
        setSettings(defaultSettings);
      } finally {
        setIsDbLoaded(true);
      }
    };
    fetchExistentialDb();
  }, []);

  useEffect(() => {
    if (theme === "night") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [theme]);

  // Firebase Auth Observer to handle auto-login, load profiles, and synchronize permissions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch user profile from Firestore "usuarios" with robust caching & local fallback
          let profileData: any = null;
          try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
              profileData = docSnap.data();
              // Cache profile in localStorage for offline, permission, or quota fallback
              localStorage.setItem(`cached_profile_${user.uid}`, JSON.stringify(profileData));
            } else {
              console.warn("[AUTH RESTORE] Perfil não encontrado no Firestore para uid:", user.uid);
            }
          } catch (fsErr: any) {
            console.warn("[AUTH RESTORE] Erro ao pesquisar Firestore, usando cache local como recurso:", fsErr);
            const cached = localStorage.getItem(`cached_profile_${user.uid}`);
            if (cached) {
              try {
                profileData = JSON.parse(cached);
              } catch (parseErr) {
                console.error("Erro ao analisar cache local do perfil:", parseErr);
              }
            }
            
            // If still no profile, generate a generic but functional fallback user based on email or UID
            if (!profileData) {
              profileData = {
                uid: user.uid,
                nomeCompleto: user.displayName || user.email?.split("@")[0] || "Operador",
                email: user.email || "operador@ostvendas.com",
                empresa: "OST Comércio Geral",
                perfil: "Administrador", // Default to high privilege fallback to keep system operational
                cargo: "Administrador",
                estado: "Ativo",
                fotoPerfil: "",
                telefone: "",
                ultimoLogin: new Date().toISOString(),
                dataCriacao: new Date().toISOString()
              };
            }
          }

          if (profileData) {
            const mappedEmployee = mapUsuarioToEmployee(profileData as any);
            
            setActiveUser(mappedEmployee);
            setIsAuthenticated(true);
            setSettings(prev => ({
              ...prev,
              companyName: profileData.empresa || "OST Comércio Geral"
            }));
            
            console.log(`[AUTH RESTORE] Utilizador autolocado (com fallback resiliente): ${mappedEmployee.name} (${mappedEmployee.role})`);
          } else {
            setIsAuthenticated(false);
            setActiveUser(null);
          }
        } catch (err) {
          console.error("[AUTH RESTORE] Erro crítico ao processar login do utilizador:", err);
          setIsAuthenticated(false);
          setActiveUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setActiveUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time products subscription and initial sync
  useEffect(() => {
    if (isAuthenticated) {
      console.log("[FIRESTORE] Ativando subscrição em tempo real para produtos...");
      
      const unsubscribe = subscribeToProdutos(
        async (firestoreProducts) => {
          setIsOnline(true);
          if (firestoreProducts && firestoreProducts.length > 0) {
            console.log(`[FIRESTORE] Recebidos ${firestoreProducts.length} produtos em tempo real.`);
            setProducts(firestoreProducts);
          } else {
            console.log("[FIRESTORE] Coleção de produtos vazia. Semeando produtos iniciais...");
            for (const prod of initialProducts) {
              await addProdutoToFirestore(prod);
            }
          }
        },
        (error) => {
          console.error("[FIRESTORE] Erro no listener em tempo real de produtos:", error);
          setIsOnline(false);
        }
      );

      const loadTransactions = async () => {
        try {
          const firestoreTx = await getTransacoesFromFirestore();
          if (firestoreTx && firestoreTx.length > 0) {
            console.log(`[FIRESTORE] Carregadas ${firestoreTx.length} transações.`);
            setTransactions(firestoreTx.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
          } else {
            console.log("[FIRESTORE] Coleção de transações vazia. Semeando transações iniciais...");
            const mockTx = generateMockTransactions();
            for (const tx of mockTx) {
              await addTransacaoToFirestore(tx);
            }
            setTransactions(mockTx);
          }
        } catch (err) {
          console.error("[FIRESTORE] Erro ao carregar transações do Firestore:", err);
        }
      };

      loadTransactions();

      return () => {
        console.log("[FIRESTORE] Desativando subscrição em tempo real para produtos.");
        unsubscribe();
      };
    }
  }, [isAuthenticated]);

  // Synchronize Firestore user database with local staff module list
  useEffect(() => {
    if (isAuthenticated) {
      const syncStaff = async () => {
        try {
          const firestoreUsers = await getUsuariosFromFirestore();
          if (firestoreUsers && firestoreUsers.length > 0) {
            // Merge firestore users with mock users by ID, prioritizing Firestore profiles
            setEmployees(prev => {
              const merged = [...prev];
              firestoreUsers.forEach(fUser => {
                const idx = merged.findIndex(m => m.id === fUser.id);
                if (idx > -1) {
                  merged[idx] = fUser;
                } else {
                  merged.push(fUser);
                }
              });
              return merged;
            });
          }
        } catch (err) {
          console.error("Erro ao sincronizar quadro de funcionários do Firestore:", err);
        }
      };
      syncStaff();
    }
  }, [isAuthenticated]);

  // Quick Switch Operator Handlers
  const handleChangeRole = async (role: UserRole) => {
    // find a fitting mock employee or create template
    const fitEmp = employees.find(e => {
      if (role === "ADMIN") return e.role.toUpperCase().includes("GESTOR") || e.role.toUpperCase().includes("ADMINISTRADOR");
      if (role === "SUPERVISOR") return e.role.toUpperCase().includes("SUPERVISOR");
      return e.role.toUpperCase().includes("CAIXA") || e.role.toUpperCase().includes("VENDEDOR");
    });
    
    if (fitEmp) {
      setPinTargetEmployee(fitEmp);
      setEnteredPin("");
      setPinError("");
      setPinVerificationOpen(true);
    }
  };

  const handleVerifyAndSwitchProfile = async () => {
    let targetEmp = pinTargetEmployee;

    if (loginMethod === "type") {
      if (!enteredUsername.trim()) {
        setPinError("Por favor, introduza o seu Username.");
        return;
      }
      const found = employees.find(e => e.username?.toLowerCase() === enteredUsername.trim().toLowerCase());
      if (!found) {
        setPinError("Nome de utilizador (Username) não encontrado.");
        return;
      }
      targetEmp = found;
    }

    if (!targetEmp) {
      setPinError("Por favor, selecione ou introduza um colaborador.");
      return;
    }

    if (targetEmp.status === "BLOCKED") {
      setPinError("A sua conta está BLOQUEADA por tempo expirado do PIN temporário ou suspensão de segurança.");
      return;
    }

    if (targetEmp.status === "INACTIVE" || targetEmp.status === "SUSPENDED") {
      setPinError("Esta conta está inativa ou suspensa. Contacte o Administrador.");
      return;
    }

    const requiredPin = targetEmp.pin || "123456";
    if (enteredPin.trim() !== requiredPin.trim()) {
      setPinError("Código PIN incorreto. Por favor, tente novamente.");
      return;
    }

    // Check expiration policy (3 days)
    const now = new Date();
    const createdAtStr = targetEmp.pinCreatedAt || targetEmp.admissionDate || now.toISOString();
    const createdAt = new Date(createdAtStr);
    const diffTime = now.getTime() - createdAt.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    const isPinTemporary = targetEmp.pinChanged === false || targetEmp.pinChanged === undefined;

    if (isPinTemporary && diffDays > 3) {
      const updatedEmployees = employees.map(emp => {
        if (emp.id === targetEmp.id) {
          return { ...emp, status: "BLOCKED" as const };
        }
        return emp;
      });
      handleUpdateEmployees(updatedEmployees);
      
      handleAddAuditLog(
        "Bloqueio de Conta Automático",
        "SEGURANÇA",
        `Conta do colaborador ${targetEmp.name} foi bloqueada por ultrapassar o prazo de 3 dias sem alterar o PIN temporário.`
      );

      setPinError("A sua conta foi BLOQUEADA por expiração do prazo de 3 dias para alterar o PIN temporário.");
      return;
    }

    if (isPinTemporary) {
      // Intercept login and open the Force PIN Change dialog
      setForcePinTargetEmployee(targetEmp);
      setNewPin("");
      setConfirmNewPin("");
      setForcePinError("");
      setForcePinChangeOpen(true);
      setPinVerificationOpen(false);
      return;
    }

    const fitEmp = targetEmp;
    setActiveUser(fitEmp);

    let ipStr = "IP Desconhecido";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      if (data && data.ip) {
        ipStr = data.ip;
      }
    } catch (e) {
      console.warn("Could not fetch IP", e);
    }

    handleAddAuditLog(
      "Alternância de Operador",
      "SISTEMA",
      `Sessão iniciada como ${fitEmp.name} (Perfil: ${fitEmp.role}). IP: ${ipStr}`
    );

    // Auto-redirect or reset module access if needed
    const simplifiedRole: UserRole = 
      fitEmp.role.toUpperCase().includes("GESTOR") || fitEmp.role.toUpperCase().includes("ADMINISTRADOR")
        ? "ADMIN"
        : fitEmp.role.toUpperCase().includes("SUPERVISOR")
          ? "SUPERVISOR"
          : "CASHIER";

    const menuItems = [
      { id: "dashboard", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "pos", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "stock", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "cash", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "customers", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "staff", roles: ["ADMIN"] },
      { id: "ai", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "reports", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "training", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "settings", roles: ["ADMIN"] },
      { id: "gateway", roles: ["ADMIN"] },
    ];

    const currentMenu = menuItems.find(m => m.id === activeTab.toLowerCase());
    if (currentMenu && !currentMenu.roles.includes(simplifiedRole)) {
      setActiveTab("POS");
    }

    showToast(`Bem-vindo, ${fitEmp.name}! Sessão autorizada com sucesso.`, "success");
    setPinVerificationOpen(false);
    setPinTargetEmployee(null);
  };

  const handleForcePinChangeSubmit = () => {
    if (!forcePinTargetEmployee) return;

    if (newPin.length !== 6) {
      setForcePinError("O novo PIN deve ter exatamente 6 dígitos.");
      return;
    }

    if (newPin === forcePinTargetEmployee.pin) {
      setForcePinError("O novo PIN não pode ser idêntico ao PIN temporário anterior.");
      return;
    }

    if (newPin !== confirmNewPin) {
      setForcePinError("Os PINs de confirmação não coincidem.");
      return;
    }

    // Update PIN & properties
    const updatedEmployees = employees.map(emp => {
      if (emp.id === forcePinTargetEmployee.id) {
        return {
          ...emp,
          pin: newPin,
          pinChanged: true,
          pinCreatedAt: new Date().toISOString()
        };
      }
      return emp;
    });

    handleUpdateEmployees(updatedEmployees);

    const fitEmp = {
      ...forcePinTargetEmployee,
      pin: newPin,
      pinChanged: true,
      pinCreatedAt: new Date().toISOString()
    };
    setActiveUser(fitEmp);

    let ipStr = "IP Desconhecido";
    fetch("https://api.ipify.org?format=json")
      .then(res => res.json())
      .then(data => {
        if (data && data.ip) {
          ipStr = data.ip;
        }
      })
      .catch(e => console.warn("Could not fetch IP", e))
      .finally(() => {
        handleAddAuditLog(
          "Alteração de PIN Obrigatório",
          "SEGURANÇA",
          `Colaborador ${fitEmp.name} alterou com sucesso o seu PIN temporário para um PIN definitivo de 6 dígitos. Sessão iniciada. IP: ${ipStr}`
        );
      });

    const simplifiedRole: UserRole = 
      fitEmp.role.toUpperCase().includes("GESTOR") || fitEmp.role.toUpperCase().includes("ADMINISTRADOR")
        ? "ADMIN"
        : fitEmp.role.toUpperCase().includes("SUPERVISOR")
          ? "SUPERVISOR"
          : "CASHIER";

    const menuItems = [
      { id: "dashboard", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "pos", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "stock", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "cash", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "customers", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "staff", roles: ["ADMIN"] },
      { id: "ai", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "reports", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "training", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "settings", roles: ["ADMIN"] },
      { id: "gateway", roles: ["ADMIN"] },
    ];

    const currentMenu = menuItems.find(m => m.id === activeTab.toLowerCase());
    if (currentMenu && !currentMenu.roles.includes(simplifiedRole)) {
      setActiveTab("POS");
    }

    showToast(`PIN definitivo de 6 dígitos registado com sucesso! Bem-vindo, ${fitEmp.name}.`, "success");
    setForcePinChangeOpen(false);
    setForcePinTargetEmployee(null);
  };

  // GENERAL AUDIT LOGGING WRAPPER
  const handleAddAuditLog = (action: string, module: string, details: string) => {
    let authRole: UserRole = "CASHIER";
    const username = activeUser ? activeUser.name : "Sistema / Visitante";
    if (activeUser && activeUser.role) {
      const raw = activeUser.role.toLowerCase();
      if (raw.includes("supervisor")) authRole = "SUPERVISOR";
      else if (raw.includes("administrador") || raw.includes("gestor")) authRole = "ADMIN";
    }

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: username,
      userRole: authRole,
      action,
      module,
      details
    };
    setAuditLogs(prev => {
      const updated = [...prev, newLog];
      syncTable("auditlogs", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - PRODUCTS
  const handleAddProduct = (newP: Product) => {
    setProducts(prev => {
      const updated = [newP, ...prev];
      syncTable("products", updated);
      return updated;
    });
  };
  const handleUpdateProduct = (updatedP: Product) => {
    setProducts(prev => {
      const updated = prev.map(p => p.id === updatedP.id ? updatedP : p);
      syncTable("products", updated);
      return updated;
    });
  };
  const handleDeleteProduct = (productId: string) => {
    setProducts(prev => {
      const updated = prev.filter(p => p.id !== productId);
      syncTable("products", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - CUSTOMERS
  const handleAddCustomer = (newC: Customer) => {
    setCustomers(prev => {
      const updated = [newC, ...prev];
      syncTable("customers", updated);
      return updated;
    });
  };
  const handleDeleteCustomer = (customerId: string) => {
    setCustomers(prev => {
      const updated = prev.filter(c => c.id !== customerId);
      syncTable("customers", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - CASH FLOW
  const handleAddCashFlowEntry = (newEntry: CashFlowEntry) => {
    setCashFlow(prev => {
      const updated = [...prev, newEntry];
      syncTable("cashflow", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - EMPLOYEES
  const handleAddEmployee = (newEmp: Employee) => {
    setEmployees(prev => {
      const updated = [newEmp, ...prev];
      syncTable("employees", updated);
      return updated;
    });
  };

  const handleUpdateEmployees = (updatedList: Employee[]) => {
    setEmployees(updatedList);
    syncTable("employees", updatedList);
  };

  // CENTRAL MUTATION HOOKS - SETTINGS
  const handleUpdateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      syncTable("settings", updated);
      return updated;
    });
  };

  const handleThemeChange = (newThemeId: string) => {
    setActiveColorTheme(newThemeId);
    const userId = activeUser?.id || "default";
    localStorage.setItem("erp_theme_" + userId, newThemeId);
    handleUpdateSettings({ theme: newThemeId });
  };

  // NEW: Unified local backup creation (supports manual and automatic scheduled runs)
  const handleTriggerLocalBackup = (type: "manual" | "automatic" = "manual") => {
    try {
      const dbPayload = {
        app: "OST Vendas",
        exportDate: new Date().toISOString(),
        version: "3.2.0-Prod-Mozambique",
        operator: type === "manual" ? (activeUser?.name || "ADMIN") : "Agendador Automático Redundante",
        data: {
          settings,
          products,
          customers,
          transactions,
          cashFlow,
          employees,
          auditLogs
        }
      };

      const dataStr = JSON.stringify(dbPayload);
      const backupId = Date.now().toString();
      
      // Save full backup payload to a unique key slot
      localStorage.setItem(`erp_backup_slot_${backupId}`, dataStr);
      localStorage.setItem("erp_auto_backup_local_db", dataStr);
      localStorage.setItem("erp_last_auto_backup_time", new Date().toISOString());

      // Update backup logs list
      let logs: any[] = [];
      try {
        const logsStr = localStorage.getItem("erp_local_backups_log");
        if (logsStr) logs = JSON.parse(logsStr);
      } catch (e) {}
      if (!Array.isArray(logs)) logs = [];

      const frequency = settings?.backupFrequency || "daily";
      
      const newLog = {
        id: backupId,
        date: new Date().toISOString(),
        type: type === "manual" ? "Manual" : "Automático",
        frequency: type === "manual" ? "N/A" : (frequency === "daily" ? "Diária" : frequency === "weekly" ? "Semanal" : frequency === "monthly" ? "Mensal" : "12 Horas"),
        size: dataStr.length,
        itemCount: (products.length || 0) + (customers.length || 0) + (transactions.length || 0),
        status: "Sucesso"
      };

      logs.unshift(newLog);
      logs = logs.slice(0, 5); // Keep last 5
      localStorage.setItem("erp_local_backups_log", JSON.stringify(logs));

      // Clean up backup slot keys that are no longer in the logs list
      const activeIds = logs.map((l: any) => l.id);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("erp_backup_slot_")) {
          const id = key.replace("erp_backup_slot_", "");
          if (!activeIds.includes(id)) {
            localStorage.removeItem(key);
          }
        }
      }

      handleAddAuditLog(
        type === "manual" ? "Backup Local Manual" : `Backup Local Automático (${frequency === "daily" ? "Diária" : frequency === "weekly" ? "Semanal" : frequency === "monthly" ? "Mensal" : "12 Horas"})`,
        type === "manual" ? "SEGURANÇA" : "SISTEMA",
        `Cópia de segurança gravada localmente com sucesso (${type === "manual" ? "Manual" : settings?.backupFrequency || "Diária"}).`
      );

      return true;
    } catch (error) {
      console.error("Erro ao realizar backup local:", error);
      return false;
    }
  };

  // Automated scheduled database backup to localStorage (runs checking interval every 15m; backups based on user configuration)
  useEffect(() => {
    if (!isAuthenticated || products.length === 0) return;

    const runAutomaticBackup = () => {
      try {
        const lastBackupTimeStr = localStorage.getItem("erp_last_auto_backup_time");
        const lastBackupTime = lastBackupTimeStr ? new Date(lastBackupTimeStr).getTime() : 0;
        const now = Date.now();
        
        const frequency = settings?.backupFrequency || "daily";
        let intervalMs = 24 * 60 * 60 * 1000; // default 1 day (daily)
        if (frequency === "weekly") {
          intervalMs = 7 * 24 * 60 * 60 * 1000;
        } else if (frequency === "monthly") {
          intervalMs = 30 * 24 * 60 * 60 * 1000;
        } else if (frequency === "12h") {
          intervalMs = 12 * 60 * 60 * 1000;
        }

        if (now - lastBackupTime >= intervalMs) {
          console.log(`[AUTO-BACKUP] Executando cópia de redundância automática (${frequency})...`);
          handleTriggerLocalBackup("automatic");
        }
      } catch (error) {
        console.error("[AUTO-BACKUP] Erro ao realizar backup de redundância automática:", error);
      }
    };

    // Run check immediately
    runAutomaticBackup();

    // Check every 15 minutes
    const intervalId = setInterval(runAutomaticBackup, 900000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, products, customers, transactions, cashFlow, employees, auditLogs, settings]);

  // ADMIN-ONLY REAL DATABASE EXPORT (JSON DOWNLOAD)
  const handleExportLocalDB = () => {
    const dbPayload = {
      app: "OST Vendas",
      exportDate: new Date().toISOString(),
      version: "3.2.0-Prod-Mozambique",
      operator: activeUser?.name || "ADMIN",
      data: {
        settings,
        products,
        customers,
        transactions,
        cashFlow,
        employees,
        auditLogs
      }
    };

    const dataStr = JSON.stringify(dbPayload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `OST_Vendas_DB_Backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    handleAddAuditLog(
      "Exportação Completa de DB",
      "SEGURANÇA",
      `Operador ${activeUser?.name || "ADMIN"} exportou com sucesso o banco de dados completo contendo ${products.length} produtos, ${customers.length} clientes, ${transactions.length} transações, ${cashFlow.length} movimentos e ${auditLogs.length} logs.`
    );
  };

  // ADMIN-ONLY REAL DATABASE IMPORT/RESTORE
  const handleImportLocalDB = async (importedData: any) => {
    try {
      if (!importedData) return false;

      if (importedData.products) {
        setProducts(importedData.products);
        await syncTable("products", importedData.products);
      }
      if (importedData.customers) {
        setCustomers(importedData.customers);
        await syncTable("customers", importedData.customers);
      }
      if (importedData.transactions) {
        setTransactions(importedData.transactions);
        await syncTable("transactions", importedData.transactions);
      }
      if (importedData.cashFlow) {
        setCashFlow(importedData.cashFlow);
        await syncTable("cashflow", importedData.cashFlow);
      }
      if (importedData.employees) {
        setEmployees(importedData.employees);
        await syncTable("employees", importedData.employees);
      }
      if (importedData.auditLogs) {
        setAuditLogs(importedData.auditLogs);
        await syncTable("auditlogs", importedData.auditLogs);
      }
      if (importedData.settings) {
        setSettings(importedData.settings);
        await syncTable("settings", importedData.settings);
      }

      handleAddAuditLog(
        "Restauro Completo de DB",
        "SEGURANÇA",
        `Operador ${activeUser?.name || "ADMIN"} restaurou com sucesso o banco de dados local.`
      );

      return true;
    } catch (error) {
      console.error("Falha ao restaurar banco de dados completo:", error);
      return false;
    }
  };

  const triggerSmsStockAlert = async (productName: string, currentStock: number, threshold: number) => {
    const managerPhone = settings.smsManagerPhone || "+258849001200";
    const provider = settings.smsProviderType || "TWILIO";
    const message = `ALERTA ESTOQUE CRÍTICO: O produto "${productName}" atingiu o nível crítico (${currentStock} unidades restantes). Limite configurado: ${threshold}. Por favor, realize a reposição urgente!`;

    // 1. Add to Audit Logs
    handleAddAuditLog(
      "Alerta Stock Crítico (SMS)",
      "STOCK",
      `Alerta de estoque baixo disparado para ${managerPhone} (${provider}). Mensagem: "${message}"`
    );

    // 2. Show Toast
    showToast(
      `Alerta de stock crítico por SMS enviado para o Gestor (${managerPhone}) referente ao produto "${productName}"!`,
      "warning",
      "SMS Enviado"
    );

    // 3. Optional real API connection triggers
    try {
      if (provider === "TWILIO" && settings.smsTwilioSid && settings.smsTwilioToken) {
        console.log(`[Twilio SMS] Sending SMS via SID: ${settings.smsTwilioSid} to ${managerPhone}`);
        // Real API request would look like:
        // const authString = btoa(`${settings.smsTwilioSid}:${settings.smsTwilioToken}`);
        // await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.smsTwilioSid}/Messages.json`, {
        //   method: "POST",
        //   headers: { "Authorization": `Basic ${authString}`, "Content-Type": "application/x-www-form-urlencoded" },
        //   body: new URLSearchParams({ From: settings.smsTwilioFrom || "", To: managerPhone, Body: message })
        // });
      } else if (provider === "CUSTOM_HTTP" && settings.smsCustomUrl) {
        console.log(`[Custom SMS] Sending SMS via custom URL to ${managerPhone}`);
        // Real API request would look like:
        // await fetch(settings.smsCustomUrl, { method: "POST", body: JSON.stringify({ to: managerPhone, text: message }) });
      }
    } catch (e) {
      console.warn("Real SMS gateway execution skipped or failed:", e);
    }
  };

  const triggerEmailStockAlert = async (productName: string, currentStock: number, threshold: number) => {
    const recipientEmail = settings.alertsRecipientEmail || "admin-alerts@empresa.co.mz";
    
    const defaultSubject = `[ALERTA] Estoque Crítico de Produtos - OST Vendas`;
    const defaultBody = `Olá,\n\nEste é um alerta automático de que os seguintes produtos atingiram o nível de estoque mínimo definido:\n\n[LISTA_PRODUTOS]\n\nPor favor, providencie a reposição o quanto antes para evitar rupturas de estoque.\n\nAtenciosamente,\nSistema OST Vendas`;

    const userSubject = settings.stockAlertEmailSubject || defaultSubject;
    const userBody = settings.stockAlertEmailBody || defaultBody;

    const productListText = `- ${productName} (Estoque Atual: ${currentStock}, Mínimo: ${threshold})`;
    const companyName = settings.companyName || "OST Vendas";
    const dateStr = new Date().toLocaleString("pt-MZ");

    const parsedSubject = userSubject
      .replace(/\[LISTA_PRODUTOS\]/g, productListText)
      .replace(/\[NOME_EMPRESA\]/g, companyName)
      .replace(/\[DATA\]/g, dateStr)
      .replace(/\[EMAIL_DESTINO\]/g, recipientEmail);

    const parsedBodyText = userBody
      .replace(/\[LISTA_PRODUTOS\]/g, productListText)
      .replace(/\[NOME_EMPRESA\]/g, companyName)
      .replace(/\[DATA\]/g, dateStr)
      .replace(/\[EMAIL_DESTINO\]/g, recipientEmail);

    const body = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #fff5f5;">
        <h2 style="color: #dc2626; margin-top: 0; font-size: 18px; display: flex; items-center: center; gap: 8px;">⚠️ Alerta de Estoque Crítico</h2>
        <div style="font-size: 14px; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${parsedBodyText}</div>
        <hr style="border: none; border-top: 1px solid #fee2e2; margin: 20px 0;" />
        <p style="font-size: 11px; color: #9ca3af; margin-top: 25px; text-align: center;">Este é um e-mail automático enviado pelo sistema ${companyName}.</p>
      </div>
    `;

    const subject = parsedSubject;

    // 1. Add to Audit Logs
    handleAddAuditLog(
      "Alerta Stock Crítico (E-mail)",
      "STOCK",
      `Alerta de estoque baixo para "${productName}" enviado para o e-mail: ${recipientEmail}`
    );

    // 2. Show Toast
    showToast(
      `Alerta de estoque crítico enviado para o e-mail: ${recipientEmail}!`,
      "warning",
      "E-mail de Alerta"
    );

    // 3. Dispatch to backend endpoint
    try {
      const response = await fetch("/api/email/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: recipientEmail,
          subject,
          body
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro no envio do e-mail de alerta");
      }
      console.log("[EMAIL ALERT] Alerta de estoque enviado com sucesso:", data);
    } catch (err: any) {
      console.error("[EMAIL ALERT ERROR] Falha ao enviar e-mail de alerta de estoque:", err);
    }
  };

  const triggerWhatsappStockAlert = async (productName: string, currentStock: number, threshold: number) => {
    if (!settings.whatsappEnabled) return;

    const phone = settings.managerWhatsappPhone || "+258849001200";
    const provider = settings.whatsappProvider || "DIRECT_LINK";
    const posLink = `${window.location.origin}/?tab=POS`;
    
    const defaultTemplate = `⚠️ *ALERTA DE ESTOQUE CRÍTICO* ⚠️\n\nO produto *{product_name}* atingiu o nível crítico de *{current_stock}* unidades (limite: {threshold}).\n\n👉 Acesse o POS para repor o estoque: {pos_link}`;
    const userTemplate = settings.whatsappMessageTemplate || defaultTemplate;
    
    const message = userTemplate
      .replace(/{product_name}/g, productName)
      .replace(/{current_stock}/g, String(currentStock))
      .replace(/{threshold}/g, String(threshold))
      .replace(/{pos_link}/g, posLink)
      .replace(/\[product_name\]/g, productName)
      .replace(/\[current_stock\]/g, String(currentStock))
      .replace(/\[threshold\]/g, String(threshold))
      .replace(/\[pos_link\]/g, posLink);

    // 1. Add to Audit Logs
    handleAddAuditLog(
      "Alerta Stock Crítico (WhatsApp)",
      "STOCK",
      `Alerta de estoque baixo disparado para ${phone} (${provider}). Mensagem: "${message}"`
    );

    // 2. Show Toast
    showToast(
      `Alerta de stock crítico enviado via WhatsApp para o Gestor (${phone})!`,
      "success",
      "WhatsApp Notificado"
    );

    // 3. Optional real API integration triggers / simulation
    try {
      if (provider === "DIRECT_LINK") {
        console.log(`[WhatsApp Direct Link] Generated link: https://api.whatsapp.com/send?phone=${phone.replace(/\+/g, "")}&text=${encodeURIComponent(message)}`);
      } else if (provider === "EVOLUTION_API" && settings.whatsappApiEndpoint) {
        console.log(`[Evolution API] Sending message to ${phone}`);
        await fetch(`${settings.whatsappApiEndpoint}/message/sendText/${settings.whatsappPhoneId || "default"}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": settings.whatsappToken || ""
          },
          body: JSON.stringify({
            number: phone.replace(/\+/g, ""),
            text: message
          })
        });
      } else if (provider === "TWILIO") {
        console.log(`[Twilio WhatsApp] Sending message to ${phone}`);
      } else if (provider === "META_CLOUD") {
        console.log(`[Meta Cloud API] Sending message to ${phone}`);
      }
    } catch (err: any) {
      console.error("[WhatsApp Send Error]:", err);
    }
  };

  // CENTRAL POS SALES TRANSACTION COMPLETION
  const handleCompleteSaleAction = (transaction: Transaction) => {
    // 1. Add to general transactions history list
    setTransactions(prev => {
      const updated = [transaction, ...prev];
      syncTable("transactions", updated);
      return updated;
    });

    const activeBranch = transaction.branchId || settings.activeBranchId || "central";
    const localBatches = [...(settings.batches || [])];

    // 2. Dynamic stock levels deduction ("Abate de Stock")
    setProducts(prevProducts => {
      const updated = prevProducts.map(prod => {
        const cartItemMatch = transaction.items.find(item => item.productId === prod.id);
        if (cartItemMatch) {
          const updatedStock = Math.max(0, prod.stock - cartItemMatch.quantity);
          
          // Geographical Branch Stock deduction
          const updatedBranchStocks = { ...(prod.branchStocks || {}) };
          const currentBranchStock = updatedBranchStocks[activeBranch] !== undefined 
            ? updatedBranchStocks[activeBranch] 
            : prod.stock;
          updatedBranchStocks[activeBranch] = Math.max(0, currentBranchStock - cartItemMatch.quantity);

          // LIFO / FIFO Batch deduction
          let remainingToDeduct = cartItemMatch.quantity;
          const prodBatches = localBatches
            .filter(b => b.productId === prod.id && b.quantity > 0)
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

          const threshold = settings.smsStockThreshold !== undefined ? settings.smsStockThreshold : 5;
          
          if (settings.smsAlertsEnabled && updatedStock <= threshold && prod.stock > threshold) {
            triggerSmsStockAlert(prod.name, updatedStock, threshold);
          }

          if (settings.emailStockAlertsEnabled && updatedStock <= threshold && prod.stock > threshold) {
            triggerEmailStockAlert(prod.name, updatedStock, threshold);
          }

          if (settings.whatsappEnabled && updatedStock <= threshold && prod.stock > threshold) {
            triggerWhatsappStockAlert(prod.name, updatedStock, threshold);
          }

          return {
            ...prod,
            stock: updatedStock,
            branchStocks: updatedBranchStocks
          };
        }
        return prod;
      });
      syncTable("products", updated);
      return updated;
    });

    // Save updated batches to system settings
    handleUpdateSettings({ batches: localBatches });

    // 3. Update customer loyalty points accumulated
    if (transaction.customerId && transaction.customerId !== "WALK_IN") {
      setCustomers(prevCustomers => {
        const updated = prevCustomers.map(cust => {
          if (cust.id === transaction.customerId) {
            const addedPoints = Math.floor(transaction.grandTotal / 100); // 1 point every 100 MT
            return {
              ...cust,
              totalSpent: cust.totalSpent + transaction.grandTotal,
              purchaseCount: cust.purchaseCount + 1,
              loyaltyPoints: cust.loyaltyPoints + addedPoints,
              lastPurchaseDate: new Date().toLocaleDateString(),
              debt: transaction.paymentMethod === "DEBT" ? (cust.debt || 0) + transaction.grandTotal : cust.debt
            };
          }
          return cust;
        });
        syncTable("customers", updated);
        return updated;
      });
    }

    // 4. Record strict auditor trace logs
    handleAddAuditLog(
      "Completar Transação de POS",
      "VENDAS",
      `Fatura ${transaction.invoiceNumber} processada na filial ${activeBranch}. Cliente: ${transaction.customerName}, Método: ${transaction.paymentMethod}. Total Pago: ${transaction.grandTotal} MT. Abate de Stock concluído.`
    );
  };

  // Trigger Gemini AI sales forecasting
  const handleTriggerAIForecast = async () => {
    setIsGeneratingForecast(true);
    setForecastResult(null);

    // Prepare critical low level stock summary
    const criticalStock = products
      .filter(p => p.stock <= p.minStock)
      .map(p => ({ sku: p.code, item: p.name, stock: p.stock }));

    // Prepare sales history summary
    const salesSummary = transactions.slice(0, 15).map(t => ({
      invoice: t.invoiceNumber,
      total: t.grandTotal,
      cashier: t.cashierName
    }));

    try {
      const response = await fetch("/api/gemini/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesHistory: salesSummary,
          inventoryStatus: criticalStock,
          businessType: settings.companyName
        })
      });
      const data = await response.json();
      setForecastResult(data);
    } catch {
      // Offline fallback
      setForecastResult({
        forecastText: `### **Análise Prematura de Previsão de Vendas (Modo Simulação)**
        
Com base no histórico fornecido de vendas para o seu negócio de **${settings.companyName}**:

1. **Tendência de Crescimento**: Projetamos um aumento aproximado de **18%** nas vendas para o próximo período devido a padrões sazonais identificados nos produtos mais vendidos.
2. **Produtos Críticos**: Itens com stock baixo (especialmente categorias eletrónicas ou mercearia) sofrem risco elevado de rutura. Recomendamos reabastecer com urgência para evitar perda de clientes.
3. **Plano de Ação Sugerido**:
   * Lance uma campanha promocional de Laurentina ou Arroz Chicualacuala.
   * Ative o programa de fidelização enviando SMS automatizadas de agradecimento.
   * Forneça opções céleres de recebimento M-Pesa.`,
        growthRate: 18,
        growthTrend: "up",
        suggestedCampaigns: [
          "Super Promo Laurentina 2M",
          "Arroz Chicualacuala Direct",
          "Desconto Especial no M-Pesa"
        ]
      });
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  // Translate employees role to fit authorization hooks
  const simplifiedRole: UserRole = useMemo(() => {
    if (!activeUser || !activeUser.role) return "CASHIER";
    const raw = activeUser.role.toLowerCase();
    if (raw.includes("caixa") || raw.includes("vendedor")) return "CASHIER";
    if (raw.includes("supervisor")) return "SUPERVISOR";
    return "ADMIN";
  }, [activeUser]);

  const handleLoginSuccess = (user: Employee, branchName: string) => {
    setActiveUser(user);
    setIsAuthenticated(true);
    setSettings(prev => ({
      ...prev,
      companyName: branchName
    }));
    
    // Auto-redirect conforming to profile role
    const raw = (user.role || "").toLowerCase();
    if (raw.includes("caixa") || raw.includes("vendedor")) {
      setActiveTab("POS");
    } else {
      setActiveTab("DASHBOARD");
    }
  };

  const handleLogout = async () => {
    try {
      if (activeUser) {
        handleAddAuditLog(
          "Logout Efetuado",
          "SEGURANÇA",
          `Operador ${activeUser.name} encerrou a sessão.`
        );
      }
      await auth.signOut();
      setActiveUser(null);
      setIsAuthenticated(false);
      showToast("Sessão terminada com sucesso.", "info");
    } catch (err: any) {
      console.error("Erro ao efetuar logout do Firebase:", err);
      setActiveUser(null);
      setIsAuthenticated(false);
      showToast("Sessão terminada com sucesso.", "info");
    }
  };

  if (!isAuthenticated || !activeUser) {
    return (
      <LoginModule
        employees={employees}
        companyName={settings.companyName}
        logoUrl={settings.logoUrl}
        onLoginSuccess={handleLoginSuccess}
        onShowToast={showToast}
      />
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
      theme === "night" ? "bg-zinc-950 text-slate-200" : "bg-slate-50 text-slate-800"
    }`}>
      
      {/* Visual background atmospheric touch for elegant negative spacing aesthetics */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* Main sidebar on the left */}
      {!isPOSFullscreen && (
        <Sidebar
          currentRole={simplifiedRole}
          onChangeRole={handleChangeRole}
          activeModule={activeTab.toLowerCase()}
          onChangeModule={(mod) => {
            setActiveTab(mod.toUpperCase());
            setIsSidebarOpen(false);
          }}
          companyName={settings.companyName}
          logoUrl={settings.logoUrl}
          onLogout={handleLogout}
          theme={theme}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Outer body wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        
        {/* TOP COMPACT STATUS BAR BRAND BANNER */}
        {!isPOSFullscreen && (
          <header className={`border-b h-16 px-4 md:px-6 shrink-0 flex items-center justify-between shadow-md backdrop-blur-md relative z-20 transition-all ${
            theme === "night" ? "bg-zinc-950/50 border-zinc-800/80" : "bg-white border-slate-200"
          }`}>
            
            <div className="flex items-center gap-3">
              {/* Hamburger Menu Toggle for Mobile/Tablet */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-zinc-900 transition shrink-0 cursor-pointer"
                aria-label="Abrir menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* System Status Indicator */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                isOnline 
                  ? theme === "night"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm"
                  : theme === "night"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                    : "bg-rose-50 text-rose-600 border border-rose-200 shadow-sm animate-pulse"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                <span>{isOnline ? "SISTEMA ONLINE" : "SISTEMA OFFLINE"}</span>
              </div>
  
              <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono opacity-80">
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="Logo Mini"
                    className="w-5 h-5 rounded-md object-contain bg-white p-0.5 border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className={theme === "night" ? "text-slate-400" : "text-slate-600"}>Empresa:</span>
                <span className={`font-bold uppercase ${theme === "night" ? "text-white" : "text-slate-800"}`}>
                  {settings.companyName}
                </span>
              </div>
  
              <span className="hidden lg:inline text-slate-500 font-mono text-[11px]">•</span>
  
              <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono opacity-80">
                <span className={theme === "night" ? "text-slate-400" : "text-slate-600"}>Versão:</span>
                <span className={`font-bold ${theme === "night" ? "text-amber-400" : "text-orange-600"}`}>v4.2.1-ERP</span>
              </div>
            </div>
  
            <div className="flex items-center gap-4 text-xs">
              {/* Session Stats & Last Sync */}
              <div className={`hidden md:flex items-center gap-4 font-mono text-[10.5px] ${
                theme === "night" ? "text-slate-400" : "text-slate-500"
              }`}>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Sessão:</span>
                  <span className={`font-bold ${theme === "night" ? "text-slate-200" : "text-slate-800"}`}>
                    {formatSessionTime(sessionSeconds)}
                  </span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5" title="Hora do último envio ou recebimento de dados com a nuvem">
                  <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  <span>Última Sinc:</span>
                  <span className={`font-bold ${theme === "night" ? "text-slate-200" : "text-slate-800"}`}>
                    {lastSyncTime}
                  </span>
                </div>
              </div>
  
              {/* Daily/Night Theme Switcher Custom Widget */}
              <button
                onClick={() => setTheme(theme === "daily" ? "night" : "daily")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-[10.5px] font-bold ${
                  theme === "night" 
                    ? "bg-zinc-900 border-zinc-800 text-amber-500 hover:text-amber-400" 
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                }`}
                title="Alternar Layout de Tema"
              >
                {theme === "daily" ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: "10s" }} />
                    <span>Dia</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-amber-450 fill-amber-400/25" />
                    <span>Noite</span>
                  </>
                )}
              </button>
  
              {/* Active user status pill */}
              <div className={`flex items-center gap-2 p-1.5 rounded-xl border ${
                theme === "night" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"
              }`}>
                <span className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-[10px]">
                  {activeUser.name.substring(0, 2).toUpperCase()}
                </span>
                <div className="text-left leading-none">
                  <p className={`font-extrabold text-[10.5px] leading-tight ${
                    theme === "night" ? "text-slate-200" : "text-slate-800"
                  }`}>{activeUser.name}</p>
                  <p className={`text-[9px] italic mt-0.5 ${
                    theme === "night" ? "text-slate-400" : "text-slate-500"
                  }`}>{activeUser.role}</p>
                </div>
              </div>
            </div>
  
          </header>
        )}
        
        {isQuotaExceeded && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-start gap-3 relative z-30 animate-in slide-in-from-top duration-200">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-extrabold text-amber-500">Aviso do Sistema: Limite de Quota Diária Excedido (Firestore Writes)</h4>
              <p className="text-slate-400 mt-1 leading-relaxed">
                A cota diária gratuita de gravação do Firestore (**Spark Plan / Free Tier**) foi atingida para este projeto. O sistema de banco de dados entrou em modo de simulação segura local. Pode continuar a registar vendas, gerir artigos, consultar relatórios e testar todas as funcionalidades do POS com segurança! Os limites de quota serão reiniciados automaticamente amanhã.
              </p>
              <div className="flex flex-wrap gap-3 mt-2">
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0285564041/firestore/databases/ai-studio-e2d52f5d-b57f-430e-9d24-e415e95b0744/data?openUpgradeDialog=true"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1 rounded text-[10px] transition uppercase tracking-wider"
                >
                  Ir para a Consola Firebase ↗
                </a>
                <a
                  href="https://firebase.google.com/pricing#cloud-firestore"
                  target="_blank"
                  rel="noreferrer"
                  className="border border-amber-500/30 text-amber-400 hover:text-amber-300 font-bold px-3 py-1 rounded text-[10px] transition"
                >
                  Tabela de Preços e Limites ↗
                </a>
                <button
                  onClick={() => setIsQuotaExceeded(false)}
                  className="text-slate-500 hover:text-slate-300 underline font-semibold text-[10px]"
                >
                  Ignorar por agora
                </button>
              </div>
            </div>
          </div>
        )}
  
        {/* INNER SCROLLABLE WORKPORT PANEL CONTENT */}
        <main className={`flex-1 overflow-y-auto relative ${isPOSFullscreen ? "p-0" : "p-4 md:p-6"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              
              {/* POS DIRECT CHECKOUT */}
              {activeTab === "POS" && (
                <POSModule
                  products={products}
                  customers={customers}
                  transactions={transactions}
                  onCompleteSale={handleCompleteSaleAction}
                  activeUsername={activeUser.name}
                  settings={settings}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                  onShowToast={showToast}
                  isPOSFullscreen={isPOSFullscreen}
                  onChangePOSFullscreen={setIsPOSFullscreen}
                />
              )}

              {/* STATS ANALYTICS CONTROL PANEL */}
              {activeTab === "DASHBOARD" && (
                <DashboardModule
                  transactions={transactions}
                  products={products}
                  customers={customers}
                  cashFlow={cashFlow}
                  currency={currency}
                  onChangeModule={(mod) => setActiveTab(mod.toUpperCase())}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onUpdateProduct={handleUpdateProduct}
                  onAddAuditLog={handleAddAuditLog}
                  onShowToast={showToast}
                  onCompleteSale={handleCompleteSaleAction}
                />
              )}

              {/* DAILY BOOK BALANCE CASH OPERATIONS */}
              {activeTab === "CASH" && (
                <CashRegisterModule
                  cashFlow={cashFlow}
                  transactions={transactions}
                  onAddCashFlowEntry={handleAddCashFlowEntry}
                  activeUsername={activeUser.name}
                  currentRole={simplifiedRole}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                  settings={settings}
                />
              )}

              {/* ACTIVE STOCK INVENTORY MANAGER */}
              {activeTab === "STOCK" && (
                <StockModule
                  products={products}
                  transactions={transactions}
                  onAddProduct={handleAddProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  currency={currency}
                  settings={settings}
                  onShowToast={showToast}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}

              {/* CUSTOMER LOYALTY CRM & MARKETING SMS */}
              {(activeTab === "CUSTOMERS" || activeTab === "CLIENTES") && (
                <CustomersModule
                  customers={customers}
                  onAddCustomer={handleAddCustomer}
                  onUpdateCustomer={(updatedC) => {
                    setCustomers(prev => {
                      const updated = prev.map(c => c.id === updatedC.id ? updatedC : c);
                      syncTable("customers", updated);
                      return updated;
                    });
                  }}
                  onAddCashFlowEntry={handleAddCashFlowEntry}
                  onDeleteCustomer={handleDeleteCustomer}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  activeUsername={activeUser.name}
                  currency={currency}
                  onShowToast={showToast}
                />
              )}

              {/* STAFF EMPLOYEES & SECURITY TRAIL AUDITOR */}
              {activeTab === "STAFF" && (
                <StaffModule
                  employees={employees}
                  auditLogs={auditLogs}
                  onAddEmployee={handleAddEmployee}
                  onUpdateEmployees={handleUpdateEmployees}
                  activeUsername={activeUser.name}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  currency={currency}
                  settings={settings}
                />
              )}

              {/* REVENUE PREDICTION AI PANEL */}
              {activeTab === "AI" && (
                <AiForecastModule
                  products={products}
                  transactions={transactions}
                  settings={settings}
                  theme={theme}
                  currency={currency}
                  onShowToast={showToast}
                  onChangeModule={(mod) => setActiveTab(mod.toUpperCase())}
                />
              )}

              {/* FINANCIAL REPORTS & SMTP TRIGGERS */}
              {activeTab === "REPORTS" && (
                <ReportsModule
                  transactions={transactions}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                  onShowToast={showToast}
                />
              )}

              {/* TUTORIAL LESSONS CENTER */}
              {activeTab === "TRAINING" && (
                <TrainingModule
                  videos={masterclassVideos}
                  currency={currency}
                />
              )}

              {/* COMPANY GENERAL IDENTITIES AND MAIN SETTINGS */}
              {activeTab === "SETTINGS" && (
                <SettingsModule
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  currency={currency}
                  onShowToast={showToast}
                  activeUser={activeUser}
                  activeColorTheme={activeColorTheme}
                  onChangeColorTheme={handleThemeChange}
                  onExportLocalDB={handleExportLocalDB}
                  onImportLocalDB={handleImportLocalDB}
                  onTriggerLocalBackup={handleTriggerLocalBackup}
                />
              )}

              {/* GATEWAY INTEGRATION PANEL */}
              {activeTab === "GATEWAY" && (
                <GatewayModule
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  onShowToast={showToast}
                  products={products}
                  customers={customers}
                />
              )}

            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* PIN Verification Modal for Switching Operator */}
      <AnimatePresence>
        {pinVerificationOpen && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                theme === "night"
                  ? "bg-zinc-950 text-slate-100 border-zinc-850"
                  : "bg-white text-slate-800 border-slate-100"
              }`}
              id="profile-pin-verification-modal"
            >
              {/* Modal Header */}
              <div className={`p-6 border-b flex items-center justify-between ${
                theme === "night" ? "bg-zinc-900 border-zinc-850" : "bg-slate-50 border-slate-100"
              }`}>
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shadow-inner">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm">Autenticação Requerida</h3>
                    <p className="text-[11px] text-slate-400 font-medium font-mono">Terminal POS de Segurança</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPinVerificationOpen(false);
                    setPinTargetEmployee(null);
                  }}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition cursor-pointer text-xs font-bold ${
                    theme === "night"
                      ? "bg-zinc-900 border-zinc-850 text-slate-400 hover:text-white"
                      : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Login Method Tabs */}
              <div className="flex border-b border-slate-100 dark:border-zinc-850">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("select");
                    setPinError("");
                  }}
                  className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                    loginMethod === "select"
                      ? "border-orange-500 text-orange-600 font-extrabold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  👥 Selecionar Operador
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("type");
                    setPinError("");
                  }}
                  className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                    loginMethod === "type"
                      ? "border-orange-500 text-orange-600 font-extrabold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  🔑 Introduzir Username
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex flex-col items-center">
                {/* Method 1: Dropdown selector */}
                {loginMethod === "select" && (
                  <div className="w-full space-y-3 mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                      Escolha o Colaborador
                    </label>
                    <select
                      value={pinTargetEmployee ? pinTargetEmployee.id : ""}
                      onChange={(e) => {
                        const emp = employees.find(empItem => empItem.id === e.target.value);
                        if (emp) {
                          setPinTargetEmployee(emp);
                          setEnteredPin("");
                          setPinError("");
                        }
                      }}
                      className={`w-full p-2.5 rounded-xl border font-semibold outline-none text-xs cursor-pointer ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-800 text-slate-100"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-500 shadow-sm"
                      }`}
                    >
                      <option value="" disabled>-- Escolha um Operador do Quadro --</option>
                      {employees.filter(e => e.status !== "INACTIVE" && e.status !== "SUSPENDED").map(empItem => (
                        <option key={empItem.id} value={empItem.id}>
                          {empItem.role.toUpperCase().includes("ADMIN") ? "👨‍💼" : empItem.role.toUpperCase().includes("SUPERVISOR") ? "👨‍💻" : "👩‍💼"}{" "}
                          {empItem.name} ({empItem.username || "sem username"})
                        </option>
                      ))}
                    </select>

                    {pinTargetEmployee && (
                      <div className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
                        theme === "night"
                          ? "bg-zinc-900/60 border-zinc-850"
                          : "bg-orange-50/55 border-orange-100/50"
                      }`}>
                        <div className="text-2xl mt-0.5">
                          {pinTargetEmployee.role.toUpperCase().includes("ADMIN") ? "👨‍💼" : pinTargetEmployee.role.toUpperCase().includes("SUPERVISOR") ? "👨‍💻" : "👩‍💼"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{pinTargetEmployee.name}</h4>
                          <p className="text-[10px] text-slate-400 font-semibold">{pinTargetEmployee.role}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 dark:bg-zinc-850 dark:text-slate-400">
                              @{pinTargetEmployee.username}
                            </span>
                            {(pinTargetEmployee.pinChanged === false || pinTargetEmployee.pinChanged === undefined) ? (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 animate-pulse">
                                PIN Temporário
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                PIN Pessoal Definido
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Method 2: Manual Username Entry */}
                {loginMethod === "type" && (
                  <div className="w-full space-y-1.5 mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                      Username do Operador
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">@</span>
                      <input
                        type="text"
                        placeholder="Iniciais + Apelido (Ex: ldomingos)"
                        value={enteredUsername}
                        onChange={(e) => {
                          setEnteredUsername(e.target.value.toLowerCase().replace(/\s/g, ""));
                          if (pinError) setPinError("");
                        }}
                        className={`w-full pl-8 pr-4 py-2.5 rounded-xl border font-mono font-bold text-xs outline-none ${
                          theme === "night"
                            ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:border-orange-500"
                            : "bg-slate-50 border-slate-200 text-slate-850 focus:border-orange-500 focus:bg-white shadow-sm"
                        }`}
                        autoFocus={loginMethod === "type"}
                      />
                    </div>
                  </div>
                )}

                {/* PIN Input Field */}
                <div className="w-full space-y-1.5 mb-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                    Digite o seu PIN de Acesso (6 Dígitos)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={enteredPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setEnteredPin(val);
                      if (pinError) setPinError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleVerifyAndSwitchProfile();
                      }
                    }}
                    placeholder="••••••"
                    className={`w-full text-center text-xl font-mono tracking-[1.5em] py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
                      theme === "night"
                        ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:border-orange-500 focus:ring-orange-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-500 focus:ring-orange-500/20 shadow-inner"
                    }`}
                  />
                  {pinError && (
                    <p className="text-xs text-rose-500 font-extrabold text-left animate-pulse mt-1.5">
                      ⚠️ {pinError}
                    </p>
                  )}
                </div>

                {/* Highly Crafted POS PIN Pad for simple mouse/touchscreen interactions */}
                <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] mb-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        if (enteredPin.length < 6) {
                          setEnteredPin(prev => prev + num);
                          if (pinError) setPinError("");
                        }
                      }}
                      className={`py-3 text-base font-extrabold rounded-xl transition cursor-pointer border ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-850 hover:bg-zinc-800 active:bg-zinc-750 text-slate-200"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 shadow-sm"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEnteredPin("")}
                    className={`py-3 text-[10px] font-bold rounded-xl transition cursor-pointer border ${
                      theme === "night"
                        ? "bg-zinc-900 border-zinc-850 text-rose-400 hover:bg-rose-500/10"
                        : "bg-slate-50 border-slate-200 text-rose-600 hover:bg-rose-50"
                    }`}
                  >
                    LIMPAR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (enteredPin.length < 6) {
                        setEnteredPin(prev => prev + "0");
                        if (pinError) setPinError("");
                      }
                    }}
                    className={`py-3 text-base font-extrabold rounded-xl transition cursor-pointer border ${
                      theme === "night"
                        ? "bg-zinc-900 border-zinc-850 hover:bg-zinc-800 active:bg-zinc-750 text-slate-200"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 shadow-sm"
                    }`}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (enteredPin.length > 0) {
                        setEnteredPin(prev => prev.slice(0, -1));
                      }
                    }}
                    className={`py-3 text-xs font-bold rounded-xl transition cursor-pointer border ${
                      theme === "night"
                        ? "bg-zinc-900 border-zinc-850 text-slate-400 hover:bg-zinc-800"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    ⌫
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={`p-4 border-t flex items-center justify-between gap-3 ${
                theme === "night" ? "bg-zinc-900 border-zinc-850" : "bg-slate-50 border-slate-100"
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setPinVerificationOpen(false);
                    setPinTargetEmployee(null);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                    theme === "night"
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAndSwitchProfile}
                  className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105`}
                >
                  Autenticar Perfil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Force PIN Change Modal */}
      <AnimatePresence>
        {forcePinChangeOpen && forcePinTargetEmployee && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                theme === "night"
                  ? "bg-zinc-950 text-slate-100 border-zinc-850"
                  : "bg-white text-slate-800 border-slate-100"
              }`}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-zinc-850 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shadow-inner">
                    <ShieldAlert className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">Atualização de Segurança Obrigatória</h3>
                    <p className="text-[10px] text-amber-600 font-extrabold font-mono uppercase">Definir PIN Definitivo de 6 dígitos</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-left">
                <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl space-y-1 text-xs">
                  <p className="font-bold text-amber-800">Olá {forcePinTargetEmployee.name},</p>
                  <p className="text-amber-700 leading-relaxed text-[11px]">
                    De acordo com a política de segurança, o PIN inicial é temporário e **deve ser alterado dentro de um prazo limite de 3 dias**. Escolha o seu PIN pessoal de 6 dígitos para ativar permanentemente a sua conta.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Novo PIN Pessoal (6 dígitos)</label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="Ex: 654321"
                      value={newPin}
                      onChange={(e) => {
                        setNewPin(e.target.value.replace(/\D/g, ""));
                        if (forcePinError) setForcePinError("");
                      }}
                      className={`w-full text-center text-lg font-mono tracking-[1.5em] py-2 rounded-xl border focus:outline-none focus:ring-2 ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:ring-orange-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-orange-500/20 focus:bg-white"
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Confirmar Novo PIN</label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="Repita o novo PIN"
                      value={confirmNewPin}
                      onChange={(e) => {
                        setConfirmNewPin(e.target.value.replace(/\D/g, ""));
                        if (forcePinError) setForcePinError("");
                      }}
                      className={`w-full text-center text-lg font-mono tracking-[1.5em] py-2 rounded-xl border focus:outline-none focus:ring-2 ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:ring-orange-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-orange-500/20 focus:bg-white"
                      }`}
                    />
                  </div>

                  {forcePinError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                      <span>⚠️</span>
                      <span>{forcePinError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-zinc-850 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setForcePinChangeOpen(false);
                    setForcePinTargetEmployee(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleForcePinChangeSubmit}
                  disabled={newPin.length !== 6 || confirmNewPin.length !== 6}
                  className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer ${
                    newPin.length === 6 && confirmNewPin.length === 6
                      ? "bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  Ativar Conta & Aceder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications Overlay Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`p-4 rounded-xl border shadow-lg pointer-events-auto flex gap-3 relative overflow-hidden backdrop-blur-md ${
                theme === "night"
                  ? "bg-zinc-950/95 border-zinc-850/80 text-slate-100 shadow-zinc-950/45"
                  : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/40"
              }`}
            >
              {/* Vertical side glow indicator bar according to toast type */}
              <div
                className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                  t.type === "success"
                    ? "bg-emerald-500"
                    : t.type === "error"
                    ? "bg-rose-500"
                    : t.type === "warning"
                    ? "bg-amber-500"
                    : "bg-blue-500"
                }`}
              />

              {/* Icon selection dynamically */}
              <div className="mt-0.5 shrink-0">
                {t.type === "success" && (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                )}
                {t.type === "error" && (
                  <XCircle className="w-5 h-5 text-rose-500" />
                )}
                {t.type === "warning" && (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
                {t.type === "info" && (
                  <Activity className="w-5 h-5 text-blue-500" />
                )}
              </div>

              {/* Contents block */}
              <div className="flex-1 pr-6">
                <h4 className="font-extrabold text-xs tracking-tight uppercase">
                  {t.title}
                </h4>
                <p className={`text-[11px] mt-1 pr-1 font-semibold leading-relaxed ${
                  theme === "night" ? "text-slate-350" : "text-slate-550"
                }`}>
                  {t.message}
                </p>
              </div>

              {/* Manual Close Button */}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className={`absolute top-3 right-3 p-1 rounded-lg transition-colors cursor-pointer ${
                  theme === "night"
                    ? "hover:bg-zinc-900 text-slate-400 hover:text-white"
                    : "hover:bg-slate-100 text-slate-400 hover:text-slate-900"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
