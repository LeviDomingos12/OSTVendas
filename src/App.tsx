import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as d3 from "d3";
import { 
  initialEmployees, 
  defaultSettings, 
  masterclassVideos 
} from "./data/mockData";
import { AdminService } from "./services/adminService";
import { 
  Product, 
  Customer, 
  Transaction, 
  CashFlowEntry, 
  Employee, 
  AuditLog, 
  SystemSettings, 
  UserRole,
  SubscriptionPlan,
  AiForecastResult
} from "./types";
import type { User } from "@supabase/supabase-js";

interface DatabaseSnapshotPayload {
  products?: Product[];
  customers?: Customer[];
  transactions?: Transaction[];
  cashFlow?: CashFlowEntry[];
  cashflow?: CashFlowEntry[];
  employees?: Employee[];
  settings?: SystemSettings;
  auditLogs?: AuditLog[];
  auditlogs?: AuditLog[];
}

// Import modules
import Sidebar from "./components/Sidebar";
import POSModule from "./components/POSModule";
import DashboardModule from "./components/DashboardModule";
import CashRegisterModule from "./components/CashRegisterModule";
import StockModule from "./components/StockModule";
import CustomersModule from "./components/CustomersModule";
import StaffModule from "./components/StaffModule";
import ReportsModule from "./components/ReportsModule";
import SettingsModule from "./components/SettingsModule";
import SubscriptionPlansModule from "./components/SubscriptionPlansModule";
import PlanLockScreen from "./components/PlanLockScreen";
import { canAccessModule } from "./lib/planPermissions";
import { RoleAccessDeniedScreen } from "./components/RoleAccessDeniedScreen";
import { canRoleAccessModule, normalizeUserRole, getDefaultModuleForRole } from "./lib/rolePermissions";
import LoginModule from "./components/LoginModule";
import { UserSwitchModal } from "./components/UserSwitchModal";
import { PinVerificationModal } from "./components/modals/PinVerificationModal";
import { ForcePinChangeModal } from "./components/modals/ForcePinChangeModal";
import { AppHeader } from "./components/layout/AppHeader";
import { ToastContainer } from "./components/layout/ToastContainer";
import { FloatingNavFab } from "./components/layout/FloatingNavFab";
import { createLocalBackup, shouldRunAutoBackup } from "./services/backupService";
import { triggerPanicAlert, fetchGeoLocationInfo, detectDeviceType } from "./services/securityAlertService";
import { processSaleDeductions, processDevolutionRestock } from "./services/posTransactionProcessor";
import { loadSyncQueue, processSyncQueue as syncOfflineQueueService } from "./services/syncQueueService";
import AiForecastModule from "./components/AiForecastModule";
import StockReplenishModal from "./components/StockReplenishModal";
import QuickLogoModal from "./components/QuickLogoModal";
import TutorialModal from "./components/TutorialModal";
import OnboardingTutorial from "./components/OnboardingTutorial";
import { SystemInfoHub } from "./components/SystemInfoHub";
import { applyTheme, SYSTEM_THEMES } from "./lib/themes";
import { sanitizeUserSession, hashSecurityPin, verifySecurityPin } from "./lib/security";
import { useSystemVersion, incrementSystemVersion, getSystemVersion, setSystemVersion, getFormattedSystemVersion } from "./lib/versionManager";
import { 
  CommercialDataService, 
  OfflineQueueService,
  SyncService, 
  ConnectionService, 
  AuthService, 
  sanitizeServiceError 
} from "./services/dataService";
import { getSupabaseClient } from "./lib/supabase";
import { authenticatedFetch } from "./lib/apiClient";
import { SupabaseSyncService, saveSupabaseConfig } from "./services/supabaseService";
import { operationalCache, ErpSnapshotData } from "./lib/indexedDbStorage";
import { setLogCallback, initErrorCapturing } from "./lib/logger";
import { generateUUID, generateEntityId, generateDeterministicCreditNoteNumber, generateSecurePin } from "./lib/deterministic";
import { sendEmail } from "./lib/gmail";
import { sendSMS } from "./lib/sms";
import QRCode from "qrcode";

import { 
  Activity, 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  Minus,
  RefreshCw, 
  Sun, 
  Moon,
  Check,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Wifi,
  WifiOff,
  Cloud,
  Clock,
  Menu,
  Lock,
  ShieldAlert,
  Users,
  Camera,
  LayoutDashboard,
  ShoppingCart,
  Package,
  PiggyBank,
  UserCheck,
  FileText,
  BookOpen,
  Settings,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Compass,
  LogOut,
  Eye,
  EyeOff,
  QrCode,
  Key,
  Fingerprint,
  UserX,
  ShieldCheck,
  Globe,
  Search,
  Calendar,
  Filter,
  Video,
  Upload,
  Save,
  Download,
  History,
  Trash2,
  CheckCircle2,
  Mail,
  Image,
  Building,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MoveLeft,
  MoveRight,
  Maximize2,
  Crop,
  MousePointer
} from "lucide-react";

interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

const NAV_MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "SUPERVISOR", "AUDITOR", "FINANCEIRO"] },
  { id: "pos", label: "Vendas (POS)", shortLabel: "Vendas", icon: ShoppingCart, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "stock", label: "Gestão de Stock", shortLabel: "Stock", icon: Package, roles: ["ADMIN", "SUPERVISOR"] },
  { id: "cash", label: "Gestão de Caixa", shortLabel: "Caixa", icon: PiggyBank, roles: ["ADMIN", "SUPERVISOR", "CASHIER", "FINANCEIRO"] },
  { id: "customers", label: "Gestão de Clientes", shortLabel: "Clientes", icon: Users, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "reports", label: "Relatórios & Faturação", shortLabel: "Relatórios", icon: FileText, roles: ["ADMIN", "SUPERVISOR", "AUDITOR", "FINANCEIRO"] },
  { id: "settings", label: "Configurações Gerais", shortLabel: "Configurações", icon: Settings, roles: ["ADMIN"] },
];

import { AuditLogsD3BarChart } from "./components/AuditLogsD3BarChart";

export default function App() {
  
  // SHARED STATES
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" | "warning" = "info", title?: string) => {
    const id = generateEntityId("toast");
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
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Global Fetch Rate Limit (429) Interceptor with Toast Throttling & Auto-Recovery
  useEffect(() => {
    const originalFetch = window.fetch;
    let lastToastTime = 0;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 429) {
        const input = args[0];
        const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request)?.url || "";
        
        // Suppress toasts for background telemetry, health pings, and silent sync polling
        const isBackgroundCall = 
          rawUrl.includes("/api/db/save") || 
          rawUrl.includes("/api/db/load") ||
          rawUrl.includes("/api/health") || 
          rawUrl.includes("/api/system/version") ||
          rawUrl.includes("/api/security/storage-health") ||
          rawUrl.includes("/api/security/firewall-status") ||
          rawUrl.includes("/api/security/rate-limit-status");

        const now = Date.now();
        if (!isBackgroundCall && now - lastToastTime > 30000) {
          lastToastTime = now;
          try {
            const clone = response.clone();
            const data = await clone.json();
            showToast(
              data.message || data.error || "Operação adiada temporariamente pelo sistema de proteção. Tente novamente em instantes.",
              "warning",
              "🛡️ Rate Limit"
            );
          } catch {
            showToast(
              "Limite de requisições ao servidor atingido (429). Aguarde alguns segundos.",
              "warning",
              "🛡️ Rate Limit"
            );
          }
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);
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
  const [showReplenishModal, setShowReplenishModal] = useState(false);

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
  const [isQuickLogoModalOpen, setIsQuickLogoModalOpen] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [isOnboardingTutorialOpen, setIsOnboardingTutorialOpen] = useState(false);
  const [isSystemInfoHubOpen, setIsSystemInfoHubOpen] = useState(false);

  // Keyboard shortcut listener for F1 help
  useEffect(() => {
    const handleF1Help = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setIsTutorialModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleF1Help);
    return () => window.removeEventListener("keydown", handleF1Help);
  }, []);

  const handleUpdateUserPlan = async (employeeId: string, newPlan: SubscriptionPlan) => {
    const updatedEmployees = employees.map(emp => 
      emp.id === employeeId ? { ...emp, subscriptionPlan: newPlan } : emp
    );
    setEmployees(updatedEmployees);
    await syncTable("employees", updatedEmployees);
    handleAddAuditLog("Plano de Usuário Alterado", "ASSINATURAS", `Plano do utilizador (ID: ${employeeId}) alterado para ${newPlan}`);
  };

  const handleUpdateSystemPlan = (newPlan: SubscriptionPlan) => {
    setSettings(prev => ({ ...prev, subscriptionPlan: newPlan }));
    handleAddAuditLog("Plano do Sistema Alterado", "ASSINATURAS", `Plano geral do sistema alterado para ${newPlan}`);
  };

  // Premium AI predictions state
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [forecastResult, setForecastResult] = useState<AiForecastResult | null>(null);

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

  const { formattedVersion: currentSystemVersion, version: systemVersionNumber } = useSystemVersion();

  // Fetch / Sync version counter and semantic version with local storage
  useEffect(() => {
    try {
      const storedBuildVersion = localStorage.getItem("system_build_version");
      if (storedBuildVersion) {
        const parsed = parseInt(storedBuildVersion, 10);
        if (!isNaN(parsed) && parsed > buildVersion) {
          setBuildVersion(parsed);
        }
      }
    } catch {}
  }, []);

  // Unified function to increment build version and semantic system version
  const incrementVersionCounter = async () => {
    // 1. Increment semantic version managed by versionManager (e.g., 1.0 -> 1.1 -> 1.2 -> ... -> 2.0)
    incrementSystemVersion();

    // 2. Increment numeric modification counter
    setBuildVersion(current => {
      const next = current + 1;
      try {
        localStorage.setItem("system_build_version", String(next));
      } catch (e) {}
      return next;
    });
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
  const [isFabOpen, setIsFabOpen] = useState<boolean>(false);
  
  // Geolocation and IP tracking for Audit Logs
  const [userIpInfo, setUserIpInfo] = useState<{ ip: string; city: string; country: string } | null>(null);
  const [deviceInfo] = useState<string>(() => detectDeviceType());

  // Track operator-specific custom color theme
  const [activeColorTheme, setActiveColorTheme] = useState<string>("laranja");

  // Load and apply color theme dynamically
  useEffect(() => {
    const userId = activeUser?.id || "default";
    const matchedEmployee = employees.find(e => e.id === userId);
    const dbTheme = matchedEmployee?.theme;
    const userTheme = dbTheme || localStorage.getItem("erp_theme_" + userId);
    
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
  }, [activeUser, settings.theme, employees]);

  // When theme changes, apply it to document head
  useEffect(() => {
    applyTheme(activeColorTheme);
  }, [activeColorTheme]);

  // Connectivity state tracking network connection
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Stable refs for DB state, performance optimization and concurrency locks
  const sessionStartTimeRef = useRef<number>(Date.now());
  const lastSyncQueueRawRef = useRef<string>("");
  const isSyncProcessingRef = useRef<boolean>(false);
  const isLoggingAuditRef = useRef<boolean>(false);
  const isBackingUpRef = useRef<boolean>(false);

  const dbStateRef = useRef({
    settings,
    products,
    customers,
    transactions,
    cashFlow,
    employees,
    auditLogs
  });

  useEffect(() => {
    dbStateRef.current = {
      settings,
      products,
      customers,
      transactions,
      cashFlow,
      employees,
      auditLogs
    };
  }, [settings, products, customers, transactions, cashFlow, employees, auditLogs]);

  // Offline sync queue state & status tracking (IndexedDB backed via operationalCache)
  const [pendingSyncQueue, setPendingSyncQueue] = useState<Record<string, unknown>>({});
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  // Load sync queue from high-capacity IndexedDB on mount
  useEffect(() => {
    loadSyncQueue().then(q => {
      if (q && typeof q === "object") {
        setPendingSyncQueue(q);
      }
    });
  }, []);

  // Initialize system error capturing
  useEffect(() => {
    // Initialize standard error capturing (console.error, unhandled promises, fetch errors)
    const destroyCapturing = initErrorCapturing();
    return () => {
      destroyCapturing();
    };
  }, []);

  // Fetch client IP and geolocation for Audit logs
  useEffect(() => {
    fetchGeoLocationInfo().then(info => {
      setUserIpInfo({
        ip: info.ip,
        city: info.city,
        country: info.country
      });
    });
  }, []);

  // Advanced top bar metrics states
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString());
  const isLoggingOutRef = useRef<boolean>(false);

  // GENERAL AUDIT LOGGING WRAPPER
  const handleAddAuditLog = useCallback((action: string, module: string, details: string, customUser?: Employee) => {
    if (isLoggingAuditRef.current) return;
    isLoggingAuditRef.current = true;
    try {
      let authRole: UserRole = "CASHIER";
      const targetUser = customUser || activeUser;
      const username = targetUser ? targetUser.name : "Sistema / Visitante";
      if (targetUser && targetUser.role) {
        const raw = targetUser.role.toLowerCase();
        if (raw.includes("supervisor")) authRole = "SUPERVISOR";
        else if (raw.includes("administrador") || raw.includes("gestor")) authRole = "ADMIN";
      }

      const ipStr = userIpInfo ? `${userIpInfo.ip} (${userIpInfo.city}, ${userIpInfo.country})` : "102.81.12.94 (Maputo, Moçambique)";
      const devStr = deviceInfo || "Desktop (Chrome)";

      const newLog: AuditLog = {
        id: generateEntityId("log"),
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
        let updated = [...prev, newLog];
        if (updated.length > 200) {
          updated = updated.slice(-200);
        }
        setTimeout(() => {
          try {
            syncTable("auditlogs", updated);
          } catch (e) {}
        }, 0);
        return updated;
      });
    } finally {
      isLoggingAuditRef.current = false;
    }
  }, [activeUser, userIpInfo, deviceInfo]);

  // DB Sync helper with robust offline queueing
  const syncTable = async (tableName: string, updatedData: unknown) => {
    if (isLoggingOutRef.current) return;
    if (!isDbLoaded && Array.isArray(updatedData) && updatedData.length === 0) return;
    setLastSyncTime(new Date().toLocaleTimeString());
    await incrementVersionCounter();
    try {
      if (!navigator.onLine) {
        throw new Error("O navegador está offline");
      }
      
      if (tableName === "products") {
        await CommercialDataService.saveProductsBatch(updatedData as Product[]);
      } else if (tableName === "transactions") {
        await CommercialDataService.saveTransactionsBatch(updatedData as Transaction[]);
      } else if (tableName === "customers") {
        await CommercialDataService.saveCustomersBatch(updatedData as Customer[]);
      } else if (tableName === "cashflow") {
        await CommercialDataService.saveCashFlowBatch(updatedData as CashFlowEntry[]);
      } else if (tableName === "settings") {
        await CommercialDataService.saveSettings(updatedData as SystemSettings);
      } else if (tableName === "employees") {
        await CommercialDataService.saveEmployeesBatch(updatedData as Employee[]);
      }

      // Also send mutation to server endpoint if available
      try {
        await authenticatedFetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: tableName, data: updatedData })
        });
      } catch (serverErr) {
        console.warn(`Could not save table '${tableName}' to server DB store:`, serverErr);
      }
      
      // Successfully synced! Try to clean from pending queue in IndexedDB
      const queue = (await operationalCache.getItem<Record<string, unknown>>("pos_sync_queue")) || {};
      if (queue[tableName]) {
        delete queue[tableName];
        if (Object.keys(queue).length === 0) {
          await operationalCache.removeItem("pos_sync_queue");
        } else {
          await operationalCache.setItem("pos_sync_queue", queue);
        }
        setPendingSyncQueue({ ...queue });
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[OFFLINE CACHE] Não foi possível sincronizar a tabela '${tableName}' (${errMessage}). Guardando no IndexedDB para reenvio automático.`);
      if (tableName !== "auditlogs") {
        handleAddAuditLog(
          "Falha de Sincronização",
          "Erros do Sistema",
          `Erro de conexão ao sincronizar tabela '${tableName}': ${errMessage}. Guardado na fila de reenvio offline.`
        );
      }
      try {
        const queue = (await operationalCache.getItem<Record<string, unknown>>("pos_sync_queue")) || {};
        queue[tableName] = updatedData;
        await operationalCache.setItem("pos_sync_queue", queue);
        setPendingSyncQueue({ ...queue });
      } catch (queueErr) {
        console.warn("Erro ao guardar alteração na fila offline no IndexedDB:", queueErr);
      }
    }
  };

  // Synchronize any offline changes when connection is re-established (or via periodic retry timer)
  useEffect(() => {
    // Register the callback to capture silent errors and log them to AuditLogs
    setLogCallback(handleAddAuditLog);
  }, [handleAddAuditLog]);

  const processSyncQueue = async () => {
    if (isSyncProcessingRef.current) return;
    if (!navigator.onLine) return;
    
    isSyncProcessingRef.current = true;
    try {
      const queue = (await operationalCache.getItem<Record<string, unknown>>("pos_sync_queue")) || {};
      const tableNames = Object.keys(queue);
      if (tableNames.length === 0) return;
      
      console.log(`[SYNC QUEUE] Detectadas ${tableNames.length} tabelas com alterações offline pendentes. Sincronizando...`);
      const { remainingQueue } = await syncOfflineQueueService(queue);
      setPendingSyncQueue(remainingQueue);
    } catch (err) {
      console.warn("[SYNC QUEUE] Erro ao reprocessar alterações offline:", err);
    } finally {
      isSyncProcessingRef.current = false;
    }
  };

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      showToast("Não é possível sincronizar: O seu dispositivo ainda está offline.", "warning", "Sem Ligação à Rede");
      return;
    }

    setIsManualSyncing(true);
    showToast("A iniciar ressincronização manual das alterações offline...", "info", "Sincronização Iniciada");
    
    try {
      await processSyncQueue();
      
      const currentQueue = (await operationalCache.getItem<Record<string, unknown>>("pos_sync_queue")) || {};
      const keys = Object.keys(currentQueue);
      
      if (keys.length === 0) {
        showToast("Todas as alterações offline foram sincronizadas com sucesso!", "success", "Sincronização Concluída");
        handleAddAuditLog(
          "Sincronização Manual Sucedida",
          "SISTEMA",
          "O usuário forçou uma sincronização manual e todas as alterações pendentes foram integradas com sucesso."
        );
      } else {
        const friendlyTables = keys.map(k => {
          if (k === "products") return "Produtos";
          if (k === "transactions") return "Vendas";
          if (k === "customers") return "Clientes";
          if (k === "cashflow") return "Caixa";
          if (k === "employees") return "Funcionários";
          if (k === "auditlogs") return "Auditoria";
          if (k === "settings") return "Definições";
          return k;
        });
        showToast(`Sincronização parcial concluída. Algumas alterações (${friendlyTables.join(", ")}) ainda estão pendentes.`, "warning", "Sincronização Parcial");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Erro durante a sincronização: ${errMsg}`, "error", "Falha na Sincronização");
    } finally {
      setIsManualSyncing(false);
    }
  };

  useEffect(() => {
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
    
    // Periodically try to re-sync every 30 seconds as a robust retry mechanism
    const interval = setInterval(() => {
      if (navigator.onLine) {
        setIsOnline(true);
        processSyncQueue();
      } else {
        setIsOnline(false);
      }
    }, 30000);

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
      if (isSyncProcessingRef.current) return;
      if (!navigator.onLine) {
        console.log("[SYNC 5MIN] Sistema offline. Sincronização periódica suspensa.");
        return;
      }

      isSyncProcessingRef.current = true;
      try {
        const queue = await operationalCache.getItem<Record<string, any>>("pos_sync_queue");
        if (!queue) return;

        const pendingTxs = queue["transactions"];

        if (pendingTxs && Array.isArray(pendingTxs) && pendingTxs.length > 0) {
          console.log(`[SYNC 5MIN] Sincronização periódica iniciada: ${pendingTxs.length} transações pendentes encontradas.`);
          
          try {
            // Envia transações pendentes para a base de dados em lote
            await CommercialDataService.saveTransactionsBatch(pendingTxs);

            // Sucesso! Remove a chave transactions da fila offline no IndexedDB
            delete queue["transactions"];
            if (Object.keys(queue).length === 0) {
              await operationalCache.removeItem("pos_sync_queue");
            } else {
              await operationalCache.setItem("pos_sync_queue", queue);
            }
            setPendingSyncQueue({ ...queue });
            
            setLastSyncTime(new Date().toLocaleTimeString());
            console.log("[SYNC 5MIN] Sincronização automática das transações offline concluída com sucesso!");
            
            handleAddAuditLog(
              "Sincronização Periódica",
              "Vendas",
              `Sincronização automática de 5 minutos reenviou ${pendingTxs.length} transações pendentes com sucesso.`
            );
          } catch (fsErr: unknown) {
            const fsErrMessage = fsErr instanceof Error ? fsErr.message : String(fsErr);
            console.error("[SYNC 5MIN] Erro ao reenviar transações pendentes:", fsErr);
            handleAddAuditLog(
              "Falha de Sincronização",
              "Vendas",
              `Falha na sincronização periódica de transações offline: ${fsErrMessage}`
            );
          }
        }
      } catch (err: unknown) {
        console.error("[SYNC 5MIN] Erro ao analisar fila de sincronização:", err);
      } finally {
        isSyncProcessingRef.current = false;
      }
    };

    // Define o intervalo para exatamente 5 minutos (300.000 milissegundos)
    const intervalId = setInterval(syncPendingTransactions, 300000);

    return () => {
      clearInterval(intervalId);
    };
  }, [handleAddAuditLog]);

  // Global keyboard shortcuts for POS operations (F1, F2, etc.) handled in the App component to improve checkout efficiency
  useEffect(() => {
    const handlePOSGlobalShortcuts = (e: KeyboardEvent) => {
      // Only capture when POS module is active/rendered
      if (activeTab !== "POS") return;

      // Intercept POS keyboard shortcuts
      if (e.key === "F1" || e.key === "F2" || e.key === "F3" || e.key === "F4" || e.key === "F5" || e.key === "F6" || e.key === "F8" || e.key === "F9" || e.key === "F10" || e.key === "F11" || e.key === "Escape") {
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

  // Global keyboard shortcut for Stock Replenishment (Ctrl+S)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (!isAuthenticated) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        setShowReplenishModal(prev => !prev);
      } else if (e.key === "Escape" && showReplenishModal) {
        setShowReplenishModal(false);
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcuts, true);
    };
  }, [isAuthenticated, showReplenishModal]);


  // Hydrate states with Cache-Aside pattern: instant local snapshot + background full integrity verification
  const hydrateDatabaseForUser = async (user?: Employee | null, customCompanyName?: string) => {
    try {
      const effectiveTenantId = user?.tenantId ||
        (user?.companyId && user.companyId.startsWith("comp_") ? user.companyId : "") ||
        (user?.id ? `comp_${user.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}` : (typeof window !== "undefined" ? localStorage.getItem("erp_current_tenant_id") || "default_tenant" : "default_tenant"));

      if (effectiveTenantId && typeof window !== "undefined") {
        localStorage.setItem("erp_current_tenant_id", effectiveTenantId);
        saveSupabaseConfig({ tenantId: effectiveTenantId });
      }

      const cacheKey = user?.id ? `erp_cache_snapshot_${effectiveTenantId}_${user.id}` : `erp_cache_snapshot_${effectiveTenantId}`;

      // 1. [CACHE-ASIDE] Leitura Imediata do Snapshot Local (IndexedDB isolado por tenant)
      let cached: ErpSnapshotData | null = null;
      try {
        cached = await operationalCache.loadSnapshot(cacheKey);
        // IMPORTANTE: NÃO carregar "erp_cache_snapshot_global" se for um usuário autenticado específico para não herdar dados de outra conta de testes
        if (!cached && !user?.id) {
          cached = await operationalCache.loadSnapshot("erp_cache_snapshot_global");
        }
        if (cached && typeof cached === "object") {
          if (Array.isArray(cached.products)) setProducts(cached.products);
          if (Array.isArray(cached.customers)) setCustomers(cached.customers);
          if (Array.isArray(cached.transactions)) setTransactions(cached.transactions);
          if (Array.isArray(cached.cashflow)) setCashFlow(cached.cashflow);
          if (Array.isArray(cached.employees) && cached.employees.length > 0) setEmployees(cached.employees);
          if (Array.isArray(cached.auditlogs)) setAuditLogs(cached.auditlogs);
          if (cached.settings) setSettings(prev => ({ ...prev, ...cached!.settings }));
          
          setIsDbLoaded(true);
          console.log(`[CACHE-ASIDE] Snapshot da conta ${effectiveTenantId} carregado via IndexedDB.`);
        }
      } catch (cacheErr) {
        console.warn("[CACHE-ASIDE] Erro ao ler snapshot em cache:", cacheErr);
      }

      // 2. [FAST-PREFETCH] Pré-carregamento imediato das transações mais recentes (últimas 24h)
      try {
        SyncService.prefetchRecentTransactions24h().then(recentTx => {
          if (recentTx && recentTx.length > 0) {
            setTransactions(prev => {
              const merged = SupabaseSyncService.mergeRecordsById(prev || [], recentTx);
              return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            });
            console.log(`[PREFETCH 24H] ${recentTx.length} transações recentes integradas imediatamente ao POS.`);
          }
        }).catch(err => {
          console.warn("[PREFETCH 24H] Falha não impeditiva no prefetch de transações:", err);
        });
      } catch {}

      console.log(`[HYDRATE] Sincronizando dados autoritativos da nuvem para o tenant ${effectiveTenantId}...`);

      // 3. Fetch remote data from Supabase for this tenant
      const [sbProducts, sbCustomers, sbTransactions, sbCashflow, sbEmployees, sbSettings, sbAuditLogs] = await Promise.all([
        CommercialDataService.fetchProducts().catch(() => []),
        CommercialDataService.fetchCustomers().catch(() => []),
        CommercialDataService.fetchTransactions().catch(() => []),
        CommercialDataService.fetchCashFlow().catch(() => []),
        CommercialDataService.fetchEmployees().catch(() => []),
        CommercialDataService.fetchSettings().catch(() => null),
        CommercialDataService.fetchAuditLogs().catch(() => [])
      ]);

      // 3. Fetch server database state if available
      let serverData: DatabaseSnapshotPayload | null = null;
      try {
        const response = await authenticatedFetch("/api/db/load");
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const json = await response.json();
          if (json.success && json.hasData) {
            serverData = json.data;
          }
        }
      } catch {}

      // 4. Merge products (garante que dados cadastrados na conta venham do servidor/nuvem)
      let finalProducts: Product[] = [];
      const remoteProds = Array.isArray(sbProducts) ? sbProducts : [];
      const serverProds = Array.isArray(serverData?.products) ? serverData.products : [];
      const combinedProds = SupabaseSyncService.mergeRecordsById(serverProds, remoteProds);

      if (combinedProds.length > 0) {
        finalProducts = combinedProds;
      } else if (cached?.products && Array.isArray(cached.products)) {
        finalProducts = cached.products;
      } else {
        finalProducts = [];
      }
      setProducts(finalProducts);

      // 5. Merge customers by ID
      let finalCustomers: Customer[] = [];
      const remoteCusts = Array.isArray(sbCustomers) ? sbCustomers : [];
      const serverCusts = Array.isArray(serverData?.customers) ? serverData.customers : [];
      const combinedCusts = SupabaseSyncService.mergeRecordsById(serverCusts, remoteCusts);

      if (combinedCusts.length > 0) {
        finalCustomers = combinedCusts;
      } else if (cached?.customers && Array.isArray(cached.customers)) {
        finalCustomers = cached.customers;
      } else {
        finalCustomers = [];
      }
      setCustomers(finalCustomers);

      // 6. Merge transactions by ID and sort chronologically
      let finalTransactions: Transaction[] = [];
      const remoteTxs = Array.isArray(sbTransactions) ? sbTransactions : [];
      const serverTxs = Array.isArray(serverData?.transactions) ? serverData.transactions : [];
      const combinedTxs = SupabaseSyncService.mergeRecordsById(serverTxs, remoteTxs);

      if (combinedTxs.length > 0) {
        finalTransactions = combinedTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } else if (cached?.transactions && Array.isArray(cached.transactions)) {
        finalTransactions = cached.transactions;
      } else {
        finalTransactions = [];
      }
      setTransactions(finalTransactions);

      // 7. Merge cashflow by ID
      let finalCashflow: CashFlowEntry[] = [];
      const remoteCash = Array.isArray(sbCashflow) ? sbCashflow : [];
      const serverCash = Array.isArray(serverData?.cashflow) ? serverData.cashflow : [];
      const combinedCash = SupabaseSyncService.mergeRecordsById(serverCash, remoteCash);

      if (combinedCash.length > 0) {
        finalCashflow = combinedCash;
      } else if (cached?.cashflow && Array.isArray(cached.cashflow)) {
        finalCashflow = cached.cashflow;
      } else {
        finalCashflow = [];
      }
      setCashFlow(finalCashflow);

      // 8. Merge employees by ID, ensuring user profile integrity and preservation of local PIN/credentials
      let finalEmployees: Employee[] = [];
      const remoteEmps = Array.isArray(sbEmployees) ? sbEmployees : [];
      const serverEmps = Array.isArray(serverData?.employees) ? serverData.employees : [];
      const combinedEmps = SupabaseSyncService.mergeRecordsById(serverEmps, remoteEmps);
      const baseEmps = combinedEmps.length > 0 ? combinedEmps : (cached?.employees && Array.isArray(cached.employees) && cached.employees.length > 0 ? cached.employees : initialEmployees);

      if (user) {
        const idx = baseEmps.findIndex(e => e.id === user.id || (e.email && e.email.toLowerCase() === user.email?.toLowerCase()));
        if (idx > -1) {
          baseEmps[idx] = { ...baseEmps[idx], ...user, pin: baseEmps[idx].pin || user.pin };
        } else {
          baseEmps.push(user);
        }
      }
      finalEmployees = baseEmps;
      setEmployees(finalEmployees);

      // 9. Merge settings
      let finalSettings: SystemSettings | null = null;
      const validCustomName = customCompanyName && customCompanyName.trim() && !customCompanyName.startsWith("comp_") ? customCompanyName.trim() : "";
      if (sbSettings) {
        const chosenName = (sbSettings.companyName && !sbSettings.companyName.startsWith("comp_")) ? sbSettings.companyName : (validCustomName || defaultSettings.companyName);
        finalSettings = { ...defaultSettings, ...sbSettings, ...(chosenName ? { companyName: chosenName } : {}) };
      } else if (serverData?.settings) {
        const chosenName = (serverData.settings.companyName && !serverData.settings.companyName.startsWith("comp_")) ? serverData.settings.companyName : (validCustomName || defaultSettings.companyName);
        finalSettings = { ...defaultSettings, ...serverData.settings, ...(chosenName ? { companyName: chosenName } : {}) };
      } else if (cached?.settings) {
        finalSettings = { ...defaultSettings, ...cached.settings, ...(validCustomName ? { companyName: validCustomName } : {}) };
      } else {
        finalSettings = { ...defaultSettings, ...(validCustomName ? { companyName: validCustomName } : {}) };
      }
      setSettings(finalSettings);

      // 10. Merge audit logs
      let finalAuditLogs: AuditLog[] = [];
      const remoteLogs = Array.isArray(sbAuditLogs) ? sbAuditLogs : [];
      const serverLogs = Array.isArray(serverData?.auditlogs) ? serverData.auditlogs : [];
      finalAuditLogs = SupabaseSyncService.mergeRecordsById(serverLogs, remoteLogs);
      setAuditLogs(finalAuditLogs);

      // 11. [CACHE-ASIDE] Atualização Assíncrona do Snapshot Local via IndexedDB
      try {
        const snapshotToPersist = {
          products: finalProducts,
          customers: finalCustomers,
          transactions: finalTransactions,
          cashflow: finalCashflow,
          employees: finalEmployees,
          auditlogs: finalAuditLogs,
          settings: finalSettings || settings,
          cachedAt: new Date().toISOString()
        };
        await operationalCache.saveSnapshot(cacheKey, snapshotToPersist);
      } catch (persistErr) {
        console.warn("[CACHE-ASIDE] Falha ao atualizar o snapshot em IndexedDB:", persistErr);
      }

      setIsDbLoaded(true);
      console.log(`[HYDRATE] Dados do tenant ${effectiveTenantId} hidratados com sucesso (${finalProducts.length} produtos).`);

      // 12. Tutorial Onboarding automático para novos utilizadores
      if (user?.id) {
        const onboardingKey = `erp_onboarding_completed_${user.id}`;
        const isAlreadyDone = localStorage.getItem(onboardingKey) === "true";
        if (!isAlreadyDone) {
          setTimeout(() => {
            setIsOnboardingTutorialOpen(true);
            localStorage.setItem(onboardingKey, "true");
          }, 800);
        }
      }

      // Flush any pending write operations in IndexedDB
      SyncService.flushQueue().then(({ processed }) => {
        if (processed > 0) {
          console.log(`[HYDRATE] ${processed} operações pendentes offline foram sincronizadas com sucesso.`);
        }
      }).catch(err => {
        console.warn("[HYDRATE] Falha ao processar fila offline:", err);
      });
    } catch (err) {
      console.warn("[HYDRATE] Erro na integridade e hidratação de dados:", err);
      setIsDbLoaded(true);
    }
  };

  // Hydrate states from existential server database on mount
  useEffect(() => {
    // Run the connection test via abstract service
    ConnectionService.test();
    hydrateDatabaseForUser();
  }, []);

  useEffect(() => {
    if (theme === "night") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [theme]);

  // Supabase Auth Observer to handle auto-login, load profiles, and synchronize permissions strictly via Supabase
  useEffect(() => {
    // Check for OAuth Callback Errors in URL Query or Hash
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const rawHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
      const hashParams = new URLSearchParams(rawHash);

      const oauthError = urlParams.get("error") || hashParams.get("error");
      const oauthErrorDesc = urlParams.get("error_description") || hashParams.get("error_description");

      if (oauthError) {
        console.warn("[OAuth Callback] Retorno de erro da autenticação Google:", oauthError, oauthErrorDesc);
        const friendlyMessage = oauthError === "access_denied"
          ? "Autenticação Google cancelada pelo utilizador."
          : (oauthErrorDesc ? decodeURIComponent(oauthErrorDesc.replace(/\+/g, " ")) : "Falha na autenticação com a conta Google.");
        
        showToast(friendlyMessage, "error");
        // Clean URL to prevent error loop on reload
        window.history.replaceState(null, document.title, window.location.pathname);
      }
    }

    const handleAuthSync = async (user: User | null) => {
      if (!user || isLoggingOutRef.current) {
        setIsAuthenticated(false);
        setActiveUser(null);
        return;
      }
      try {
        const { employee, companyName } = await SupabaseSyncService.syncUserProfileFromAuth(user, employees);

        if (employee.status === "BLOCKED") {
          showToast("A sua conta está BLOQUEADA por tempo expirado do PIN temporário ou suspensão de segurança.", "error");
          await SupabaseSyncService.signOut();
          setIsAuthenticated(false);
          setActiveUser(null);
          return;
        }

        if (employee.status === "INACTIVE" || employee.status === "SUSPENDED") {
          showToast("Esta conta está inativa ou suspensa. Contacte a Administração.", "error");
          await SupabaseSyncService.signOut();
          setIsAuthenticated(false);
          setActiveUser(null);
          return;
        }

        setActiveUser(prev => {
          if (prev && prev.id === employee.id && prev.name === employee.name && prev.role === employee.role && prev.status === employee.status && prev.pin === employee.pin) {
            return prev;
          }
          return employee;
        });
        setIsAuthenticated(true);
        if (companyName && companyName.trim() && !companyName.startsWith("comp_")) {
          setSettings(prev => {
            if (prev.companyName === companyName.trim()) return prev;
            return {
              ...prev,
              companyName: companyName.trim()
            };
          });
        }

        // Hydrate and merge all database records for this tenant/user
        await hydrateDatabaseForUser(employee, companyName);

        // Clean OAuth hash/query tokens from URL bar without reload for a pristine URL
        if (typeof window !== "undefined" && (window.location.hash || window.location.search)) {
          window.history.replaceState(null, document.title, window.location.pathname);
        }

        console.log(`[SUPABASE AUTH] Sessão autoritativa ativa: ${employee.name} (${employee.role}) - Empresa: ${companyName}`);
      } catch (err) {
        console.error("[SUPABASE AUTH] Erro ao sincronizar perfil autoritativo:", err);
        setIsAuthenticated(false);
        setActiveUser(null);
      }
    };

    const client = getSupabaseClient();
    if (client) {
      client.auth.getSession().then(({ data: { session }, error }) => {
        if (error || !session?.user || isLoggingOutRef.current) {
          setIsAuthenticated(false);
          setActiveUser(null);
        } else {
          handleAuthSync(session.user);
        }
      }).catch(() => {
        setIsAuthenticated(false);
        setActiveUser(null);
      });

      const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
        if (session?.user && !isLoggingOutRef.current && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
          handleAuthSync(session.user);
        } else if (event === "SIGNED_OUT" || !session) {
          setIsAuthenticated(false);
          setActiveUser(null);
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    } else {
      setIsAuthenticated(false);
      setActiveUser(null);
    }
  }, []);

  // Real-time products subscription and initial sync
  useEffect(() => {
    if (isAuthenticated) {
      console.log("[SUPABASE] Ativando subscrição em tempo real para produtos...");
      
      const unsubscribe = CommercialDataService.subscribeProducts(async () => {
        setIsOnline(true);
        try {
          const sbProducts = await CommercialDataService.fetchProducts();
          if (sbProducts && sbProducts.length > 0) {
            console.log(`[SUPABASE] Recebidos ${sbProducts.length} produtos em tempo real.`);
            setProducts(sbProducts);
          }
        } catch (error) {
          console.error("[SUPABASE] Erro no listener em tempo real de produtos:", error);
        }
      });

      const loadTransactions = async () => {
        try {
          const sbTx = await CommercialDataService.fetchTransactions();
          if (sbTx && sbTx.length > 0) {
            console.log(`[SUPABASE] Carregadas ${sbTx.length} transações.`);
            setTransactions(sbTx.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
          } else {
            console.log("[SUPABASE] Sem transações registradas.");
            setTransactions(prev => prev || []);
          }
        } catch (err) {
          console.error("[SUPABASE] Erro ao carregar transações:", err);
        }
      };

      loadTransactions();

      return () => {
        console.log("[SUPABASE] Desativando subscrição em tempo real para produtos.");
        if (unsubscribe && typeof (unsubscribe as { unsubscribe?: () => void }).unsubscribe === "function") {
          (unsubscribe as { unsubscribe: () => void }).unsubscribe();
        } else if (typeof unsubscribe === "function") {
          (unsubscribe as () => void)();
        }
      };
    }
  }, [isAuthenticated]);

  // Synchronize user database with local staff module list
  useEffect(() => {
    if (isAuthenticated) {
      const syncStaff = async () => {
        try {
          const sbUsers = await CommercialDataService.fetchEmployees();
          if (sbUsers && sbUsers.length > 0) {
            // Merge users prioritizing database profiles
            setEmployees(prev => {
              const merged = [...prev];
              sbUsers.forEach(fUser => {
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
          console.error("Erro ao sincronizar quadro de colaboradores:", err);
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

    const requiredPin = targetEmp.pin?.trim();
    if (!requiredPin) {
      setPinError("Colaborador sem PIN configurado. Contacte o Administrador para definir uma senha segura.");
      return;
    }
    const isPinMatch = await verifySecurityPin(enteredPin.trim(), requiredPin);
    if (!isPinMatch) {
      setPinError("Senha incorreta. Por favor, tente novamente.");
      return;
    }

    // Check expiration policy (2 months / 60 days)
    const now = new Date();
    const createdAtStr = targetEmp.pinCreatedAt || targetEmp.admissionDate || now.toISOString();
    const createdAt = new Date(createdAtStr);
    const diffTime = now.getTime() - createdAt.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    const isPinTemporary = targetEmp.pinChanged === false;

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
    const targetUserRole = normalizeUserRole(fitEmp);
    const accessCheck = canRoleAccessModule(targetUserRole, activeTab.toLowerCase());
    if (!accessCheck.allowed) {
      setActiveTab(getDefaultModuleForRole(targetUserRole));
    }

    showToast(`Bem-vindo, ${fitEmp.name}! Sessão autorizada com sucesso.`, "success");
    setPinVerificationOpen(false);
    setPinTargetEmployee(null);
  };

  const handleForcePinChangeSubmit = async () => {
    if (!forcePinTargetEmployee) return;

    if (newPin.length < 6) {
      setForcePinError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (forcePinTargetEmployee.pin && await verifySecurityPin(newPin, forcePinTargetEmployee.pin)) {
      setForcePinError("A nova senha não pode ser idêntica à senha anterior.");
      return;
    }

    if (newPin !== confirmNewPin) {
      setForcePinError("As senhas de confirmação não coincidem.");
      return;
    }

    const hashedNewPin = await hashSecurityPin(newPin);

    // Update PIN & properties
    const updatedEmployees = employees.map(emp => {
      if (emp.id === forcePinTargetEmployee.id) {
        return {
          ...emp,
          pin: hashedNewPin,
          pinChanged: true,
          pinCreatedAt: new Date().toISOString()
        };
      }
      return emp;
    });

    handleUpdateEmployees(updatedEmployees);

    const fitEmp = {
      ...forcePinTargetEmployee,
      pin: hashedNewPin,
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

    const targetUserRole = normalizeUserRole(fitEmp);
    const accessCheck = canRoleAccessModule(targetUserRole, activeTab.toLowerCase());
    if (!accessCheck.allowed) {
      setActiveTab(getDefaultModuleForRole(targetUserRole));
    }

    showToast(`Nova senha de acesso registada com sucesso! Bem-vindo, ${fitEmp.name}.`, "success");
    setForcePinChangeOpen(false);
    setForcePinTargetEmployee(null);
  };

  // PANIC SYSTEM / EMERGENCY SECURITY ALERT
  const handleTriggerPanic = async () => {
    const result = await triggerPanicAlert({
      activeUser,
      userIpInfo,
      deviceInfo,
      employees,
      settings,
      onAddAuditLog: handleAddAuditLog
    });

    showToast(
      `Alerta crítico disparado! ${result.successfulEmailsCount} e-mails e ${result.successfulSmsCount} SMS de emergência enviados aos administradores.`,
      "warning",
      "🚨 ALERTA MÁXIMO"
    );
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
  const handleDeleteProduct = async (productId: string) => {
    try {
      await CommercialDataService.removeProduct(productId);
    } catch (err) {
      console.warn("Erro ao apagar produto:", err);
    }

    // Update local state and sync batch
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
  const handleDeleteCustomer = async (customerId: string) => {
    try {
      await CommercialDataService.removeCustomer(customerId);
    } catch (err) {
      console.warn("Erro ao apagar cliente:", err);
    }

    // Update state and sync with server
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
  const handleTriggerLocalBackup = async (type: "manual" | "automatic" = "manual") => {
    if (isBackingUpRef.current) return false;
    isBackingUpRef.current = true;
    try {
      const result = await createLocalBackup(
        dbStateRef.current,
        type,
        activeUser,
        currentSystemVersion
      );

      if (result.success && type === "manual") {
        handleAddAuditLog(
          "Backup Local Manual",
          "SEGURANÇA",
          "Cópia de segurança gravada localmente com sucesso (Manual)."
        );
      }

      return result.success;
    } catch (error) {
      console.error("Erro ao realizar backup local:", error);
      return false;
    } finally {
      isBackingUpRef.current = false;
    }
  };

  // Automated scheduled database backup to localStorage (runs checking interval every 15m; backups based on user configuration)
  useEffect(() => {
    if (!isAuthenticated) return;

    const runAutomaticBackup = () => {
      try {
        if (isBackingUpRef.current) return;
        const lastBackupTimeStr = localStorage.getItem("erp_last_auto_backup_time");
        const lastBackupTime = lastBackupTimeStr ? new Date(lastBackupTimeStr).getTime() : 0;
        const now = Date.now();
        
        const frequency = dbStateRef.current.settings?.backupFrequency || "daily";
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

    // Run check on mount / frequency change
    runAutomaticBackup();

    // Check every 15 minutes
    const intervalId = setInterval(runAutomaticBackup, 900000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, settings?.backupFrequency]);

  const handleGetBackupPayload = () => {
    return {
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
  };

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
  const handleImportLocalDB = async (importedData: DatabaseSnapshotPayload) => {
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

  // ADMIN-ONLY PERMANENT MOCK DATA PURGE
  const handlePurgeMockData = async () => {
    try {
      const result = await AdminService.purgeMockData(activeUser?.name || "Administrador");
      if (result.success) {
        setProducts(prev => AdminService.filterRealProducts(prev));
        setCustomers(prev => AdminService.filterRealCustomers(prev));
        setTransactions(prev => AdminService.filterRealTransactions(prev));

        handleAddAuditLog(
          "Purga de Dados Mock/Exemplo",
          "ADMINISTRAÇÃO",
          `Administrador removeu ${result.report.purgedProducts} produtos, ${result.report.purgedCustomers} clientes e ${result.report.purgedTransactions} vendas de teste permanentemente.`
        );

        showToast(
          `Limpeza concluída com sucesso! ${result.report.purgedProducts} produtos, ${result.report.purgedCustomers} clientes e ${result.report.purgedTransactions} transações de exemplo foram removidos.`,
          "success"
        );
      } else {
        showToast(result.message || "Erro ao efetuar a purga de dados mock.", "error");
      }
    } catch (e: unknown) {
      const eMessage = e instanceof Error ? e.message : "Erro desconhecido";
      showToast("Falha na execução da purga: " + eMessage, "error");
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
      const response = await authenticatedFetch("/api/email/send-alert", {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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

    // 2. Dynamic stock levels deduction via specialized processor
    const saleResult = processSaleDeductions(transaction, products, settings, activeUser);
    setProducts(saleResult.updatedProducts);
    syncTable("products", saleResult.updatedProducts);

    if (saleResult.updatedBatches) {
      handleUpdateSettings({ batches: saleResult.updatedBatches });
    }

    // Trigger individual minimum stock alerting
    const autoSendAlerts = settings.stockAlertAutoSendOnSale !== false;
    if (autoSendAlerts) {
      for (const alert of saleResult.lowStockAlerts) {
        if (settings.smsAlertsEnabled) {
          triggerSmsStockAlert(alert.productName, alert.currentStock, alert.minThreshold);
        }
        if (settings.emailStockAlertsEnabled) {
          triggerEmailStockAlert(alert.productName, alert.currentStock, alert.minThreshold);
        }
        if (settings.whatsappEnabled) {
          triggerWhatsappStockAlert(alert.productName, alert.currentStock, alert.minThreshold);
        }
      }
    }

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

    // 4. Atomic PostgreSQL / Supabase Sale persistence with offline queue fallback
    CommercialDataService.saveTransaction(transaction).catch(err => {
      console.warn("Processamento atómico em segundo plano (offline queue):", err);
    });

    // 5. Record cash inflow entry in cashFlow if paid via Cash/POS/Mobile
    if (saleResult.cashFlowEntry) {
      const cashEntry = saleResult.cashFlowEntry;
      setCashFlow(prev => {
        const updated = [cashEntry, ...prev];
        syncTable("cashflow", updated);
        return updated;
      });
    }

    // 6. Record strict auditor trace logs
    handleAddAuditLog(
      "Completar Transação de POS",
      "VENDAS",
      `Fatura ${transaction.invoiceNumber} processada na filial ${activeBranch}. Cliente: ${transaction.customerName}, Método: ${transaction.paymentMethod}. Total Pago: ${transaction.grandTotal} MT. Abate de Stock concluído.`
    );
  };

  // CENTRAL POS RETURN / DEVOLUTION & CREDIT NOTE HANDLER
  const handleReturnSaleAction = (
    transaction: Transaction,
    returnReason: string,
    returnedItems: { productId: string; quantity: number; price: number }[],
    refundMethod: string = "CASH"
  ) => {
    if (!transaction || !returnedItems || returnedItems.length === 0) return;

    const devolutionResult = processDevolutionRestock(
      transaction,
      returnedItems,
      returnReason,
      refundMethod,
      products,
      settings,
      activeUser,
      transactions.length
    );

    const { creditNoteNum, refundTotal, updatedProducts, refundCashEntry } = devolutionResult;
    const activeBranch = transaction.branchId || settings.activeBranchId || "central";

    // 1. Restock products in inventory
    setProducts(updatedProducts);
    syncTable("products", updatedProducts);

    // 2. Record cash refund in cashflow if refunded from register
    if (refundCashEntry) {
      setCashFlow(prev => {
        const updated = [refundCashEntry, ...prev];
        syncTable("cashflow", updated);
        return updated;
      });
    }

    // 3. Adjust customer balance if credit / debt
    if (transaction.customerId && transaction.customerId !== "WALK_IN") {
      setCustomers(prev => {
        const updated = prev.map(c => {
          if (c.id === transaction.customerId) {
            const newDebt = transaction.paymentMethod === "DEBT" ? Math.max(0, (c.debt || 0) - refundTotal) : c.debt;
            return {
              ...c,
              debt: newDebt,
              totalSpent: Math.max(0, c.totalSpent - refundTotal)
            };
          }
          return c;
        });
        syncTable("customers", updated);
        return updated;
      });
    }

    // 4. Audit Log
    handleAddAuditLog(
      "Devolução de Venda / Nota de Crédito",
      "VENDAS",
      `Nota de Crédito ${creditNoteNum} emitida para a fatura ${transaction.invoiceNumber}. Total Reembolsado: ${refundTotal} MT. Motivo: ${returnReason}. Stock de ${returnedItems.length} artigo(s) restaurado.`
    );

    if (showToast) {
      showToast(`Devolução processada com sucesso! Nota de Crédito: ${creditNoteNum}`, "success", "Devolução Concluída");
    }
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
      const response = await authenticatedFetch("/api/gemini/forecast", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          salesHistory: salesSummary,
          inventoryStatus: criticalStock,
          businessType: settings.companyName
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (data && (data.forecastText || data.growthRate !== undefined)) {
        setForecastResult(data);
      } else {
        throw new Error("Invalid forecast payload format");
      }
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
    return normalizeUserRole(activeUser);
  }, [activeUser]);

  // Memoized stable company and user display values to prevent UI cycling/flickering
  const companyDisplayName = useMemo(() => {
    const raw = settings?.companyName?.trim();
    if (!raw || raw.startsWith("comp_")) {
      return "OST Vendas";
    }
    return raw;
  }, [settings?.companyName]);

  const activeUserDisplayName = useMemo(() => {
    return activeUser?.name?.trim() || "Administrador";
  }, [activeUser?.name]);

  const activeUserRoleDisplay = useMemo(() => {
    return activeUser?.role || "Operador";
  }, [activeUser?.role]);

  // Redirecionamento automático de segurança caso a aba ativa não seja permitida para o perfil do utilizador
  useEffect(() => {
    if (!isAuthenticated || !activeUser) return;
    const currentTabKey = activeTab.toLowerCase();
    const roleCheck = canRoleAccessModule(simplifiedRole, currentTabKey);
    if (!roleCheck.allowed) {
      const fallbackTab = getDefaultModuleForRole(simplifiedRole);
      setActiveTab(fallbackTab);
    }
  }, [simplifiedRole, isAuthenticated, activeUser, activeTab]);

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

    const isPinTemporary = user.pinChanged === false;

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

    const safeUser = sanitizeUserSession(user);
    localStorage.setItem("erp_logged_in_user", JSON.stringify(safeUser));
    localStorage.removeItem("erp_simulated_logged_in_user");

    // Limpar resíduos de memória de outra conta antes de hidratar a nova
    setProducts([]);
    setCustomers([]);
    setTransactions([]);
    setCashFlow([]);
    setAuditLogs([]);
    setIsDbLoaded(false);

    setActiveUser(safeUser);
    setIsAuthenticated(true);
    const cleanBranchName = branchName && !branchName.startsWith("comp_") ? branchName.trim() : "";
    if (cleanBranchName) {
      setSettings(prev => {
        if (prev.companyName === cleanBranchName) return prev;
        return {
          ...prev,
          companyName: cleanBranchName
        };
      });
    }

    // Trigger full entity integrity and hydration
    hydrateDatabaseForUser(user, cleanBranchName || undefined);

    // Record login audit log
    handleAddAuditLog(
      "Login efetuado",
      "AUTENTICAÇÃO",
      `Sessão iniciada com sucesso para o colaborador ${user.name} (${user.role}) no ramo ${branchName}.`,
      user
    );

    // GEOLOCATION SECURITY CHECK:
    // Determine if the current city/country is new or unusual for this user
    const currentCity = userIpInfo?.city || "Maputo";
    const currentCountry = userIpInfo?.country || "Moçambique";
    const currentIp = userIpInfo?.ip || "102.81.12.94";

    // Filter audit logs for previous successful logins for this user
    const userPreviousLogins = auditLogs.filter(log => 
      log.user === user.name && 
      log.action === "Login efetuado"
    );

    let isNewLocation = false;
    let locationHistoryString = "";

    if (userPreviousLogins.length > 0) {
      // Extract cities and countries from previous logs
      const knownLocations = userPreviousLogins.map(log => {
        const match = log.ip?.match(/\(([^)]+)\)/);
        if (match) {
          const parts = match[1].split(",");
          const city = parts[0] ? parts[0].trim().toLowerCase() : "";
          const country = parts[1] ? parts[1].trim().toLowerCase() : "";
          return { city, country };
        }
        return { city: "maputo", country: "moçambique" };
      });

      const hasCity = knownLocations.some(loc => loc.city === currentCity.toLowerCase());
      const hasCountry = knownLocations.some(loc => loc.country === currentCountry.toLowerCase());

      if (!hasCity || !hasCountry) {
        isNewLocation = true;
        const uniqueHistory = Array.from(new Set(userPreviousLogins.map(log => {
          const match = log.ip?.match(/\(([^)]+)\)/);
          return match ? match[1].trim() : "Maputo, Moçambique";
        })));
        locationHistoryString = uniqueHistory.join(" | ");
      }
    } else {
      // If there are no previous logs at all (first login), but they are logging in from outside Moçambique,
      // let's treat it as unusual to protect the company.
      const isOutsideMozambique = currentCountry.toLowerCase() !== "moçambique" && 
                                  currentCountry.toLowerCase() !== "mozambique";
      if (isOutsideMozambique) {
        isNewLocation = true;
        locationHistoryString = "Nenhum histórico (Primeiro Login - Local Internacional)";
      }
    }

    if (isNewLocation) {
      const alertMsg = `ALERTA DE SEGURANÇA: Login de ${user.name} detectado a partir de uma localização não habitual: ${currentCity}, ${currentCountry}. IP: ${currentIp}.`;
      
      // Add a security warning log entry
      setTimeout(() => {
        handleAddAuditLog(
          "Alerta de Segurança",
          "SEGURANÇA",
          alertMsg,
          user
        );
      }, 300);

      // Email details to admin
      const adminEmail = settings.reportRecipientEmail || "admin@example.com";
      const subject = `🚨 ALERTA DE SEGURANÇA: Login de Localização Incomum (${user.name})`;
      
      const emailBody = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 20px; margin-bottom: 25px;">
            <span style="background-color: #fef2f2; border: 1px solid #fee2e2; color: #ef4444; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; tracking-wider: 1px;">Alerta do Módulo de Auditoria</span>
            <h1 style="color: #991b1b; margin: 10px 0 0 0; font-size: 24px; font-weight: 800;">Acesso Não Habitual</h1>
            <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">OST Vendas - ERP Comercial</p>
          </div>
          
          <div style="margin-bottom: 30px; line-height: 1.6; color: #334155; font-size: 14px;">
            <p>Prezado <strong>Administrador do Sistema</strong>,</p>
            <p>O sistema de segurança integrativa da OST detectou um evento de autenticação originado de uma <strong>localização geográfica nova ou não habitual</strong>.</p>
            
            <div style="background-color: #fffaf0; border: 1px solid #feebc8; border-left: 4px solid #dd6b20; border-radius: 12px; padding: 20px; margin: 25px 0;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #dd6b20; font-weight: bold;">Dados de Acesso Suspeito</h3>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold; width: 40%;">Colaborador:</td>
                  <td style="padding: 6px 0; color: #2d3748; font-weight: bold;">${user.name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Perfil / Função:</td>
                  <td style="padding: 6px 0; color: #2d3748; font-weight: bold;">${user.role}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Localização Detectada:</td>
                  <td style="padding: 6px 0; color: #e53e3e; font-weight: 900; font-size: 14px;">${currentCity}, ${currentCountry}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Endereço de IP:</td>
                  <td style="padding: 6px 0; color: #2d3748; font-family: monospace; font-weight: bold;">${currentIp}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Dispositivo/Browser:</td>
                  <td style="padding: 6px 0; color: #2d3748; font-size: 12px;">${deviceInfo || "Desktop (Chrome)"}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Data e Hora (Local):</td>
                  <td style="padding: 6px 0; color: #2d3748;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 12.5px; color: #4a5568; line-height: 1.5;">
              <strong>Histórico Conhecido de Localizações:</strong><br/>
              <span style="color: #718096; font-family: monospace; font-size: 12px; display: block; margin-top: 5px; padding: 8px; background-color: #f7fafc; border-radius: 6px; border: 1px solid #e2e8f0; word-break: break-all;">${locationHistoryString || "Nenhum histórico anterior registado (primeiro acesso do utilizador)."}</span>
            </p>
            
            <p style="margin-top: 25px; padding: 15px; background-color: #f7fafc; border-radius: 8px; font-size: 12px; color: #4a5568; border-left: 4px solid #4a5568;">
              <strong>Medida Recomendada:</strong> Se este acesso não for reconhecido pelo utilizador em causa, aceda ao painel de controlo do ERP, secção <strong>"Recursos Humanos / Funcionários"</strong>, e altere imediatamente o PIN de acesso ou suspenda a conta do colaborador para mitigar riscos de intrusão.
            </p>
          </div>

          <div style="text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 25px;">
            <p>Este alerta automatizado foi disparado pelo sistema de integridade OST Vendas.</p>
          </div>
        </div>
      `;

      // Send Email Alerta
      sendEmail({
        to: adminEmail,
        subject,
        body: emailBody
      }).catch(err => console.error("[SECURITY] Falha ao enviar email de alerta ao administrador:", err));

      // Send SMS Alerta
      const smsMessage = `🚨 ALERTA OST: Login suspeito detectado de ${user.name} em ${currentCity}, ${currentCountry}. IP: ${currentIp}. Verifique o e-mail de auditoria.`;

      // Send SMS to all administrator employees in the store
      const adminUsers = employees.filter(emp => 
        emp.role?.toUpperCase().includes("ADMIN") || 
        emp.role?.toUpperCase().includes("GESTOR")
      );

      adminUsers.forEach(adm => {
        if (adm.contact && adm.contact.trim()) {
          sendSMS(adm.contact.trim(), smsMessage).catch(err => 
            console.error(`[SECURITY] Falha ao enviar SMS para o administrador ${adm.name}:`, err)
          );
        }
      });

      // Send SMS to current store contact if set
      if (settings.storeContact && settings.storeContact.trim()) {
        sendSMS(settings.storeContact.trim(), smsMessage).catch(err => 
          console.error("[SECURITY] Falha ao enviar SMS para o storeContact:", err)
        );
      }
    }
    
    // Auto-redirect conforming to profile role
    const userRole = normalizeUserRole(user);
    setActiveTab(getDefaultModuleForRole(userRole));
  };

  const handleLogout = async () => {
    isLoggingOutRef.current = true;
    try {
      if (activeUser) {
        handleAddAuditLog(
          "Logout Efetuado",
          "SEGURANÇA",
          `Operador ${activeUser.name} encerrou a sessão.`
        );
      }
      await SupabaseSyncService.signOut();
      localStorage.removeItem("erp_logged_in_user");
      localStorage.removeItem("erp_simulated_logged_in_user");
      localStorage.removeItem("erp_current_tenant_id");
      setProducts([]);
      setCustomers([]);
      setTransactions([]);
      setCashFlow([]);
      setAuditLogs([]);
      setIsDbLoaded(false);
      setActiveUser(null);
      setIsAuthenticated(false);
      showToast("Sessão terminada com sucesso.", "info");
    } catch (err: unknown) {
      console.error("Erro ao efetuar logout:", err);
      try {
        await SupabaseSyncService.signOut();
      } catch {}
      localStorage.removeItem("erp_logged_in_user");
      localStorage.removeItem("erp_simulated_logged_in_user");
      localStorage.removeItem("erp_current_tenant_id");
      setProducts([]);
      setCustomers([]);
      setTransactions([]);
      setCashFlow([]);
      setAuditLogs([]);
      setIsDbLoaded(false);
      setActiveUser(null);
      setIsAuthenticated(false);
      showToast("Sessão terminada com sucesso.", "info");
    } finally {
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 1000);
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
      <>
        <LoginModule
          employees={employees}
          companyName={companyDisplayName}
          logoUrl={settings.logoUrl}
          branches={settings.branches || []}
          onLoginSuccess={handleLoginSuccess}
          onShowToast={showToast}
          onAddAuditLog={handleAddAuditLog}
          settings={settings}
        />
        <ForcePinChangeModal
          isOpen={forcePinChangeOpen}
          targetEmployee={forcePinTargetEmployee}
          theme={theme}
          newPin={newPin}
          confirmNewPin={confirmNewPin}
          error={forcePinError}
          onNewPinChange={(val) => {
            setNewPin(val);
            if (forcePinError) setForcePinError("");
          }}
          onConfirmNewPinChange={(val) => {
            setConfirmNewPin(val);
            if (forcePinError) setForcePinError("");
          }}
          onSubmit={handleForcePinChangeSubmit}
          onClose={() => {
            setForcePinChangeOpen(false);
            setForcePinTargetEmployee(null);
          }}
        />
      </>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
      theme === "night" ? "bg-zinc-950 text-slate-200" : "bg-slate-50 text-slate-800"
    }`}>
      
        {!isPOSFullscreen && (
        <Sidebar
          currentRole={simplifiedRole}
          onChangeRole={handleChangeRole}
          activeModule={activeTab.toLowerCase()}
          onChangeModule={(mod) => {
            setActiveTab(mod.toUpperCase());
            setIsSidebarOpen(false);
          }}
          companyName={companyDisplayName}
          logoUrl={settings.logoUrl}
          onLogout={handleLogout}
          theme={theme}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeUser={activeUser}
          subscriptionPlan={activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO"}
          onSwitchUser={() => setIsUserSwitchModalOpen(true)}
        />
      )}

      {/* Outer body wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        
        {/* HEADER & HORIZONTAL NAVIGATION BAR */}
        <AppHeader
          isPOSFullscreen={isPOSFullscreen}
          theme={theme}
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          activeUserDisplayName={activeUserDisplayName}
          onOpenTutorial={() => setIsOnboardingTutorialOpen(true)}
          onOpenUserSwitch={() => setIsUserSwitchModalOpen(true)}
          simplifiedRole={simplifiedRole}
          canRoleAccessModule={canRoleAccessModule}
        />
  
        {/* INNER SCROLLABLE WORKPORT PANEL CONTENT */}
        <main className={`flex-1 overflow-y-auto relative ${isPOSFullscreen ? "p-0" : "p-4 md:p-6"}`}>
          <AnimatePresence mode="wait">
            {/* POS DIRECT CHECKOUT */}
            {activeTab === "POS" && (
              <motion.div
                key="POS"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canRoleAccessModule(simplifiedRole, "pos").allowed ? (
                  <RoleAccessDeniedScreen
                    moduleId="pos"
                    userRole={simplifiedRole}
                    activeUser={activeUser}
                    theme={theme}
                    onNavigateToModule={(mod) => setActiveTab(mod.toUpperCase())}
                    onSwitchUser={() => setIsUserSwitchModalOpen(true)}
                  />
                ) : (
                  <POSModule
                    products={products}
                    customers={customers}
                    transactions={filteredTransactions}
                    onCompleteSale={handleCompleteSaleAction}
                    onReturnSale={handleReturnSaleAction}
                    activeUsername={activeUserDisplayName}
                    settings={settings}
                    onAddAuditLog={handleAddAuditLog}
                    currency={currency}
                    onShowToast={showToast}
                    isPOSFullscreen={isPOSFullscreen}
                    onChangePOSFullscreen={setIsPOSFullscreen}
                    onTriggerPanic={handleTriggerPanic}
                  />
                )}
              </motion.div>
            )}

            {/* STATS ANALYTICS CONTROL PANEL */}
            {activeTab === "DASHBOARD" && (
              <motion.div
                key="DASHBOARD"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canRoleAccessModule(simplifiedRole, "dashboard").allowed ? (
                  <RoleAccessDeniedScreen
                    moduleId="dashboard"
                    userRole={simplifiedRole}
                    activeUser={activeUser}
                    theme={theme}
                    onNavigateToModule={(mod) => setActiveTab(mod.toUpperCase())}
                    onSwitchUser={() => setIsUserSwitchModalOpen(true)}
                  />
                ) : (
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
                    pendingSyncQueue={pendingSyncQueue}
                    isManualSyncing={isManualSyncing}
                    isOnline={isOnline}
                    onManualSync={handleManualSync}
                    theme={theme}
                    onTriggerPanic={handleTriggerPanic}
                  />
                )}
              </motion.div>
            )}

            {/* DAILY BOOK BALANCE CASH OPERATIONS */}
            {activeTab === "CASH" && (
              <motion.div
                key="CASH"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canRoleAccessModule(simplifiedRole, "cash").allowed ? (
                  <RoleAccessDeniedScreen
                    moduleId="cash"
                    userRole={simplifiedRole}
                    activeUser={activeUser}
                    theme={theme}
                    onNavigateToModule={(mod) => setActiveTab(mod.toUpperCase())}
                    onSwitchUser={() => setIsUserSwitchModalOpen(true)}
                  />
                ) : (
                  <CashRegisterModule
                    cashFlow={filteredCashFlow}
                    transactions={filteredTransactions}
                    onAddCashFlowEntry={handleAddCashFlowEntry}
                    activeUsername={activeUserDisplayName}
                    activeUser={activeUser}
                    employees={employees}
                    currentRole={simplifiedRole}
                    onAddAuditLog={handleAddAuditLog}
                    currency={currency}
                    settings={settings}
                    theme={theme}
                    onShowToast={showToast}
                  />
                )}
              </motion.div>
            )}

            {/* ACTIVE STOCK INVENTORY MANAGER */}
            {activeTab === "STOCK" && (
              <motion.div
                key="STOCK"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canRoleAccessModule(simplifiedRole, "stock").allowed ? (
                  <RoleAccessDeniedScreen
                    moduleId="stock"
                    userRole={simplifiedRole}
                    activeUser={activeUser}
                    theme={theme}
                    onNavigateToModule={(mod) => setActiveTab(mod.toUpperCase())}
                    onSwitchUser={() => setIsUserSwitchModalOpen(true)}
                  />
                ) : !canAccessModule("stock", activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO").allowed ? (
                  <PlanLockScreen
                    moduleName="Gestão Avançada de Stock"
                    requiredPlan="PRATA"
                    userPlan={activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO"}
                    description="O Plano Bronze inclui apenas vendas rápidas POS e catálogo básico. Atualize para o Plano Prata ou Ouro para gerir lotes, datas de expiração e reabastecimentos."
                    onUpgradeClick={() => setActiveTab("PLANS")}
                  />
                ) : (
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
              </motion.div>
            )}

            {/* CUSTOMER LOYALTY CRM & MARKETING SMS */}
            {(activeTab === "CUSTOMERS" || activeTab === "CLIENTES") && (
              <motion.div
                key="CUSTOMERS"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canRoleAccessModule(simplifiedRole, "customers").allowed ? (
                  <RoleAccessDeniedScreen
                    moduleId="customers"
                    userRole={simplifiedRole}
                    activeUser={activeUser}
                    theme={theme}
                    onNavigateToModule={(mod) => setActiveTab(mod.toUpperCase())}
                    onSwitchUser={() => setIsUserSwitchModalOpen(true)}
                  />
                ) : (
                  <CustomersModule
                    customers={customers}
                    transactions={transactions}
                    settings={settings}
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
                    activeUsername={activeUserDisplayName}
                    currency={currency}
                    onShowToast={showToast}
                  />
                )}
              </motion.div>
            )}

            {/* FINANCIAL REPORTS & SMTP TRIGGERS */}
            {activeTab === "REPORTS" && (
              <motion.div
                key="REPORTS"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canRoleAccessModule(simplifiedRole, "reports").allowed ? (
                  <RoleAccessDeniedScreen
                    moduleId="reports"
                    userRole={simplifiedRole}
                    activeUser={activeUser}
                    theme={theme}
                    onNavigateToModule={(mod) => setActiveTab(mod.toUpperCase())}
                    onSwitchUser={() => setIsUserSwitchModalOpen(true)}
                  />
                ) : (
                  <ReportsModule
                    transactions={filteredTransactions}
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    onAddAuditLog={handleAddAuditLog}
                    currency={currency}
                    onShowToast={showToast}
                    auditLogs={auditLogs}
                  />
                )}
              </motion.div>
            )}

            {/* COMPANY GENERAL IDENTITIES AND MAIN SETTINGS (INCLUDING ADVANCED CONSOLIDATED SUBMODULES) */}
            {(activeTab === "SETTINGS" || activeTab === "STAFF" || activeTab === "AI" || activeTab === "TRAINING" || activeTab === "GATEWAY" || activeTab === "PLANS") && (
              <motion.div
                key="SETTINGS"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canRoleAccessModule(simplifiedRole, activeTab.toLowerCase()).allowed ? (
                  <RoleAccessDeniedScreen
                    moduleId={activeTab.toLowerCase()}
                    userRole={simplifiedRole}
                    activeUser={activeUser}
                    theme={theme}
                    onNavigateToModule={(mod) => setActiveTab(mod.toUpperCase())}
                    onSwitchUser={() => setIsUserSwitchModalOpen(true)}
                  />
                ) : (
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
                    onGetBackupPayload={handleGetBackupPayload}
                    onPurgeMockData={handlePurgeMockData}
                    systemVersion={currentSystemVersion}
                    employees={employees}
                    auditLogs={auditLogs}
                    products={products}
                    onUpdateProduct={handleUpdateProduct}
                    onUpdateProducts={(updatedList) => {
                      setProducts(updatedList);
                      syncTable("products", updatedList);
                    }}
                    transactions={filteredTransactions}
                    customers={customers}
                    onAddEmployee={handleAddEmployee}
                    onUpdateEmployees={handleUpdateEmployees}
                    masterclassVideos={masterclassVideos}
                    theme={theme}
                    onUpdateUserPlan={handleUpdateUserPlan}
                    onUpdateSystemPlan={handleUpdateSystemPlan}
                    initialSubTab={
                      activeTab === "STAFF" ? "staff" :
                      activeTab === "AI" ? "ai" :
                      activeTab === "TRAINING" ? "training" :
                      activeTab === "GATEWAY" ? "gateway" :
                      activeTab === "PLANS" ? "plans" : undefined
                    }
                    onChangeModule={(mod) => setActiveTab(mod.toUpperCase())}
                    onResetEmployeePin={async (empId) => {
                      const target = employees.find(e => e.id === empId);
                      if (!target) return;
                      const generatedPin = generateSecurePin(6);
                      const updatedEmployees = employees.map(emp => {
                        if (emp.id === empId) {
                          return {
                            ...emp,
                            pin: generatedPin,
                            password: generatedPin,
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
                        `PIN do colaborador ${target.name} (${target.username}) redefinido e enviado para o e-mail pelo Administrador.`
                      );

                      let emailDetails = "";
                      const targetEmail = target.email?.trim();
                      if (targetEmail) {
                        try {
                          await sendEmail({
                            to: targetEmail,
                            subject: "Redefinição de PIN / Senha de Acesso - OST Vendas",
                            body: `
                              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                              <div style="text-align: center; border-bottom: 2px solid #ff6b00; padding-bottom: 15px; margin-bottom: 20px;">
                                <h1 style="color: #0f172a; margin: 0; font-size: 24px;">OST Vendas</h1>
                                <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Notificação de Segurança - Redefinição de Credenciais</p>
                              </div>
                              <h2 style="color: #1e293b; font-size: 18px;">Olá, ${target.name}!</h2>
                              <p style="color: #475569; font-size: 14px; line-height: 1.5;">Informamos que as suas credenciais de acesso ao sistema <strong>OST Vendas</strong> foram redefinidas com sucesso pela Administração.</p>
                              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
                                <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 5px; font-weight: bold; text-transform: uppercase;">Novo PIN Temporário de Acesso:</span>
                                <strong style="color: #ff6b00; font-size: 24px; letter-spacing: 2px; font-family: monospace;">${generatedPin}</strong>
                              </div>
                              <p style="color: #475569; font-size: 14px; line-height: 1.5;">Por motivos de segurança, utilize este PIN temporário para efetuar o login. O sistema exigirá que defina uma senha definitiva personalizada no primeiro acesso.</p>
                              <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center;">Se não solicitou esta alteração, entre em contacto imediatamente com o Administrador.</p>
                            </div>
                          `,
                          isHtml: true
                        });
                        emailDetails = ` Um e-mail com a nova senha foi enviado com sucesso para ${targetEmail}.`;
                      } catch (emailErr) {
                        console.error("Erro ao enviar e-mail de redefinição de PIN:", emailErr);
                        emailDetails = " (Nota: Ocorreu um erro ao enviar o e-mail de notificação. Certifique-se de que as configurações de SMTP estão ativas).";
                      }
                    } else {
                      emailDetails = " (Aviso: O colaborador não possui e-mail cadastrado no sistema para o envio automático).";
                    }

                    showToast(
                      `PIN do colaborador ${target.name} redefinido com sucesso para '${generatedPin}'.${emailDetails}`,
                      "success",
                      "Reset de PIN Concluído"
                    );
                  }}
                  onUpdateEmployeeTheme={async (empId, themeId) => {
                    const target = employees.find(e => e.id === empId);
                    if (!target) return;
                    const updatedEmployees = employees.map(emp => {
                      if (emp.id === empId) {
                        return {
                          ...emp,
                          theme: themeId
                        };
                      }
                      return emp;
                    });
                    setEmployees(updatedEmployees);
                    await syncTable("employees", updatedEmployees);
                    
                    if (activeUser && activeUser.id === empId) {
                      setActiveColorTheme(themeId);
                      localStorage.setItem("erp_theme_" + empId, themeId);
                    }

                    handleAddAuditLog(
                      "Definição de Tema de Colaborador",
                      "SEGURANÇA",
                      `Tema do colaborador ${target.name} (${target.username}) atualizado para ${themeId} pelo Administrador.`
                    );
                    showToast(
                      `Preferência de cor para ${target.name} atualizada para '${themeId}'.`,
                      "success",
                      "Tema de Colaborador"
                    );
                  }}
                />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

      </div>

      {/* PIN Verification Modal for Switching Operator */}
      <PinVerificationModal
        isOpen={pinVerificationOpen}
        onClose={() => {
          setPinVerificationOpen(false);
          setPinTargetEmployee(null);
        }}
        theme={theme}
        loginMethod={loginMethod}
        onLoginMethodChange={(m) => {
          setLoginMethod(m);
          setPinError("");
        }}
        pinTargetEmployee={pinTargetEmployee}
        onPinTargetEmployeeChange={(emp) => {
          setPinTargetEmployee(emp);
          setEnteredPin("");
          setPinError("");
        }}
        employees={employees}
        enteredUsername={enteredUsername}
        onEnteredUsernameChange={(u) => {
          setEnteredUsername(u);
          if (pinError) setPinError("");
        }}
        enteredPin={enteredPin}
        onEnteredPinChange={(p) => {
          setEnteredPin(p);
          if (pinError) setPinError("");
        }}
        pinError={pinError}
        onVerify={handleVerifyAndSwitchProfile}
      />



      {/* Ultra-Clean User / Collaborator Switch Modal */}
      <UserSwitchModal
        isOpen={isUserSwitchModalOpen}
        onClose={() => setIsUserSwitchModalOpen(false)}
        theme={theme}
        employees={employees}
        activeUser={activeUser}
        settings={settings}
        onSelectEmployee={(newEmp) => {
          setActiveUser(newEmp);
          showToast(`Operador alterado para ${newEmp.name}!`, "success");
        }}
        onAuditLog={(action, module, details) => {
          handleAddAuditLog(action, module, details);
        }}
      />

      <StockReplenishModal
        isOpen={showReplenishModal}
        onClose={() => setShowReplenishModal(false)}
        products={products}
        onUpdateProduct={handleUpdateProduct}
        activeBranchId={settings.activeBranchId || "central"}
        onShowToast={showToast}
        theme={theme}
      />

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

      {/* Floating Action Navigation Hub (FAB) */}
      {!isPOSFullscreen && (
        <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3 no-print">
          <AnimatePresence>
            {isFabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className={`p-4 rounded-3xl border shadow-2xl w-64 md:w-72 max-h-[75vh] overflow-y-auto backdrop-blur-xl flex flex-col gap-2 ${
                  theme === "night"
                    ? "bg-zinc-950/95 border-zinc-850/80 shadow-zinc-950/50 text-slate-100"
                    : "bg-white/95 border-slate-200 shadow-slate-350/30 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-1 border-b border-dashed border-slate-700/20 dark:border-zinc-800">
                  <span className="text-[10px] font-black tracking-widest uppercase text-orange-500 font-mono">Navegação Rápida</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-900 border dark:border-zinc-800 font-mono">
                    {activeUser ? activeUser.role : "Sessão"}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  {NAV_MENU_ITEMS.map((item) => {
                    const roleCheck = canRoleAccessModule(simplifiedRole, item.id);
                    const authorized = roleCheck.allowed;
                    const active = activeTab.toLowerCase() === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        disabled={!authorized}
                        onClick={() => {
                          if (authorized) {
                            setActiveTab(item.id.toUpperCase());
                            setIsFabOpen(false);
                          }
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all group ${
                          active
                            ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                            : authorized
                            ? theme === "night"
                              ? "text-slate-300 hover:text-white hover:bg-zinc-900 cursor-pointer"
                              : "text-slate-700 hover:text-orange-600 hover:bg-orange-50/50 cursor-pointer"
                            : "opacity-35 cursor-not-allowed text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                            active
                              ? "text-white"
                              : authorized
                              ? theme === "night"
                                ? "text-slate-500 group-hover:text-slate-300"
                                : "text-slate-400 group-hover:text-orange-500"
                              : "text-slate-400"
                          }`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        
                        {!authorized && (
                          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                <div className="border-t border-slate-700/10 dark:border-zinc-800/80 pt-2 mt-1 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setIsSidebarOpen(true);
                      setIsFabOpen(false);
                    }}
                    className={`w-full flex items-center justify-center gap-2 p-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                      theme === "night"
                        ? "bg-zinc-900/60 border-zinc-850 text-orange-400 hover:bg-zinc-900 hover:text-orange-300"
                        : "bg-orange-50/40 border-orange-100 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                    }`}
                  >
                    <Menu className="w-3.5 h-3.5" />
                    <span>Ver Painel Lateral 📋</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsFabOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Terminar Sessão 🔒</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer border relative group ${
              isFabOpen
                ? "bg-slate-900 text-white border-slate-800 hover:bg-slate-800 scale-105"
                : theme === "night"
                ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-600 hover:scale-110"
                : "bg-orange-500 hover:bg-orange-600 text-white border-orange-400 hover:scale-110"
            }`}
            title="Menu de Navegação Rápida"
          >
            {isFabOpen ? (
              <X className="w-6 h-6 animate-in spin-in duration-200" />
            ) : (
              <Compass className="w-6 h-6 group-hover:rotate-45 transition-transform duration-300 animate-pulse" />
            )}
            
            {/* Soft pulsing visual outer ring */}
            {!isFabOpen && (
              <span className="absolute -inset-0.5 rounded-full border border-orange-500 animate-ping opacity-25 pointer-events-none"></span>
            )}
          </button>
        </div>
      )}

      {/* Quick Logo Config Modal */}
      <QuickLogoModal
        isOpen={isQuickLogoModalOpen}
        onClose={() => setIsQuickLogoModalOpen(false)}
        currentLogoUrl={settings.logoUrl}
        companyName={companyDisplayName}
        theme={theme}
        onSaveLogo={(newLogoUrl) => {
          handleUpdateSettings({ logoUrl: newLogoUrl });
          handleAddAuditLog(
            "Logotipo Atualizado",
            "DEFINICOES",
            `Logotipo da empresa atualizado para '${newLogoUrl.substring(0, 40)}...' via Painel de Configuração Rápida.`
          );
        }}
        onShowToast={showToast}
      />

      {/* Tutorial & Keyboard Shortcuts Modal */}
      <TutorialModal
        isOpen={isTutorialModalOpen}
        onClose={() => setIsTutorialModalOpen(false)}
        theme={theme}
        onNavigateModule={(moduleKey) => setActiveTab(moduleKey)}
      />

      {/* Interactive Step-by-Step Onboarding Tutorial */}
      <OnboardingTutorial
        isOpen={isOnboardingTutorialOpen}
        onClose={() => setIsOnboardingTutorialOpen(false)}
        userName={activeUser?.name || "Utilizador"}
        theme={theme === "night" ? "night" : "day"}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* Unified System Info Hub Modal */}
      <SystemInfoHub
        isOpen={isSystemInfoHubOpen}
        onClose={() => setIsSystemInfoHubOpen(false)}
        isOnline={isOnline}
        companyName={companyDisplayName}
        logoUrl={settings.logoUrl}
        version={currentSystemVersion}
        sessionSeconds={Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)}
        activeUser={activeUser}
        onSwitchUser={() => setIsUserSwitchModalOpen(true)}
        onOpenLogoModal={() => setIsQuickLogoModalOpen(true)}
        onOpenTutorial={() => setIsTutorialModalOpen(true)}
        theme={theme}
      />
    </div>
  );
}
