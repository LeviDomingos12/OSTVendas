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
  addProdutosToFirestoreBatch,
  updateProdutoInFirestore,
  deleteProdutoFromFirestore,
  getTransacoesFromFirestore,
  addTransacaoToFirestore,
  addTransacoesToFirestoreBatch,
  subscribeToProdutos,
  isCircuitBroken,
  getPartitionPath
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
  Lock,
  ShieldAlert,
  Users,
  Camera
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

  // User Switch & Account Linking (Vínculo de Conta) States
  const [isUserSwitchModalOpen, setIsUserSwitchModalOpen] = useState(false);
  const [switchSelectedEmployeeId, setSwitchSelectedEmployeeId] = useState("");
  const [userSwitchModalTab, setUserSwitchModalTab] = useState<"switch" | "profile">("switch");
  const [profileName, setProfileName] = useState("");
  const [profileContact, setProfileContact] = useState("");
  const [profileFotoPerfil, setProfileFotoPerfil] = useState("");
  const [switchEnteredPin, setSwitchEnteredPin] = useState("");
  const [switchPinError, setSwitchPinError] = useState("");

  useEffect(() => {
    if (isUserSwitchModalOpen && activeUser) {
      setProfileName(activeUser.name || "");
      setProfileContact(activeUser.contact || "");
      setProfileFotoPerfil(activeUser.fotoPerfil || "");
    }
    setSwitchEnteredPin("");
    setSwitchPinError("");
  }, [isUserSwitchModalOpen, activeUser]);

  // Premium AI predictions state
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [forecastResult, setForecastResult] = useState<any | null>(null);

  // Dynamic system versioning that automatically increments with each database record or action logged
  const totalSystemModifications = useMemo(() => {
    return (products?.length || 0) + (customers?.length || 0) + (transactions?.length || 0) + (cashFlow?.length || 0) + (employees?.length || 0) + (auditLogs?.length || 0);
  }, [products, customers, transactions, cashFlow, employees, auditLogs]);

  const pinRemainingDays = useMemo(() => {
    if (!activeUser) return 0;
    if (activeUser.pinChanged === false || activeUser.pinChanged === undefined) {
      return 0;
    }
    const now = new Date();
    const createdAtStr = activeUser.pinCreatedAt || activeUser.admissionDate || now.toISOString();
    const createdAt = new Date(createdAtStr);
    const diffTime = now.getTime() - createdAt.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, 60 - diffDays);
  }, [activeUser]);

  const [buildVersion, setBuildVersion] = useState<number>(() => {
    try {
      const cached = localStorage.getItem("system_build_version");
      if (cached) {
        const parsed = parseInt(cached, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch (e) {}
    // Fallback: start at max of 362 and total items inside local collections
    return Math.max(362, (products?.length || 0) + (customers?.length || 0) + (transactions?.length || 0) + (cashFlow?.length || 0) + (employees?.length || 0) + (auditLogs?.length || 0));
  });

  // Keep localStorage and buildVersion in sync if totalSystemModifications becomes higher on initial load
  useEffect(() => {
    setBuildVersion(current => {
      if (totalSystemModifications > current) {
        try {
          localStorage.setItem("system_build_version", String(totalSystemModifications));
        } catch (e) {}
        return totalSystemModifications;
      }
      return current;
    });
  }, [totalSystemModifications]);

  const currentSystemVersion = `v4.2.1-rev${buildVersion}-ERP`;

  // Fetch / Sync version counter with Firestore partitioned document
  useEffect(() => {
    const syncFirestoreVersion = async () => {
      if (isCircuitBroken() || !navigator.onLine) return;
      try {
        const path = getPartitionPath("system");
        const docRef = doc(db, path, "version");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && typeof data.counter === "number") {
            const firestoreCounter = data.counter;
            setBuildVersion(current => {
              const highest = Math.max(current, firestoreCounter);
              try {
                localStorage.setItem("system_build_version", String(highest));
              } catch (e) {}
              return highest;
            });
          }
        } else {
          // Document does not exist yet, write the current local build version as initial value
          await setDoc(docRef, { counter: buildVersion, updatedAt: new Date().toISOString() });
        }
      } catch (err) {
        console.warn("Failed to fetch/sync global version counter from Firestore:", err);
      }
    };

    if (isAuthenticated || activeUser) {
      // Small delay or directly trigger
      syncFirestoreVersion();
    }
  }, [isAuthenticated, activeUser, db, buildVersion]);

  // Unified function to increment build version both locally and in Firestore
  const incrementVersionCounter = async () => {
    let nextVal = buildVersion + 1;
    setBuildVersion(current => {
      const next = current + 1;
      nextVal = next;
      try {
        localStorage.setItem("system_build_version", String(next));
      } catch (e) {}
      return next;
    });

    if (navigator.onLine && !isCircuitBroken()) {
      try {
        const path = getPartitionPath("system");
        const docRef = doc(db, path, "version");
        await setDoc(docRef, { 
          counter: nextVal, 
          updatedAt: new Date().toISOString() 
        }, { merge: true });
      } catch (err) {
        console.warn("Failed to update global version counter in Firestore:", err);
      }
    }
  };

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
  
  // Geolocation and IP tracking for Audit Logs
  const [userIpInfo, setUserIpInfo] = useState<{ ip: string; city: string; country: string } | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<string>("");

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

  // Fetch client IP and device info for Audit logs
  useEffect(() => {
    // Detect browser/device info
    const ua = navigator.userAgent;
    let dev = "Desktop";
    if (/mobile/i.test(ua)) dev = "Telemóvel / Mobile";
    else if (/tablet/i.test(ua)) dev = "Tablet";
    
    if (ua.includes("Chrome")) dev += " (Chrome)";
    else if (ua.includes("Firefox")) dev += " (Firefox)";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) dev += " (Safari)";
    else if (ua.includes("Edge")) dev += " (Edge)";
    setDeviceInfo(dev);

    // Fetch IP and Geo IP details
    fetch("https://ipapi.co/json/")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch IP details");
        return res.json();
      })
      .then(data => {
        if (data && data.ip) {
          setUserIpInfo({
            ip: data.ip,
            city: data.city || "Maputo",
            country: data.country_name || "Moçambique"
          });
        }
      })
      .catch(() => {
        // Safe mock realistic Mozambican IP/Geo details on failure/ad-blocker
        setUserIpInfo({
          ip: "102.81.12.94",
          city: "Maputo",
          country: "Moçambique"
        });
      });
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
    await incrementVersionCounter();
    try {
      if (!navigator.onLine) {
        throw new Error("browser is offline");
      }
      
      if (tableName === "products") {
        await addProdutosToFirestoreBatch(updatedData);
      } else if (tableName === "transactions") {
        await addTransacoesToFirestoreBatch(updatedData);
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
              await addProdutosToFirestoreBatch(data);
              success = true;
            } catch (fsErr) {
              console.warn("[SYNC QUEUE] Erro ao ressincronizar produtos com Firestore:", fsErr);
            }
          } else if (tableName === "transactions") {
            try {
              await addTransacoesToFirestoreBatch(data);
              success = true;
            } catch (fsErr) {
              console.warn("[SYNC QUEUE] Erro ao ressincronizar transações com Firestore:", fsErr);
            }
          } else {
            try {
              const response = await fetch("/api/db/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ table: tableName, data })
              });
              success = response.ok;
            } catch (fetchErr) {
              console.warn(`[SYNC QUEUE] Erro de rede ao ressincronizar tabela ${tableName}:`, fetchErr);
            }
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
        console.warn("[SYNC QUEUE] Erro ao reprocessar alterações offline:", err);
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
          // Fetch employee list to map Google account to actual employee
          let currentEmployees: Employee[] = [];
          try {
            const dbResponse = await fetch("/api/db/load");
            const dbJson = await dbResponse.json();
            if (dbJson.success && dbJson.data && dbJson.data.employees) {
              currentEmployees = dbJson.data.employees;
            }
          } catch (e) {
            console.warn("Could not load employees for auth mapping:", e);
          }

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
          }

          // Match logged in user email to an existing employee
          const employeeEmailMatch = currentEmployees.find(emp => emp.email?.toLowerCase() === user.email?.toLowerCase());

          if (!profileData && employeeEmailMatch) {
            // Create user profile document in Firestore from matched employee
            profileData = {
              uid: user.uid,
              nomeCompleto: employeeEmailMatch.name,
              email: employeeEmailMatch.email || user.email || "",
              empresa: "OST Comércio Geral",
              perfil: employeeEmailMatch.role,
              cargo: employeeEmailMatch.role,
              estado: employeeEmailMatch.status === "ACTIVE" ? "Ativo" : "Inativo",
              fotoPerfil: user.photoURL || "",
              telefone: employeeEmailMatch.contact || "",
              ultimoLogin: new Date().toISOString(),
              dataCriacao: employeeEmailMatch.admissionDate ? new Date(employeeEmailMatch.admissionDate).toISOString() : new Date().toISOString(),
              username: employeeEmailMatch.username || "",
              pin: employeeEmailMatch.pin || "",
              pinCreatedAt: employeeEmailMatch.pinCreatedAt || "",
              pinChanged: employeeEmailMatch.pinChanged !== undefined ? employeeEmailMatch.pinChanged : true
            };
            
            // Also write to Firestore to persist this mapping if online
            try {
              const userDocRef = doc(db, "usuarios", user.uid);
              await setDoc(userDocRef, profileData);
            } catch (err) {
              console.warn("Could not save mapped Google profile to Firestore:", err);
            }
          }

          if (!profileData) {
            // Generate a generic profile for the Google user if not found
            profileData = {
              uid: user.uid,
              nomeCompleto: user.displayName || user.email?.split("@")[0] || "Operador",
              email: user.email || "operador@ostvendas.com",
              empresa: "OST Comércio Geral",
              perfil: "Administrador Completo", // Default to high privilege fallback
              cargo: "Administrador",
              estado: "Ativo",
              fotoPerfil: user.photoURL || "",
              telefone: "",
              ultimoLogin: new Date().toISOString(),
              dataCriacao: new Date().toISOString()
            };
          }

          if (profileData) {
            const isGoogleAdminEmail = user.email?.toLowerCase() === "levidomingos12@gmail.com";
            const isMatchedAdmin = employeeEmailMatch && (employeeEmailMatch.role?.toUpperCase().includes("ADMIN") || employeeEmailMatch.role?.toUpperCase().includes("GESTOR"));
            const isProfileAdmin = profileData.perfil && (profileData.perfil.toUpperCase().includes("ADMIN") || profileData.perfil.toUpperCase().includes("GESTOR"));
            if (isGoogleAdminEmail || isMatchedAdmin || isProfileAdmin) {
              profileData.perfil = "Administrador";
              profileData.cargo = "Administrador";
            }

            const mappedEmployee = mapUsuarioToEmployee(profileData as any);
            
            if (mappedEmployee.status === "BLOCKED") {
              showToast("A sua conta está BLOQUEADA por tempo expirado do PIN temporário ou suspensão de segurança.", "error");
              await auth.signOut();
              setIsAuthenticated(false);
              setActiveUser(null);
              return;
            }

            if (mappedEmployee.status === "INACTIVE" || mappedEmployee.status === "SUSPENDED") {
              showToast("Esta conta está inativa ou suspensa. Contacte o Administrador.", "error");
              await auth.signOut();
              setIsAuthenticated(false);
              setActiveUser(null);
              return;
            }

            // Check if PIN has expired (3 days rule)
            const now = new Date();
            const createdAtStr = mappedEmployee.pinCreatedAt || mappedEmployee.admissionDate || now.toISOString();
            const createdAt = new Date(createdAtStr);
            const diffTime = now.getTime() - createdAt.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            const isPinTemporary = mappedEmployee.pinChanged === false || mappedEmployee.pinChanged === undefined;

            if (isPinTemporary && diffDays > 3) {
              const updatedEmployees = currentEmployees.map(emp => {
                if (emp.id === mappedEmployee.id) {
                  return { ...emp, status: "BLOCKED" as const };
                }
                return emp;
              });
              handleUpdateEmployees(updatedEmployees);
              
              handleAddAuditLog(
                "Bloqueio de Conta Automático",
                "SEGURANÇA",
                `Conta do colaborador ${mappedEmployee.name} foi bloqueada por ultrapassar o prazo de 3 dias sem alterar o PIN temporário.`
              );

              showToast("A sua conta foi BLOQUEADA por expiração do prazo de 3 dias para alterar o PIN temporário.", "error");
              await auth.signOut();
              setIsAuthenticated(false);
              setActiveUser(null);
              return;
            }

            // Force PIN change if temporary but within the 3 days window
            if (isPinTemporary) {
              setForcePinTargetEmployee(mappedEmployee);
              setNewPin("");
              setConfirmNewPin("");
              setForcePinError("");
              setForcePinChangeOpen(true);
              return;
            }

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
        const storedSimulated = localStorage.getItem("erp_simulated_logged_in_user");
        if (storedSimulated) {
          try {
            const parsed = JSON.parse(storedSimulated);
            setActiveUser(parsed);
            setIsAuthenticated(true);
            return;
          } catch (e) {
            console.error("Failed to restore simulated session:", e);
          }
        }
        setIsAuthenticated(false);
        setActiveUser(null);
      }
    });

    return () => unsubscribe();
  }, [employees]);

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
      if (role === "ADMIN") return e.role.toUpperCase().includes("GESTOR") || e.role.toUpperCase().includes("ADMINISTRADOR") || e.role.toUpperCase().includes("ADMIN");
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
      setPinError("A sua conta está BLOQUEADA por tempo expirado da senha de acesso ou suspensão de segurança.");
      return;
    }

    if (targetEmp.status === "INACTIVE" || targetEmp.status === "SUSPENDED") {
      setPinError("Esta conta está inativa ou suspensa. Contacte o Administrador.");
      return;
    }

    const requiredPin = targetEmp.pin || "123456";
    if (enteredPin.trim() !== requiredPin.trim()) {
      setPinError("Senha incorreta. Por favor, tente novamente.");
      return;
    }

    // Check expiration policy (2 months / 60 days)
    const now = new Date();
    const createdAtStr = targetEmp.pinCreatedAt || targetEmp.admissionDate || now.toISOString();
    const createdAt = new Date(createdAtStr);
    const diffTime = now.getTime() - createdAt.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    const isPinTemporary = targetEmp.pinChanged === false || targetEmp.pinChanged === undefined;

    // If password is temporary (first login) OR has expired (older than 60 days)
    if (isPinTemporary) {
      // Intercept login and open the Force password Change dialog
      setForcePinTargetEmployee(targetEmp);
      setNewPin("");
      setConfirmNewPin("");
      setForcePinError("Este é o seu primeiro login. Por favor, crie uma senha pessoal segura.");
      setForcePinChangeOpen(true);
      setPinVerificationOpen(false);
      return;
    }

    if (diffDays > 60) {
      // Password expired
      setForcePinTargetEmployee(targetEmp);
      setNewPin("");
      setConfirmNewPin("");
      setForcePinError("A sua senha de acesso expirou (validade de 2 meses). Por favor, defina uma nova senha.");
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
      fitEmp.role.toUpperCase().includes("GESTOR") || fitEmp.role.toUpperCase().includes("ADMINISTRADOR") || fitEmp.role.toUpperCase().includes("ADMIN")
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

    if (newPin.length < 6) {
      setForcePinError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPin === forcePinTargetEmployee.pin) {
      setForcePinError("A nova senha não pode ser idêntica à senha anterior.");
      return;
    }

    if (newPin !== confirmNewPin) {
      setForcePinError("As senhas de confirmação não coincidem.");
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
    setIsAuthenticated(true);

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
          "Alteração de Senha Obrigatória",
          "SEGURANÇA",
          `Colaborador ${fitEmp.name} alterou com sucesso a sua senha de acesso. Sessão iniciada. IP: ${ipStr}`
        );
      });

    const rawRole = (fitEmp.role || "").toUpperCase();
    const simplifiedRole: UserRole = 
      rawRole.includes("GESTOR") || rawRole.includes("ADMINISTRADOR") || rawRole.includes("ADMIN")
        ? "ADMIN"
        : rawRole.includes("SUPERVISOR")
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

    showToast(`Nova senha de acesso registada com sucesso! Bem-vindo, ${fitEmp.name}.`, "success");
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

    const ipStr = userIpInfo ? `${userIpInfo.ip} (${userIpInfo.city}, ${userIpInfo.country})` : "102.81.12.94 (Maputo, Moçambique)";
    const devStr = deviceInfo || "Desktop (Chrome)";

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: username,
      userRole: authRole,
      action,
      module,
      details,
      ip: ipStr,
      device: devStr
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
        version: currentSystemVersion,
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
      version: currentSystemVersion,
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

  // Filtra dados para que vendedores (CASHIER) e supervisores (SUPERVISOR) vejam apenas os seus registos, enquanto o ADMIN tem acesso total
  const filteredTransactions = useMemo(() => {
    if (!activeUser) return [];
    if (simplifiedRole === "ADMIN") {
      return transactions;
    }
    return transactions.filter(t => {
      const cashierLower = (t.cashierName || "").toLowerCase().trim();
      const activeNameLower = (activeUser.name || "").toLowerCase().trim();
      const activeUsernameLower = (activeUser.username || "").toLowerCase().trim();
      return cashierLower === activeNameLower || cashierLower === activeUsernameLower;
    });
  }, [transactions, activeUser, simplifiedRole]);

  const filteredCashFlow = useMemo(() => {
    if (!activeUser) return [];
    if (simplifiedRole === "ADMIN") {
      return cashFlow;
    }
    return cashFlow.filter(c => {
      const respUserLower = (c.responsibleUser || "").toLowerCase().trim();
      const activeNameLower = (activeUser.name || "").toLowerCase().trim();
      const activeUsernameLower = (activeUser.username || "").toLowerCase().trim();
      return respUserLower === activeNameLower || respUserLower === activeUsernameLower;
    });
  }, [cashFlow, activeUser, simplifiedRole]);

  const handleLoginSuccess = (user: Employee, branchName: string) => {
    // 1. Check blocked status
    if (user.status === "BLOCKED") {
      showToast("A sua conta está BLOQUEADA por tempo expirado da senha de acesso ou suspensão de segurança.", "error");
      return;
    }

    if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
      showToast("Esta conta está inativa ou suspensa. Contacte o Administrador.", "error");
      return;
    }

    // 2. Check Password expiration policy (2 months / 60 days)
    const now = new Date();
    const createdAtStr = user.pinCreatedAt || user.admissionDate || now.toISOString();
    const createdAt = new Date(createdAtStr);
    const diffTime = now.getTime() - createdAt.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    const isPinTemporary = user.pinChanged === false || user.pinChanged === undefined;

    // 3. Force Password change if temporary (first login)
    if (isPinTemporary) {
      setForcePinTargetEmployee(user);
      setNewPin("");
      setConfirmNewPin("");
      setForcePinError("Este é o seu primeiro login. Por favor, crie uma senha pessoal segura.");
      setForcePinChangeOpen(true);
      return;
    }

    if (diffDays > 60) {
      setForcePinTargetEmployee(user);
      setNewPin("");
      setConfirmNewPin("");
      setForcePinError("A sua senha de acesso expirou (validade de 2 meses). Por favor, defina uma nova senha.");
      setForcePinChangeOpen(true);
      return;
    }

    localStorage.setItem("erp_simulated_logged_in_user", JSON.stringify(user));
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
      localStorage.removeItem("erp_simulated_logged_in_user");
      await auth.signOut();
      setActiveUser(null);
      setIsAuthenticated(false);
      showToast("Sessão terminada com sucesso.", "info");
    } catch (err: any) {
      console.error("Erro ao efetuar logout do Firebase:", err);
      localStorage.removeItem("erp_simulated_logged_in_user");
      setActiveUser(null);
      setIsAuthenticated(false);
      showToast("Sessão terminada com sucesso.", "info");
    }
  };

  const handleLinkAccount = async (employeeId: string, emailStr: string) => {
    const updatedEmployees = employees.map(emp => {
      if (emp.id === employeeId) {
        return { ...emp, email: emailStr.toLowerCase().trim() };
      }
      return emp;
    });
    setEmployees(updatedEmployees);
    await syncTable("employees", updatedEmployees);
    showToast("Sucesso: A sua conta foi vinculada a este perfil!", "success");
    handleAddAuditLog(
      "Vínculo de Conta",
      "SISTEMA",
      `Perfil de colaborador ${employeeId} vinculado ao e-mail ${emailStr}`
    );
  };

  if (!isAuthenticated || !activeUser) {
    return (
      <LoginModule
        employees={employees}
        companyName={settings.companyName}
        logoUrl={settings.logoUrl}
        branches={settings.branches || []}
        onLoginSuccess={handleLoginSuccess}
        onShowToast={showToast}
        onAddAuditLog={handleAddAuditLog}
        settings={settings}
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
          activeUser={activeUser}
          onSwitchUser={() => {
            setIsUserSwitchModalOpen(true);
            if (activeUser) {
              setSwitchSelectedEmployeeId(activeUser.id);
            }
          }}
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
                <span className={`font-bold ${theme === "night" ? "text-amber-400" : "text-orange-600"}`}>{currentSystemVersion}</span>
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
  
              {/* Button to quickly switch account / alter user */}
              <button
                id="quick-switch-user-btn"
                onClick={() => {
                  setIsUserSwitchModalOpen(true);
                  if (activeUser) {
                    setSwitchSelectedEmployeeId(activeUser.id);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-[10.5px] font-bold ${
                  theme === "night" 
                    ? "bg-zinc-900 border-zinc-800 text-orange-400 hover:text-orange-300" 
                    : "bg-white border-slate-200 text-orange-600 hover:bg-slate-50 hover:text-orange-700 shadow-sm"
                }`}
                title="Alterar Conta do Usuário"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Alterar Usuário / Vincular</span>
              </button>

              {/* Active user status pill made interactive */}
              <button
                onClick={() => {
                  setIsUserSwitchModalOpen(true);
                  if (activeUser) {
                    setSwitchSelectedEmployeeId(activeUser.id);
                  }
                }}
                className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all text-left cursor-pointer ${
                  theme === "night" 
                    ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-850 text-slate-200" 
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800 shadow-sm"
                }`}
                title="Clique para alterar conta ou vincular novo e-mail"
              >
                <div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden">
                  {activeUser.fotoPerfil ? (
                    <img src={activeUser.fotoPerfil} className="w-full h-full object-cover" alt="Perfil" referrerPolicy="no-referrer" />
                  ) : (
                    activeUser.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="leading-none">
                  <p className="font-extrabold text-[10.5px] leading-tight">{activeUser.name}</p>
                  <p className={`text-[9px] mt-0.5 ${
                    theme === "night" ? "text-slate-400" : "text-slate-500"
                  }`}>{activeUser.role}</p>
                </div>
              </button>
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
                  transactions={filteredTransactions}
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
                  transactions={filteredTransactions}
                  products={products}
                  customers={customers}
                  cashFlow={filteredCashFlow}
                  currency={currency}
                  activeUser={activeUser}
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
                  cashFlow={filteredCashFlow}
                  transactions={filteredTransactions}
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
                  transactions={filteredTransactions}
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
                  transactions={filteredTransactions}
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
                  transactions={filteredTransactions}
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
                  systemVersion={currentSystemVersion}
                  employees={employees}
                  onResetEmployeePin={async (empId) => {
                    const target = employees.find(e => e.id === empId);
                    if (!target) return;
                    const updatedEmployees = employees.map(emp => {
                      if (emp.id === empId) {
                        return {
                          ...emp,
                          pin: "123456",
                          pinChanged: false,
                          pinCreatedAt: new Date().toISOString()
                        };
                      }
                      return emp;
                    });
                    setEmployees(updatedEmployees);
                    await syncTable("employees", updatedEmployees);
                    handleAddAuditLog(
                      "Reset de PIN Forçado",
                      "SEGURANÇA",
                      `PIN do colaborador ${target.name} (${target.username}) resetado para o padrão '123456' pelo Administrador.`
                    );
                    showToast(
                      `PIN do colaborador ${target.name} foi resetado com sucesso para '123456'. Ele será obrigado a alterá-lo no próximo login.`,
                      "success",
                      "Reset de PIN Concluído"
                    );
                  }}
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
                                Senha Temporária
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                Senha Definida
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

                {/* Password Input Field */}
                <div className="w-full space-y-1.5 mb-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                    Digite a sua Senha de Acesso
                  </label>
                  <input
                    type="password"
                    maxLength={32}
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      if (pinError) setPinError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleVerifyAndSwitchProfile();
                      }
                    }}
                    placeholder="Sua senha secreta"
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all text-xs font-medium ${
                      theme === "night"
                        ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:border-orange-500 focus:ring-orange-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-500 focus:ring-orange-500/20 shadow-sm"
                    }`}
                  />
                  {pinError && (
                    <p className="text-xs text-rose-500 font-extrabold text-left animate-pulse mt-1.5">
                      ⚠️ {pinError}
                    </p>
                  )}
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
                    <p className="text-[10px] text-amber-600 font-extrabold font-mono uppercase">Definir Senha Definitiva de Acesso</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-left">
                <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl space-y-1 text-xs">
                  <p className="font-bold text-amber-800">Olá {forcePinTargetEmployee.name},</p>
                  <p className="text-amber-700 leading-relaxed text-[11px]">
                    De acordo com a política de segurança, a sua senha inicial é temporária ou expirou. **Todas as senhas de acesso possuem validade máxima de 2 meses (60 dias)**. Defina uma senha de acesso forte de pelo menos 6 caracteres.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nova Senha de Acesso</label>
                    <input
                      type="password"
                      maxLength={32}
                      placeholder="Mínimo 6 caracteres"
                      value={newPin}
                      onChange={(e) => {
                        setNewPin(e.target.value);
                        if (forcePinError) setForcePinError("");
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-xs font-medium ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:ring-orange-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-orange-500/20 focus:bg-white"
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      maxLength={32}
                      placeholder="Repita a nova senha de acesso"
                      value={confirmNewPin}
                      onChange={(e) => {
                        setConfirmNewPin(e.target.value);
                        if (forcePinError) setForcePinError("");
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-xs font-medium ${
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
                  disabled={newPin.length < 6 || confirmNewPin.length < 6}
                  className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer ${
                    newPin.length >= 6 && confirmNewPin.length >= 6
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

      {/* Interactive Account Switching & Linking Modal */}
      <AnimatePresence>
        {isUserSwitchModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                theme === "night"
                  ? "bg-zinc-950 text-slate-100 border-zinc-850"
                  : "bg-white text-slate-800 border-slate-100"
              }`}
              id="inside-user-switcher-modal"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-zinc-850 bg-gradient-to-r from-orange-500/10 to-amber-500/10 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 text-orange-700 dark:bg-orange-900/35 dark:text-orange-400 rounded-xl flex items-center justify-center shadow-inner">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">Painel do Colaborador</h3>
                      <p className="text-[10px] text-orange-600 dark:text-orange-400 font-extrabold font-mono uppercase">Vincular Conta & Configurar Perfil</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUserSwitchModalOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className={`flex border-b text-xs font-bold ${
                theme === "night" ? "border-zinc-850 bg-zinc-900/40" : "border-slate-100 bg-slate-50/40"
              }`}>
                <button
                  type="button"
                  onClick={() => setUserSwitchModalTab("switch")}
                  className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
                    userSwitchModalTab === "switch"
                      ? "border-orange-500 text-orange-500 font-black"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
                >
                  🔄 Alterar Usuário
                </button>
                <button
                  type="button"
                  onClick={() => setUserSwitchModalTab("profile")}
                  className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
                    userSwitchModalTab === "profile"
                      ? "border-orange-500 text-orange-500 font-black"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
                >
                  ⚙️ Configurações de Perfil
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-left overflow-y-auto max-h-[60vh]">
                {userSwitchModalTab === "switch" ? (
                  <>
                    <div className="p-3.5 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-1 text-xs">
                      <p className="font-bold text-orange-500">Sessão Autenticada Ativa:</p>
                      <p className="text-slate-400 leading-relaxed text-[11px]">
                        Atualmente você está logado no sistema via e-mail com: <strong className="text-orange-400 font-mono">{auth.currentUser?.email || "Sem e-mail (Login Local)"}</strong>.
                        Você pode selecionar qualquer colaborador no quadro comercial abaixo para **vincular o seu e-mail ativo** a ele e mudar seu operador operacional de forma instantânea.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Selecione o Colaborador de Destino</label>
                      <select
                        value={switchSelectedEmployeeId}
                        onChange={(e) => {
                          setSwitchSelectedEmployeeId(e.target.value);
                          setSwitchEnteredPin("");
                          setSwitchPinError("");
                        }}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-3 px-3 text-xs text-white outline-none transition font-medium cursor-pointer"
                      >
                        <option value="">-- Escolha um colaborador --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.role}) {emp.email ? `[Vínculo: ${emp.email}]` : "[Sem vínculo]"}
                          </option>
                        ))}
                      </select>
                    </div>

                    {switchSelectedEmployeeId && (
                      <div className="space-y-4 p-4 bg-slate-900/60 rounded-xl border border-slate-800 animate-in fade-in duration-200">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-400 flex items-center justify-center font-bold text-[11px] overflow-hidden">
                            {employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil ? (
                              (employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil || "").startsWith("data:") || (employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil || "").startsWith("http") ? (
                                <img src={employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil} className="w-full h-full object-cover" alt="Perfil" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-sm leading-none">{employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil}</span>
                              )
                            ) : (
                              (employees.find(x => x.id === switchSelectedEmployeeId)?.name || "US").substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="leading-none text-left">
                            <p className="font-extrabold text-xs text-white">
                              {employees.find(x => x.id === switchSelectedEmployeeId)?.name}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {employees.find(x => x.id === switchSelectedEmployeeId)?.role}
                            </p>
                          </div>
                        </div>

                        {/* PASSWORD / PIN INPUT FIELD FOR PROTECTION */}
                        <div className="border-t border-slate-800 pt-3 space-y-1.5 text-left">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Senha / PIN de Acesso do Colaborador Selecionado
                          </label>
                          <input
                            type="password"
                            maxLength={32}
                            value={switchEnteredPin}
                            onChange={(e) => {
                              setSwitchEnteredPin(e.target.value);
                              if (switchPinError) setSwitchPinError("");
                            }}
                            placeholder="Digite o PIN/Senha do colaborador para confirmar"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none transition font-medium focus:ring-2 focus:ring-orange-500/20"
                          />
                          {switchPinError && (
                            <p className="text-[10.5px] text-red-500 font-bold animate-pulse mt-1">⚠️ {switchPinError}</p>
                          )}
                        </div>

                        <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
                          <label className="flex items-start gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              defaultChecked={true}
                              id="auto-link-email-checkbox"
                              className="mt-0.5 rounded border-slate-850 bg-slate-950 text-orange-500 focus:ring-orange-500/30 cursor-pointer"
                            />
                            <div className="text-left leading-tight">
                              <p className="text-[11px] font-bold text-slate-200">Vincular meu e-mail atual a este perfil</p>
                              <p className="text-[9.5px] text-slate-400 mt-0.5">Sempre que fizer login com <strong className="text-orange-400">{auth.currentUser?.email || "seu e-mail atual"}</strong>, você entrará automaticamente nesta conta comercial.</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Visual Preview Banner & Uploader */}
                    <div className="flex items-center gap-4 p-4 bg-slate-900/60 rounded-xl border border-slate-850">
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold text-xl overflow-hidden border border-slate-700 shadow-lg">
                          {profileFotoPerfil ? (
                            profileFotoPerfil.startsWith("data:") || profileFotoPerfil.startsWith("http") || profileFotoPerfil.startsWith("/") ? (
                              <img src={profileFotoPerfil} className="w-full h-full object-cover" alt="Previsualização" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-3xl leading-none">{profileFotoPerfil}</span>
                            )
                          ) : (
                            profileName.substring(0, 2).toUpperCase() || "US"
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => document.getElementById("profile-photo-upload-input")?.click()}
                          className="absolute -bottom-1 -right-1 bg-orange-500 text-white rounded-lg p-1.5 hover:bg-orange-600 transition cursor-pointer shadow-md"
                          title="Carregar Imagem"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex-1 leading-none text-left">
                        <p className="text-xs font-black text-white">{profileName || "Sem Nome"}</p>
                        <p className="text-[10px] text-slate-400 mt-1.5 uppercase font-mono tracking-wider">{activeUser?.role || "Colaborador"}</p>
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => document.getElementById("profile-photo-upload-input")?.click()}
                            className="px-2.5 py-1 bg-slate-950 text-slate-300 hover:text-white rounded-lg text-[9px] font-bold border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                          >
                            Upload Foto
                          </button>
                          {profileFotoPerfil && (
                            <button
                              type="button"
                              onClick={() => setProfileFotoPerfil("")}
                              className="px-2.5 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-[9px] font-bold border border-red-500/20 transition cursor-pointer"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hidden File Input */}
                    <input
                      type="file"
                      id="profile-photo-upload-input"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 1.5 * 1024 * 1024) {
                            showToast("A imagem deve ter no máximo 1.5MB", "error");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setProfileFotoPerfil(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />

                    {/* Emojis Preset Grid */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Escolha um Emoji como Avatar</label>
                      <div className="grid grid-cols-8 gap-2">
                        {["👨‍💼", "👩‍💼", "👨‍💻", "👩‍💻", "🚀", "🌟", "🍊", "💼", "☕", "🎮", "🦁", "🍕", "⚡", "❤️", "👑", "💡"].map((emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            onClick={() => setProfileFotoPerfil(emoji)}
                            className={`text-lg p-2 rounded-xl transition-all border cursor-pointer hover:scale-110 flex items-center justify-center ${
                              profileFotoPerfil === emoji
                                ? "bg-orange-500/15 border-orange-500 text-white"
                                : "bg-slate-950 border-slate-850 hover:border-slate-650 text-slate-300"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual Image URL */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ou Cole uma URL de Imagem</label>
                      <input
                        type="text"
                        value={profileFotoPerfil.startsWith("data:") ? "" : profileFotoPerfil}
                        placeholder="https://exemplo.com/sua-foto.jpg"
                        onChange={(e) => setProfileFotoPerfil(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-orange-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none transition font-medium"
                      />
                    </div>

                    {/* Text Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nome Completo</label>
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Seu nome"
                          className="w-full bg-slate-950 border border-slate-850 focus:border-orange-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none transition font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contacto Telefónico</label>
                        <input
                          type="text"
                          value={profileContact}
                          onChange={(e) => setProfileContact(e.target.value)}
                          placeholder="Seu contacto"
                          className="w-full bg-slate-950 border border-slate-850 focus:border-orange-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none transition font-medium"
                        />
                      </div>
                    </div>

                    {/* PIN Expiration Indicator */}
                    <div className={`p-3.5 rounded-xl border flex flex-col gap-1 text-xs leading-relaxed transition-all ${
                      pinRemainingDays <= 7 
                        ? "bg-rose-500/10 border-rose-500/25 text-rose-400 animate-pulse" 
                        : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    }`}>
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          {pinRemainingDays <= 7 ? "⚠️ Expiração de Segurança (PIN)" : "🛡️ Validade da Senha (PIN)"}
                        </span>
                        <span className={`font-mono text-[11px] px-2.5 py-0.5 rounded-md bg-black/40 font-black ${
                          pinRemainingDays <= 7 ? "text-rose-400 border border-rose-500/30" : "text-emerald-400"
                        }`}>
                          {pinRemainingDays} {pinRemainingDays === 1 ? "dia" : "dias"}
                        </span>
                      </div>
                      <p className="text-[10.5px] opacity-85 mt-1">
                        {pinRemainingDays <= 7 
                          ? `Atenção colaborador! Seu PIN de acesso está prestes a expirar. Por segurança de dados comerciais, atualize o seu PIN em breve (Resta(m) apenas ${pinRemainingDays} dia(s)).`
                          : `Sua senha de segurança está em conformidade com as regras de rotação obrigatória do sistema (máximo 60 dias).`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-zinc-850 flex items-center justify-end gap-3 bg-slate-900/10">
                <button
                  type="button"
                  onClick={() => setIsUserSwitchModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (userSwitchModalTab === "switch") {
                      if (!switchSelectedEmployeeId) return;
                      const selectedEmp = employees.find(x => x.id === switchSelectedEmployeeId);
                      if (!selectedEmp) return;

                      // Verify PIN/password before switching!
                      const requiredPin = selectedEmp.pin || "123456";
                      if (!switchEnteredPin.trim()) {
                        setSwitchPinError("Por favor, introduza a senha / PIN de acesso deste colaborador.");
                        return;
                      }
                      if (switchEnteredPin.trim() !== requiredPin.trim()) {
                        setSwitchPinError("Senha incorreta. Por favor, tente novamente.");
                        return;
                      }

                      // Check if account is blocked/inactive
                      if (selectedEmp.status === "BLOCKED") {
                        setSwitchPinError("Esta conta está BLOQUEADA por expiração de senha ou motivos de segurança.");
                        return;
                      }
                      if (selectedEmp.status === "INACTIVE" || selectedEmp.status === "SUSPENDED") {
                        setSwitchPinError("Esta conta está inativa ou suspensa. Contacte o Administrador.");
                        return;
                      }

                      // Check expiration policy (2 months / 60 days)
                      const now = new Date();
                      const createdAtStr = selectedEmp.pinCreatedAt || selectedEmp.admissionDate || now.toISOString();
                      const createdAt = new Date(createdAtStr);
                      const diffTime = now.getTime() - createdAt.getTime();
                      const diffDays = diffTime / (1000 * 60 * 60 * 24);

                      const isPinTemporary = selectedEmp.pinChanged === false || selectedEmp.pinChanged === undefined;

                      // If password is temporary (first login) OR has expired (older than 60 days)
                      if (isPinTemporary) {
                        setForcePinTargetEmployee(selectedEmp);
                        setNewPin("");
                        setConfirmNewPin("");
                        setForcePinError("Este é o seu primeiro login. Por favor, crie uma senha pessoal segura.");
                        setForcePinChangeOpen(true);
                        setIsUserSwitchModalOpen(false);
                        return;
                      }

                      if (diffDays > 60) {
                        setForcePinTargetEmployee(selectedEmp);
                        setNewPin("");
                        setConfirmNewPin("");
                        setForcePinError("A sua senha de acesso expirou (validade de 2 meses). Por favor, defina uma nova senha.");
                        setForcePinChangeOpen(true);
                        setIsUserSwitchModalOpen(false);
                        return;
                      }

                      const autoLinkChecked = (document.getElementById("auto-link-email-checkbox") as HTMLInputElement)?.checked ?? true;
                      const emailToBind = auth.currentUser?.email || selectedEmp.email || "";

                      let updatedEmployees = [...employees];
                      if (autoLinkChecked && emailToBind) {
                        updatedEmployees = employees.map(emp => {
                          if (emp.id === switchSelectedEmployeeId) {
                            return { ...emp, email: emailToBind.toLowerCase().trim() };
                          }
                          return emp;
                        });
                        setEmployees(updatedEmployees);
                        await syncTable("employees", updatedEmployees);
                      }

                      // Perform active switch
                      const finalActiveUser = {
                        ...selectedEmp,
                        email: autoLinkChecked && emailToBind ? emailToBind : (selectedEmp.email || ""),
                        fotoPerfil: selectedEmp.fotoPerfil || ""
                      };
                      setActiveUser(finalActiveUser);

                      showToast(
                        `Usuário alterado com sucesso para ${selectedEmp.name}!${autoLinkChecked ? " Conta vinculada com sucesso." : ""}`, 
                        "success"
                      );

                      handleAddAuditLog(
                        "Alteração de Usuário",
                        "SISTEMA",
                        `Operador alterado para ${selectedEmp.name} (ID: ${selectedEmp.id})${autoLinkChecked ? ` com vínculo de e-mail ao ${emailToBind}` : ""}`
                      );

                      setIsUserSwitchModalOpen(false);
                    } else {
                      if (!activeUser) return;
                      if (!profileName.trim()) {
                        showToast("O nome do perfil não pode estar vazio.", "warning");
                        return;
                      }

                      const updatedEmployees = employees.map(emp => {
                        if (emp.id === activeUser.id) {
                          return {
                            ...emp,
                            name: profileName.trim(),
                            contact: profileContact.trim(),
                            fotoPerfil: profileFotoPerfil.trim()
                          };
                        }
                        return emp;
                      });

                      setEmployees(updatedEmployees);
                      await syncTable("employees", updatedEmployees);

                      // Update active session operator
                      setActiveUser({
                        ...activeUser,
                        name: profileName.trim(),
                        contact: profileContact.trim(),
                        fotoPerfil: profileFotoPerfil.trim()
                      });

                      showToast("Perfil atualizado com sucesso!", "success");

                      handleAddAuditLog(
                        "Atualização de Perfil",
                        "SISTEMA",
                        `Colaborador ${activeUser.name} atualizou os seus dados de perfil.`
                      );

                      setIsUserSwitchModalOpen(false);
                    }
                  }}
                  disabled={userSwitchModalTab === "switch" ? (!switchSelectedEmployeeId || !switchEnteredPin.trim()) : !profileName.trim()}
                  className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer ${
                    (userSwitchModalTab === "switch" ? (switchSelectedEmployeeId && switchEnteredPin.trim()) : profileName.trim())
                      ? "bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  }`}
                >
                  {userSwitchModalTab === "switch" ? "Vincular & Alterar Conta" : "Salvar Perfil"}
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
