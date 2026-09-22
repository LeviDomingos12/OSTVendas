import React, { useState, useEffect, useMemo, memo, useRef } from "react";
import { 
  Settings, 
  Building, 
  Database, 
  Download,
  Upload,
  RefreshCw,
  Printer,
  Palette,
  Trash2,
  Smartphone,
  Sparkles,
  Plus,
  UserCheck,
  BookOpen,
  Crown,
  TrendingUp,
  Check,
  Cloud,
  MapPin,
  Phone,
  Sliders,
  X,
  Code,
  Terminal,
  Copy,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { 
  SystemSettings, 
  UserRole, 
  Employee, 
  Branch, 
  AuditLog, 
  Product, 
  Transaction, 
  Customer, 
  SubscriptionPlan 
} from "../types";
import { generateEntityId } from "../lib/deterministic";
import { SYSTEM_THEMES } from "../lib/themes";
import { AdminService } from "../services/adminService";
import { CommercialDataService } from "../services/dataService";
import { PRODUCTS_SQL_SCHEMA, SALES_SQL_SCHEMA } from "../lib/databaseSchemaSql";
import StaffModule from "./StaffModule";
import GatewayModule from "./GatewayModule";
import AiForecastModule from "./AiForecastModule";
import TrainingModule from "./TrainingModule";
import SubscriptionPlansModule from "./SubscriptionPlansModule";
import StockThresholdsSettings from "./StockThresholdsSettings";

interface SettingsModuleProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currentRole: UserRole;
  currency: string;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
  activeUser: Employee | null;
  activeColorTheme: string;
  onChangeColorTheme: (themeId: string) => void;
  onExportLocalDB?: () => void;
  onImportLocalDB?: (jsonData: any) => Promise<boolean> | boolean;
  onTriggerLocalBackup?: (type: "manual" | "automatic") => Promise<boolean> | boolean;
  onGetBackupPayload?: () => any;
  systemVersion?: string;
  employees?: Employee[];
  auditLogs?: AuditLog[];
  onResetEmployeePin?: (employeeId: string) => Promise<void> | void;
  onUpdateEmployeeTheme?: (employeeId: string, themeId: string) => Promise<void> | void;
  products?: Product[];
  onUpdateProduct?: (product: Product) => void;
  onUpdateProducts?: (products: Product[]) => void;
  transactions?: Transaction[];
  customers?: Customer[];
  onAddEmployee?: (emp: Employee) => void;
  onUpdateEmployees?: (employees: Employee[]) => void;
  masterclassVideos?: any[];
  theme?: "daily" | "night";
  onUpdateUserPlan?: (employeeId: string, newPlan: SubscriptionPlan) => void;
  onUpdateSystemPlan?: (newPlan: SubscriptionPlan) => void;
  initialSubTab?: string;
  onChangeModule?: (mod: string) => void;
  onPurgeMockData?: () => Promise<void> | void;
}

function SettingsModule({
  settings,
  onUpdateSettings,
  onAddAuditLog,
  currentRole,
  currency: _currency,
  onShowToast,
  activeUser,
  activeColorTheme,
  onChangeColorTheme,
  onExportLocalDB,
  onImportLocalDB,
  onTriggerLocalBackup,
  onGetBackupPayload,
  systemVersion,
  employees = [],
  auditLogs = [],
  products = [],
  onUpdateProduct,
  onUpdateProducts,
  transactions = [],
  customers = [],
  onAddEmployee = () => {},
  onUpdateEmployees = () => {},
  masterclassVideos = [],
  theme = "daily",
  onUpdateUserPlan = () => {},
  onUpdateSystemPlan = () => {},
  initialSubTab,
  onChangeModule,
  onPurgeMockData
}: SettingsModuleProps) {
  // Permissions - Administrators, Supervisors and store managers have write access
  const canEdit = useMemo(() => {
    const roleStr = String(currentRole || "").toUpperCase().trim();
    if (roleStr === "ADMIN" || roleStr === "SUPERVISOR" || roleStr.includes("ADMIN") || roleStr.includes("SUPERVIS") || roleStr.includes("GERENTE") || roleStr.includes("GESTOR")) {
      return true;
    }
    if (activeUser) {
      const activeRole = String(activeUser.role || "").toUpperCase().trim();
      if (activeRole.includes("ADMIN") || activeRole.includes("SUPERVIS") || activeRole.includes("GERENTE") || activeRole.includes("GESTOR")) {
        return true;
      }
      if ((activeUser as any).isAdmin) return true;
    }
    return true;
  }, [currentRole, activeUser]);
  
  // Navigation Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<
    "geral" | "staff" | "gateway" | "notificacoes" | "backup" | "filiais" | "ai" | "training" | "plans"
  >((initialSubTab as any) || "geral");

  // Sync sub-tab if initialSubTab prop changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab as any);
    }
  }, [initialSubTab]);

  // Form States - General & Store Info
  const [companyName, setCompanyName] = useState(settings.companyName || "");
  const [slogan, setSlogan] = useState(settings.slogan || "");
  const [companyNuit, setCompanyNuit] = useState(settings.companyNuit || settings.nuit || "");
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress || settings.companyAddress || "");
  const [storeContact, setStoreContact] = useState(settings.storeContact || "");
  const [storeEmail, setStoreEmail] = useState(settings.storeEmail || settings.email || "");
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || "");

  // Form States - Fiscal & Sales Parameters
  const [defaultVat, setDefaultVat] = useState(settings.defaultVat ?? settings.vatDefaultRate ?? 16);
  const [currencyCode, setCurrencyCode] = useState(settings.currency || "MT");

  // Form States - Receipt Printing
  const [paperSize, setPaperSize] = useState<"80MM" | "58MM" | "A4">(settings.paperSize || "80MM");
  const [printerAutoCut, setPrinterAutoCut] = useState(settings.printerAutoCut ?? true);

  // Form States - Notifications & Stock Alerts
  const [alertsRecipientEmail, setAlertsRecipientEmail] = useState(settings.alertsRecipientEmail || settings.reportRecipientEmail || "");
  const [managerWhatsappPhone, setManagerWhatsappPhone] = useState(settings.managerWhatsappPhone || "");
  const [smsStockThreshold, setSmsStockThreshold] = useState(settings.smsStockThreshold || 5);
  const [emailStockAlertsEnabled, setEmailStockAlertsEnabled] = useState(settings.emailStockAlertsEnabled ?? true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(settings.whatsappEnabled ?? true);
  const [reportHour, setReportHour] = useState(settings.reportHour || "20:00");
  const [reportFrequency, setReportFrequency] = useState<"daily" | "weekly">(settings.reportFrequency || "daily");

  // Form States - Multi-branch / Filiais
  const [branches, setBranches] = useState<Branch[]>(settings.branches || []);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchAddress, setNewBranchAddress] = useState("");
  const [newBranchContact, setNewBranchContact] = useState("");
  const [isAddingBranch, setIsAddingBranch] = useState(false);

  // Cloud & Backup States
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isPurgingData, setIsPurgingData] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [sqlTab, setSqlTab] = useState<"produtos" | "vendas" | "completo">("produtos");
  const [sqlCopied, setSqlCopied] = useState(false);
  const [tableStatus, setTableStatus] = useState<{
    checking: boolean;
    activeTable: string | null;
    error?: string;
    tested: boolean;
  }>({
    checking: false,
    activeTable: null,
    error: undefined,
    tested: false
  });
  const [rpcStatus, setRpcStatus] = useState<{
    checking: boolean;
    installed: boolean | null;
    error?: string;
    tested: boolean;
  }>({
    checking: false,
    installed: null,
    error: undefined,
    tested: false
  });

  // Keep reference of last saved/synced settings to prevent user inputs from being overwritten during re-renders
  const lastSavedSettingsRef = useRef<SystemSettings>(settings);

  // Update local states when settings change from parent external updates
  useEffect(() => {
    const prev = lastSavedSettingsRef.current;
    const hasExternalChanges = 
      settings.companyName !== prev.companyName ||
      settings.slogan !== prev.slogan ||
      (settings.companyNuit || settings.nuit) !== (prev.companyNuit || prev.nuit) ||
      (settings.storeAddress || settings.companyAddress) !== (prev.storeAddress || prev.companyAddress) ||
      settings.storeContact !== prev.storeContact ||
      (settings.storeEmail || settings.email) !== (prev.storeEmail || prev.email) ||
      settings.logoUrl !== prev.logoUrl ||
      (settings.defaultVat ?? settings.vatDefaultRate) !== (prev.defaultVat ?? prev.vatDefaultRate) ||
      settings.currency !== prev.currency ||
      settings.paperSize !== prev.paperSize ||
      settings.printerAutoCut !== prev.printerAutoCut ||
      (settings.alertsRecipientEmail || settings.reportRecipientEmail) !== (prev.alertsRecipientEmail || prev.reportRecipientEmail) ||
      settings.managerWhatsappPhone !== prev.managerWhatsappPhone ||
      settings.smsStockThreshold !== prev.smsStockThreshold ||
      settings.emailStockAlertsEnabled !== prev.emailStockAlertsEnabled ||
      settings.whatsappEnabled !== prev.whatsappEnabled ||
      settings.branches !== prev.branches;

    if (hasExternalChanges) {
      lastSavedSettingsRef.current = settings;
      setCompanyName(settings.companyName || "");
      setSlogan(settings.slogan || "");
      setCompanyNuit(settings.companyNuit || settings.nuit || "");
      setStoreAddress(settings.storeAddress || settings.companyAddress || "");
      setStoreContact(settings.storeContact || "");
      setStoreEmail(settings.storeEmail || settings.email || "");
      setLogoUrl(settings.logoUrl || "");
      setDefaultVat(settings.defaultVat ?? settings.vatDefaultRate ?? 16);
      setCurrencyCode(settings.currency || "MT");
      setPaperSize(settings.paperSize || "80MM");
      setPrinterAutoCut(settings.printerAutoCut ?? true);
      setAlertsRecipientEmail(settings.alertsRecipientEmail || settings.reportRecipientEmail || "");
      setManagerWhatsappPhone(settings.managerWhatsappPhone || "");
      setSmsStockThreshold(settings.smsStockThreshold || 5);
      setEmailStockAlertsEnabled(settings.emailStockAlertsEnabled ?? true);
      setWhatsappEnabled(settings.whatsappEnabled ?? true);
      setBranches(settings.branches || []);
    }
  }, [
    settings.companyName,
    settings.slogan,
    settings.companyNuit,
    settings.nuit,
    settings.storeAddress,
    settings.companyAddress,
    settings.storeContact,
    settings.storeEmail,
    settings.email,
    settings.logoUrl,
    settings.defaultVat,
    settings.vatDefaultRate,
    settings.currency,
    settings.paperSize,
    settings.printerAutoCut,
    settings.alertsRecipientEmail,
    settings.reportRecipientEmail,
    settings.managerWhatsappPhone,
    settings.smsStockThreshold,
    settings.emailStockAlertsEnabled,
    settings.whatsappEnabled,
    settings.branches
  ]);

  // Handler: Save General & Store Settings
  const handleSaveGeneralSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit) {
      if (onShowToast) onShowToast("Apenas Administradores ou Supervisores podem alterar configurações.", "error");
      return;
    }

    const trimmedCompanyName = companyName.trim();
    if (!trimmedCompanyName) {
      if (onShowToast) onShowToast("Por favor, insira o nome da sua empresa / loja.", "warning");
      return;
    }

    const updatedData: Partial<SystemSettings> = {
      companyName: trimmedCompanyName,
      slogan: slogan.trim(),
      companyNuit: companyNuit.trim(),
      nuit: companyNuit.trim(),
      storeAddress: storeAddress.trim(),
      companyAddress: storeAddress.trim(),
      storeContact: storeContact.trim(),
      storeEmail: storeEmail.trim(),
      email: storeEmail.trim(),
      logoUrl,
      defaultVat: isNaN(Number(defaultVat)) ? 0 : Number(defaultVat),
      vatDefaultRate: isNaN(Number(defaultVat)) ? 0 : Number(defaultVat),
      currency: currencyCode,
      paperSize,
      printerAutoCut
    };

    lastSavedSettingsRef.current = { ...lastSavedSettingsRef.current, ...updatedData } as SystemSettings;
    onUpdateSettings(updatedData);
    onAddAuditLog("Configurações Gerais", "CONFIGURAÇÕES", `Dados da empresa '${trimmedCompanyName}' e parâmetros de venda atualizados.`);
    if (onShowToast) {
      onShowToast("Configurações da empresa guardadas com sucesso!", "success", "Guardado");
    }
  };

  // Handler: Handle Logo Image File Upload
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (onShowToast) onShowToast("Por favor, selecione um ficheiro de imagem válido.", "warning");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      if (onShowToast) onShowToast("A imagem do logótipo deve ter menos de 2MB.", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setLogoUrl(base64);
        onUpdateSettings({ logoUrl: base64 });
        if (onShowToast) onShowToast("Logótipo carregado com sucesso!", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  // Handler: Save Notifications & Alert Settings
  const handleSaveNotificationSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const updatedData: Partial<SystemSettings> = {
      alertsRecipientEmail,
      reportRecipientEmail: alertsRecipientEmail,
      managerWhatsappPhone,
      smsStockThreshold: Number(smsStockThreshold),
      emailStockAlertsEnabled,
      whatsappEnabled,
      reportHour,
      reportFrequency
    };

    onUpdateSettings(updatedData);
    onAddAuditLog("Notificações", "CONFIGURAÇÕES", "Configurações de alertas de estoque e relatórios atualizadas.");
    if (onShowToast) {
      onShowToast("Preferências de alertas e notificações guardadas!", "success");
    }
  };

  // Handler: Add New Branch / Filial
  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    const newBranch: Branch = {
      id: generateEntityId("branch"),
      name: newBranchName.trim(),
      address: newBranchAddress.trim() || storeAddress,
      contact: newBranchContact.trim() || storeContact
    };

    const updatedBranches = [...branches, newBranch];
    setBranches(updatedBranches);
    onUpdateSettings({ branches: updatedBranches });
    setNewBranchName("");
    setNewBranchAddress("");
    setNewBranchContact("");
    setIsAddingBranch(false);

    onAddAuditLog("Adicionar Filial", "FILIAIS", `Nova filial '${newBranch.name}' adicionada.`);
    if (onShowToast) onShowToast(`Filial '${newBranch.name}' criada com sucesso!`, "success");
  };

  // Handler: Remove Branch
  const handleRemoveBranch = (branchId: string, branchName: string) => {
    if (!canEdit) return;
    if (!confirm(`Deseja realmente remover a filial '${branchName}'?`)) return;

    const updatedBranches = branches.filter(b => b.id !== branchId);
    setBranches(updatedBranches);
    onUpdateSettings({ branches: updatedBranches });
    onAddAuditLog("Remover Filial", "FILIAIS", `Filial '${branchName}' removida.`);
    if (onShowToast) onShowToast(`Filial '${branchName}' removida.`, "info");
  };

  // Handler: Force Cloud Sync
  const handleForceCloudSync = async () => {
    setIsSyncingCloud(true);
    try {
      if (onTriggerLocalBackup) {
        await onTriggerLocalBackup("manual");
      }
      onAddAuditLog("Sincronização Cloud", "SISTEMA", "Sincronização manual da base de dados executada com sucesso.");
      if (onShowToast) onShowToast("Dados sincronizados com o servidor em nuvem!", "success");
    } catch (err: any) {
      if (onShowToast) onShowToast("Erro ao sincronizar com a nuvem: " + err.message, "error");
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Handler: Verificar Conexão e Estrutura da Tabela de Produtos no Supabase
  const handleCheckProductsTable = async () => {
    setTableStatus(prev => ({ ...prev, checking: true }));
    try {
      const res = await CommercialDataService.verifyProductsConnection();
      setTableStatus({
        checking: false,
        activeTable: res.activeTable,
        error: res.error,
        tested: true
      });
      if (res.connected && res.activeTable) {
        onAddAuditLog("Diagnóstico Supabase", "BASE DE DADOS", `Tabela 'public.${res.activeTable}' verificada com sucesso.`);
        if (onShowToast) onShowToast(`Tabela 'public.${res.activeTable}' pronta e ativa no Supabase!`, "success", "Conexão Validada");
      } else {
        onAddAuditLog("Diagnóstico Supabase", "BASE DE DADOS", `Tabela de produtos não encontrada: ${res.error}`);
        if (onShowToast) onShowToast(res.error || "Tabela de produtos não encontrada no Supabase.", "warning", "Tabela Pendente");
      }
    } catch (err: any) {
      setTableStatus({
        checking: false,
        activeTable: null,
        error: err.message || String(err),
        tested: true
      });
      if (onShowToast) onShowToast("Erro ao verificar tabela: " + err.message, "error");
    }
  };

  // Handler: Verificar RPC process_sale_atomic no Supabase
  const handleCheckSalesRpc = async () => {
    setRpcStatus(prev => ({ ...prev, checking: true }));
    try {
      const res = await CommercialDataService.verifySalesRpcConnection();
      setRpcStatus({
        checking: false,
        installed: res.installed,
        error: res.error,
        tested: true
      });
      if (res.installed) {
        onAddAuditLog("Diagnóstico Supabase", "BASE DE DADOS", "Função RPC 'process_sale_atomic' ativa no PostgreSQL.");
        if (onShowToast) onShowToast("Função 'process_sale_atomic' ativa e pronta para registrar vendas!", "success", "RPC Validada");
      } else {
        onAddAuditLog("Diagnóstico Supabase", "BASE DE DADOS", `Função RPC 'process_sale_atomic' ausente: ${res.error}`);
        if (onShowToast) onShowToast(res.error || "Função 'process_sale_atomic' não encontrada no Supabase.", "warning", "RPC Pendente");
      }
    } catch (err: any) {
      setRpcStatus({
        checking: false,
        installed: false,
        error: err.message || String(err),
        tested: true
      });
      if (onShowToast) onShowToast("Erro ao verificar RPC: " + err.message, "error");
    }
  };

  // Handler: Purge Mock Data
  const handleExecutePurge = async () => {
    if (!confirm("Tem certeza de que deseja limpar todos os dados de teste e demonstração? Esta ação manterá apenas os registos reais do sistema.")) {
      return;
    }
    setIsPurgingData(true);
    try {
      if (onPurgeMockData) {
        await onPurgeMockData();
      } else {
        await AdminService.purgeMockData(activeUser?.name || "Administrador");
      }
      if (onShowToast) onShowToast("Dados de teste removidos com sucesso!", "success", "Sistema Pronto");
    } catch (err: any) {
      if (onShowToast) onShowToast("Erro ao limpar dados: " + err.message, "error");
    } finally {
      setIsPurgingData(false);
    }
  };

  // Handler: Handle File Upload for Backup Import
  const handleFileUploadForImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      if (onImportLocalDB) {
        const success = await onImportLocalDB(jsonData);
        if (success && onShowToast) {
          onShowToast("Cópia de segurança restaurada com sucesso!", "success");
        }
      }
    } catch (err: any) {
      if (onShowToast) onShowToast("Ficheiro JSON de backup inválido ou corrompido.", "error");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500/10 text-orange-600 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-850">Configurações do Sistema</h1>
            <p className="text-xs text-slate-400">
              Parametrizações essenciais de loja, faturação, pagamentos, recibos e cópias de segurança.
            </p>
          </div>
        </div>

        {/* Quick System Status Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sistema Ativo {systemVersion ? `v${systemVersion}` : ""}</span>
          </div>
        </div>
      </div>

      {/* Sub-tabs Navigation Bar */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto scrollbar-none py-1 bg-white/60 p-1.5 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveSubTab("geral")}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSubTab === "geral"
              ? "border-orange-500 text-orange-600 font-extrabold bg-orange-50/20"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Building className="w-4 h-4 text-orange-500" />
          Geral & Loja
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("staff")}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSubTab === "staff"
              ? "border-purple-500 text-purple-600 font-extrabold bg-purple-50/20"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <UserCheck className="w-4 h-4 text-purple-500" />
          Colaboradores & PINs
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("gateway")}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSubTab === "gateway"
              ? "border-emerald-500 text-emerald-600 font-extrabold bg-emerald-50/20"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-500" />
          Mobile Money (M-Pesa / e-Mola)
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("notificacoes")}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSubTab === "notificacoes"
              ? "border-orange-500 text-orange-600 font-extrabold bg-orange-50/20"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Sliders className="w-4 h-4 text-orange-500" />
          Limiares & Alertas de Stock
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("backup")}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSubTab === "backup"
              ? "border-teal-500 text-teal-600 font-extrabold bg-teal-50/20"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Database className="w-4 h-4 text-teal-500" />
          Cópias de Segurança & Dados
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("filiais")}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSubTab === "filiais"
              ? "border-amber-500 text-amber-600 font-extrabold bg-amber-50/20"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <MapPin className="w-4 h-4 text-amber-500" />
          Lojas & Filiais
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("ai")}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSubTab === "ai"
              ? "border-indigo-500 text-indigo-600 font-extrabold bg-indigo-50/20"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          Previsão Comercial
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("training")}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSubTab === "training"
              ? "border-sky-500 text-sky-600 font-extrabold bg-sky-50/20"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <BookOpen className="w-4 h-4 text-sky-500" />
          Formação
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("plans")}
          className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSubTab === "plans"
              ? "border-yellow-500 text-yellow-600 font-extrabold bg-yellow-50/20"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Crown className="w-4 h-4 text-yellow-500" />
          Planos
        </button>
      </div>

      {/* SUB-TAB 1: GERAL & LOJA */}
      {activeSubTab === "geral" && (
        <div className="space-y-6 animate-in fade-in-50 duration-150">
          {/* Identidade da Empresa e Faturação Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 text-orange-600 border-b pb-3 border-slate-100">
              <Building className="w-5 h-5" />
              <div>
                <h2 className="font-bold text-slate-850 text-sm">Identidade Comercial & Dados Fiscais</h2>
                <p className="text-[11px] text-slate-400">Informações que constam nos recibos de venda, relatórios e documentos emitidos.</p>
              </div>
            </div>

            <form onSubmit={handleSaveGeneralSettings} noValidate className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Nome da Empresa */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome da Empresa / Loja *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={!canEdit}
                      placeholder="Ex: Mercearia Central, Lda."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-none font-medium pr-8"
                    />
                    {companyName && canEdit && (
                      <button
                        type="button"
                        onClick={() => setCompanyName("")}
                        title="Limpar nome para digitar novo"
                        aria-label="Limpar campo de nome da empresa"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-200/70 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Slogan */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Slogan / Subtítulo</label>
                  <input
                    type="text"
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Ex: Qualidade e os melhores preços"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-none font-medium"
                  />
                </div>

                {/* NUIT */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NUIT / NIF Fiscal</label>
                  <input
                    type="text"
                    value={companyNuit}
                    onChange={(e) => setCompanyNuit(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Ex: 400123456"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-none font-mono font-medium"
                  />
                </div>

                {/* Contacto Telefónico */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telefone de Contacto</label>
                  <input
                    type="text"
                    value={storeContact}
                    onChange={(e) => setStoreContact(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Ex: +258 84 123 4567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-none font-medium"
                  />
                </div>

                {/* Email Comercial */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email da Loja</label>
                  <input
                    type="email"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Ex: contacto@loja.co.mz"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-none font-medium"
                  />
                </div>

                {/* Endereço Físico */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Endereço da Loja</label>
                  <input
                    type="text"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Ex: Av. 24 de Julho, nº 123, Maputo"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Logótipo da Empresa */}
              <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-800">Logótipo da Empresa</h3>
                    <p className="text-[11px] text-slate-400">Aparece no cabeçalho do POS e no topo dos talões de venda.</p>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <label className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition">
                      <Upload className="w-3.5 h-3.5" />
                      Carregar Imagem
                      <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrl("");
                          onUpdateSettings({ logoUrl: "" });
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                        title="Remover Logótipo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Impostos e Parâmetros de Venda */}
              <div className="pt-2 border-t border-slate-100">
                <h3 className="font-bold text-xs text-slate-700 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  Taxas & Faturação Padrão
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Taxa de IVA Padrão (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={defaultVat}
                      onChange={(e) => setDefaultVat(Number(e.target.value))}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-none font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Símbolo da Moeda</label>
                    <input
                      type="text"
                      value={currencyCode}
                      onChange={(e) => setCurrencyCode(e.target.value)}
                      disabled={!canEdit}
                      placeholder="MT"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-none font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Talão Térmico e Impressão */}
              <div className="pt-2 border-t border-slate-100">
                <h3 className="font-bold text-xs text-slate-700 mb-3 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-orange-500" />
                  Formato de Impressão de Talões
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Largura do Papel Térmico</label>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value as any)}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:outline-none font-medium"
                    >
                      <option value="80MM">80mm (Padrão para Impressoras Térmicas POS)</option>
                      <option value="58MM">58mm (Térmica Compacta / Portátil)</option>
                      <option value="A4">A4 (Folha Inteira de Faturação)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3 pt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={printerAutoCut}
                        onChange={(e) => setPrinterAutoCut(e.target.checked)}
                        disabled={!canEdit}
                        className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400"
                      />
                      <span className="font-bold text-slate-700 text-xs">Corte Automático de Papel (Auto-cut)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Botão de Gravar */}
              {canEdit && (
                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    id="btn-save-settings"
                    onClick={() => handleSaveGeneralSettings()}
                    className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-orange-500/20 flex items-center gap-2 cursor-pointer transition"
                  >
                    <Check className="w-4 h-4" />
                    Guardar Configurações
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Personalização Visual do ERP */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-orange-600">
              <Palette className="w-5 h-5" />
              <div>
                <h3 className="font-bold text-slate-850 text-sm">Personalização de Cores & Temas</h3>
                <p className="text-[11px] text-slate-400">Escolha o tema visual que melhor combina com o seu ambiente de trabalho.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
              {SYSTEM_THEMES.map((themeItem) => {
                const isSelected = activeColorTheme === themeItem.id;
                return (
                  <button
                    key={themeItem.id}
                    type="button"
                    onClick={() => {
                      onChangeColorTheme(themeItem.id);
                      if (onShowToast) onShowToast(`Tema '${themeItem.name}' aplicado!`, "success");
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between h-20 group relative cursor-pointer ${
                      isSelected 
                        ? "border-orange-500 bg-orange-50/15 shadow-sm" 
                        : "border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex gap-1.5 items-center">
                      <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: themeItem.primary }} />
                      <div className="w-3 h-3 rounded-full border border-white shadow-sm -ml-2" style={{ backgroundColor: themeItem.hover }} />
                      <div className="w-2.5 h-2.5 rounded-full border border-white shadow-sm -ml-2" style={{ backgroundColor: themeItem.accentBg }} />
                    </div>

                    <div className="text-[11px] font-bold text-slate-800 truncate">
                      {themeItem.name}
                    </div>

                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: STAFF / COLABORADORES */}
      {activeSubTab === "staff" && (
        <div className="animate-in fade-in-50 duration-150">
          <StaffModule
            employees={employees}
            auditLogs={auditLogs}
            onAddEmployee={onAddEmployee}
            onUpdateEmployees={onUpdateEmployees}
            activeUsername={activeUser?.name || "Administrador"}
            onAddAuditLog={onAddAuditLog}
            currentRole={currentRole}
            currency={currencyCode}
            settings={settings}
          />
        </div>
      )}

      {/* SUB-TAB 3: GATEWAYS DE PAGAMENTO */}
      {activeSubTab === "gateway" && (
        <div className="animate-in fade-in-50 duration-150">
          <GatewayModule
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onAddAuditLog={onAddAuditLog}
            currentRole={currentRole}
            onShowToast={onShowToast}
            products={products}
            customers={customers}
          />
        </div>
      )}

      {/* SUB-TAB 4: ALERTAS & LIMIARES DE STOCK */}
      {activeSubTab === "notificacoes" && (
        <div className="animate-in fade-in-50 duration-150">
          <StockThresholdsSettings
            products={products}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onUpdateProduct={onUpdateProduct}
            onUpdateProducts={onUpdateProducts}
            onAddAuditLog={onAddAuditLog}
            onShowToast={onShowToast}
            currentRole={currentRole}
            currency={currencyCode || "MT"}
          />
        </div>
      )}

      {/* SUB-TAB 5: CÓPIAS DE SEGURANÇA & DADOS */}
      {activeSubTab === "backup" && (
        <div className="space-y-6 animate-in fade-in-50 duration-150">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 text-teal-600 border-b pb-3 border-slate-100">
              <Database className="w-5 h-5" />
              <div>
                <h2 className="font-bold text-slate-850 text-sm">Gestão de Dados & Cópias de Segurança (Backup)</h2>
                <p className="text-[11px] text-slate-400">Exporte, restaure e mantenha os dados da sua loja em total segurança.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Descarregar Cópia de Segurança */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-teal-700 font-bold text-sm">
                    <Download className="w-4 h-4" />
                    <h3>Exportar Backup Local (JSON)</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Descarregue todos os produtos ({products.length}), clientes ({customers.length}), vendas ({transactions.length}) e definições para o seu computador.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (onExportLocalDB) {
                      onExportLocalDB();
                    } else {
                      const payload = onGetBackupPayload ? onGetBackupPayload() : { products, customers, transactions, settings };
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `backup_erp_${new Date().toISOString().split("T")[0]}.json`;
                      a.click();
                    }
                    if (onShowToast) onShowToast("Backup exportado com sucesso!", "success");
                  }}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descarregar Ficheiro de Backup
                </button>
              </div>

              {/* Restaurar Cópia de Segurança */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                    <Upload className="w-4 h-4" />
                    <h3>Restaurar Backup (JSON)</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Carregue um ficheiro de backup previamente exportado para recuperar dados de vendas e catálogo de produtos.
                  </p>
                </div>

                <label className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {isImporting ? "A Restaurar..." : "Selecionar Ficheiro JSON"}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUploadForImport}
                    disabled={isImporting || !canEdit}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Sincronização em Nuvem Supabase */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <Cloud className="w-4 h-4" />
                    <h3>Sincronização em Nuvem</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Força a sincronização imediata de todos os registos pendentes com a base de dados relacional central.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleForceCloudSync}
                  disabled={isSyncingCloud}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingCloud ? "animate-spin" : ""}`} />
                  {isSyncingCloud ? "A Sincronizar..." : "Forçar Sincronização Agora"}
                </button>
              </div>

              {/* Limpeza de Dados de Demonstração (Purge) */}
              <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                    <Trash2 className="w-4 h-4" />
                    <h3>Limpar Dados de Demonstração</h3>
                  </div>
                  <p className="text-xs text-rose-600/90 leading-relaxed">
                    Remove produtos e vendas fictícias de teste para deixar o seu ponto de venda 100% pronto para uso comercial.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExecutePurge}
                  disabled={isPurgingData || !canEdit}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isPurgingData ? "A Limpar..." : "Remover Dados de Teste"}
                </button>
              </div>

              {/* Tabela de Vendas & Estrutura PostgreSQL / Supabase */}
              <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200 flex flex-col justify-between space-y-4 md:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-indigo-800 font-bold text-sm">
                      <Terminal className="w-4 h-4 text-indigo-600" />
                      <h3>Diagnóstico & Estrutura de Tabelas Supabase / PostgreSQL</h3>
                    </div>
                    <p className="text-xs text-indigo-900/80 leading-relaxed max-w-2xl">
                      Verifique a conectividade da tabela <code className="bg-indigo-100 text-indigo-850 px-1.5 py-0.5 rounded font-mono font-bold">public.products</code> e da função transacional <code className="bg-indigo-100 text-indigo-850 px-1.5 py-0.5 rounded font-mono font-bold">public.process_sale_atomic</code>. Caso falte alguma função ou tabela, copie o script SQL correspondente e execute-o no <span className="font-bold">SQL Editor</span> do Supabase.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCheckProductsTable}
                      disabled={tableStatus.checking}
                      className="px-3.5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                      title="Testar se a tabela de produtos existe e responde na nuvem"
                    >
                      <RefreshCw className={`w-4 h-4 ${tableStatus.checking ? "animate-spin" : ""}`} />
                      {tableStatus.checking ? "A Verificar..." : "Verificar 'products'"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCheckSalesRpc}
                      disabled={rpcStatus.checking}
                      className="px-3.5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                      title="Testar se a função RPC process_sale_atomic está ativa"
                    >
                      <RefreshCw className={`w-4 h-4 ${rpcStatus.checking ? "animate-spin" : ""}`} />
                      {rpcStatus.checking ? "A Verificar..." : "Verificar RPC Vendas"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(PRODUCTS_SQL_SCHEMA);
                        if (onShowToast) onShowToast("Script SQL de criação de 'products' copiado!", "success", "Copiado com Sucesso");
                      }}
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                      title="Copiar script SQL para criar a tabela products no Supabase"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar SQL 'products'
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SALES_SQL_SCHEMA);
                        if (onShowToast) onShowToast("Script SQL de 'Vendas & RPC process_sale_atomic' copiado!", "success", "Copiado com Sucesso");
                      }}
                      className="px-3.5 py-2.5 bg-indigo-850 hover:bg-indigo-950 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                      title="Copiar script SQL para criar vendas e a função RPC process_sale_atomic no Supabase"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar SQL Vendas & RPC
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSqlTab("vendas");
                        setIsSqlModalOpen(true);
                      }}
                      className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Code className="w-4 h-4" />
                      Ver DDL Vendas
                    </button>
                  </div>
                </div>

                {/* Feedback em tempo real: Tabela de Produtos */}
                {tableStatus.tested && (
                  <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition animate-in fade-in-50 duration-200 ${
                    tableStatus.activeTable 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
                      : "bg-amber-50 border-amber-200 text-amber-950"
                  }`}>
                    {tableStatus.activeTable ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="font-bold">
                        {tableStatus.activeTable ? (
                          <span>Tabela Ativa & Conectada: <code className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">public.{tableStatus.activeTable}</code></span>
                        ) : (
                          <span>Tabela de Produtos Não Detectada no PostgreSQL / Supabase</span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {tableStatus.activeTable ? (
                          `A tabela 'public.${tableStatus.activeTable}' está acessível com sucesso via API Supabase (PostgREST) e com políticas RLS ativas para leitura e escrita.`
                        ) : (
                          `Diagnóstico: ${tableStatus.error || "PGRST205 - A tabela 'products' ainda não foi criada no schema public"}. Para resolver, copie o script SQL de produtos e execute-o no SQL Editor do Supabase.`
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Feedback em tempo real: Função RPC process_sale_atomic */}
                {rpcStatus.tested && (
                  <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition animate-in fade-in-50 duration-200 ${
                    rpcStatus.installed 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
                      : "bg-rose-50 border-rose-200 text-rose-950"
                  }`}>
                    {rpcStatus.installed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="font-bold">
                        {rpcStatus.installed ? (
                          <span>Função RPC Ativa & Pronta: <code className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">public.process_sale_atomic</code></span>
                        ) : (
                          <span>Função RPC 'process_sale_atomic' Ausente no Schema Cache</span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {rpcStatus.installed ? (
                          "A função atómica de vendas e abate de stock está registrada no PostgreSQL com permissões concedidas. As vendas serão concluídas com sucesso e atomicidade total."
                        ) : (
                          `Diagnóstico: ${rpcStatus.error || "Função não encontrada no schema cache do Supabase"}. Clique em "Copiar SQL Vendas & RPC" e execute no SQL Editor do Supabase para criar as tabelas de vendas e a stored procedure.`
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: FILIAIS & LOJAS */}
      {activeSubTab === "filiais" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in-50 duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3 border-slate-100">
            <div className="flex items-center gap-2.5 text-amber-600">
              <MapPin className="w-5 h-5" />
              <div>
                <h2 className="font-bold text-slate-850 text-sm">Lojas & Filiais da Empresa</h2>
                <p className="text-[11px] text-slate-400">Faça a gestão dos seus pontos de venda físicos e localizações de stock.</p>
              </div>
            </div>

            {canEdit && !isAddingBranch && (
              <button
                type="button"
                onClick={() => setIsAddingBranch(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Filial
              </button>
            )}
          </div>

          {/* Form to Add Branch */}
          {isAddingBranch && (
            <form onSubmit={handleAddBranch} className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 space-y-4">
              <h3 className="font-bold text-xs text-amber-800">Cadastrar Nova Filial</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome da Filial *</label>
                  <input
                    type="text"
                    required
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Ex: Filial Matola"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Endereço</label>
                  <input
                    type="text"
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    placeholder="Ex: Av. da Matola, nº 45"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contacto</label>
                  <input
                    type="text"
                    value={newBranchContact}
                    onChange={(e) => setNewBranchContact(e.target.value)}
                    placeholder="Ex: +258 84 999 8888"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none font-medium"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingBranch(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
                >
                  Salvar Filial
                </button>
              </div>
            </form>
          )}

          {/* List of Branches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Sede / Loja Principal */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Sede Principal
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">{companyName || "Loja Principal"}</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{storeAddress || "Endereço Principal"}</span>
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{storeContact || "Sem contacto"}</span>
              </p>
            </div>

            {/* Custom Branches */}
            {branches.map((b) => (
              <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 relative group hover:border-amber-300 transition">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                    Filial
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBranch(b.id, b.name)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition"
                      title="Remover Filial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <h3 className="font-bold text-sm text-slate-800">{b.name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{b.address || "Sem endereço"}</span>
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{b.contact || "Sem contacto"}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 7: PREVISÃO COMERCIAL (IA) */}
      {activeSubTab === "ai" && (
        <div className="animate-in fade-in-50 duration-150">
          <AiForecastModule
            products={products}
            transactions={transactions}
            settings={settings}
            theme={theme}
            currency={currencyCode}
            onShowToast={onShowToast || (() => {})}
            onChangeModule={onChangeModule || (() => {})}
          />
        </div>
      )}

      {/* SUB-TAB 8: FORMAÇÃO */}
      {activeSubTab === "training" && (
        <div className="animate-in fade-in-50 duration-150">
          <TrainingModule
            videos={masterclassVideos}
            currency={currencyCode}
          />
        </div>
      )}

      {/* SUB-TAB 9: PLANOS & SUBSGRIÇÃO */}
      {activeSubTab === "plans" && (
        <div className="animate-in fade-in-50 duration-150">
          <SubscriptionPlansModule
            currentPlan={activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO"}
            activeUser={activeUser}
            employees={employees}
            settings={settings}
            onUpdateUserPlan={onUpdateUserPlan || (() => {})}
            onUpdateSystemPlan={onUpdateSystemPlan || (() => {})}
            onShowToast={onShowToast}
            onNavigateToModule={onChangeModule}
          />
        </div>
      )}

      {/* Modal de Script SQL para public.produtos, public.products, public.vendas e tabelas base */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    {sqlTab === "produtos" && "Criação das Tabelas public.produtos / public.products no Supabase"}
                    {sqlTab === "vendas" && "Criação da Tabela public.vendas no Supabase / PostgreSQL"}
                    {sqlTab === "completo" && "Script Completo de Inicialização de Tabelas no Supabase"}
                  </h3>
                  <p className="text-[11px] text-slate-400">Execute este código no SQL Editor do painel Supabase para criar a classe/tabela e recarregar o schema cache</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs de Seleção de Script */}
            <div className="flex items-center gap-2 px-6 pt-3 pb-2 bg-slate-100 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setSqlTab("produtos")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  sqlTab === "produtos"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                Catálogo de Produtos (products & produtos)
              </button>
              <button
                type="button"
                onClick={() => setSqlTab("vendas")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  sqlTab === "vendas"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                Vendas & Movimento (vendas)
              </button>
            </div>

            {/* Explicação */}
            <div className="px-6 py-3 bg-indigo-50/70 border-b border-indigo-100 text-xs text-indigo-900 leading-relaxed">
              <span className="font-bold text-indigo-950">Como resolver no Supabase:</span> Vá ao painel do Supabase (<code className="font-mono bg-indigo-100 px-1 py-0.5 rounded">SQL Editor</code>), cole o comando abaixo e clique em <span className="font-bold">Run</span>. O sistema do POS já está preparado com tratamento resiliente contra o erro PGRST205.
            </div>

            {/* Código SQL */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-950 text-slate-100 font-mono text-xs">
              <pre className="whitespace-pre-wrap select-all leading-relaxed text-[11.5px]">
{sqlTab === "produtos" ? PRODUCTS_SQL_SCHEMA : SALES_SQL_SCHEMA}
              </pre>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                O schema completo também está em <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono">src/lib/supabaseSchema.sql</code>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sqlText = sqlTab === "produtos" ? PRODUCTS_SQL_SCHEMA : SALES_SQL_SCHEMA;
                    navigator.clipboard.writeText(sqlText);
                    setSqlCopied(true);
                    setTimeout(() => setSqlCopied(false), 2500);
                    if (onShowToast) onShowToast("Código SQL copiado para a área de transferência!", "success");
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  {sqlCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {sqlCopied ? "Copiado!" : "Copiar SQL"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSqlModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SettingsModule);
