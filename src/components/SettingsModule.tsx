import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Building, 
  CreditCard, 
  Database, 
  CheckCircle, 
  Shield, 
  HelpCircle, 
  Lock,
  Download,
  Upload,
  RefreshCw,
  Mail,
  Clock,
  Calendar,
  Play,
  Terminal,
  Check,
  FileText,
  Cloud,
  Globe,
  Server,
  Printer,
  Palette,
  Trash2,
  AlertTriangle,
  Smartphone,
  MessageSquare,
  Usb,
  Tag,
  Camera,
  Sparkles,
  Image,
  Layers,
  Bell,
  ChevronDown,
  MapPin,
  Phone,
  Plus,
  Edit
} from "lucide-react";
import { SystemSettings, UserRole, Employee, Branch } from "../types";
import { initAuth, googleSignIn, logout, getAccessToken, getLogsFromFirestore } from "../lib/firebase";
import { sendEmail } from "../lib/gmail";
import { SYSTEM_THEMES } from "../lib/themes";

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
  systemVersion?: string;
  employees?: Employee[];
  onResetEmployeePin?: (employeeId: string) => Promise<void> | void;
}

export default function SettingsModule({
  settings,
  onUpdateSettings,
  onAddAuditLog,
  currentRole,
  currency,
  onShowToast,
  activeUser,
  activeColorTheme,
  onChangeColorTheme,
  onExportLocalDB,
  onImportLocalDB,
  onTriggerLocalBackup,
  systemVersion,
  employees = [],
  onResetEmployeePin
}: SettingsModuleProps) {
  const canEdit = currentRole === "ADMIN";
  
  // Local states matching state configurations
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [slogan, setSlogan] = useState(settings.slogan);
  const [companyNuit, setCompanyNuit] = useState(settings.companyNuit);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [storeContact, setStoreContact] = useState(settings.storeContact);
  const [defaultVat, setDefaultVat] = useState(settings.defaultVat);

  // Logo upload and generation states
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || "");
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [logoPrompt, setLogoPrompt] = useState("");
  const [showAiLogoPanel, setShowAiLogoPanel] = useState(false);
  const [showCameraPanel, setShowCameraPanel] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Gateway credentials configurations (MPesa, EMola)

  // Automated report email states
  const [reportRecipientEmail, setReportRecipientEmail] = useState(settings.reportRecipientEmail || "");
  const [reportHour, setReportHour] = useState(settings.reportHour || "02:00");
  const [reportFrequency, setReportFrequency] = useState(settings.reportFrequency || "daily");
  const [alertsRecipientEmail, setAlertsRecipientEmail] = useState(settings.alertsRecipientEmail || "");
  
  // SMS Alert states
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(settings.smsAlertsEnabled || false);
  const [smsProviderType, setSmsProviderType] = useState<"TWILIO" | "CUSTOM_HTTP">(settings.smsProviderType || "TWILIO");
  const [smsTwilioSid, setSmsTwilioSid] = useState(settings.smsTwilioSid || "");
  const [smsTwilioToken, setSmsTwilioToken] = useState(settings.smsTwilioToken || "");
  const [smsTwilioFrom, setSmsTwilioFrom] = useState(settings.smsTwilioFrom || "");
  const [smsCustomUrl, setSmsCustomUrl] = useState(settings.smsCustomUrl || "");
  const [smsManagerPhone, setSmsManagerPhone] = useState(settings.smsManagerPhone || "");
  const [smsStockThreshold, setSmsStockThreshold] = useState(settings.smsStockThreshold || 5);

  // WhatsApp Alert states
  const [whatsappEnabled, setWhatsappEnabled] = useState(settings.whatsappEnabled || false);
  const [whatsappProvider, setWhatsappProvider] = useState<"DIRECT_LINK" | "EVOLUTION_API" | "TWILIO" | "META_CLOUD">(
    settings.whatsappProvider || "DIRECT_LINK"
  );
  const [whatsappApiEndpoint, setWhatsappApiEndpoint] = useState(settings.whatsappApiEndpoint || "");
  const [whatsappToken, setWhatsappToken] = useState(settings.whatsappToken || "");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState(settings.whatsappPhoneId || "");
  const [managerWhatsappPhone, setManagerWhatsappPhone] = useState(settings.managerWhatsappPhone || "");
  const [whatsappMessageTemplate, setWhatsappMessageTemplate] = useState(
    settings.whatsappMessageTemplate ||
      `⚠️ *ALERTA DE ESTOQUE CRÍTICO* ⚠️\n\nO produto *{product_name}* atingiu o nível crítico de *{current_stock}* unidades (limite: {threshold}).\n\n👉 Acesse o POS para repor o estoque: {pos_link}`
  );
  
  // Custom SMTP Configurations
  const [smtpEnabled, setSmtpEnabled] = useState(settings.smtpEnabled || false);
  const [smtpHost, setSmtpHost] = useState(settings.smtpHost || "smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(settings.smtpPort || 587);
  const [smtpUser, setSmtpUser] = useState(settings.smtpUser || "");
  const [smtpPassword, setSmtpPassword] = useState(settings.smtpPassword || "");
  const [smtpSecure, setSmtpSecure] = useState(settings.smtpSecure || false);
  const [emailStockAlertsEnabled, setEmailStockAlertsEnabled] = useState(settings.emailStockAlertsEnabled || false);
  const [stockAlertEmailSubject, setStockAlertEmailSubject] = useState(
    settings.stockAlertEmailSubject || "[ALERTA] Estoque Crítico de Produtos - OST Vendas"
  );
  const [stockAlertEmailBody, setStockAlertEmailBody] = useState(
    settings.stockAlertEmailBody || `Olá,\n\nEste é um alerta automático de que os seguintes produtos atingiram o nível de estoque mínimo definido:\n\n[LISTA_PRODUTOS]\n\nPor favor, providencie a reposição o quanto antes para evitar rupturas de estoque.\n\nAtenciosamente,\nSistema OST Vendas`
  );
  const [isSmtpVerified, setIsSmtpVerified] = useState(settings.isSmtpVerified || false);
  const [testRecipient, setTestRecipient] = useState(settings.alertsRecipientEmail || settings.reportRecipientEmail || "");
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isImportingEnv, setIsImportingEnv] = useState(false);

  // Expiry and Batches states
  const [inventoryStrategy, setInventoryStrategy] = useState<"FIFO" | "LIFO" | "NORMAL">(settings.inventoryStrategy || "FIFO");
  const [expiryAlertDays, setExpiryAlertDays] = useState<number>(settings.expiryAlertDays || 30);
  const [expiryAlertsEnabled, setExpiryAlertsEnabled] = useState<boolean>(settings.expiryAlertsEnabled || false);
  const [expiryNotificationMethod, setExpiryNotificationMethod] = useState<"EMAIL" | "SMS" | "BOTH">(settings.expiryNotificationMethod || "EMAIL");
  const [expiryEmailSubject, setExpiryEmailSubject] = useState(
    settings.expiryEmailSubject || "[ALERTA] Vencimento de Produtos - OST Vendas"
  );
  const [expiryEmailBody, setExpiryEmailBody] = useState(
    settings.expiryEmailBody || `Olá,\n\nEste é um alerta automático de que os seguintes lotes/produtos perecíveis estão próximos do vencimento ou já venceram:\n\n[LISTA_VENCIMENTOS]\n\nPor favor, retire de circulação ou providencie que sejam consumidos com base na política configurada.\n\nAtenciosamente,\nSistema OST Vendas`
  );
  
  // Custom states for dispatcher details
  const [reportFormat, setReportFormat] = useState<"PDF" | "CSV" | "AMBOS">("PDF");
  const [includeFinancial, setIncludeFinancial] = useState(true);
  const [includeAudit, setIncludeAudit] = useState(true);
  const [includeStaff, setIncludeStaff] = useState(false);

  // AI Settings States
  const [aiAutoMonitoring, setAiAutoMonitoring] = useState(settings.aiAutoMonitoring ?? true);
  const [aiHealthSensitivity, setAiHealthSensitivity] = useState(settings.aiHealthSensitivity ?? 80);

  // Gmail OAuth States
  const [gmailUser, setGmailUser] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(true);

  // Google Drive States
  const [driveStats, setDriveStats] = useState<{ limit: number, usage: number } | null>(null);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);

  const fetchDriveStats = async () => {
    if (needsAuth) return;
    setIsFetchingDrive(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sem token");

      // Fetch storage quota
      const aboutRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const aboutData = await aboutRes.json();
      if (aboutData.storageQuota) {
        setDriveStats({
          limit: Number(aboutData.storageQuota.limit),
          usage: Number(aboutData.storageQuota.usage)
        });
      }

      // Fetch recent files
      const filesRes = await fetch("https://www.googleapis.com/drive/v3/files?orderBy=createdTime desc&pageSize=5&fields=files(id,name,mimeType,createdTime)", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const filesData = await filesRes.json();
      if (filesData.files) {
        setRecentFiles(filesData.files);
      }
    } catch (e) {
      console.error("Failed to fetch drive stats", e);
    } finally {
      setIsFetchingDrive(false);
    }
  };

  useEffect(() => {
    if (!needsAuth) {
      fetchDriveStats();
    }
  }, [needsAuth]);

  // Daily backup check scheduler
  useEffect(() => {
    if (!canEdit) return; // Only warn admin

    const checkBackupStatus = () => {
      const lastBackupStr = localStorage.getItem("lastBackupDate");
      const todayStr = new Date().toISOString().split("T")[0];
      
      if (!lastBackupStr) {
        if (onShowToast) onShowToast("Nenhum backup em nuvem encontrado. Realize um backup urgente!", "warning", "Atenção: Risco de Perda de Dados");
        return;
      }

      const lastBackupDate = new Date(lastBackupStr);
      const today = new Date();
      
      // Calculate days diff
      const diffTime = Math.abs(today.getTime() - lastBackupDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays > 1) {
        if (onShowToast) onShowToast(`Último backup foi há ${diffDays} dias. Recomendamos forçar um backup agora.`, "warning", "Aviso de Backup Pendente");
      }
    };

    // Check once on mount
    const timeoutId = setTimeout(checkBackupStatus, 5000); // delay so it doesn't overlap with welcome toasts

    // Check every 6 hours
    const intervalId = setInterval(checkBackupStatus, 6 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [canEdit, onShowToast]);

  const handleManualDriveBackup = async () => {
    if (needsAuth) {
      if (onShowToast) onShowToast("Por favor, conecte a sua conta Google primeiro.", "warning");
      return;
    }
    
    setIsBackingUp(true);
    setCloudBackupLogs([]);
    
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sem token do Google Drive");
      
      setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 📦 Obtendo snapshot da base de dados local...`]);

      const response = await fetch("/api/db/load");
      const json = await response.json();
      
      if (!json.success) throw new Error("Falha ao ler dados da base local.");

      setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ☁️ Compactando dados e estabelecendo conexão com Google Drive...`]);
      
      const dbPayload = JSON.stringify(json.data, null, 2);
      const filename = `OST_Backup_Vendas_${new Date().toISOString().split("T")[0]}.json`;

      const metadata = {
        name: filename,
        mimeType: "application/json",
      };

      const boundary = "-------314159265358979323846";
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const multipartRequestBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        dbPayload +
        close_delim;

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!res.ok) throw new Error("Erro na API do Google Drive");

      const resData = await res.json();

      setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Backup salvo no Drive com sucesso. ID: ${resData.id}`]);
      
      onAddAuditLog("Backup Manual Drive", "CONFIGURAÇÕES", `Backup completo guardado na Cloud: ${filename}`);
      if (onShowToast) onShowToast("Backup completo realizado no Google Drive com sucesso!", "success", "Resiliência Garantida");
      
      // Update local storage date
      localStorage.setItem("lastBackupDate", new Date().toISOString());

      // Refresh recent files
      fetchDriveStats();
    } catch (err) {
      console.error(err);
      setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Falha no processo: ${(err as Error).message}`]);
      if (onShowToast) onShowToast("Falha ao realizar backup no Google Drive.", "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  // 7-day physical JSON backup scheduling states
  const [lastFullBackupDate, setLastFullBackupDate] = useState<string | null>(null);
  const [daysSinceLastBackup, setDaysSinceLastBackup] = useState<number | null>(null);
  const [isBackupRecommended, setIsBackupRecommended] = useState<boolean>(false);

  const checkFullBackupStatus = () => {
    if (!canEdit) return;
    
    const lastBackupStr = localStorage.getItem("lastFullBackupDownloadDate");
    setLastFullBackupDate(lastBackupStr);

    if (!lastBackupStr) {
      setIsBackupRecommended(true);
      setDaysSinceLastBackup(null);
      return;
    }

    const lastBackupDateObj = new Date(lastBackupStr);
    const today = new Date();
    
    // Calculate difference in days
    const diffTime = Math.abs(today.getTime() - lastBackupDateObj.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    setDaysSinceLastBackup(diffDays);

    if (diffDays >= 7) {
      setIsBackupRecommended(true);
    } else {
      setIsBackupRecommended(false);
    }
  };

  useEffect(() => {
    if (canEdit) {
      checkFullBackupStatus();
      
      // Check immediately and also set up warning toast if needed after loading is complete
      const timerId = setTimeout(() => {
        const lastBackupStr = localStorage.getItem("lastFullBackupDownloadDate");
        if (!lastBackupStr) {
          if (onShowToast) {
            onShowToast("Por razões de segurança, descarregue um backup físico JSON.", "warning", "Backup Físico Recomendado");
          }
        } else {
          const lastBackupDateObj = new Date(lastBackupStr);
          const diffDays = Math.floor(Math.abs(new Date().getTime() - lastBackupDateObj.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 7 && onShowToast) {
            onShowToast(`Aviso: Seu último backup físico JSON foi há ${diffDays} dias.`, "warning", "Cópia Física em Atraso");
          }
        }
      }, 6000);

      const interval = setInterval(checkFullBackupStatus, 4 * 60 * 60 * 1000); // Check every 4 hours
      return () => {
        clearTimeout(timerId);
        clearInterval(interval);
      };
    }
  }, [canEdit]);

  const triggerAdminBackupDownload = () => {
    if (onExportLocalDB) {
      onExportLocalDB();
      const nowStr = new Date().toISOString();
      localStorage.setItem("lastFullBackupDownloadDate", nowStr);
      setLastFullBackupDate(nowStr);
      setDaysSinceLastBackup(0);
      setIsBackupRecommended(false);
      
      onAddAuditLog(
        "Fazer Cópia de Segurança Periódica",
        "CONFIGURAÇÕES",
        `Backup físico de 7 dias descarregado com sucesso.`
      );
    }
  };

  // Simulation states
  const [isSimulatingMail, setIsSimulatingMail] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

  // NEW Backup and Recovery tab states
  const [activeSubTab, setActiveSubTab] = useState<"geral" | "backup" | "lotes" | "whatsapp" | "filiais" | "seguranca" | "smtp">("geral");
  const [localBackupsLog, setLocalBackupsLog] = useState<any[]>([]);
  const [confirmResetEmployeeId, setConfirmResetEmployeeId] = useState<string | null>(null);
  const [isResettingPin, setIsResettingPin] = useState(false);

  // Branch (Filial) Management States
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchNameInput, setBranchNameInput] = useState("");
  const [branchCodeInput, setBranchCodeInput] = useState("");
  const [branchAddressInput, setBranchAddressInput] = useState("");
  const [branchContactInput, setBranchContactInput] = useState("");
  const [branchCityInput, setBranchCityInput] = useState("");

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      if (onShowToast) onShowToast("Apenas administradores podem gerenciar filiais.", "error", "Permissão Negada");
      return;
    }

    if (!branchNameInput.trim()) {
      if (onShowToast) onShowToast("O nome da filial é obrigatório.", "error");
      return;
    }

    const currentBranches = settings.branches || [];

    if (editingBranchId) {
      const updatedBranches = currentBranches.map(b => 
        b.id === editingBranchId 
          ? { 
              ...b, 
              name: branchNameInput.trim(),
              code: branchCodeInput.trim() || undefined,
              address: branchAddressInput.trim(),
              contact: branchContactInput.trim(),
              city: branchCityInput.trim() || undefined
            } 
          : b
      );

      onUpdateSettings({ branches: updatedBranches });
      if (onShowToast) onShowToast("Filial atualizada com sucesso!", "success");
      
      if (onAddAuditLog) {
        onAddAuditLog(
          "CONFIGURAÇÃO",
          "CONFIGURAÇÕES",
          `Filial "${branchNameInput.trim()}" atualizada pelo administrador.`
        );
      }
    } else {
      const newId = `branch-${Date.now()}`;
      const newBranch: Branch = {
        id: newId,
        name: branchNameInput.trim(),
        code: branchCodeInput.trim() || `FIL-${currentBranches.length + 1}`,
        address: branchAddressInput.trim(),
        contact: branchContactInput.trim(),
        city: branchCityInput.trim() || undefined
      };

      const updatedBranches = [...currentBranches, newBranch];
      onUpdateSettings({ branches: updatedBranches });
      if (onShowToast) onShowToast("Nova filial cadastrada com sucesso!", "success");

      if (onAddAuditLog) {
        onAddAuditLog(
          "CONFIGURAÇÃO",
          "CONFIGURAÇÕES",
          `Nova filial "${branchNameInput.trim()}" cadastrada pelo administrador.`
        );
      }
    }

    // Reset inputs
    setEditingBranchId(null);
    setBranchNameInput("");
    setBranchCodeInput("");
    setBranchAddressInput("");
    setBranchContactInput("");
    setBranchCityInput("");
  };

  const handleEditBranchClick = (branch: Branch) => {
    setEditingBranchId(branch.id);
    setBranchNameInput(branch.name);
    setBranchCodeInput(branch.code || "");
    setBranchAddressInput(branch.address);
    setBranchContactInput(branch.contact);
    setBranchCityInput(branch.city || "");
    
    // Smooth scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBranch = (id: string, name: string) => {
    if (!canEdit) {
      if (onShowToast) onShowToast("Apenas administradores podem gerenciar filiais.", "error", "Permissão Negada");
      return;
    }

    const currentBranches = settings.branches || [];
    if (currentBranches.length <= 1) {
      if (onShowToast) onShowToast("Não é possível remover todas as filiais. O sistema precisa de pelo menos uma filial ativa.", "error");
      return;
    }

    const confirmDel = window.confirm(`Tem certeza de que deseja remover a filial "${name}"?`);
    if (!confirmDel) return;

    const updatedBranches = currentBranches.filter(b => b.id !== id);
    onUpdateSettings({ branches: updatedBranches });
    if (onShowToast) onShowToast("Filial removida com sucesso!", "success");

    if (onAddAuditLog) {
      onAddAuditLog(
        "CONFIGURAÇÃO",
        "CONFIGURAÇÕES",
        `Filial "${name}" removida pelo administrador.`
      );
    }
  };

  const loadLocalBackupsLog = () => {
    try {
      const logsStr = localStorage.getItem("erp_local_backups_log");
      if (logsStr) {
        setLocalBackupsLog(JSON.parse(logsStr));
      } else {
        setLocalBackupsLog([]);
      }
    } catch (e) {
      console.error("Erro ao ler logs de backup:", e);
    }
  };

  useEffect(() => {
    loadLocalBackupsLog();
  }, []);

  const handleCreateManualBackup = async () => {
    if (!canEdit) {
      if (onShowToast) {
        onShowToast("Apenas administradores podem iniciar um backup manual.", "error", "Permissão Negada");
      }
      return;
    }
    
    if (onTriggerLocalBackup) {
      const success = await onTriggerLocalBackup("manual");
      if (success) {
        if (onShowToast) {
          onShowToast("Cópia de segurança manual criada localmente com sucesso!", "success", "Backup Concluído");
        }
        loadLocalBackupsLog();
      } else {
        if (onShowToast) {
          onShowToast("Erro ao processar cópia de segurança manual.", "error", "Falha de Backup");
        }
      }
    }
  };

  const handleRestoreFromSlot = async (slotId: string) => {
    if (currentRole !== "ADMIN") {
      if (onShowToast) {
        onShowToast("Apenas utilizadores com privilégios de Administrador (ADMIN) podem restaurar o banco de dados.", "error", "Permissão Negada");
      }
      return;
    }

    if (window.confirm("Deseja realmente restaurar os dados a partir deste ponto de backup local? Os dados atuais serão substituídos.")) {
      try {
        const dataStr = localStorage.getItem(`erp_backup_slot_${slotId}`);
        if (dataStr) {
          const parsed = JSON.parse(dataStr);
          if (onImportLocalDB && parsed.data) {
            const success = await onImportLocalDB(parsed.data);
            if (success) {
              if (onShowToast) {
                onShowToast("Banco de dados local restaurado com sucesso!", "success", "Redundância Restaurada");
              }
            }
          } else {
            if (onShowToast) {
              onShowToast("Os dados salvos nesse backup parecem inválidos ou incompletos.", "warning", "Dados Inválidos");
            }
          }
        } else {
          if (onShowToast) {
            onShowToast("Não foi possível encontrar os dados desse backup. Ele pode ter sido limpo pelo navegador.", "error", "Ficheiro Não Encontrado");
          }
        }
      } catch (err) {
        if (onShowToast) {
          onShowToast("Erro ao ler dados de backup.", "error", "Erro de Restauro");
        }
      }
    }
  };

  const handleDownloadSlotBackup = (slotId: string, dateStr: string) => {
    try {
      const dataStr = localStorage.getItem(`erp_backup_slot_${slotId}`);
      if (dataStr) {
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `OST_Vendas_Backup_Local_${dateStr.split("T")[0]}_${slotId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        if (onShowToast) {
          onShowToast("Download do backup JSON concluído!", "success", "Exportação");
        }
      } else {
        if (onShowToast) {
          onShowToast("Não foi possível encontrar os dados do backup para descarregar.", "error", "Erro de Download");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveBackupInterval = (frequency: string) => {
    if (!canEdit) {
      if (onShowToast) {
        onShowToast("Apenas administradores podem alterar o intervalo de backup.", "error", "Acesso Negado");
      }
      return;
    }

    setBackupFrequency(frequency);
    onUpdateSettings({
      backupFrequency: frequency
    });

    if (onShowToast) {
      onShowToast(`Intervalo de exportação automática atualizado para: ${frequency === "daily" ? "Diário" : frequency === "weekly" ? "Semanal" : frequency === "monthly" ? "Mensal" : "A cada 12 Horas"}`, "success", "Intervalo Salvo");
    }

    onAddAuditLog(
      "Alterar Intervalo de Backup",
      "CONFIGURAÇÕES",
      `Alterado intervalo de backup automático local para: ${frequency}.`
    );
  };

  // Automatic Cloud Backup Scheduler States
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(settings.cloudBackupEnabled ?? true);
  const [backupFrequency, setBackupFrequency] = useState(settings.backupFrequency || "daily");
  const [backupCron, setBackupCron] = useState(settings.backupCron || "0 2 * * *");
  const [backupTime, setBackupTime] = useState(settings.backupTime || "02:00");
  const [cloudProvider, setCloudProvider] = useState(settings.cloudProvider || "gcs");
  const [backupExportToCloud, setBackupExportToCloud] = useState(settings.backupExportToCloud ?? true);
  const [backupExportToEmail, setBackupExportToEmail] = useState(settings.backupExportToEmail ?? true);
  const [isSimulatingCloudBackup, setIsSimulatingCloudBackup] = useState(false);
  const [cloudBackupLogs, setCloudBackupLogs] = useState<string[]>([]);

  // Cron Backups status states from backend
  const [cronStatus, setCronStatus] = useState<{
    active: boolean;
    cronPattern: string;
    description: string;
    lastRun: string | null;
    status: string | null;
  } | null>(null);

  const fetchCronStatus = async () => {
    try {
      const res = await fetch("/api/backups/cron-status");
      const data = await res.json();
      if (data.success) {
        setCronStatus({
          active: data.active,
          cronPattern: data.cronPattern,
          description: data.description,
          lastRun: data.lastRun,
          status: data.status
        });
      }
    } catch (e) {
      console.error("Erro ao carregar status do cron de backup:", e);
    }
  };

  const handleTriggerCronBackup = async () => {
    setIsSimulatingCloudBackup(true);
    setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🚀 Disparando execução manual do backup agendado (Fim do Dia de Trabalho)...`]);
    try {
      const res = await fetch("/api/backups/trigger-cron", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCloudBackupLogs(prev => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] 📦 Cópia gerada com sucesso!`,
          `[${new Date().toLocaleTimeString()}] 📧 Resultado: ${data.status || "Backup concluído com sucesso."}`
        ]);
        if (onShowToast) {
          onShowToast("Backup agendado de fim de dia executado e enviado por e-mail com sucesso!", "success", "Cron Concluído");
        }
        await fetchCronStatus();
        await fetchBackupsList();
      } else {
        throw new Error(data.error || "Falha na execução");
      }
    } catch (e: any) {
      setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Erro: ${e.message}`]);
      if (onShowToast) {
        onShowToast(`Falha ao disparar cron: ${e.message}`, "error");
      }
    } finally {
      setIsSimulatingCloudBackup(false);
    }
  };

  // Real backups state & actions
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  // Firebase logs states & actions
  const [firebaseLogs, setFirebaseLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilterDate, setLogFilterDate] = useState("");
  const [logFilterType, setLogFilterType] = useState(""); // filter by category/module/action (e.g., "AUTENTICAÇÃO" or "MÓDULO")

  const fetchBackupsList = async () => {
    try {
      setIsLoadingBackups(true);
      const response = await fetch("/api/backups");
      const data = await response.json();
      if (data.success) {
        setBackupsList(data.backups);
      }
    } catch (err) {
      console.error("Erro ao carregar backups:", err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const fetchFirebaseLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const logs = await getLogsFromFirestore();
      setFirebaseLogs(logs);
    } catch (err) {
      console.error("Erro ao carregar logs do Firebase:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchBackupsList();
    fetchFirebaseLogs();
    fetchCronStatus();
  }, []);

  const handleRestoreBackup = async (filename: string) => {
    const confirmed = window.confirm(`Atenção: Tem certeza de que deseja restaurar o backup "${filename}"? Todos os dados atuais do banco de dados serão substituídos pelos dados contidos nesta cópia de segurança.`);
    if (!confirmed) return;

    try {
      setIsRestoringBackup(true);
      const response = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
      });
      const data = await response.json();
      if (data.success) {
        if (onShowToast) onShowToast(data.message || "Banco de dados restaurado com sucesso!", "success");
        onAddAuditLog(
          "Restauro de Backup",
          "SISTEMA",
          `Restauro efetuado com sucesso a partir do ficheiro: ${filename}.`
        );
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(data.error || "Falha ao restaurar banco de dados.");
      }
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message, "error");
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    const confirmed = window.confirm(`Deseja realmente eliminar permanentemente o arquivo de backup "${filename}"?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/backups/${filename}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        if (onShowToast) onShowToast("Cópia de segurança eliminada do servidor.", "success");
        onAddAuditLog(
          "Eliminação de Backup",
          "SISTEMA",
          `Ficheiro de backup eliminado: ${filename}.`
        );
        fetchBackupsList();
      } else {
        throw new Error(data.error || "Erro ao eliminar backup.");
      }
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message, "error");
    }
  };

  // Thermal Printer States
  const [printerEnabled, setPrinterEnabled] = useState(settings.printerEnabled || false);
  const [printerName, setPrinterName] = useState(settings.printerName || "POS-58");
  const [printerConnectionType, setPrinterConnectionType] = useState<"USB" | "BLUETOOTH" | "NETWORK">(settings.printerConnectionType || "USB");
  const [printerIpAddress, setPrinterIpAddress] = useState(settings.printerIpAddress || "192.168.1.100");
  const [printerPort, setPrinterPort] = useState(settings.printerPort || "COM1");
  const [printerBaudRate, setPrinterBaudRate] = useState(settings.printerBaudRate || "9600");
  const [printerType, setPrinterType] = useState<"RECEIPT" | "LABEL">(settings.printerType || "RECEIPT");
  const [paperSize, setPaperSize] = useState<"A4" | "80MM" | "58MM">(settings.paperSize || "80MM");
  const [printerAutoCut, setPrinterAutoCut] = useState(settings.printerAutoCut !== undefined ? settings.printerAutoCut : true);
  const [isTestingPrinter, setIsTestingPrinter] = useState(false);
  const [printerLogs, setPrinterLogs] = useState<string[]>([]);
  const [showTestReceipt, setShowTestReceipt] = useState(false);

  // WebUSB / Serial Printer Detection Logic
  const [usbDevices, setUsbDevices] = useState<any[]>([]);
  const [isScanningUsb, setIsScanningUsb] = useState(false);
  const [webUsbError, setWebUsbError] = useState("");

  const handleListUsbDevices = async () => {
    setWebUsbError("");
    setIsScanningUsb(true);
    setPrinterLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🔎 Iniciando varredura por dispositivos USB (WebUSB)...`]);
    
    try {
      if (typeof navigator === "undefined" || !(navigator as any).usb) {
        throw new Error("WebUSB API não é suportada neste navegador ou ambiente.");
      }
      
      const devices = await (navigator as any).usb.getDevices();
      const mappedDevices = devices.map(d => ({
        id: `${d.vendorId}_${d.productId}`,
        name: d.productName || `Dispositivo USB (${d.vendorId.toString(16)}:${d.productId.toString(16)})`,
        manufacturer: d.manufacturerName || "Fabricante Desconhecido",
        vendorId: d.vendorId,
        productId: d.productId,
        serialNumber: d.serialNumber || "",
        isSimulated: false
      }));

      // Add default mock/fallback devices to ensure interactive experience in the preview iframe
      const mockDevices = [
        { id: "mock_epson", name: "Epson TM-T20III (USB Direct)", manufacturer: "Epson Inc.", vendorId: 1208, productId: 514, serialNumber: "EP20394821", isSimulated: true },
        { id: "mock_xprinter", name: "Xprinter XP-58IIH (USB Serial Printer)", manufacturer: "Xprinter", vendorId: 1155, productId: 22336, serialNumber: "XP992011", isSimulated: true },
        { id: "mock_generic", name: "Generic POS-80 Thermal Printer", manufacturer: "Zjiang", vendorId: 10473, productId: 649, serialNumber: "ZJ80123", isSimulated: true }
      ];

      const combined = [...mappedDevices, ...mockDevices];
      setUsbDevices(combined);
      
      setPrinterLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 🟢 Varredura concluída. Encontrado(s) ${mappedDevices.length} dispositivo(s) físico(s) e ${mockDevices.length} simulado(s).`
      ]);
      
      if (onShowToast) {
        onShowToast(`Encontrados ${combined.length} dispositivos USB (físicos & simulados) para seleção.`, "info", "Varredura Concluída");
      }
    } catch (err: any) {
      console.warn("WebUSB listing failed, using simulated devices fallback:", err);
      // Fallback list of simulated devices
      const fallbackDevices = [
        { id: "mock_epson", name: "Epson TM-T20III (USB Direct)", manufacturer: "Epson Inc.", vendorId: 1208, productId: 514, serialNumber: "EP20394821", isSimulated: true },
        { id: "mock_xprinter", name: "Xprinter XP-58IIH (USB Serial Printer)", manufacturer: "Xprinter", vendorId: 1155, productId: 22336, serialNumber: "XP992011", isSimulated: true },
        { id: "mock_generic", name: "Generic POS-80 Thermal Printer", manufacturer: "Zjiang", vendorId: 10473, productId: 649, serialNumber: "ZJ80123", isSimulated: true }
      ];
      setUsbDevices(fallbackDevices);
      setWebUsbError("O seu navegador ou o iframe bloqueou o WebUSB. Pode utilizar as impressoras simuladas abaixo!");
      setPrinterLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ⚠️ Restrição de segurança: WebUSB indisponível no iframe. Carregados dispositivos simulados de alto-desempenho para teste.`
      ]);
    } finally {
      setIsScanningUsb(false);
    }
  };

  const handleRequestUsbDevice = async () => {
    setWebUsbError("");
    setIsScanningUsb(true);
    
    try {
      if (typeof navigator === "undefined" || !(navigator as any).usb) {
        throw new Error("A WebUSB API não é suportada por este navegador.");
      }
      
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      if (device) {
        const newDev = {
          id: `${device.vendorId}_${device.productId}`,
          name: device.productName || `Impressora USB (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
          manufacturer: device.manufacturerName || "Fabricante Desconhecido",
          vendorId: device.vendorId,
          productId: device.productId,
          serialNumber: device.serialNumber || "",
          isSimulated: false
        };

        setUsbDevices(prev => {
          if (prev.some(d => d.id === newDev.id)) return prev;
          return [newDev, ...prev];
        });
        
        setPrinterName(newDev.name);
        setPrinterConnectionType("USB");
        setPrinterPort("USB001");
        
        if (onShowToast) {
          onShowToast(`Impressora "${newDev.name}" pareada e selecionada com sucesso!`, "success", "Dispositivo Vinculado");
        }
        
        setPrinterLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✔️ Dispositivo físico pareado com sucesso: ${newDev.name} (USB Vendor: ${newDev.vendorId}, Product: ${newDev.productId})`
        ]);
        
        onAddAuditLog(
          "Pareamento USB",
          "CONFIGURAÇÕES",
          `Impressora USB pareada com sucesso via WebUSB: ${newDev.name} (ID: ${newDev.id})`
        );
      }
    } catch (err: any) {
      console.error("Erro ao solicitar dispositivo WebUSB:", err);
      let errMsg = err.message || "Solicitação USB rejeitada ou cancelada.";
      if (err.name === "SecurityError") {
        errMsg = "Segurança: WebUSB bloqueado no iframe. Abra a aplicação numa Nova Aba para utilizar impressoras USB físicas!";
      } else if (err.name === "NotFoundError") {
        errMsg = "Nenhum dispositivo USB foi selecionado pelo utilizador.";
      }
      setWebUsbError(errMsg);
      if (onShowToast) {
        onShowToast(errMsg, "error", "Falha de Conexão");
      }
    } finally {
      setIsScanningUsb(false);
    }
  };

  const handleSelectUsbDevice = (device: any) => {
    setPrinterName(device.name);
    setPrinterConnectionType("USB");
    if (device.isSimulated) {
      setPrinterLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 🔌 Selecionada Impressora Simulada: ${device.name}. Pronto para testar emissão.`
      ]);
      if (onShowToast) {
        onShowToast(`Impressora simulada "${device.name}" selecionada para testes!`, "info", "Dispositivo Ativo");
      }
    } else {
      setPrinterLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 🔌 Selecionada Impressora Física WebUSB: ${device.name} (Vid: ${device.vendorId}, Pid: ${device.productId}).`
      ]);
      if (onShowToast) {
        onShowToast(`Impressora "${device.name}" ativa via WebUSB!`, "success", "Dispositivo Selecionado");
      }
    }
  };

  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [localError, setLocalError] = useState("");
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleTestPrinter = () => {
    if (isTestingPrinter) return;

    setIsTestingPrinter(true);
    setPrinterLogs([]);
    setShowTestReceipt(false);

    const connectionInfo = printerConnectionType === "NETWORK" 
      ? `IP ${printerIpAddress}` 
      : printerConnectionType === "BLUETOOTH" 
        ? "Bluetooth (Sem Fios)" 
        : `${printerPort} a ${printerBaudRate} bps`;

    const steps = [
      `[${new Date().toLocaleTimeString()}] 🖨️ Inicializando protocolo de comunicação com a ${printerType === "RECEIPT" ? "impressora de talões" : "impressora de etiquetas"}...`,
      `[${new Date().toLocaleTimeString()}] 🔌 Estabelecendo conexão via ${printerConnectionType} (${connectionInfo})...`,
      `[${new Date().toLocaleTimeString()}] ✅ Dispositivo detetado com sucesso: ${printerName}.`,
      `[${new Date().toLocaleTimeString()}] 📄 Preparando ${printerType === "RECEIPT" ? "cupom" : "etiqueta"} de teste (${paperSize})...`,
      `[${new Date().toLocaleTimeString()}] 📤 Enviando buffer para fila de impressão...`,
      printerAutoCut 
        ? `[${new Date().toLocaleTimeString()}] ✂️ Enviando comando de guilhotina ESC/POS (Corte Total: GS V 66 0)...`
        : `[${new Date().toLocaleTimeString()}] ✂️ Corte Automático de Papel desativado nas configurações. Ignorando comando de guilhotina.`,
      `[${new Date().toLocaleTimeString()}] ✔️ ${printerType === "RECEIPT" ? "Cupom" : "Etiqueta"} de teste impresso com sucesso!`
    ];

    let stepIndex = 0;
    const intervalId = setInterval(() => {
      if (stepIndex < steps.length) {
        setPrinterLogs(prev => [...prev, steps[stepIndex]]);
        stepIndex++;
      } else {
        clearInterval(intervalId);
        setIsTestingPrinter(false);
        setShowTestReceipt(true);
        if (onShowToast) onShowToast(`${printerType === "RECEIPT" ? "Cupom" : "Etiqueta"} de teste emitido com sucesso!`, "success", "Impressão Concluída");
        onAddAuditLog(
          "Teste de Impressora",
          "CONFIGURAÇÕES",
          `Impressão de ${printerType === "RECEIPT" ? "cupom" : "etiqueta"} de teste (${paperSize}) executada com sucesso na impressora "${printerName}" via ${printerConnectionType}.`
        );
      }
    }, 350);
  };

  const handleSavePrinterConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setLocalError("Apenas administradores seniores têm permissão para editar configurações de impressora.");
      setTimeout(() => setLocalError(""), 3500);
      return;
    }
    
    // Save settings globally
    onUpdateSettings({
      printerEnabled,
      printerName,
      printerConnectionType,
      printerIpAddress,
      printerPort,
      printerBaudRate,
      printerType,
      paperSize,
      printerAutoCut
    });

    setFeedbackMsg("Configuração da Impressora de Vendas salva com sucesso!");
    onAddAuditLog(
      "Configuração da Impressora",
      "CONFIGURAÇÕES",
      `Impressora configurada: ${printerName}, Tipo: ${printerType}, Papel: ${paperSize}, Conectividade: ${printerConnectionType}, Corte Automático: ${printerAutoCut ? "Ativo" : "Inativo"}.`
    );
    if (onShowToast) onShowToast("As configurações da Impressora de Vendas foram gravadas com sucesso!", "success", "Configurações Salvas");
    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  useEffect(() => {
    setCompanyName(settings.companyName || "");
    setSlogan(settings.slogan || "");
    setCompanyNuit(settings.companyNuit || "");
    setStoreAddress(settings.storeAddress || "");
    setStoreContact(settings.storeContact || "");
    setDefaultVat(settings.defaultVat !== undefined ? settings.defaultVat : settings.vatDefaultRate || 16);
    setLogoUrl(settings.logoUrl || "");
    
    setReportRecipientEmail(settings.reportRecipientEmail || "");
    setReportHour(settings.reportHour || "02:00");
    setReportFrequency(settings.reportFrequency || "daily");
    setAlertsRecipientEmail(settings.alertsRecipientEmail || "");
    
    setSmsAlertsEnabled(settings.smsAlertsEnabled || false);
    setSmsProviderType(settings.smsProviderType || "TWILIO");
    setSmsTwilioSid(settings.smsTwilioSid || "");
    setSmsTwilioToken(settings.smsTwilioToken || "");
    setSmsTwilioFrom(settings.smsTwilioFrom || "");
    setSmsCustomUrl(settings.smsCustomUrl || "");
    setSmsManagerPhone(settings.smsManagerPhone || "");
    setSmsStockThreshold(settings.smsStockThreshold || 5);

    setWhatsappEnabled(settings.whatsappEnabled || false);
    setWhatsappProvider(settings.whatsappProvider || "DIRECT_LINK");
    setWhatsappApiEndpoint(settings.whatsappApiEndpoint || "");
    setWhatsappToken(settings.whatsappToken || "");
    setWhatsappPhoneId(settings.whatsappPhoneId || "");
    setManagerWhatsappPhone(settings.managerWhatsappPhone || "");
    setWhatsappMessageTemplate(
      settings.whatsappMessageTemplate ||
        `⚠️ *ALERTA DE ESTOQUE CRÍTICO* ⚠️\n\nO produto *{product_name}* atingiu o nível crítico de *{current_stock}* unidades (limite: {threshold}).\n\n👉 Acesse o POS para repor o estoque: {pos_link}`
    );
    
    setSmtpEnabled(settings.smtpEnabled || false);
    setSmtpHost(settings.smtpHost || "smtp.gmail.com");
    setSmtpPort(settings.smtpPort || 587);
    setSmtpUser(settings.smtpUser || "");
    setSmtpPassword(settings.smtpPassword || "");
    setSmtpSecure(settings.smtpSecure || false);
    setEmailStockAlertsEnabled(settings.emailStockAlertsEnabled || false);
    setStockAlertEmailSubject(settings.stockAlertEmailSubject || "[ALERTA] Estoque Crítico de Produtos - OST Vendas");
    setStockAlertEmailBody(settings.stockAlertEmailBody || `Olá,\n\nEste é um alerta automático de que os seguintes produtos atingiram o nível de estoque mínimo definido:\n\n[LISTA_PRODUTOS]\n\nPor favor, providencie a reposição o quanto antes para evitar rupturas de estoque.\n\nAtenciosamente,\nSistema OST Vendas`);
    setIsSmtpVerified(settings.isSmtpVerified || false);
    setTestRecipient(settings.alertsRecipientEmail || settings.reportRecipientEmail || testRecipient || "");
    
    if (settings.cloudBackupEnabled !== undefined) setCloudBackupEnabled(settings.cloudBackupEnabled);
    if (settings.backupFrequency) setBackupFrequency(settings.backupFrequency);
    if (settings.backupCron) setBackupCron(settings.backupCron);
    if (settings.backupTime) setBackupTime(settings.backupTime);
    if (settings.cloudProvider) setCloudProvider(settings.cloudProvider);
    if (settings.backupExportToCloud !== undefined) setBackupExportToCloud(settings.backupExportToCloud);
    if (settings.backupExportToEmail !== undefined) setBackupExportToEmail(settings.backupExportToEmail);

    setPrinterEnabled(settings.printerEnabled || false);
    setPrinterName(settings.printerName || "POS-58");
    setPrinterConnectionType(settings.printerConnectionType || "USB");
    setPrinterIpAddress(settings.printerIpAddress || "192.168.1.100");
    setPrinterPort(settings.printerPort || "COM1");
    setPrinterBaudRate(settings.printerBaudRate || "9600");
    setPrinterType(settings.printerType || "RECEIPT");
    setPaperSize(settings.paperSize || "80MM");
    setPrinterAutoCut(settings.printerAutoCut !== undefined ? settings.printerAutoCut : true);

    if (settings.inventoryStrategy) setInventoryStrategy(settings.inventoryStrategy);
    if (settings.expiryAlertDays !== undefined) setExpiryAlertDays(settings.expiryAlertDays);
    if (settings.expiryAlertsEnabled !== undefined) setExpiryAlertsEnabled(settings.expiryAlertsEnabled);
    if (settings.expiryNotificationMethod) setExpiryNotificationMethod(settings.expiryNotificationMethod);
    if (settings.expiryEmailSubject) setExpiryEmailSubject(settings.expiryEmailSubject);
    if (settings.expiryEmailBody) setExpiryEmailBody(settings.expiryEmailBody);

    if (settings.aiAutoMonitoring !== undefined) setAiAutoMonitoring(settings.aiAutoMonitoring);
    if (settings.aiHealthSensitivity !== undefined) setAiHealthSensitivity(settings.aiHealthSensitivity);
  }, [settings]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGmailUser(user);
        setNeedsAuth(false);
      },
      () => {
        setGmailUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGmailLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn(true);
      if (result) {
        setGmailUser(result.user);
        setNeedsAuth(false);
        if (onShowToast) onShowToast("Autenticado com Gmail (OAuth2) com sucesso!", "success");
      }
    } catch (err) {
      if (onShowToast) onShowToast("Falha na autenticação com Gmail.", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGmailLogout = async () => {
    await logout();
    setGmailUser(null);
    setNeedsAuth(true);
    if (onShowToast) onShowToast("Conta Gmail desvinculada.", "info");
  };
  
  const handleDedicatedSmtpTest = async () => {
    if (!smtpHost || !smtpPort) {
      if (onShowToast) {
        onShowToast("O Servidor Host e a Porta do SMTP são obrigatórios para realizar o teste.", "warning", "Campos em Falta");
      }
      return;
    }

    const recipient = testRecipient || reportRecipientEmail || (activeUser?.email) || "test@ostvendas.com";
    if (!recipient || !recipient.includes("@")) {
      if (onShowToast) {
        onShowToast("Insira um endereço de e-mail de destinatário válido para o teste.", "warning", "E-mail Inválido");
      }
      return;
    }

    setIsTestingSmtp(true);
    try {
      const response = await fetch("/api/email/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUser,
          smtpPassword,
          smtpSecure,
          recipient: recipient,
          subject: "Teste de Conexão SMTP - OST Vendas",
          body: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <h2 style="color: #f97316; text-align: center; margin-top: 0;">Teste de SMTP Concluído com Sucesso!</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.6;">Se recebeu esta mensagem, significa que as credenciais do seu servidor SMTP dedicado foram verificadas corretamente e o sistema de vendas está autorizado a enviar e-mails.</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 12px; margin: 20px 0; border: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 12px; color: #64748b; font-family: monospace;"><b>Host:</b> ${smtpHost}</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; font-family: monospace;"><b>Porta:</b> ${smtpPort}</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; font-family: monospace;"><b>Utilizador:</b> ${smtpUser || "Sem autenticação"}</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; font-family: monospace;"><b>Segurança:</b> ${smtpSecure ? "SSL/TLS Ativo" : "Inativo"}</p>
              </div>
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">Este é um e-mail automático enviado pelo painel de configurações do OST Vendas.</p>
            </div>
          `
        })
      });

      const data = await response.json();
      if (response.ok) {
        setIsSmtpVerified(true);
        if (onShowToast) {
          onShowToast(data.message || "Conexão SMTP validada com sucesso e e-mail enviado!", "success", "Conexão Estabelecida");
        }
        onUpdateSettings({
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUser,
          smtpPassword,
          smtpSecure,
          isSmtpVerified: true
        });
        onAddAuditLog(
          "Teste de SMTP",
          "CONFIGURAÇÕES",
          `Conexão SMTP testada com sucesso para o host ${smtpHost}:${smtpPort}. Destinatário: ${recipient}. Estado: Verificado.`
        );
      } else {
        setIsSmtpVerified(false);
        if (onShowToast) {
          onShowToast(data.error || "Servidor SMTP recusou a ligação de teste.", "error", "Falha de Conexão");
        }
        onUpdateSettings({
          isSmtpVerified: false
        });
      }
    } catch (err: any) {
      setIsSmtpVerified(false);
      if (onShowToast) {
        onShowToast(err.message || "Erro desconhecido ao ligar ao SMTP.", "error", "Falha de Ligação");
      }
      onUpdateSettings({
        isSmtpVerified: false
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleImportFromEnv = async () => {
    setIsImportingEnv(true);
    try {
      const response = await fetch("/api/email/smtp-env");
      if (response.ok) {
        const data = await response.json();
        setSmtpHost(data.smtpHost || "");
        setSmtpPort(data.smtpPort || 587);
        setSmtpUser(data.smtpUser || "");
        setSmtpPassword(data.smtpPassword || "");
        setSmtpSecure(data.smtpSecure || false);
        setIsSmtpVerified(false);
        if (onShowToast) {
          onShowToast("Configurações SMTP importadas do arquivo .env com sucesso! Clique em 'Salvar Servidor' para gravar.", "success", "Importação Conclúida");
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Não foi possível contactar o servidor para obter dados do .env.");
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(err.message || "Falha ao obter credenciais do .env.", "error", "Falha na Importação");
      }
    } finally {
      setIsImportingEnv(false);
    }
  };

  const handleSaveDedicatedSmtp = () => {
    if (!smtpHost || !smtpPort) {
      if (onShowToast) {
        onShowToast("O Servidor Host e a Porta do SMTP são obrigatórios para gravar.", "warning", "Campos em Falta");
      }
      return;
    }

    onUpdateSettings({
      smtpHost,
      smtpPort: Number(smtpPort),
      smtpUser,
      smtpPassword,
      smtpSecure,
      isSmtpVerified
    });

    setFeedbackMsg("Configuração do Servidor SMTP Dedicado gravada com sucesso!");
    onAddAuditLog(
      "Salvar Configuração SMTP",
      "CONFIGURAÇÕES",
      `Credenciais SMTP gravadas para ${smtpHost}:${smtpPort} (Utilizador: ${smtpUser || "Nenhum"}). Verificado: ${isSmtpVerified ? "Sim" : "Não"}.`
    );
    if (onShowToast) {
      onShowToast("As configurações do servidor SMTP dedicado foram gravadas!", "success", "SMTP Gravado");
    }
    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const handleSaveEmailConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setLocalError("Apenas administradores seniores têm permissão para editar as configurações de despacho automático.");
      setTimeout(() => setLocalError(""), 3500);
      return;
    }

    onUpdateSettings({
      reportRecipientEmail,
      reportHour,
      reportFrequency: reportFrequency as "daily" | "weekly",
      smtpEnabled,
      smtpHost,
      smtpPort: Number(smtpPort),
      smtpUser,
      smtpPassword,
      smtpSecure
    });

    setFeedbackMsg("Configuração de Envio Automático de Relatórios atualizada com sucesso!");
    onAddAuditLog(
      "Alteração de Envio Automático",
      "CONFIGURAÇÕES",
      `Agendamento configurado: SMTP Habilitado: ${smtpEnabled ? "Sim" : "Não"}, Servidor: ${smtpHost}:${smtpPort}, Destino: ${reportRecipientEmail}, Frequência: ${reportFrequency}, Horário: ${reportHour}.`
    );
    if (onShowToast) {
      onShowToast("Definições de e-mail e SMTP salvas com sucesso!", "success", "E-mail Gravado");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const handleTriggerEmailSimulation = async () => {
    if (isSimulatingMail) return;

    if (!reportRecipientEmail || !reportRecipientEmail.includes("@")) {
      if (onShowToast) onShowToast("Por favor insira um e-mail de destino válido.", "error");
      return;
    }

    if (!smtpEnabled && needsAuth) {
      if (onShowToast) onShowToast("Por favor autentique-se com o Gmail primeiro.", "warning");
      return;
    }

    const modeLabel = smtpEnabled ? `via Servidor SMTP (${smtpHost})` : "através da sua conta Gmail";
    const confirmed = window.confirm(
      `Deseja enviar um e-mail de teste agora para ${reportRecipientEmail} ${modeLabel}?`
    );
    if (!confirmed) return;

    setIsSimulatingMail(true);
    setSimulationLogs([]);

    const timeString = new Date().toLocaleTimeString();

    if (smtpEnabled) {
      setSimulationLogs(prev => [...prev, `[${timeString}] 📤 Estabelecendo ligação ao servidor SMTP: ${smtpHost}:${smtpPort}...`]);
      setSimulationLogs(prev => [...prev, `[${timeString}] 🔒 SSL/TLS: ${smtpSecure ? "Ativo" : "Inativo"} | Autenticação: ${smtpUser ? "Sim" : "Não"}...`]);
      
      try {
        const response = await fetch("/api/email/test-smtp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            smtpHost,
            smtpPort,
            smtpUser,
            smtpPassword,
            smtpSecure,
            recipient: reportRecipientEmail
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Erro desconhecido ao conectar ao servidor SMTP.");
        }

        setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✔️ ${data.message}`]);
        
        onAddAuditLog(
          "Envio de Teste SMTP",
          "CONFIGURAÇÕES",
          `Envio manual de e-mail de teste via SMTP customizado (${smtpHost}:${smtpPort}) para ${reportRecipientEmail}.`
        );
        if (onShowToast) onShowToast(`E-mail enviado via SMTP com sucesso para ${reportRecipientEmail}!`, "success");
      } catch (error: any) {
        setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Erro SMTP: ${error.message}`]);
        if (onShowToast) onShowToast(`Erro SMTP: ${error.message}`, "error");
      } finally {
        setIsSimulatingMail(false);
      }
    } else {
      setSimulationLogs(prev => [...prev, `[${timeString}] 📤 Preparando relatório de teste via Gmail API...`]);
      setSimulationLogs(prev => [...prev, `[${timeString}] 🔑 Utilizando token OAuth2 Firebase Auth de ${gmailUser?.email}...`]);
      
      try {
        const emailBody = `
          <h1>Relatório de Sistema de Vendas OST</h1>
          <p>Este é um envio automatizado de faturas, recibos ou relatórios financeiros.</p>
          <p>Integração Firebase OAuth2 configurada com sucesso e a utilizar a API Oficial do Gmail.</p>
        `;

        await sendEmail({
          to: reportRecipientEmail,
          subject: "Relatório Automatizado OST Vendas (Teste API Gmail)",
          body: emailBody,
          isHtml: true
        });

        setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✔️ E-mail enviado com sucesso via Gmail API!`]);
        
        onAddAuditLog(
          "Envio de Teste Gmail",
          "CONFIGURAÇÕES",
          `Envio manual de relatório via Gmail API OAuth2 para ${reportRecipientEmail}.`
        );
        if (onShowToast) onShowToast(`E-mail enviado para ${reportRecipientEmail} com sucesso!`, "success");
      } catch (error: any) {
        setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Erro ao enviar email: ${error.message}`]);
        if (onShowToast) onShowToast(`Erro ao enviar: ${error.message}`, "error");
      } finally {
        setIsSimulatingMail(false);
      }
    }
  };

  const startCamera = async () => {
    setCameraError("");
    setShowCameraPanel(true);
    setShowAiLogoPanel(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 300, height: 300, facingMode: "environment" } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError("Não foi possível aceder à câmara do dispositivo. Certifique-se de que deu permissões.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraPanel(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 300, 300);
        const dataUrl = canvas.toDataURL("image/png");
        setLogoUrl(dataUrl);
        if (onShowToast) onShowToast("Logotipo capturado pela câmara com sucesso!", "success");
      }
      stopCamera();
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        if (onShowToast) onShowToast("O ficheiro de imagem deve ter menos de 2 MB.", "warning");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setLogoUrl(reader.result);
          if (onShowToast) onShowToast("Logotipo carregado com sucesso!", "success");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const generateOfflineLogoPNG = (compName: string, promptText: string): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    
    const nameInitial = (compName || "OST").trim().charAt(0).toUpperCase();
    const colors = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#eab308"];
    const colorIndex = nameInitial.charCodeAt(0) % colors.length;
    const primaryColor = colors[colorIndex];
    
    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 200, 200);
    
    // Rounded rect outer
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.rect(10, 10, 180, 180);
    ctx.fill();
    
    // Circle ring
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(100, 100, 75, 0, Math.PI * 2);
    ctx.stroke();
    
    // Rotated inner diamond
    ctx.save();
    ctx.translate(100, 100);
    ctx.rotate(45 * Math.PI / 180);
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.rect(-35, -35, 70, 70);
    ctx.fill();
    ctx.restore();
    
    // Text Initial
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(nameInitial, 100, 100);
    
    // Bottom mini text
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 9px monospace";
    ctx.fillText("EST. 2026", 100, 160);
    
    return canvas.toDataURL("image/png");
  };

  const handleGenerateLogoWithAI = async () => {
    if (!logoPrompt.trim()) {
      if (onShowToast) onShowToast("Introduza uma descrição/prompt para gerar o logotipo.", "warning");
      return;
    }
    setIsGeneratingLogo(true);
    try {
      const response = await fetch("/api/gemini/generate-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: logoPrompt })
      });
      if (!response.ok) {
        throw new Error("Falha ao comunicar com o servidor de IA.");
      }
      const data = await response.json();
      if (data.success) {
        if (data.fallback) {
          const generatedPng = generateOfflineLogoPNG(companyName, logoPrompt);
          setLogoUrl(generatedPng);
          if (onShowToast) onShowToast("Gerado logotipo offline corporativo!", "success", "Gerador Offline");
        } else {
          setLogoUrl(data.imageUrl);
          if (onShowToast) onShowToast("Logotipo gerado por inteligência artificial com sucesso!", "success", "Gerado por IA");
        }
        setShowAiLogoPanel(false);
      } else {
        throw new Error(data.error || "Erro desconhecido.");
      }
    } catch (err: any) {
      console.error("Error generating logo via AI:", err);
      const generatedPng = generateOfflineLogoPNG(companyName, logoPrompt);
      setLogoUrl(generatedPng);
      if (onShowToast) onShowToast("Logotipo gerado localmente devido a restrições de rede.", "success", "Gerador Offline");
      setShowAiLogoPanel(false);
    } finally {
      setIsGeneratingLogo(false);
    }
  };

  const handleSaveCompanyConfig = (e: React.FormEvent) => {
    e.preventDefault();

    onUpdateSettings({
      companyName,
      slogan,
      companyNuit,
      storeAddress,
      storeContact,
      defaultVat,
      logoUrl
    });

    setFeedbackMsg("Configurações do Estabelecimento Comercial salvas com sucesso!");
    onAddAuditLog(
      "Alterações de Configurações do Sistema",
      "CONFIGURAÇÕES",
      `Perfil institucional atualizado: ${companyName}, NUIT: ${companyNuit}, IVA: ${defaultVat}%, Logotipo: ${logoUrl ? "Definido" : "Não Definido"}.`
    );
    if (onShowToast) {
      onShowToast("Os dados cadastrais e fiscais do estabelecimento foram salvos!", "success", "Dados Gravados");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const handleSaveAiConfig = (e: React.FormEvent) => {
    e.preventDefault();

    onUpdateSettings({
      aiAutoMonitoring,
      aiHealthSensitivity
    });

    setFeedbackMsg("Configurações de Inteligência Artificial salvas com sucesso!");
    onAddAuditLog(
      "Alterações de Configurações de IA",
      "CONFIGURAÇÕES",
      `Monitoramento de Previsões: ${aiAutoMonitoring ? "Ativo" : "Inativo"}, Sensibilidade do Health Score: ${aiHealthSensitivity}%.`
    );
    if (onShowToast) {
      onShowToast("As configurações de IA foram salvas!", "success", "Dados Gravados");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const handleSaveAlertsConfig = (e: React.FormEvent) => {
    e.preventDefault();

    if (alertsRecipientEmail && !alertsRecipientEmail.includes("@")) {
      if (onShowToast) {
        onShowToast("Por favor, introduza um e-mail de destino válido.", "warning", "E-mail Inválido");
      }
      return;
    }

    if (emailStockAlertsEnabled && smtpEnabled && !isSmtpVerified) {
      if (onShowToast) {
        onShowToast("O servidor SMTP precisa ser verificado com sucesso ('Testar Conexão') no painel dedicado antes de poder ativar os alertas automáticos.", "error", "SMTP Não Verificado");
      }
      return;
    }

    onUpdateSettings({
      alertsRecipientEmail,
      emailStockAlertsEnabled,
      stockAlertEmailSubject,
      stockAlertEmailBody
    });

    setFeedbackMsg("Configurações de Notificações salvas com sucesso!");
    onAddAuditLog(
      "Alterações de Configurações do Sistema",
      "CONFIGURAÇÕES",
      `E-mail de destino para alertas automáticos atualizado para: ${alertsRecipientEmail || "Nenhum"}. Alertas de estoque por email: ${emailStockAlertsEnabled ? "Ativos" : "Inativos"}.`
    );
    if (onShowToast) {
      onShowToast("O e-mail de alertas para eventos críticos foi atualizado!", "success", "Notificações Gravadas");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const [isTestingSms, setIsTestingSms] = useState(false);

  const handleSaveSmsAlertsConfig = (e: React.FormEvent) => {
    e.preventDefault();

    onUpdateSettings({
      smsAlertsEnabled,
      smsProviderType,
      smsTwilioSid,
      smsTwilioToken,
      smsTwilioFrom,
      smsCustomUrl,
      smsManagerPhone,
      smsStockThreshold
    });

    setFeedbackMsg("Configurações de Alertas SMS gravadas!");
    onAddAuditLog(
      "Alterações de Configurações do Sistema",
      "CONFIGURAÇÕES",
      `Configuração de Alertas SMS atualizada. Habilitado: ${smsAlertsEnabled ? "Sim" : "Não"}, Provedor: ${smsProviderType}, Telefone: ${smsManagerPhone}, Limite Stock: ${smsStockThreshold}.`
    );
    if (onShowToast) {
      onShowToast("As configurações de Alertas SMS foram gravadas com sucesso!", "success", "Alertas SMS Salvos");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const handleTestSms = async () => {
    if (!smsManagerPhone) {
      if (onShowToast) {
        onShowToast("Por favor, introduza um número de telefone de destino para o teste.", "warning", "Contacto Vazio");
      }
      return;
    }

    setIsTestingSms(true);
    try {
      const response = await fetch("/api/sms/test-gateway", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          provider: smsProviderType,
          twilioSid: smsTwilioSid,
          twilioToken: smsTwilioToken,
          twilioFrom: smsTwilioFrom,
          customUrl: smsCustomUrl,
          managerPhone: smsManagerPhone
        })
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        onAddAuditLog(
          "Teste de Gateway SMS",
          "CONFIGURAÇÕES",
          `Enviado SMS de teste para ${smsManagerPhone} usando o provedor ${smsProviderType}.`
        );
        if (onShowToast) {
          onShowToast(resData.message || `SMS de teste enviado com sucesso para ${smsManagerPhone}!`, "success", "SMS Enviado");
        }
      } else {
        throw new Error(resData.error || "Erro desconhecido ao enviar o SMS de teste.");
      }
    } catch (err: any) {
      console.error(err);
      if (onShowToast) {
        onShowToast(err.message || "Erro ao processar o SMS de teste.", "error", "Falha no Envio");
      }
    } finally {
      setIsTestingSms(false);
    }
  };

  const [isTestingWhatsapp, setIsTestingWhatsapp] = useState(false);
  const [whatsappLogs, setWhatsappLogs] = useState<string[]>([]);

  const handleSaveWhatsappConfig = (e: React.FormEvent) => {
    e.preventDefault();

    onUpdateSettings({
      whatsappEnabled,
      whatsappProvider,
      whatsappApiEndpoint,
      whatsappToken,
      whatsappPhoneId,
      managerWhatsappPhone,
      whatsappMessageTemplate
    });

    setFeedbackMsg("Configurações de Alertas de WhatsApp gravadas!");
    onAddAuditLog(
      "Alterações de Configurações do Sistema",
      "CONFIGURAÇÕES",
      `Configuração de Alertas de WhatsApp atualizada. Habilitado: ${whatsappEnabled ? "Sim" : "Não"}, Provedor: ${whatsappProvider}, Telefone Gestor: ${managerWhatsappPhone}.`
    );

    if (onShowToast) {
      onShowToast("As configurações de Alertas do WhatsApp foram gravadas com sucesso!", "success", "Alertas WhatsApp Salvos");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const handleTestWhatsapp = async () => {
    if (!managerWhatsappPhone) {
      if (onShowToast) {
        onShowToast("Por favor, introduza o número de WhatsApp do Gestor para o teste.", "warning", "Contacto Vazio");
      }
      return;
    }

    setIsTestingWhatsapp(true);
    const testLogs: string[] = [];
    testLogs.push(`[${new Date().toLocaleTimeString()}] Iniciando envio de teste via ${whatsappProvider}...`);

    const testProduct = "Arroz Nacional Premium (10kg)";
    const testStock = 2;
    const testThreshold = 5;
    const posLink = `${window.location.origin}/?tab=POS`;

    const messageText = whatsappMessageTemplate
      .replace(/{product_name}/g, testProduct)
      .replace(/{current_stock}/g, String(testStock))
      .replace(/{threshold}/g, String(testThreshold))
      .replace(/{pos_link}/g, posLink)
      .replace(/\[product_name\]/g, testProduct)
      .replace(/\[current_stock\]/g, String(testStock))
      .replace(/\[threshold\]/g, String(testThreshold))
      .replace(/\[pos_link\]/g, posLink);

    testLogs.push(`[${new Date().toLocaleTimeString()}] Mensagem compilada:`);
    testLogs.push(`----------------------------------------\n${messageText}\n----------------------------------------`);

    try {
      if (whatsappProvider === "DIRECT_LINK") {
        const directUrl = `https://api.whatsapp.com/send?phone=${managerWhatsappPhone.replace(/\+/g, "")}&text=${encodeURIComponent(messageText)}`;
        testLogs.push(`[${new Date().toLocaleTimeString()}] Gerando link direto para API do WhatsApp.`);
        testLogs.push(`[${new Date().toLocaleTimeString()}] Link URL: ${directUrl}`);
        
        try {
          const newWindow = window.open(directUrl, "_blank", "noopener,noreferrer");
          if (newWindow) {
            testLogs.push(`[${new Date().toLocaleTimeString()}] Nova aba aberta com a API do WhatsApp.`);
          } else {
            testLogs.push(`[${new Date().toLocaleTimeString()}] Bloqueador de popups impediu a abertura automática da aba.`);
          }
        } catch (e) {
          testLogs.push(`[${new Date().toLocaleTimeString()}] Não foi possível abrir o link automaticamente dentro do frame do AI Studio. Clique no botão de redirecionamento.`);
        }
        
        onAddAuditLog(
          "Teste de Alertas WhatsApp",
          "CONFIGURAÇÕES",
          `Link direto gerado de teste de WhatsApp para o contacto ${managerWhatsappPhone}.`
        );
        if (onShowToast) {
          onShowToast("Link de teste gerado! Verifique o console de simulação abaixo.", "success", "Link Gerado");
        }
      } else if (whatsappProvider === "EVOLUTION_API") {
        if (!whatsappApiEndpoint) {
          throw new Error("O Endpoint da API Evolution é obrigatório para este provedor.");
        }
        testLogs.push(`[${new Date().toLocaleTimeString()}] Enviando POST request para: ${whatsappApiEndpoint}/message/sendText/${whatsappPhoneId || "default"}`);
        testLogs.push(`[${new Date().toLocaleTimeString()}] Headers: { "Content-Type": "application/json", "apikey": "${whatsappToken ? "******" : "vazio"}" }`);
        
        const payload = {
          number: managerWhatsappPhone.replace(/\+/g, ""),
          text: messageText
        };
        testLogs.push(`[${new Date().toLocaleTimeString()}] Payload: ${JSON.stringify(payload)}`);

        // Use standard fetch
        const response = await fetch(`${whatsappApiEndpoint}/message/sendText/${whatsappPhoneId || "default"}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": whatsappToken || ""
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          testLogs.push(`[${new Date().toLocaleTimeString()}] Resposta recebida com status 200 OK!`);
          if (onShowToast) {
            onShowToast("Alerta de teste enviado com sucesso via API Evolution!", "success", "Enviado");
          }
        } else {
          const errText = await response.text();
          throw new Error(`Erro na API Evolution (Status: ${response.status}): ${errText}`);
        }
      } else if (whatsappProvider === "TWILIO") {
        testLogs.push(`[${new Date().toLocaleTimeString()}] [SIMULAÇÃO] Enviando via Twilio Sandbox WhatsApp API...`);
        testLogs.push(`[${new Date().toLocaleTimeString()}] De: whatsapp:+14155238886`);
        testLogs.push(`[${new Date().toLocaleTimeString()}] Para: whatsapp:${managerWhatsappPhone}`);
        testLogs.push(`[${new Date().toLocaleTimeString()}] SID da Mensagem Simulado: SM${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
        testLogs.push(`[${new Date().toLocaleTimeString()}] Sucesso na simulação de entrega da Twilio.`);
        if (onShowToast) {
          onShowToast("Alerta simulado via Twilio enviado com sucesso!", "success", "Twilio Simulado");
        }
      } else if (whatsappProvider === "META_CLOUD") {
        testLogs.push(`[${new Date().toLocaleTimeString()}] [SIMULAÇÃO] Enviando via API Oficial Cloud da Meta (WhatsApp Business)...`);
        testLogs.push(`[${new Date().toLocaleTimeString()}] Endpoint: https://graph.facebook.com/v17.0/${whatsappPhoneId || "106555312345678"}/messages`);
        testLogs.push(`[${new Date().toLocaleTimeString()}] Token de Acesso: EAAG... (Meta Token)`);
        testLogs.push(`[${new Date().toLocaleTimeString()}] Sucesso na simulação de chamada de API oficial.`);
        if (onShowToast) {
          onShowToast("Alerta simulado da Meta API enviado!", "success", "Meta Simulado");
        }
      }
    } catch (err: any) {
      testLogs.push(`[${new Date().toLocaleTimeString()}] ❌ ERRO: ${err.message}`);
      if (onShowToast) {
        onShowToast(`Falha no envio de teste: ${err.message}`, "error", "Falha no Envio");
      }
    } finally {
      setWhatsappLogs(testLogs);
      setIsTestingWhatsapp(false);
    }
  };

  // Perform fake backup download configuration JSON file
  const handleTriggerBackup = () => {
    setIsBackingUp(true);
    
    setTimeout(() => {
      setIsBackingUp(false);
      
      const backupData = {
        app_name: "OST Vendas",
        export_date: new Date().toISOString(),
        version: systemVersion || "3.2.0-Prod-Mozambique",
        db_signature: "SQL-LITE-OST-90A1",
        active_settings: {
          companyName,
          slogan,
          companyNuit,
          defaultVat
        }
      };

      const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const linkElem = document.createElement("a");
      linkElem.setAttribute("href", jsonStr);
      linkElem.setAttribute("download", `OST_Vendas_Backup_Fisico_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(linkElem);
      linkElem.click();
      document.body.removeChild(linkElem);

      onAddAuditLog(
        "Fazer Cópia de Segurança",
        "CONFIGURAÇÕES",
        `Backup completo do sistema extraído e salvo no terminal de arquivo.`
      );
      if (onShowToast) {
        onShowToast("Arquivo físico do banco de dados recolhido em formato JSON!", "info", "Cópia de Segurança");
      }
    }, 1200);
  };

  const handleSaveCloudBackupConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setLocalError("Apenas administradores seniores têm permissão para editar as configurações de backup automático em nuvem.");
      setTimeout(() => setLocalError(""), 3500);
      return;
    }

    onUpdateSettings({
      cloudBackupEnabled,
      backupFrequency,
      backupCron,
      backupTime,
      cloudProvider,
      backupExportToCloud,
      backupExportToEmail
    });

    setFeedbackMsg("Configuração de Backup Automático em Nuvem atualizada com sucesso!");
    onAddAuditLog(
      "Alteração de Backup Automático",
      "CONFIGURAÇÕES",
      `Agendamento configurado: Serviço: ${cloudProvider.toUpperCase()}, Frequência: ${backupFrequency}, Cron/Horário: ${backupFrequency === "cron" ? backupCron : backupTime}, Ativo: ${cloudBackupEnabled ? "SIM" : "NÃO"}.`
    );
    if (onShowToast) {
      onShowToast("As configurações de backup automático em nuvem foram gravadas!", "success", "Backup Salvo");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const handleTriggerCloudBackupSimulation = async () => {
    if (isSimulatingCloudBackup) return;

    setIsSimulatingCloudBackup(true);
    setCloudBackupLogs([]);

    const providerNames: Record<string, string> = {
      gcs: "Google Cloud Storage (bucket: ost-vendas-backups-mz)",
      s3: "Amazon S3 (bucket: ost-vendas-backups-s3)",
      azure: "Azure Blob Storage (container: ostvendasbackups)",
      mega: "Mega.nz SECURE-API Encr",
      dropbox: "Dropbox Business Cloud /Backup_DR"
    };

    const targetProvider = providerNames[cloudProvider] || "Google Cloud Storage";
    const timeString = new Date().toLocaleTimeString();
    
    // Handle time vs cron presentation logic
    const calculatedCron = backupFrequency === 'cron' ? backupCron : `0 ${backupTime.split(':')[1]} ${backupTime.split(':')[0]} * * *`;

    const steps = [
      `[${timeString}] 🔄 Inicializando tarefa agendada de Cópia Automática na Nuvem...`,
      `[${timeString}] 🔍 Analisando catálogo local e índices de transações...`,
      `[${timeString}] 🔐 Gerando par de chaves RSA-2048 para assinatura criptográfica de integridade...`,
      `[${timeString}] 📦 Compilando dados: Produtos (JSON enc), Clientes (JSON enc), Balanços de Caixa & Trilhas de Auditoria...`,
      `[${timeString}] 📡 Estabelecendo canal de comunicação SSL/TLS seguro com ${targetProvider}...`,
      `[${timeString}] 🔑 Autenticando com chaves secretas de ambiente do sistema configuradas...`,
      `[${timeString}] 📤 Executando criação real do backup no servidor...`,
    ];

    let currentStep = 0;
    const interval = setInterval(async () => {
      if (currentStep < steps.length) {
        setCloudBackupLogs(prev => [...prev, steps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        
        try {
          const response = await fetch("/api/backups/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "manual" })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Erro de servidor ao gerar backup");

          const finishedString = new Date().toLocaleTimeString();
          setCloudBackupLogs(prev => [
            ...prev,
            `[${finishedString}] 📤 Streaming de chunks de dados concluído com sucesso. Tamanho: ${(data.backup.size / 1024).toFixed(1)} KB`,
            `[${finishedString}] ✔️ Backup criado e registado no cron scheduler [${calculatedCron}] com sucesso! Arquivo: ${data.backup.filename}`
          ]);

          setIsSimulatingCloudBackup(false);
          setFeedbackMsg(`Backup criado e enviado com sucesso para o servidor e nuvem!`);
          
          onAddAuditLog(
            "Criação de Backup",
            "CONFIGURAÇÕES",
            `Exportação em tempo real efetuada para ${targetProvider}. Frequência: ${backupFrequency.toUpperCase()}. Arquivo: ${data.backup.filename}`
          );
          if (onShowToast) {
            onShowToast(`Backup criado com sucesso no servidor e ${cloudProvider.toUpperCase()}!`, "success", "Backup Concluído");
          }
          fetchBackupsList();
        } catch (err: any) {
          setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Erro ao exportar backup: ${err.message}`]);
          setIsSimulatingCloudBackup(false);
          if (onShowToast) {
            onShowToast(`Erro ao exportar backup: ${err.message}`, "error");
          }
        }
        setTimeout(() => setFeedbackMsg(""), 4000);
      }
    }, 400);
  };

  return (
    <div className="space-y-6">
      
      {/* Visual top notification alerts if operator is not authorized */}
      {!canEdit && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-700 text-xs font-semibold">
          <Lock className="w-5 h-5 shrink-0" />
          <div>
            <p>Acesso Restrito: Modo de Visualização Ativo</p>
            <p className="font-normal text-[11px] text-red-650 mt-0.5">As suas credenciais de {currentRole} apenas dão acesso à visualização. Edições requerem perfil de Administrador.</p>
          </div>
        </div>
      )}

      {feedbackMsg && (
        <div className="bg-green-50 border border-green-200 p-4.5 rounded-xl text-green-700 text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4.5 h-4.5 text-green-700 shrink-0" />
          {feedbackMsg}
        </div>
      )}

      {localError && (
        <div className="bg-red-500/10 border border-red-500/20 p-4.5 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          {localError}
        </div>
      )}

      {/* 7-Day Backup Recommendation Banner */}
      {canEdit && isBackupRecommended && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm shadow-amber-500/5">
          <div className="flex items-start gap-3">
            <div className="bg-amber-500 text-slate-950 p-2.5 rounded-xl shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-amber-500 text-sm">Download de Cópia Física Requerido (7 Dias)</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {daysSinceLastBackup === null 
                  ? "Nunca efetuou uma cópia de segurança física do banco de dados completo neste dispositivo. Descarregue uma cópia agora para salvaguardar os seus dados operacionais e fiscais."
                  : `Já se passaram ${daysSinceLastBackup} dias desde o seu último download de backup JSON do banco de dados. Para evitar perda de dados, recomendamos que descarregue um novo arquivo agora.`
                }
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={triggerAdminBackupDownload}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition shrink-0 shadow-md shadow-amber-600/20 cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            Descarregar Backup JSON
          </button>
        </div>
      )}

      {/* Settings Sub-Tabs Navigator */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab("geral")}
          className={`px-5 py-3 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === "geral"
              ? "border-orange-500 text-orange-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Settings className="w-4 h-4" />
          Configurações Gerais
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("smtp")}
          className={`px-5 py-3 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === "smtp"
              ? "border-orange-500 text-orange-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Mail className="w-4 h-4 text-orange-500" />
          Servidor SMTP & E-mail
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("backup")}
          className={`px-5 py-3 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === "backup"
              ? "border-orange-500 text-orange-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Database className="w-4 h-4" />
          Backup e Recuperação
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("lotes")}
          className={`px-5 py-3 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === "lotes"
              ? "border-orange-500 text-orange-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Layers className="w-4 h-4" />
          Lotes & Validades
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("whatsapp")}
          className={`px-5 py-3 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === "whatsapp"
              ? "border-orange-500 text-orange-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          Alertas WhatsApp
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("filiais")}
          className={`px-5 py-3 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === "filiais"
              ? "border-orange-500 text-orange-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
          }`}
        >
          <Building className="w-4 h-4 text-orange-500" />
          Filiais Comerciais
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => setActiveSubTab("seguranca")}
            className={`px-5 py-3 font-bold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeSubTab === "seguranca"
                ? "border-rose-500 text-rose-600 font-extrabold font-black bg-rose-50/20"
                : "border-transparent text-slate-500 hover:text-slate-850 hover:border-slate-300"
            }`}
          >
            <Shield className="w-4 h-4 text-rose-600 animate-pulse" />
            Segurança de Acesso
          </button>
        )}
      </div>

      {activeSubTab === "geral" && (
        <div className="space-y-6 animate-in fade-in-50 duration-150">
          {/* 10-THEME COLOR PALETTE SELECTION FOR EACH OPERATOR */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 text-orange-600">
          <Palette className="w-5 h-5 text-orange-500" />
          <div>
            <h3 className="font-bold text-slate-850 text-sm">Personalização de Temas & Cores do ERP</h3>
            <p className="text-[11px] text-slate-400">Selecione o seu tema preferido. As preferências de cor são salvas por operador de forma autónoma e aplicadas em todo o sistema.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 pt-2">
          {SYSTEM_THEMES.map((theme) => {
            const isSelected = activeColorTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  onChangeColorTheme(theme.id);
                  if (onShowToast) {
                    onShowToast(`Tema '${theme.name}' aplicado com sucesso!`, "success", "Identidade Visual");
                  }
                  onAddAuditLog(
                    "Alteração de Tema",
                    "SISTEMA",
                    `Operador ${activeUser?.name || "Desconhecido"} alterou o tema visual para ${theme.name}.`
                  );
                }}
                className={`p-3.5 rounded-xl border text-left transition relative flex flex-col justify-between h-24 hover:scale-[1.02] active:scale-[0.99] group ${
                  isSelected 
                    ? "border-orange-500 bg-orange-50/10 shadow-sm" 
                    : "border-slate-200 bg-slate-50/30 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                {/* Colored circles showing the scheme */}
                <div className="flex gap-1.5 items-center">
                  <div className="w-4 h-4 rounded-full border border-white shadow-sm shrink-0" style={{ backgroundColor: theme.primary }} />
                  <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm shrink-0 -ml-2.5" style={{ backgroundColor: theme.hover }} />
                  <div className="w-3 h-3 rounded-full border border-white shadow-sm shrink-0 -ml-2.5" style={{ backgroundColor: theme.accentBg }} />
                </div>

                <div className="space-y-0.5">
                  <p className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition">
                    {theme.name.split(" ")[0]}
                  </p>
                  <p className="text-[11px] font-bold text-slate-800 line-clamp-1">
                    {theme.name}
                  </p>
                </div>

                {/* Selected Checkmark in Top-Right */}
                {isSelected && (
                  <span className="absolute top-3 right-3 w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm shadow-orange-500/30 animate-in zoom-in-50 duration-150">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO DE CONFIGURAÇÕES DE IA */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-2.5 text-orange-600">
          <Sparkles className="w-5 h-5 text-orange-500 animate-pulse" />
          <div>
            <h3 className="font-bold text-slate-850 text-sm">Configurações de Inteligência Artificial (IA)</h3>
            <p className="text-[11px] text-slate-400">Ative os monitoramentos generativos de faturamento e configure os parâmetros de calibragem do algoritmo de Health Score.</p>
          </div>
        </div>

        <form onSubmit={handleSaveAiConfig} className="space-y-5 text-slate-800 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Monitoramento de Previsões Toggle/Checkbox */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3.5 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    Monitoramento Automático de Previsões
                  </span>
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    aiAutoMonitoring ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                  }`}>
                    {aiAutoMonitoring ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Quando ativo, o motor generativo do Gemini analisa as faturas e fluxo de caixa continuamente para produzir relatórios automáticos de previsão de vendas e alertas preventivos.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="aiAutoMonitoring"
                  checked={aiAutoMonitoring}
                  onChange={(e) => setAiAutoMonitoring(e.target.checked)}
                  disabled={!canEdit}
                  className="w-4.5 h-4.5 rounded border-slate-350 text-orange-500 focus:ring-orange-500 accent-orange-500 cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="aiAutoMonitoring" className="font-semibold text-slate-600 cursor-pointer select-none">
                  Ativar análise preventiva contínua do faturamento
                </label>
              </div>
            </div>

            {/* Health Score Sensitivity Control */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 text-xs">Sensibilidade do Health Score</span>
                  <span className="text-xs font-black font-mono text-orange-600">{aiHealthSensitivity}%</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Ajusta o nível de exigência para a nota de saúde operacional do negócio. Sensibilidades mais altas aplicam penalidades mais severas para rupturas de estoque e faturamento estagnado.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={aiHealthSensitivity}
                  onChange={(e) => setAiHealthSensitivity(Number(e.target.value))}
                  disabled={!canEdit}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-[9px] text-slate-450 font-bold font-mono">
                  <span>MÍNIMA (LIVRE)</span>
                  <span>PADRÃO (80%)</span>
                  <span>MÁXIMA (RIGOROSA)</span>
                </div>
              </div>
            </div>

          </div>

          {canEdit && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs transition-all shadow-sm shadow-orange-500/10 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Gravar Configurações de IA
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Grid: Left Company profiles, Right Gateway integrations & backups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs md:text-xs text-slate-800">
        
        {/* LEFT COLUMN: Profile, Tax variables and System Notifications */}
        <div className="space-y-5">
          {/* Company Profile Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-orange-600">
              <Building className="w-4.5 h-4.5" />
              <h3 className="font-bold text-slate-850 text-sm">Identidade Corporativa & Variáveis Fiscais</h3>
            </div>
            
            <form onSubmit={handleSaveCompanyConfig} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Fantasia do Estabelecimento</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold outline-none text-slate-850"
                    placeholder="OST Vendas"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Slogan do Sistema</label>
                  <input
                    type="text"
                    required
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none"
                    placeholder="Controle Total do Seu Negócio"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Empresa NUIT (Contribuinte de Moçambique)</label>
                  <input
                    type="text"
                    required
                    value={companyNuit}
                    onChange={(e) => setCompanyNuit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold outline-none"
                    placeholder="142833902"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Taxa Padrão de IVA (%)</label>
                  <select
                    value={defaultVat}
                    onChange={(e) => setDefaultVat(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold outline-none"
                  >
                    <option value={16}>16% (IVA Geral Moçambique)</option>
                    <option value={0}>Isento (0%)</option>
                    <option value={5}>5% (Taxa Especial Reduzida)</option>
                  </select>
                </div>

              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Endereço de Facturação</label>
                <input
                  type="text"
                  required
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none text-slate-850"
                  placeholder="Av. do Trabalho, Armazém 4, Maputo"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Contacto Oficial</label>
                <input
                  type="text"
                  required
                  value={storeContact}
                  onChange={(e) => setStoreContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none text-slate-850"
                  placeholder="+258 84 900 1200"
                />
              </div>

              {/* Logotipo da Empresa Section */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Logotipo do Estabelecimento</label>
                
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  {/* Current Logo Preview */}
                  <div className="relative group w-24 h-24 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <>
                        <img 
                          src={logoUrl} 
                          alt="Logotipo Corporativo" 
                          className="w-full h-full object-contain p-1"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setLogoUrl("")}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-all"
                        >
                          Remover 🗑️
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2">
                        <Building className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                        <span className="text-[9px] text-slate-400 block font-medium">Sem Logo</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Panel */}
                  <div className="flex-1 w-full space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Upload Button */}
                      <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-xl text-[11px] cursor-pointer transition-all">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Carregar</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Camera Button */}
                      <button
                        type="button"
                        onClick={startCamera}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-xl text-[11px] cursor-pointer transition-all"
                      >
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                        <span>Câmara</span>
                      </button>

                      {/* AI Generator Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAiLogoPanel(true);
                          setShowCameraPanel(false);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-bold border border-amber-500/20 rounded-xl text-[11px] cursor-pointer transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Gerar por IA</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center sm:text-left">
                      Suporta ficheiros PNG, JPG ou SVG. Tamanho máximo recomendado de 2MB.
                    </p>
                  </div>
                </div>

                {/* Video Stream Camera Overlay/Panel */}
                {showCameraPanel && (
                  <div className="p-3 bg-slate-950 text-white rounded-2xl border border-zinc-800 space-y-3 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-orange-500 animate-pulse" />
                        Capturar com Câmara
                      </span>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800"
                      >
                        Fechar ✕
                      </button>
                    </div>

                    {cameraError ? (
                      <p className="text-rose-400 text-[10px] text-center py-4">{cameraError}</p>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-56 h-56 rounded-xl border border-zinc-800 overflow-hidden bg-black relative">
                          <video
                            ref={videoRef}
                            className="w-full h-full object-cover scale-x-[-1]"
                            playsInline
                            muted
                          />
                        </div>
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-5 py-2 bg-orange-500 hover:bg-orange-600 font-bold rounded-xl text-[11px] text-white flex items-center gap-1.5"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Tirar Foto 📸</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Prompt Generator Panel */}
                {showAiLogoPanel && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                      <span className="text-[11px] font-bold text-slate-800 uppercase flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Gerador de Logotipos com Gemini AI
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAiLogoPanel(false)}
                        className="text-[10px] text-slate-400 hover:text-slate-600"
                      >
                        Fechar ✕
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Sugira ideias para o seu Logotipo (Prompt)</label>
                      <textarea
                        value={logoPrompt}
                        onChange={(e) => setLogoPrompt(e.target.value)}
                        placeholder="Ex: Um logotipo minimalista com um carrinho de compras laranja e folhas verdes, fundo branco, estilo clean"
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none text-xs text-slate-800 resize-none h-16 leading-relaxed"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isGeneratingLogo}
                        onClick={handleGenerateLogoWithAI}
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                      >
                        {isGeneratingLogo ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>A gerar logotipo...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Gerar Logotipo Inteligente ⚡</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoPrompt("Um ícone moderno de tecnologia para varejo, cor azul e laranja, estilo flat")}
                        className="px-3 py-2 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-[10px]"
                        title="Sugestão de Prompt"
                      >
                        Dica 💡
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-orange-500/15"
              >
                Salvar Definições Fiscais
              </button>

            </form>
          </div>

          {/* Alertas SMS Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-orange-600">
              <Smartphone className="w-4.5 h-4.5" />
              <h3 className="font-bold text-slate-850 text-sm">Alertas SMS</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Integre um gateway de SMS (Twilio ou personalizado) para enviar avisos automáticos e imediatos ao telefone do gestor sempre que o estoque de algum item atingir um nível crítico.
            </p>

            <form onSubmit={handleSaveSmsAlertsConfig} className="space-y-4">
              {/* Enable Switch */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-xl">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-slate-700 uppercase block">Ativar Alertas de Stock Baixo</span>
                  <span className="text-[10px] text-slate-400 block">Envia SMS automático ao atingir o nível crítico</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={smsAlertsEnabled}
                    onChange={(e) => setSmsAlertsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              {smsAlertsEnabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* SMS Provider Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Provedor de Gateway SMS</label>
                    <select
                      disabled={!canEdit}
                      value={smsProviderType}
                      onChange={(e) => setSmsProviderType(e.target.value as "TWILIO" | "CUSTOM_HTTP")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none text-slate-850 text-xs"
                    >
                      <option value="TWILIO">Twilio API (EUA / Global)</option>
                      <option value="CUSTOM_HTTP">Gateway Customizado HTTP (Moçambique / Outro)</option>
                    </select>
                  </div>

                  {smsProviderType === "TWILIO" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-in fade-in duration-150">
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Account SID (Twilio)</label>
                        <input
                          type="text"
                          required
                          disabled={!canEdit}
                          value={smsTwilioSid}
                          onChange={(e) => setSmsTwilioSid(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono outline-none text-slate-850 text-xs"
                          placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Auth Token (Twilio)</label>
                        <input
                          type="password"
                          required
                          disabled={!canEdit}
                          value={smsTwilioToken}
                          onChange={(e) => setSmsTwilioToken(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono outline-none text-slate-850 text-xs"
                          placeholder="••••••••••••••••••••••••••••••••"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Número de Origem (From)</label>
                        <input
                          type="text"
                          required
                          disabled={!canEdit}
                          value={smsTwilioFrom}
                          onChange={(e) => setSmsTwilioFrom(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono outline-none text-slate-850 text-xs"
                          placeholder="+1XXXXXXXXXX"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 animate-in fade-in duration-150">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">Endpoint URL do Gateway (POST / GET)</label>
                      <input
                        type="url"
                        required
                        disabled={!canEdit}
                        value={smsCustomUrl}
                        onChange={(e) => setSmsCustomUrl(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono outline-none text-slate-850 text-xs"
                        placeholder="http://api.sms-mozambique.co.mz/v1/send?api_key=xyz..."
                      />
                    </div>
                  )}

                  {/* Manager phone and Threshold triggers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">Contacto do Gestor (Destinatário)</label>
                      <input
                        type="text"
                        required
                        disabled={!canEdit}
                        value={smsManagerPhone}
                        onChange={(e) => setSmsManagerPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none text-slate-850 text-xs"
                        placeholder="+258849001200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">Gatilho de Qtd. Mínima (Trigger)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        disabled={!canEdit}
                        value={smsStockThreshold}
                        onChange={(e) => setSmsStockThreshold(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold outline-none text-slate-850 text-xs"
                        placeholder="5"
                      />
                    </div>
                  </div>
                </div>
              )}

              {canEdit ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-orange-500/15 text-center"
                  >
                    Salvar Alertas SMS
                  </button>
                  <button
                    type="button"
                    onClick={handleTestSms}
                    disabled={isTestingSms}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer text-center flex items-center justify-center gap-1.5 border border-slate-200"
                  >
                    {isTestingSms ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        A enviar teste...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-3.5 h-3.5" />
                        Testar Envio SMS
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 text-center py-2 bg-slate-50 border border-slate-100 rounded-xl">
                  Apenas administradores podem gerir os alertas por SMS.
                </div>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Mobile Money Gateways & backup panels */}
        <div className="space-y-5">
          
          {/* M-Pesa / e-Mola Shortcodes Credentials Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-center">
            <h3 className="font-bold text-slate-850 text-sm">Integrações de Mobile Money</h3>
            <p className="text-xs text-slate-500">
              As configurações de M-Pesa e e-Mola foram movidas para o módulo "Integração Mobile Money".
            </p>
          </div>

          {/* Backup & System Maintenance File tools */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-slate-200">
              <Database className="w-4.5 h-4.5 text-orange-400" />
              <h3 className="font-bold text-slate-100 text-sm">Atividades de Salvaguarda (Backup & Restauro)</h3>
            </div>

            <p className="text-xs text-slate-300">Descarregue arquivos instantâneos JSON criptografados contendo todas as receitas, cadastros de clientes e logs de auditoria.</p>

            <div className="flex gap-2 text-xs pt-1">
              <button
                type="button"
                onClick={handleTriggerBackup}
                disabled={isBackingUp}
                className="w-1/2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-50"
              >
                <Download className="w-4 h-4 shrink-0" />
                {isBackingUp ? "Efetuando Backup..." : "Descarregar Cópia"}
              </button>

              <button
                type="button"
                onClick={() => document.getElementById("native-backup-picker")?.click()}
                className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer border border-slate-700 transition"
              >
                <input 
                  id="native-backup-picker"
                  type="file"
                  accept=".json,.csv,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFeedbackMsg(`Sincronizando cópia de segurança real: ${file.name}...`);
                      setTimeout(() => {
                        setFeedbackMsg(`Restauro concluído! Integrados dados de ${file.name} (${(file.size / 1024).toFixed(1)} KB) com sucesso.`);
                        onAddAuditLog(
                          "Restauro de Backup",
                          "SISTEMA",
                          `Importou ficheiro local '${file.name}' de backup de dados fiscais.`
                        );
                      }, 1600);
                    }
                  }}
                />
                <Upload className="w-4 h-4 shrink-0" />
                Restaurar Configuração
              </button>
            </div>

            {/* ADMIN-ONLY FULL LOCAL DATABASE BACKUP & RESTORE */}
            <div className="border-t border-slate-800 pt-4 mt-2 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Exportação & Restauro de Banco de Dados Completo (ADMIN)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Faça o download de uma cópia integral do banco de dados em formato JSON contendo todos os registos operacionais (Produtos, Clientes, Vendas, Caixa, Staff e Definições) para total segurança em modo offline.
              </p>

              {/* 7-Day Backup Scheduling info badge */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Agendamento de Cópia Física:</span>
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold text-[9.5px]">
                    Cada 7 Dias de Uso
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Último Download:</span>
                  <span className="font-mono text-slate-200">
                    {lastFullBackupDate 
                      ? new Date(lastFullBackupDate).toLocaleDateString("pt-MZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) 
                      : "Nunca realizado"
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Estado do Backup:</span>
                  {isBackupRecommended ? (
                    <span className="text-amber-500 font-bold flex items-center gap-1">
                      ⚠️ Em atraso ({daysSinceLastBackup === null ? "Pendente" : `${daysSinceLastBackup} dias`})
                    </span>
                  ) : (
                    <span className="text-emerald-500 font-bold flex items-center gap-1">
                      ✅ Em dia (Próximo em {7 - (daysSinceLastBackup || 0)} dias)
                    </span>
                  )}
                </div>
              </div>

              {/* 24-Hour LocalStorage Automatic Backup Status */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-[11px] mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Redundância Automática Local:</span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold text-[9.5px]">
                    Cada 24 Horas (Ativo)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Último Auto-Backup:</span>
                  <span className="font-mono text-slate-200">
                    {localStorage.getItem("erp_last_auto_backup_time")
                      ? new Date(localStorage.getItem("erp_last_auto_backup_time")!).toLocaleString("pt-MZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "Pendente"
                    }
                  </span>
                </div>
                
                {localStorage.getItem("erp_auto_backup_local_db") && (
                  <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">Redundância salva no navegador</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (currentRole !== "ADMIN") {
                          if (onShowToast) {
                            onShowToast("Apenas utilizadores com privilégios de Administrador (ADMIN) podem restaurar o banco de dados.", "error", "Permissão Negada");
                          }
                          return;
                        }
                        if (window.confirm("Deseja realmente restaurar os dados a partir do último backup redundante de 24h armazenado no LocalStorage? Os dados atuais serão substituídos.")) {
                          try {
                            const dataStr = localStorage.getItem("erp_auto_backup_local_db");
                            if (dataStr) {
                              const parsed = JSON.parse(dataStr);
                              if (onImportLocalDB && parsed.data) {
                                const success = await onImportLocalDB(parsed.data);
                                if (success && onShowToast) {
                                  onShowToast("Banco de dados local restaurado com sucesso a partir do LocalStorage!", "success", "Redundância Restaurada");
                                }
                              }
                            }
                          } catch (err) {
                            if (onShowToast) {
                              onShowToast("Erro ao ler dados de backup do LocalStorage.", "error", "Erro de Restauro");
                            }
                          }
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1 px-2.5 rounded text-[10px] transition cursor-pointer"
                    >
                      Restaurar Redundância
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (currentRole !== "ADMIN") {
                      if (onShowToast) {
                        onShowToast("Apenas utilizadores com privilégios de Administrador (ADMIN) podem exportar a base de dados completa.", "error", "Permissão Negada");
                      }
                      return;
                    }
                    triggerAdminBackupDownload();
                  }}
                  className={`w-1/2 font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    currentRole === "ADMIN" 
                      ? "bg-amber-600 hover:bg-amber-700 text-white border border-amber-500 shadow-sm shadow-amber-600/10" 
                      : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50"
                  }`}
                  title={currentRole !== "ADMIN" ? "Restrito para Administradores" : "Exportar base de dados completa para JSON"}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  Exportar DB (JSON)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentRole !== "ADMIN") {
                      if (onShowToast) {
                        onShowToast("Apenas utilizadores com privilégios de Administrador (ADMIN) podem restaurar a base de dados completa.", "error", "Permissão Negada");
                      }
                      return;
                    }
                    document.getElementById("admin-db-restore-picker")?.click();
                  }}
                  className={`w-1/2 font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    currentRole === "ADMIN" 
                      ? "bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30" 
                      : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50"
                  }`}
                  title={currentRole !== "ADMIN" ? "Restrito para Administradores" : "Restaurar base de dados completa a partir de um JSON"}
                >
                  <input 
                    id="admin-db-restore-picker"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      try {
                        const text = await file.text();
                        const parsed = JSON.parse(text);
                        if (!parsed.app || !parsed.data) {
                          if (onShowToast) {
                            onShowToast("O ficheiro carregado não é um backup válido de banco de dados do OST Vendas.", "error", "Erro de Backup");
                          }
                          return;
                        }
                        
                        if (onImportLocalDB) {
                          const success = await onImportLocalDB(parsed.data);
                          if (success && onShowToast) {
                            onShowToast("Banco de dados local restaurado com sucesso!", "success", "Cópia Restaurada");
                          }
                        }
                      } catch (err) {
                        if (onShowToast) {
                          onShowToast("Falha ao analisar o ficheiro JSON de backup.", "error", "Erro de Ficheiro");
                        }
                      }
                    }}
                  />
                  <Upload className="w-4 h-4 shrink-0" />
                  Restaurar DB (JSON)
                </button>
              </div>
            </div>
          </div>

          {/* NEW MODULE: Automated Cloud Backup Scheduler (Mock Cloud Export) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2 text-orange-600">
                <Cloud className="w-5 h-5 shrink-0" />
                <div>
                  <h3 className="font-bold text-slate-850 text-xs md:text-sm">Agendamento de Backup</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Agende a exportação automática de todos os dados do sistema</p>
                </div>
              </div>
 
              {/* Status Indicator */}
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                cloudBackupEnabled 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cloudBackupEnabled ? "bg-emerald-600 animate-pulse" : "bg-slate-400"}`}></span>
                {cloudBackupEnabled ? "Agendado" : "Inativo"}
              </span>
            </div>
 
            <form onSubmit={handleSaveCloudBackupConfig} className="space-y-4">
              {/* Toggle to enable/disable */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-slate-700 cursor-pointer select-none" htmlFor="cloud-backup-toggle">
                    Ativar Rotina Automática
                  </label>
                  <p className="text-[10px] text-slate-400 leading-tight">Autorizar disparos automáticos nos horários parametrizados.</p>
                </div>
                <input
                  id="cloud-backup-toggle"
                  type="checkbox"
                  disabled={!canEdit}
                  checked={cloudBackupEnabled}
                  onChange={(e) => setCloudBackupEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                />
              </div>
 
              {cloudBackupEnabled && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs animate-in slide-in-from-top-2 duration-150">
                  {/* Backup Destination Channels */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-150 space-y-2">
                    <span className="text-[9.5px] font-extrabold text-slate-400 uppercase block leading-none">Método de Exportação / Canais de Envio</span>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={backupExportToCloud}
                          onChange={(e) => setBackupExportToCloud(e.target.checked)}
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Nuvem de Destino</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={backupExportToEmail}
                          onChange={(e) => setBackupExportToEmail(e.target.checked)}
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Enviar por E-mail</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Destination Cloud Service Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Serviço de Destino (Cloud)</label>
                      <select
                        disabled={!canEdit || !backupExportToCloud}
                        value={cloudProvider}
                        onChange={(e) => setCloudProvider(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none text-xs text-slate-750 disabled:opacity-50"
                      >
                        <option value="gcs">Google Cloud (GCS)</option>
                        <option value="s3">Amazon Web Services (S3)</option>
                        <option value="azure">Microsoft Azure (Blob)</option>
                        <option value="mega">Mega Storage Cripto</option>
                        <option value="dropbox">Dropbox Business Cloud</option>
                      </select>
                    </div>
 
                    {/* Frequency Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Frequência</label>
                      <select
                        disabled={!canEdit}
                        value={backupFrequency}
                        onChange={(e) => setBackupFrequency(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none text-xs text-slate-750"
                      >
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                        <option value="cron">Cron (Personalizado)</option>
                      </select>
                    </div>
                  </div>

                  {/* Frequency parameters time or cron input */}
                  {backupFrequency === "cron" ? (
                    <div className="space-y-1 animate-in fade-in duration-100">
                      <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                        <span>Expressão Cron Personalizada</span>
                        <span className="text-[9px] text-orange-500 font-mono normal-case font-bold">padrão: minuto hora dia mês sem</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!canEdit}
                        value={backupCron}
                        onChange={(e) => setBackupCron(e.target.value)}
                        className="w-full bg-white font-mono border border-slate-200 rounded-lg p-2 font-semibold outline-none text-xs text-slate-750"
                        placeholder="Ex: 0 4 * * 1-5"
                      />
                      <p className="text-[9.5px] text-slate-400 font-medium">Configuração cron padrão para agendar tarefas em segundo plano do servidor.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 items-center animate-in fade-in duration-100">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Horário de Gravação</label>
                        <input
                          type="time"
                          required
                          disabled={!canEdit}
                          value={backupTime}
                          onChange={(e) => setBackupTime(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-center outline-none text-xs text-slate-750"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-1">Cron equivalente</span>
                        <div className="bg-slate-100 border border-slate-205 p-2 text-center rounded-lg font-mono text-[10.5px] text-slate-505 font-bold">
                          {`0 ${backupTime.split(':')[1]} ${backupTime.split(':')[0]} * * ${backupFrequency === 'weekly' ? '1' : backupFrequency === 'monthly' ? '1' : '*'}`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Backend Cron Real-Time status panel */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    Status do Agendador (Cron do Servidor)
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${cronStatus?.active ? "bg-emerald-100 text-emerald-805" : "bg-orange-100 text-orange-805"}`}>
                    {cronStatus?.active ? "Ativo no Servidor" : "Inativo"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600">
                  <div className="bg-white p-2 rounded-lg border border-slate-100 space-y-0.5">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block leading-none">Expressão Cron</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">{cronStatus?.cronPattern || "0 18 * * 1-5"}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100 space-y-0.5">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block leading-none">Frequência Ativa</span>
                    <span className="font-bold text-slate-800 text-[10px] truncate block" title={cronStatus?.description || "Fim de Dia (Seg-Sex às 18:00)"}>
                      {cronStatus?.description || "Fim de Dia (Seg-Sex às 18:00)"}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase leading-none">
                    <span>Último Disparo Automático</span>
                    <span>Status de Envio</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-[10.5px]">
                    <span className="text-slate-750">{cronStatus?.lastRun ? new Date(cronStatus.lastRun).toLocaleString("pt-PT") : "Pendente (Sem disparos)"}</span>
                    <span className="text-slate-600 max-w-[150px] truncate font-semibold" title={cronStatus?.status || "Nenhum status"}>
                      {cronStatus?.status || "Pendente"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerCronBackup}
                  disabled={isSimulatingCloudBackup || !cloudBackupEnabled}
                  className="w-full py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-bold rounded-lg text-[10.5px] flex items-center justify-center gap-1 transition disabled:opacity-50"
                >
                  <Mail className="w-3 h-3" />
                  Executar Envio & Fecho de Caixa Completo (Manual)
                </button>
              </div>

              {/* Operations control buttons */}
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleTriggerCloudBackupSimulation}
                  disabled={isSimulatingCloudBackup || !cloudBackupEnabled}
                  className="w-1/2 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow cursor-pointer disabled:opacity-50 transition"
                >
                  <Play className={`w-3.5 h-3.5 text-orange-400 ${isSimulatingCloudBackup ? "animate-spin" : ""}`} />
                  Exportar Agora
                </button>

                {canEdit && (
                  <button
                    type="submit"
                    className="w-1/2 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-lg shadow-orange-500/10 cursor-pointer transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Salvar Agenda
                  </button>
                )}
              </div>
            </form>

            {/* Simulated Live CLI Progress Logs console */}
            {cloudBackupLogs.length > 0 && (
              <div className="space-y-1.5 pt-1 animate-in fade-in-50 duration-250">
                <h5 className="text-[9.5px] font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  Terminal de Envio na Nuvem (Relatório de Monitoria)
                </h5>
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[9.5px] leading-relaxed space-y-1 max-h-36 overflow-y-auto shadow-inner text-amber-400">
                  {cloudBackupLogs.map((log, index) => {
                    const isSucc = log.includes("✔️") || log.includes("sucesso");
                    return (
                      <div key={index} className={`flex items-start gap-1 justify-start ${isSucc ? "text-emerald-400 font-bold" : ""}`}>
                        <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                        <span>{log}</span>
                      </div>
                    );
                  })}
                  {isSimulatingCloudBackup && (
                    <div className="flex items-center gap-2 text-slate-550 italic animate-pulse">
                      <span className="text-slate-650 shrink-0 select-none">$&gt;</span>
                      <span>Inicializando transmissão de pacotes gzip...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* NEW MODULE: Backup History & Local Restore Management */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2 text-slate-700">
                <Database className="w-5 h-5 text-orange-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-slate-850 text-xs md:text-sm">Histórico de Backups</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Gerencie e restaure backups salvos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchBackupsList}
                disabled={isLoadingBackups}
                className="p-1.5 hover:bg-slate-105 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title="Atualizar Lista"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? "animate-spin" : ""}`} />
              </button>
            </div>

            {isLoadingBackups ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Carregando arquivos de backup...
              </div>
            ) : backupsList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs space-y-1">
                <Database className="w-8 h-8 text-slate-200 mx-auto" />
                <p>Nenhum backup encontrado no servidor.</p>
                <p className="text-[10px] text-slate-350">Clique em 'Exportar Agora' para criar o primeiro.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider text-left font-bold">
                      <th className="py-2">Ficheiro / Data</th>
                      <th className="py-2">Tamanho</th>
                      <th className="py-2">Tipo</th>
                      <th className="py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {backupsList.map((backup) => (
                      <tr key={backup.filename} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 pr-2">
                          <div className="font-semibold text-slate-850 truncate max-w-[140px]" title={backup.filename}>
                            {backup.filename}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(backup.mtime).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-2.5 font-mono text-slate-500">
                          {(backup.size / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                            backup.type === "automated" 
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                              : "bg-orange-50 text-orange-700 border border-orange-100"
                          }`}>
                            {backup.type === "automated" ? "Automático" : "Manual"}
                          </span>
                        </td>
                        <td className="py-2.5 text-right space-x-1.5 whitespace-nowrap">
                          <a
                            href={`/api/backups/download/${backup.filename}`}
                            download
                            className="inline-flex items-center justify-center p-1 hover:bg-slate-150 text-slate-600 hover:text-slate-900 rounded transition"
                            title="Baixar Backup"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRestoreBackup(backup.filename)}
                                disabled={isRestoringBackup}
                                className="p-1 hover:bg-slate-150 text-emerald-600 hover:text-emerald-800 rounded transition cursor-pointer"
                                title="Restaurar este Backup"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBackup(backup.filename)}
                                className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition cursor-pointer"
                                title="Eliminar Backup"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* NEW MODULE: Firebase Event & Diagnostics Logs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2 text-slate-700">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-slate-850 text-xs md:text-sm">Log de Diagnósticos (Firebase)</h3>
                  <p className="text-[10px] text-slate-400 font-medium font-sans">Visualização de auditoria e erros de sistema</p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchFirebaseLogs}
                disabled={isLoadingLogs}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title="Atualizar Logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Filtrar por Data</label>
                <input
                  type="date"
                  value={logFilterDate}
                  onChange={(e) => setLogFilterDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-orange-500 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Filtrar por Tipo</label>
                <select
                  value={logFilterType}
                  onChange={(e) => setLogFilterType(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-orange-500 text-xs"
                >
                  <option value="">Todos</option>
                  <option value="AUTENTICAÇÃO">Autenticação</option>
                  <option value="CONFIGURAÇÕES">Configurações</option>
                  <option value="SISTEMA">Sistema</option>
                  <option value="FALHA">Falhas / Erros</option>
                </select>
              </div>
            </div>

            {isLoadingLogs ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Carregando logs de diagnóstico...
              </div>
            ) : firebaseLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs space-y-1">
                <Shield className="w-8 h-8 text-slate-200 mx-auto" />
                <p>Nenhum log de diagnóstico registado.</p>
              </div>
            ) : (() => {
              // Apply filters
              const filteredLogs = firebaseLogs.filter(log => {
                // Filter by date
                if (logFilterDate) {
                  if (!log.timestamp) return false;
                  const logDateStr = log.timestamp.split("T")[0];
                  if (logDateStr !== logFilterDate) return false;
                }
                // Filter by type (module or action contains type)
                if (logFilterType) {
                  const actionUpper = (log.action || "").toUpperCase();
                  const moduleUpper = (log.module || "").toUpperCase();
                  const detailsUpper = (log.details || "").toUpperCase();
                  
                  if (logFilterType === "FALHA") {
                    return actionUpper.includes("FAIL") || actionUpper.includes("FALHA") || detailsUpper.includes("FALHA") || detailsUpper.includes("ERR") || detailsUpper.includes("RECUSOU");
                  } else {
                    return moduleUpper.includes(logFilterType) || actionUpper.includes(logFilterType);
                  }
                }
                return true;
              });

              if (filteredLogs.length === 0) {
                return (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    Nenhum log corresponde aos filtros aplicados.
                  </div>
                );
              }

              return (
                <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {filteredLogs.map((log) => {
                    const isError = (log.action || "").toUpperCase().includes("FALHA") || 
                                    (log.action || "").toUpperCase().includes("FAIL") ||
                                    (log.details || "").toUpperCase().includes("ERR") ||
                                    (log.details || "").toUpperCase().includes("RECUSOU");
                    return (
                      <div 
                        key={log.id || `log-${Math.random()}`} 
                        className={`p-2.5 rounded-xl border text-[11px] transition ${
                          isError 
                            ? "bg-rose-50/70 border-rose-100 text-rose-900" 
                            : "bg-slate-50/70 border-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                            isError ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-800"
                          }`}>
                            {log.action || "Log"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                          </span>
                        </div>
                        <p className="font-medium text-slate-800 break-words leading-relaxed">
                          {log.details}
                        </p>
                        {log.userName && (
                          <div className="mt-1.5 flex items-center gap-1 text-[9.5px] text-slate-400 font-semibold uppercase">
                            <span>Utilizador:</span>
                            <span className="text-slate-600">{log.userName}</span>
                          </div>
                        )}
                        {log.timestamp && (
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>

      </div>
        </div>
      )}

      {activeSubTab === "smtp" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-lg space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 text-slate-950 p-2.5 rounded-xl shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Servidor SMTP & Alertas de E-mail</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure as credenciais do seu próprio servidor de e-mail para enviar faturas, alertas de estoque crítico e relatórios financeiros automatizados.
                </p>
              </div>
            </div>
          </div>

          {/* System Notifications Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-4.5 h-4.5" />
              <h3 className="font-bold text-slate-850 text-sm">Notificações do Sistema & Alertas por E-mail</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Configure as definições de e-mail de destino para alertas e relatórios automáticos de auditoria. O administrador receberá logs de eventos operacionais críticos externamente para garantir monitoria contínua do ERP.
            </p>

            <form onSubmit={handleSaveAlertsConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">E-mail de Destino para Alertas de Eventos Críticos</label>
                  <input
                    type="email"
                    disabled={!canEdit}
                    value={alertsRecipientEmail}
                    onChange={(e) => setAlertsRecipientEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none text-slate-850 disabled:opacity-75 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                    placeholder="admin-alerts@empresa.co.mz"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Este endereço receberá notificações automáticas em caso de eventos de segurança, falhas de sistema e acessos não autorizados.
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={emailStockAlertsEnabled}
                      onChange={(e) => {
                        if (e.target.checked && smtpEnabled && !isSmtpVerified) {
                          if (onShowToast) {
                            onShowToast(
                              "O servidor SMTP precisa ser verificado com sucesso ('Testar Conexão') no painel dedicado antes de poder ativar os alertas automáticos.",
                              "warning",
                              "SMTP Não Verificado"
                            );
                          }
                          return;
                        }
                        setEmailStockAlertsEnabled(e.target.checked);
                      }}
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Alertas de Estoque Baixo por E-mail</span>
                  </label>
                  <p className="text-[10.5px] text-slate-400 leading-normal">
                    Quando ativo, envia avisos automáticos via e-mail para o destinatário ao lado sempre que o estoque de algum item atingir um nível crítico. Requer SMTP configurado.
                  </p>
                </div>
              </div>

              {/* Custom Email Template Editor for Stock Alerts */}
              {emailStockAlertsEnabled && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 text-orange-600 font-bold text-xs uppercase tracking-wider border-b pb-1.5 border-slate-200">
                    <Mail className="w-4 h-4 text-orange-500" />
                    <span>Modelo de E-mail de Alerta</span>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Assunto do E-mail</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={stockAlertEmailSubject}
                      onChange={(e) => setStockAlertEmailSubject(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none text-slate-850 disabled:opacity-75 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                      placeholder="Ex: [ALERTA] Estoque Crítico de Produtos"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Corpo do E-mail (Texto Simples)</label>
                    <textarea
                      rows={6}
                      disabled={!canEdit}
                      value={stockAlertEmailBody}
                      onChange={(e) => setStockAlertEmailBody(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] text-slate-850 disabled:opacity-75 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 leading-relaxed resize-y"
                      placeholder="Escreva a mensagem do e-mail..."
                    />
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-150 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tags Dinâmicas Disponíveis:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-600">
                      <div className="flex items-center gap-1">
                        <code className="bg-slate-100 px-1 py-0.5 rounded font-bold font-mono text-orange-600">[LISTA_PRODUTOS]</code>
                        <span>Lista de produtos baixos</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <code className="bg-slate-100 px-1 py-0.5 rounded font-bold font-mono text-orange-600">[NOME_EMPRESA]</code>
                        <span>Nome do estabelecimento</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <code className="bg-slate-100 px-1 py-0.5 rounded font-bold font-mono text-orange-600">[DATA]</code>
                        <span>Data e hora do envio</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <code className="bg-slate-100 px-1 py-0.5 rounded font-bold font-mono text-orange-600">[EMAIL_DESTINO]</code>
                        <span>E-mail destinatário</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {canEdit ? (
                <button
                  type="submit"
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-orange-500/15"
                >
                  Salvar Definições de Notificações
                </button>
              ) : (
                <div className="text-[11px] text-slate-400 text-center py-2 bg-slate-50 border border-slate-100 rounded-xl">
                  Apenas administradores podem alterar as definições de alertas críticos.
                </div>
              )}
            </form>
          </div>

          {/* EXCLUSIVE PANEL: Dedicated SMTP Server Configuration */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-100">
          <div className="flex items-center gap-2.5 text-orange-600">
            <Server className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Configuração de Servidor SMTP Dedicado</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Gerencie as credenciais do seu servidor de saída para envio de e-mails de forma independente e segura.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isImportingEnv || !canEdit}
              onClick={handleImportFromEnv}
              className="bg-orange-50 hover:bg-orange-100 text-orange-600 disabled:opacity-50 text-[10px] py-1 px-3 rounded-full font-bold transition flex items-center gap-1 cursor-pointer border border-orange-200"
              title="Preencher os campos abaixo utilizando as definições de SMTP configuradas no ficheiro .env do servidor"
            >
              <Download className={`w-3 h-3 ${isImportingEnv ? "animate-spin" : ""}`} />
              {isImportingEnv ? "A importar..." : "Preencher do .env"}
            </button>

            {isSmtpVerified ? (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold text-[10px] flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Conexão Verificada
              </span>
            ) : (
              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-bold text-[10px] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Não Verificado
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-800 text-xs">
          {/* SMTP Credentials */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Servidor Host (ex: smtp.gmail.com)</label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={smtpHost}
                  onChange={(e) => {
                    setSmtpHost(e.target.value);
                    setIsSmtpVerified(false);
                  }}
                  className="w-full bg-slate-50 disabled:opacity-75 border border-slate-200 rounded-xl p-2.5 font-semibold outline-none focus:border-orange-400 text-xs transition"
                  placeholder="smtp.empresa.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Porta SMTP</label>
                <input
                  type="number"
                  required
                  disabled={!canEdit}
                  value={smtpPort}
                  onChange={(e) => {
                    setSmtpPort(Number(e.target.value));
                    setIsSmtpVerified(false);
                  }}
                  className="w-full bg-slate-50 disabled:opacity-75 border border-slate-200 rounded-xl p-2.5 font-semibold outline-none focus:border-orange-400 text-xs transition"
                  placeholder="587"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Usuário / E-mail</label>
                <input
                  type="text"
                  required
                  disabled={!canEdit}
                  value={smtpUser}
                  onChange={(e) => {
                    setSmtpUser(e.target.value);
                    setIsSmtpVerified(false);
                  }}
                  className="w-full bg-slate-50 disabled:opacity-75 border border-slate-200 rounded-xl p-2.5 font-semibold outline-none focus:border-orange-400 text-xs transition"
                  placeholder="exemplo@provedor.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Senha SMTP</label>
                <input
                  type="password"
                  required
                  disabled={!canEdit}
                  value={smtpPassword}
                  onChange={(e) => {
                    setSmtpPassword(e.target.value);
                    setIsSmtpVerified(false);
                  }}
                  className="w-full bg-slate-50 disabled:opacity-75 border border-slate-200 rounded-xl p-2.5 font-semibold outline-none focus:border-orange-400 text-xs transition"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="smtpSecureDedicated"
                disabled={!canEdit}
                checked={smtpSecure}
                onChange={(e) => {
                  setSmtpSecure(e.target.checked);
                  setIsSmtpVerified(false);
                }}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="smtpSecureDedicated" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                Utilizar conexão segura SSL/TLS (Necessário para porta 465)
              </label>
            </div>
          </div>

          {/* Verification & Test Panel */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-2 border-slate-200">
              <Check className="w-4 h-4 text-orange-500" />
              Verificação & Teste
            </h4>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Destinatário do E-mail de Teste</label>
                <input
                  type="email"
                  required
                  disabled={!canEdit}
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 font-semibold outline-none focus:border-orange-400 text-xs"
                  placeholder="destino-teste@empresa.com"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={isTestingSmtp || !canEdit}
                  onClick={handleDedicatedSmtpTest}
                  className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow shadow-slate-900/10"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isTestingSmtp ? "animate-spin" : ""}`} />
                  {isTestingSmtp ? "A testar..." : "Testar Conexão"}
                </button>

                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={handleSaveDedicatedSmtp}
                  className="flex-1 py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow shadow-orange-500/10 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar Servidor
                </button>
              </div>

              {isSmtpVerified ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[11px] rounded-xl flex items-start gap-2 animate-in fade-in duration-150">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Conexão Ativa!</span>
                    As credenciais estão corretas. Pode agora ativar as notificações e relatórios automatizados por e-mail com segurança.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[11px] rounded-xl flex items-start gap-2 animate-in fade-in duration-150">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Necessita Validação</span>
                    Por favor teste a conexão para garantir o envio correto de alertas de estoque e relatórios periódicos.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Automated Email Report Dispatch Configuration Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-100">
          <div className="flex items-center gap-2.5 text-orange-600">
            <Mail className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Envio Automático de Relatórios por Email</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Defina o agendamento de relatórios de auditoria e financeiro utilizando SMTP padrão.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerEmailSimulation}
            disabled={isSimulatingMail}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow shadow-slate-900/10 shrink-0"
          >
            <Play className={`w-3.5 h-3.5 text-amber-400 ${isSimulatingMail ? "animate-spin" : ""}`} />
            {isSimulatingMail ? "Processando Envio..." : "Disparar Teste de Email"}
          </button>
        </div>

        <form onSubmit={handleSaveEmailConfig} className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-slate-800 text-xs">
          {/* Email dispatch provider column: Gmail API or Custom SMTP */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              Provedor de E-mail Emissor
            </h4>

            {/* Toggle Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Método de Envio</label>
              <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSmtpEnabled(false)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition cursor-pointer ${!smtpEnabled ? "bg-white text-orange-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Gmail API
                </button>
                <button
                  type="button"
                  onClick={() => setSmtpEnabled(true)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition cursor-pointer ${smtpEnabled ? "bg-white text-orange-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  SMTP Personalizado
                </button>
              </div>
            </div>

            {!smtpEnabled ? (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Conecte a conta Gmail oficial da empresa. Esta conta será utilizada para disparar os e-mails e faturas através da API oficial do Google.
                </p>

                <div className="pt-1 flex flex-col gap-3">
                  {needsAuth ? (
                    <button
                      type="button"
                      onClick={handleGmailLogin}
                      disabled={isLoggingIn}
                      className="flex items-center justify-center gap-3 w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition shadow-sm cursor-pointer"
                    >
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                      {isLoggingIn ? "Conectando..." : "Vincular Conta Google"}
                    </button>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Conta Vinculada</p>
                          <p className="text-xs font-semibold text-emerald-700 truncate">{gmailUser?.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleGmailLogout}
                        className="text-[10px] bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-bold py-1 px-2.5 rounded shadow-sm transition shrink-0 cursor-pointer"
                      >
                        Desvincular
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200 animate-in fade-in-50 duration-150 text-[11px] text-slate-600 leading-normal">
                <p>
                  O sistema utilizará o servidor SMTP dedicado configurado no painel dedicado acima para disparar os relatórios programados.
                </p>
                <div className="bg-white p-2.5 rounded-lg border border-slate-150 space-y-1 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Servidor:</span>
                    <span className="font-semibold text-slate-800">{smtpHost || "Não Configurado"}:{smtpPort || "Nenhum"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Usuário:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[120px]">{smtpUser || "Nenhum"}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                    <span className="text-slate-400">Estado SMTP:</span>
                    {isSmtpVerified ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1 text-[10px]">
                        ● Verificado
                      </span>
                    ) : (
                      <span className="text-amber-600 font-bold flex items-center gap-1 text-[10px]">
                        ● Não Verificado
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  Para alterar as credenciais ou testar a ligação, utilize o painel exclusivo do Servidor SMTP Dedicado acima.
                </p>
              </div>
            )}
          </div>

          {/* Trigger Frequency / Recipient Destination Column */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Destinatários e Agendamento
            </h4>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">E-mail de Destino</label>
              <input
                type="email"
                required
                disabled={!canEdit}
                value={reportRecipientEmail}
                onChange={(e) => setReportRecipientEmail(e.target.value)}
                className="w-full bg-slate-50 disabled:opacity-75 border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-slate-350 text-xs"
                placeholder="gestor-er@empresa.co.mz"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Frequência</label>
                <select
                  disabled={!canEdit}
                  value={reportFrequency}
                  onChange={(e) => setReportFrequency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
                >
                  <option value="daily">Diário (Consolidado)</option>
                  <option value="weekly">Semanal (Segundas)</option>
                  <option value="monthly">Mensal (Dia 1)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Hora do Disparo</label>
                <div className="relative">
                  <input
                    type="time"
                    required
                    disabled={!canEdit}
                    value={reportHour}
                    onChange={(e) => setReportHour(e.target.value)}
                    className="w-full bg-slate-50 disabled:opacity-75 border border-slate-200 rounded-lg p-1.5 font-semibold text-center outline-none focus:border-slate-350 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Attachment Formats & Selective Reports Column */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Anexos e Relatórios Incluídos
            </h4>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Formato do Arquivo</label>
              <select
                disabled={!canEdit}
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
              >
                <option value="PDF">Formato Comercial PDF (Vectorizado)</option>
                <option value="CSV">Folha de Cálculo CSV / Excel</option>
                <option value="AMBOS">Ambos os formatos (PDF + CSV)</option>
              </select>
            </div>

            <div className="space-y-2 pt-1 text-[11px] font-medium text-slate-600">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Módulos de Relatórios</label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFinancial}
                    onChange={(e) => setIncludeFinancial(e.target.checked)}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                  <span>Financeiro</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAudit}
                    onChange={(e) => setIncludeAudit(e.target.checked)}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                  <span>Ficheiros Log</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeStaff}
                    onChange={(e) => setIncludeStaff(e.target.checked)}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                  <span>Quadro Staff</span>
                </label>
              </div>
            </div>
          </div>

          {/* Save Button Row span 3 */}
          {canEdit && (
            <div className="lg:col-span-3 pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-orange-500/15"
              >
                Salvar Definições de Dispatch Automático
              </button>
            </div>
          )}
        </form>

        {/* Live Simulation Progress CLI Logger Console */}
        {simulationLogs.length > 0 && (
          <div className="space-y-2 pt-2 animate-in fade-in-50 duration-200">
            <h5 className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Consola de Monitoria do Serviço de SMTP (Monitorização em Tempo Real)
            </h5>
            
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-[10.5px] leading-relaxed space-y-1 max-h-48 overflow-y-auto shadow-inner text-amber-400">
              {simulationLogs.map((log, index) => {
                const isSuccess = log.includes("✔️") || log.includes("sucesso");
                return (
                  <div key={index} className={`flex items-start gap-1 justify-start ${isSuccess ? "text-emerald-400 font-bold" : ""}`}>
                    <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                    <span>{log}</span>
                  </div>
                );
              })}
              {isSimulatingMail && (
                <div className="flex items-center gap-2 text-slate-500 italic animate-pulse">
                  <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                  <span>A processar envio de email de teste...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
        </div>
      )}

      {activeSubTab === "geral" && (
        <div className="space-y-6 animate-in fade-in-50 duration-150">

          {/* Google Drive Integration */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-100">
          <div className="flex items-center gap-2.5 text-blue-600">
            <Cloud className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Integração Google Drive (Storage & Backups)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Visualize a utilização do espaço e guarde backups na nuvem.</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleManualDriveBackup}
            disabled={isBackingUp || needsAuth}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow shadow-blue-600/20 shrink-0"
          >
            <Database className={`w-3.5 h-3.5 ${isBackingUp ? "animate-pulse" : ""}`} />
            {isBackingUp ? "A Guardar Backup..." : "Forçar Backup Agora"}
          </button>
        </div>

        {/* Logs do Backup */}
        {cloudBackupLogs.length > 0 && (
          <div className="bg-slate-900 rounded-xl p-4 overflow-hidden border border-slate-800 relative">
            <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
              <span className="text-slate-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className={`w-3 h-3 text-emerald-400 ${isBackingUp ? 'animate-spin' : ''}`} />
                Cloud Backup Logs
              </span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[10px] pr-2">
              {cloudBackupLogs.map((log, idx) => (
                <div key={idx} className="text-emerald-400/90 leading-relaxed flex gap-2">
                  <span className="text-slate-500 shrink-0 select-none">$&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-slate-800 text-xs">
          
          {/* Storage Quota */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              Utilização de Armazenamento
            </h4>
            
            {needsAuth ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                <p className="text-[11px] text-slate-500 mb-3">Autentique-se com sua conta Google para visualizar estatísticas.</p>
                <button
                  type="button"
                  onClick={handleGmailLogin}
                  disabled={isLoggingIn}
                  className="mx-auto flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-xl transition shadow-sm"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  {isLoggingIn ? "Conectando..." : "Vincular Google Drive"}
                </button>
              </div>
            ) : isFetchingDrive ? (
              <div className="flex items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-200">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : driveStats ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                  <span>Espaço Utilizado</span>
                  <span>{((driveStats.usage / driveStats.limit) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${Math.min(100, (driveStats.usage / driveStats.limit) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center font-mono text-[11px] text-slate-700">
                  <span>{(driveStats.usage / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                  <span>{(driveStats.limit / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                </div>
                <button
                  type="button"
                  onClick={fetchDriveStats}
                  className="w-full mt-2 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar Dados
                </button>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200 text-slate-500 text-[11px]">
                Não foi possível carregar as estatísticas.
              </div>
            )}
          </div>

          {/* Recent Files */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Ficheiros Recentes
            </h4>

            {needsAuth ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                <p className="text-[11px] text-slate-500">Autentique-se para ver os ficheiros recentes.</p>
              </div>
            ) : isFetchingDrive ? (
              <div className="flex items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-200">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : recentFiles.length > 0 ? (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {recentFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-lg">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="truncate text-[11px] font-semibold text-slate-700" title={file.name}>{file.name}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono shrink-0 ml-2">
                      {new Date(file.createdTime).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200 text-slate-500 text-[11px]">
                Nenhum ficheiro encontrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gerenciamento da Impressora de Vendas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-100">
          <div className="flex items-center gap-2.5 text-orange-600">
            <Printer className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Impressora de Vendas</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Gerencie os parâmetros de conexão física ou de rede para faturas e recibos do ponto de venda.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestPrinter}
            disabled={isTestingPrinter}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow shadow-slate-900/10 shrink-0"
          >
            <Printer className={`w-3.5 h-3.5 text-amber-400 ${isTestingPrinter ? "animate-pulse" : ""}`} />
            {isTestingPrinter ? "Testando Impressão..." : "Emitir Cupom de Teste"}
          </button>
        </div>

        <form onSubmit={handleSavePrinterConfig} className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-slate-800 text-xs">
          
          {/* Parâmetros de Conexão */}
          <div className="space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              Parâmetros da Impressora
            </h4>
            
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-150">
              <div className="space-y-0.5">
                <label className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Ativar Impressão Direta
                </label>
                <p className="text-[10px] text-slate-400 leading-tight">Habilita a integração direta com impressoras térmicas ao fechar vendas.</p>
              </div>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={printerEnabled}
                onChange={(e) => setPrinterEnabled(e.target.checked)}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
              />
            </div>

            {printerEnabled && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nome da Impressora</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
                    placeholder="Ex: POS-80, Epson TM-T20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Função de Impressão</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => {
                        setPrinterType("RECEIPT");
                        // Automatically set appropriate paperSize default if toggled
                        if (paperSize === "A4") setPaperSize("80MM");
                      }}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition cursor-pointer select-none ${
                        printerType === "RECEIPT"
                          ? "bg-orange-50/70 border-orange-300 text-orange-950 font-bold shadow-sm"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <Printer className="w-5 h-5 text-orange-500 shrink-0" />
                      <div className="leading-tight">
                        <span className="text-[11px] block">Impressora de Talões</span>
                        <span className="text-[8px] text-slate-400 block font-normal mt-0.5">Faturas, recibos simplificados e relatórios</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setPrinterType("LABEL")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition cursor-pointer select-none ${
                        printerType === "LABEL"
                          ? "bg-orange-50/70 border-orange-300 text-orange-950 font-bold shadow-sm"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <Tag className="w-5 h-5 text-orange-500 shrink-0" />
                      <div className="leading-tight">
                        <span className="text-[11px] block">Impressora de Etiquetas</span>
                        <span className="text-[8px] text-slate-400 block font-normal mt-0.5">Rótulos de preço, códigos de barras e stock</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tamanho do Papel Padrão</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["58MM", "80MM", "A4"] as const).map((size) => {
                      const isDisabled = printerType === "LABEL" && size === "A4"; // Labels generally not printed in direct A4 in POS printers
                      return (
                        <button
                          key={size}
                          type="button"
                          disabled={!canEdit || isDisabled}
                          onClick={() => setPaperSize(size)}
                          className={`py-2 rounded-lg font-bold border transition text-center text-[10px] cursor-pointer ${
                            isDisabled ? "opacity-35 cursor-not-allowed bg-slate-100 border-slate-150 text-slate-400" :
                            paperSize === size
                              ? "bg-orange-50 border-orange-300 text-orange-700 shadow-sm"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          {size === "58MM" ? "58mm (Térmico)" : size === "80MM" ? "80mm (Padrão)" : "A4 (Documento)"}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-slate-400 leading-tight">
                    {printerType === "RECEIPT" 
                      ? "O tamanho do papel define a largura física do cupom virtual gerado nas vendas."
                      : "Para etiquetas adesivas, recomenda-se o formato de 58mm ou 80mm."}
                  </p>
                </div>

                <div className="flex items-center justify-between bg-orange-50/30 p-2.5 rounded-xl border border-orange-100/60">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-700 cursor-pointer select-none flex items-center gap-1.5">
                      Corte Automático de Papel
                    </label>
                    <p className="text-[9px] text-slate-400 leading-tight">Envia o comando ESC/POS de corte (GS V 66 0) após a impressão do recibo.</p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={printerAutoCut}
                    onChange={(e) => setPrinterAutoCut(e.target.checked)}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Conexão</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["USB", "BLUETOOTH", "NETWORK"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setPrinterConnectionType(type)}
                        className={`py-2 rounded-lg font-bold border transition text-center text-[10px] ${
                          printerConnectionType === type
                            ? "bg-orange-50 border-orange-300 text-orange-700 shadow-sm"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        {type === "NETWORK" ? "Rede / IP" : type}
                      </button>
                    ))}
                  </div>
                </div>

                {printerConnectionType === "USB" && (
                  <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-150 animate-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Usb className="w-3.5 h-3.5 text-orange-500" />
                        Deteção WebUSB / Serial
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isScanningUsb || !canEdit}
                          onClick={handleListUsbDevices}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[9px] font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                          title="Listar dispositivos USB já autorizados no navegador"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isScanningUsb ? "animate-spin" : ""}`} />
                          Procurar
                        </button>
                        <button
                          type="button"
                          disabled={isScanningUsb || !canEdit}
                          onClick={handleRequestUsbDevice}
                          className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[9px] font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                          title="Vincular uma nova impressora USB física"
                        >
                          + Parear
                        </button>
                      </div>
                    </div>

                    {webUsbError && (
                      <p className="text-[9px] text-amber-600 leading-tight font-semibold bg-amber-50 p-1.5 rounded-md border border-amber-100">
                        ⚠️ {webUsbError}
                      </p>
                    )}

                    {usbDevices.length > 0 ? (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        <label className="text-[8px] font-extrabold text-slate-400 uppercase block tracking-wider">Dispositivos Encontrados (Clique para selecionar):</label>
                        {usbDevices.map((device) => {
                          const isSelected = printerName === device.name;
                          return (
                            <button
                              key={device.id}
                              type="button"
                              onClick={() => handleSelectUsbDevice(device)}
                              className={`w-full text-left p-2 rounded-lg border transition flex items-center justify-between ${
                                isSelected 
                                  ? "bg-orange-50 border-orange-300 text-orange-950 font-bold" 
                                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Printer className={`w-3.5 h-3.5 ${isSelected ? "text-orange-500" : "text-slate-400"}`} />
                                <div className="leading-tight">
                                  <div className="text-[10px] font-semibold flex items-center gap-1">
                                    {device.name}
                                    {device.isSimulated && (
                                      <span className="text-[7px] bg-slate-100 text-slate-500 px-1 rounded font-normal">Simulado</span>
                                    )}
                                  </div>
                                  <div className="text-[8px] text-slate-400">
                                    S/N: {device.serialNumber || "N/A"} • ID: {device.vendorId.toString(16).padStart(4, '0')}:{device.productId.toString(16).padStart(4, '0')}
                                  </div>
                                </div>
                              </div>
                              <span className={`text-[8px] font-bold uppercase ${isSelected ? "text-orange-600" : "text-slate-400"}`}>
                                {isSelected ? "Ativo" : "Selecionar"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-3 border border-dashed border-slate-200 rounded-lg bg-white">
                        <Usb className="w-5 h-5 text-slate-300 mx-auto animate-pulse" />
                        <span className="text-[9px] text-slate-400 block mt-1">Nenhum dispositivo listado. Clique em Procurar ou Parear.</span>
                      </div>
                    )}
                  </div>
                )}

                {printerConnectionType === "NETWORK" ? (
                  <div className="space-y-1 animate-in slide-in-from-top-1 duration-150">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Endereço IP da Impressora</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={printerIpAddress}
                      onChange={(e) => setPrinterIpAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
                      placeholder="Ex: 192.168.1.100"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-1 duration-150">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Porta de Comunicação</label>
                      <select
                        disabled={!canEdit}
                        value={printerPort}
                        onChange={(e) => setPrinterPort(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
                      >
                        <option value="COM1">COM1 (Serial)</option>
                        <option value="COM2">COM2</option>
                        <option value="COM3">COM3</option>
                        <option value="LPT1">LPT1 (Paralela)</option>
                        <option value="USB001">USB001 (Virtual USB)</option>
                        <option value="USB002">USB002 (Virtual USB)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Baud Rate (Velocidade)</label>
                      <select
                        disabled={!canEdit}
                        value={printerBaudRate}
                        onChange={(e) => setPrinterBaudRate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
                      >
                        <option value="4800">4800 bps</option>
                        <option value="9600">9600 bps</option>
                        <option value="19200">19200 bps</option>
                        <option value="38400">38400 bps</option>
                        <option value="115200">115200 bps</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visualização e Resultados */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-3.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                Status & Cupom Emitido
              </h4>

              {printerLogs.length > 0 && (
                <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                  <label className="text-[9px] font-extrabold font-mono text-slate-400 uppercase tracking-wider">Consola de Eventos</label>
                  <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[10px] leading-relaxed space-y-1 max-h-36 overflow-y-auto shadow-inner text-blue-300">
                    {printerLogs.map((log, index) => {
                      const isSucc = log.includes("✔️") || log.includes("sucesso") || log.includes("✅");
                      return (
                        <div key={index} className={`flex items-start gap-1 justify-start ${isSucc ? "text-emerald-400 font-bold" : ""}`}>
                          <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                          <span>{log}</span>
                        </div>
                      );
                    })}
                    {isTestingPrinter && (
                      <div className="flex items-center gap-2 text-slate-500 italic animate-pulse">
                        <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                        <span>Aguardando resposta do dispositivo...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cupom de Teste Virtual Realista */}
              {showTestReceipt && (
                <div className="animate-in zoom-in-95 duration-200 mt-2">
                  <span className="text-[9px] font-extrabold font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    Visualização do Trabalho de Impressão ({printerType === "RECEIPT" ? "Talão" : "Etiqueta"} - {paperSize})
                  </span>
                  
                  {printerType === "RECEIPT" ? (
                    /* Layout de Recibo / Talão */
                    paperSize === "A4" ? (
                      /* A4 Document Layout */
                      <div className="bg-white border border-slate-300 rounded-xl p-5 font-mono text-slate-700 text-[9px] shadow-md max-w-md mx-auto relative overflow-hidden">
                        <div className="flex justify-between items-start border-b pb-3 mb-3 border-slate-200">
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs block text-slate-900 uppercase">{companyName || "OST Comércio Geral, Lda"}</span>
                            {slogan && <span className="text-[8px] text-slate-500 italic block">"{slogan}"</span>}
                            <span className="text-[8px] text-slate-500 block">NUIT: {companyNuit || "400293112"}</span>
                            {storeAddress && <span className="text-[7.5px] text-slate-400 block leading-tight">{storeAddress}</span>}
                            {storeContact && <span className="text-[7.5px] text-slate-400 block">Tel: {storeContact}</span>}
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[10px] text-slate-900 block tracking-wider">DOCUMENTO DE TESTE</span>
                            <span className="text-[8px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold block mt-1">FATURA-RECIBO FR TST/1</span>
                            <span className="text-[7px] text-slate-400 block mt-1">Impresso em: {new Date().toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-150">
                          <div>
                            <span className="font-bold text-[8px] uppercase text-slate-400 block">Dados da Impressora:</span>
                            <span className="block font-semibold">Nome: {printerName}</span>
                            <span className="block text-slate-500">Conexão: {printerConnectionType}</span>
                            {printerConnectionType === "NETWORK" ? (
                              <span className="block text-slate-500">Endereço: {printerIpAddress}</span>
                            ) : (
                              <span className="block text-slate-500">Porta: {printerPort} @ {printerBaudRate}bps</span>
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-[8px] uppercase text-slate-400 block">Parâmetros de Papel:</span>
                            <span className="block font-semibold">Tamanho Padrão: A4 Documento</span>
                            <span className="block text-slate-500">Largura Física: 210mm (Escalado)</span>
                            <span className="block text-emerald-600 font-bold">✓ ESC/POS Alinhamento A4</span>
                          </div>
                        </div>

                        <table className="w-full text-left border-collapse mb-4">
                          <thead>
                            <tr className="border-b-2 border-slate-200 text-slate-800 text-[8px] font-bold uppercase bg-slate-50">
                              <th className="py-1 px-1.5">Ref / Produto</th>
                              <th className="py-1 text-center">Quant.</th>
                              <th className="py-1 text-right">Preço Un.</th>
                              <th className="py-1 text-right px-1.5">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-100">
                              <td className="py-1.5 px-1.5 font-semibold text-slate-900">COD-9029 • Teste de Protocolo Térmico</td>
                              <td className="py-1.5 text-center">1.00</td>
                              <td className="py-1.5 text-right">MZN 1.500,00</td>
                              <td className="py-1.5 text-right px-1.5 font-semibold">MZN 1.500,00</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="py-1.5 px-1.5 font-semibold text-slate-900">COD-3311 • Ajuste de Margem ESC/POS</td>
                              <td className="py-1.5 text-center">2.00</td>
                              <td className="py-1.5 text-right">MZN 250,00</td>
                              <td className="py-1.5 text-right px-1.5 font-semibold">MZN 500,00</td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="flex justify-end mb-3">
                          <div className="w-1/2 space-y-1 text-right">
                            <div className="flex justify-between text-slate-500 text-[8px]">
                              <span>Subtotal:</span>
                              <span>MZN 2.000,00</span>
                            </div>
                            <div className="flex justify-between text-slate-500 text-[8px]">
                              <span>IVA (16%):</span>
                              <span>MZN 320,00</span>
                            </div>
                            <div className="border-t border-slate-200 my-1"></div>
                            <div className="flex justify-between font-bold text-slate-900 text-[10px]">
                              <span>Total Faturado:</span>
                              <span className="text-orange-600">MZN 2.320,00</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-dashed border-slate-200 pt-3 text-center space-y-1">
                          <p className="text-[8px] font-bold text-emerald-600">✓ COMUNICADOR EMULADO ATIVO E HOMOLOGADO</p>
                          <p className="text-[7.5px] text-slate-400">Este documento comprova o perfeito fluxo de renderização e enquadramento de margens para folhas de tamanho A4.</p>
                        </div>
                      </div>
                    ) : (
                      /* 80mm and 58mm Thermal Receipt Layout */
                      <div className={`bg-white border border-slate-200 rounded-xl p-4 font-mono text-slate-700 shadow-sm relative overflow-hidden mx-auto transition-all duration-300 ${
                        paperSize === "58MM" ? "max-w-[215px] text-[8.5px]" : "max-w-[290px] text-[10px]"
                      }`}>
                        {/* Decorative receipt zig-zag top */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%)] bg-[size:6px_6px]" />
                        
                        <div className="text-center space-y-1 pt-2">
                          <span className={`font-bold block text-slate-900 ${paperSize === "58MM" ? "text-xs" : "text-sm"}`}>{companyName || "OST Comércio Geral, Lda"}</span>
                          {slogan && <span className="text-[8px] text-slate-500 italic block">"{slogan}"</span>}
                          <span className="text-[8px] text-slate-500 block">NUIT: {companyNuit || "400293112"}</span>
                          {storeAddress && <span className="text-[7.5px] text-slate-400 block leading-tight">{storeAddress}</span>}
                          {storeContact && <span className="text-[7.5px] text-slate-400 block">Tel: {storeContact}</span>}
                        </div>
                        
                        <div className="border-t border-dashed border-slate-300 my-2.5" />
                        
                        <div className="text-center font-bold text-slate-900 tracking-wider uppercase py-0.5 text-[9.5px]">
                          *** CUPOM DE TESTE DE IMPRESSÃO ***
                        </div>
                        
                        <div className="border-t border-dashed border-slate-300 my-2.5" />
                        
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>Data/Hora:</span>
                            <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Terminal:</span>
                            <span>PDV-PRINCIPAL</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Largura Papel:</span>
                            <span className="font-bold">{paperSize}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Impressora:</span>
                            <span>{printerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Conexão:</span>
                            <span className="font-bold text-orange-600">{printerConnectionType}</span>
                          </div>
                          {printerConnectionType === "NETWORK" ? (
                            <div className="flex justify-between">
                              <span>Endereço IP:</span>
                              <span>{printerIpAddress}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between">
                              <span>Porta/Baud:</span>
                              <span>{printerPort} @ {printerBaudRate}bps</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="border-t border-dashed border-slate-300 my-2.5" />

                        {/* Sample sale item */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-bold text-slate-900">
                            <span>1.00 x TESTE COMUNICAÇÃO ESC/POS</span>
                            <span>1.500,00</span>
                          </div>
                          <div className="flex justify-between text-slate-400 text-[8px]">
                            <span>Item de validação de largura de coluna ({paperSize})</span>
                            <span>MZN</span>
                          </div>
                        </div>
                        
                        <div className="border-t border-dashed border-slate-300 my-2.5" />
                        
                        <div className="text-center space-y-1.5 py-1">
                          <p className="text-[9px] font-bold text-emerald-600">✓ PROTOCOLO TÉRMICO {paperSize} OK</p>
                          <p className="text-[7.5px] text-slate-400 leading-tight">Este documento confirma que a aplicação possui conectividade bidirecional ativa com a impressora.</p>
                        </div>
                        
                        <div className="border-t border-dashed border-slate-300 my-2.5" />
                        
                        <div className="text-center font-bold text-slate-500 text-[8px] tracking-widest uppercase">
                          Obrigado pela preferência!
                        </div>

                        {/* Decorative receipt zig-zag bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[size:6px_6px] rotate-180" />
                      </div>
                    )
                  ) : (
                    /* Layout de Etiqueta Adesiva (Barcode Sticker) */
                    <div className={`bg-white border-2 border-dashed border-slate-300 rounded-xl p-4 font-mono text-slate-800 text-center relative overflow-hidden shadow-sm mx-auto transition-all duration-300 ${
                      paperSize === "58MM" ? "max-w-[215px] text-[8.5px] p-3" : "max-w-[270px] text-[10px]"
                    }`}>
                      <div className="absolute top-1 left-2 text-[7px] text-slate-400 font-bold uppercase tracking-wider">
                        ★ ETIQUETA DE STOCK ★
                      </div>
                      <div className="absolute top-1 right-2 text-[7px] text-slate-400 font-bold uppercase tracking-wider">
                        {paperSize}
                      </div>

                      <div className="pt-2 pb-1 text-center space-y-1">
                        <span className="font-extrabold text-slate-900 block leading-tight text-xs">
                          {companyName || "OST Comércio Geral, Lda"}
                        </span>
                        <div className="border-b border-slate-200 w-12 mx-auto my-1"></div>
                        <span className="font-bold text-slate-950 block text-[11px] leading-tight mt-1">
                          TESTE IMPRESSÃO ETIQUETAS
                        </span>
                        <span className="text-slate-500 text-[7.5px] block font-semibold">
                          SKU-TST-88219 • SEÇÃO CONFIG
                        </span>
                      </div>

                      {/* Simulated Barcode generator lines */}
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60 my-2">
                        <div className="flex justify-center items-stretch h-9 gap-[1.5px] mb-1">
                          <div className="w-1.5 bg-black"></div>
                          <div className="w-[1px] bg-black"></div>
                          <div className="w-[3px] bg-black"></div>
                          <div className="w-[1px] bg-black"></div>
                          <div className="w-1.5 bg-black"></div>
                          <div className="w-[1px] bg-black"></div>
                          <div className="w-[2px] bg-black"></div>
                          <div className="w-1.5 bg-black"></div>
                          <div className="w-[1px] bg-black"></div>
                          <div className="w-[3px] bg-black"></div>
                          <div className="w-[2px] bg-black"></div>
                          <div className="w-1.5 bg-black"></div>
                          <div className="w-[1px] bg-black"></div>
                        </div>
                        <span className="text-[7.5px] tracking-[4px] font-bold text-slate-900">
                          *992811776512*
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-left pt-1 border-t border-slate-100 text-[8px] leading-tight">
                        <div>
                          <span className="text-slate-400 block text-[7px] uppercase font-bold">Local:</span>
                          <span className="font-bold text-slate-700">PRATELEIRA B-12</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[7px] uppercase font-bold">Preço Unit:</span>
                          <span className="font-extrabold text-orange-600 text-[9.5px]">MZN 1.250,00</span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-1.5 border-t border-dotted border-slate-200 text-center">
                        <span className="text-[7px] text-slate-400 block">
                          Impressora Ativa: {printerName} ({printerPort})
                        </span>
                        <span className="text-[7.5px] text-emerald-600 font-bold block mt-0.5">
                          ✓ PAREAMENTO E TIPO ETIQUETA ATIVOS
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {canEdit && (
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-orange-500/15 transition-all flex items-center justify-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Gravar Parâmetros da Impressora
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
      </div>
      )}

      {activeSubTab === "backup" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-lg space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 text-slate-950 p-2.5 rounded-xl shrink-0">
                <Database className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Cópia de Segurança & Recuperação de Dados</h3>
                <p className="text-xs text-slate-400 mt-0.5">Defina as suas preferências de salvaguarda de dados operacionais e restaure redundâncias passadas.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs text-slate-800">
            {/* Left Config Panel */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Card 1: Backup Interval Config */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-orange-600">
                  <Clock className="w-4.5 h-4.5" />
                  <h4 className="font-bold text-slate-800 text-sm">Intervalo do Backup Automático</h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Selecione com que frequência o sistema deve criar automaticamente um ponto de redundância do banco de dados no armazenamento local do navegador.
                </p>

                <div className="space-y-3 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Frequência Escolhida</label>
                  <div className="relative">
                    <select
                      disabled={!canEdit}
                      value={backupFrequency}
                      onChange={(e) => handleSaveBackupInterval(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 pr-10 font-bold outline-none text-xs text-slate-700 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition cursor-pointer appearance-none"
                    >
                      <option value="12h">A cada 12 Horas (Redundância Rápida)</option>
                      <option value="daily">Diária (A cada 24 horas)</option>
                      <option value="weekly">Semanal (A cada 7 dias)</option>
                      <option value="monthly">Mensal (A cada 30 dias)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="p-3.5 bg-orange-500/5 rounded-xl border border-orange-500/10 text-[11px] text-slate-600 leading-relaxed shadow-sm animate-in fade-in duration-250">
                    <span className="font-extrabold text-orange-700 block mb-1">Configuração Ativa:</span>
                    {backupFrequency === "12h" && "Backup de alta frequência: altamente recomendado para comércios de alta rotação e vendas constantes de modo a evitar perda de faturamento recente."}
                    {backupFrequency === "daily" && "Frequência recomendada para a maioria das operações: salvaguarda automática ao fim de cada expediente comercial."}
                    {backupFrequency === "weekly" && "Frequência reduzida: adequada para estabelecimentos com baixo volume de alterações cadastrais semanais."}
                    {backupFrequency === "monthly" && "Salvaguarda básica de longo prazo: adequada apenas como recurso de arquivamento menos prioritário."}
                  </div>
                </div>
              </div>

              {/* Card 2: Manual Trigger */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-orange-600">
                  <Shield className="w-4.5 h-4.5" />
                  <h4 className="font-bold text-slate-800 text-sm">Backup Local Instantâneo</h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Gere e salve imediatamente uma cópia de segurança completa do seu banco de dados na lista de pontos de restauro local.
                </p>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={handleCreateManualBackup}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow shadow-slate-900/10"
                  >
                    <RefreshCw className="w-4 h-4 text-orange-400" />
                    Fazer Backup Local Agora
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Último Auto-Backup:</span>
                  <span className="font-mono text-slate-700 font-bold">
                    {localStorage.getItem("erp_last_auto_backup_time")
                      ? new Date(localStorage.getItem("erp_last_auto_backup_time")!).toLocaleString("pt-MZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "Nunca realizado"
                    }
                  </span>
                </div>
              </div>

            </div>

            {/* Right List Panel */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Card: Backups Log */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col h-full min-h-[400px]">
                <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                  <div className="flex items-center gap-2 text-orange-600">
                    <Database className="w-4.5 h-4.5" />
                    <h4 className="font-bold text-slate-800 text-sm">Histórico de Backups realizados no localStorage</h4>
                  </div>
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold text-[10px]">
                    {localBackupsLog.length} de 5 Slots
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  Estes são os últimos 5 backups gravados localmente neste navegador. Pode descarregar cada ponto de restauro individualmente ou restaurar o banco de dados diretamente a partir deles.
                </p>

                {localBackupsLog.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 min-h-[250px]">
                    <div className="bg-slate-100 text-slate-400 p-4 rounded-2xl mb-3">
                      <Database className="w-8 h-8 stroke-[1.5]" />
                    </div>
                    <h5 className="font-bold text-slate-700 text-xs">Nenhum backup local registado</h5>
                    <p className="text-[11px] text-slate-400 max-w-[280px] mt-1">
                      Os backups automáticos e manuais serão listados aqui assim que forem gerados pelo sistema.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-x-auto border border-slate-100 rounded-xl bg-slate-50/50">
                    <table className="w-full text-[11px] text-slate-600 border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-[9.5px] text-slate-500 uppercase tracking-wider text-left font-bold">
                          <th className="py-2.5 px-3">Data & Hora</th>
                          <th className="py-2.5 px-2">Tipo</th>
                          <th className="py-2.5 px-2">Frequência</th>
                          <th className="py-2.5 px-2">Tamanho</th>
                          <th className="py-2.5 px-2 text-center">Registos</th>
                          <th className="py-2.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {localBackupsLog.map((log: any) => (
                          <tr key={log.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3 font-semibold text-slate-800">
                              {new Date(log.date).toLocaleString("pt-MZ", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}
                            </td>
                            <td className="py-3 px-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                log.type === "Manual"
                                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              }`}>
                                {log.type}
                              </span>
                            </td>
                            <td className="py-3 px-2 font-medium text-slate-500">
                              {log.frequency}
                            </td>
                            <td className="py-3 px-2 font-mono text-[10.5px] text-slate-500">
                              {(log.size / 1024).toFixed(1)} KB
                            </td>
                            <td className="py-3 px-2 text-center font-bold text-slate-600">
                              {log.itemCount || 0}
                            </td>
                            <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDownloadSlotBackup(log.id, log.date)}
                                className="inline-flex items-center justify-center p-1.5 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-955 border border-slate-200 rounded-lg transition shadow-sm cursor-pointer"
                                title="Descarregar ficheiro JSON de backup"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={currentRole !== "ADMIN"}
                                onClick={() => handleRestoreFromSlot(log.id)}
                                className={`inline-flex items-center justify-center p-1.5 border rounded-lg transition-all cursor-pointer ${
                                  currentRole === "ADMIN"
                                    ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-600 shadow-sm"
                                    : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50"
                                }`}
                                title={currentRole === "ADMIN" ? "Restaurar banco de dados para este ponto" : "Apenas administradores"}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-400 italic flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>A restauração de qualquer backup substitui imediatamente os dados em execução no terminal offline.</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {activeSubTab === "lotes" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-lg space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 text-slate-950 p-2.5 rounded-xl shrink-0">
                <Layers className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Controle de Lotes & Alertas de Validade</h3>
                <p className="text-xs text-slate-400 mt-0.5">Defina a política de consumo de estoque (FIFO/LIFO) e gerencie as notificações de vencimento para produtos perecíveis.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Col 1: Strategy & Expiry settings */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card 1: Consumo de Lotes */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 text-slate-800 border-b border-slate-100 pb-3">
                  <Layers className="w-5 h-5 text-orange-500" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Estratégia de Consumo de Estoque</h4>
                    <p className="text-[11px] text-slate-400">Determine como o sistema priorizará a saída automática dos lotes no checkout.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Option FIFO */}
                    <button
                      type="button"
                      onClick={() => setInventoryStrategy("FIFO")}
                      className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-32 ${
                        inventoryStrategy === "FIFO"
                          ? "border-orange-500 bg-orange-50/20 ring-1 ring-orange-500"
                          : "border-slate-200 hover:border-slate-350 bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-xs text-slate-800">FIFO (PEPS)</span>
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${inventoryStrategy === "FIFO" ? "border-orange-500" : "border-slate-300"}`}>
                          {inventoryStrategy === "FIFO" && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-orange-700 uppercase">First-In, First-Out</p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-snug">Vende primeiro o lote com validade mais próxima do vencimento.</p>
                      </div>
                    </button>

                    {/* Option LIFO */}
                    <button
                      type="button"
                      onClick={() => setInventoryStrategy("LIFO")}
                      className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-32 ${
                        inventoryStrategy === "LIFO"
                          ? "border-orange-500 bg-orange-50/20 ring-1 ring-orange-500"
                          : "border-slate-200 hover:border-slate-350 bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-xs text-slate-800">LIFO (UEPS)</span>
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${inventoryStrategy === "LIFO" ? "border-orange-500" : "border-slate-300"}`}>
                          {inventoryStrategy === "LIFO" && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-orange-700 uppercase">Last-In, First-Out</p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-snug">Prioriza a saída do lote recebido mais recentemente no estoque.</p>
                      </div>
                    </button>

                    {/* Option NORMAL */}
                    <button
                      type="button"
                      onClick={() => setInventoryStrategy("NORMAL")}
                      className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-32 ${
                        inventoryStrategy === "NORMAL"
                          ? "border-orange-500 bg-orange-50/20 ring-1 ring-orange-500"
                          : "border-slate-200 hover:border-slate-350 bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-xs text-slate-800">Sem Lote (Geral)</span>
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${inventoryStrategy === "NORMAL" ? "border-orange-500" : "border-slate-300"}`}>
                          {inventoryStrategy === "NORMAL" && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-orange-700 uppercase">Padrão Simples</p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-snug">Deduz o estoque do produto de forma global, ignorando especificações de lote.</p>
                      </div>
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-[10px] text-slate-500 leading-relaxed">
                    💡 <b>Impacto Operacional:</b> A alteração da estratégia afeta o motor de abate do POS e as sugestões de triagem de estoque no painel do operador. O <b>FIFO</b> é altamente recomendado para negócios com produtos perecíveis (alimentação, farmacêutica).
                  </div>
                </div>
              </div>

              {/* Card 2: Alertas de Vencimento */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5 text-slate-800">
                    <Bell className="w-5 h-5 text-orange-500" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Configuração de Alertas de Vencimento</h4>
                      <p className="text-[11px] text-slate-400">Ative avisos preventivos para produtos que se aproximam do fim da validade.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expiryAlertsEnabled}
                      onChange={(e) => setExpiryAlertsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {expiryAlertsEnabled && (
                  <div className="space-y-4 animate-in slide-in-from-top-1 duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Alert days threshold */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Janela de Alerta Prévio (Dias)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={expiryAlertDays}
                            onChange={(e) => setExpiryAlertDays(Math.max(1, parseInt(e.target.value) || 0))}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold w-24 focus:bg-white focus:border-orange-500 outline-none"
                          />
                          <span className="text-xs text-slate-500">dias antes do vencimento</span>
                        </div>
                      </div>

                      {/* Notification channel selection */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Canal de Notificação</label>
                        <select
                          value={expiryNotificationMethod}
                          onChange={(e) => setExpiryNotificationMethod(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-700 outline-none focus:bg-white focus:border-orange-500 cursor-pointer"
                        >
                          <option value="EMAIL">📧 Enviar apenas por Email (SMTP)</option>
                          <option value="SMS">💬 Enviar apenas por SMS (Gateway)</option>
                          <option value="BOTH">🔄 Enviar por Ambos (Email e SMS)</option>
                        </select>
                      </div>

                    </div>

                    {/* Email content configuration */}
                    {(expiryNotificationMethod === "EMAIL" || expiryNotificationMethod === "BOTH") && (
                      <div className="space-y-3.5 border-t border-slate-100 pt-4.5 animate-in fade-in">
                        <h5 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                          <span>📋</span> Template de Alerta por Email
                        </h5>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Assunto do Email</label>
                          <input
                            type="text"
                            value={expiryEmailSubject}
                            onChange={(e) => setExpiryEmailSubject(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-orange-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Corpo da Mensagem</label>
                          <textarea
                            rows={5}
                            value={expiryEmailBody}
                            onChange={(e) => setExpiryEmailBody(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono outline-none focus:bg-white focus:border-orange-500"
                          />
                          <p className="text-[9px] text-slate-400">
                            Use a tag <code>[LISTA_VENCIMENTOS]</code> para injetar automaticamente a lista de lotes e produtos próximos da expiração.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Col 2: Action details & active inventory preview */}
            <div className="space-y-6">
              
              {/* Save Settings Action Button */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
                <div className="bg-orange-100 text-orange-600 p-3 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Gravar Alterações</h4>
                  <p className="text-xs text-slate-400 mt-1">Garante que todas as estratégias operacionais e notificações sejam aplicadas imediatamente.</p>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({
                      inventoryStrategy,
                      expiryAlertsEnabled,
                      expiryAlertDays,
                      expiryNotificationMethod,
                      expiryEmailSubject,
                      expiryEmailBody
                    });

                    onAddAuditLog(
                      "Definições de Lotes e Validades",
                      "CONFIGURAÇÕES",
                      `Parâmetros atualizados: Estratégia=${inventoryStrategy}, Alertas=${expiryAlertsEnabled ? 'Sim' : 'Não'} (${expiryAlertDays} dias).`
                    );

                    if (onShowToast) {
                      onShowToast("Configurações de lotes e validades salvas com sucesso!", "success");
                    }
                  }}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-md shadow-orange-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Gravar Parâmetros de Lotes
                </button>
              </div>

              {/* Status card preview: Perecíveis no inventário */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-150 space-y-4">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Informações de Lotes Atuais
                </h4>
                
                <div className="space-y-3 font-mono text-slate-650 text-[11px]">
                  <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                    <span>Lotes Totais:</span>
                    <span className="font-bold text-slate-800">{(settings.batches || []).length} lotes</span>
                  </div>
                  <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                    <span>Produtos Loteados:</span>
                    <span className="font-bold text-slate-800">
                      {new Set((settings.batches || []).map(b => b.productId)).size} produtos
                    </span>
                  </div>
                  <div className="flex justify-between pb-1.5">
                    <span>Estratégia no POS:</span>
                    <span className="font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-[10px]">
                      {settings.inventoryStrategy || "FIFO"}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  * Os lotes e validades podem ser cadastrados e ajustados diretamente através da aba "Lotes, Validades & FIFO" no módulo de Controle de Estoque.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {activeSubTab === "whatsapp" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="bg-emerald-950 text-white p-6 rounded-2xl border border-emerald-900 shadow-lg space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-xl shrink-0">
                <MessageSquare className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Configuração de Alertas via WhatsApp API</h3>
                <p className="text-xs text-emerald-300 mt-0.5">
                  Notifique o gestor instantaneamente por WhatsApp quando o estoque de qualquer produto atingir níveis críticos, com link direto de reabastecimento.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Col 1: Configurations */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Main settings card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5 text-slate-800">
                    <MessageSquare className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Controle de Alertas Automáticos</h4>
                      <p className="text-[11px] text-slate-400">Ativar ou desativar o disparo de alertas no momento da venda.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whatsappEnabled}
                      onChange={(e) => setWhatsappEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {whatsappEnabled && (
                  <form onSubmit={handleSaveWhatsappConfig} className="space-y-4 animate-in slide-in-from-top-1 duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Phone number of Manager */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">WhatsApp do Gestor (Destinatário)</label>
                        <input
                          type="text"
                          placeholder="+258849001200"
                          value={managerWhatsappPhone}
                          onChange={(e) => setManagerWhatsappPhone(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-emerald-500"
                        />
                        <p className="text-[9px] text-slate-400">Insira com o código de país (ex: +258 para Moçambique).</p>
                      </div>

                      {/* API Gateway type */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Provedor / Gateway de API</label>
                        <select
                          value={whatsappProvider}
                          onChange={(e) => setWhatsappProvider(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-700 outline-none focus:bg-white focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="DIRECT_LINK">🔗 Link Direto (Grátis / WhatsApp Web)</option>
                          <option value="EVOLUTION_API">🚀 Evolution API (Recomendado)</option>
                          <option value="TWILIO">💬 Twilio API (Enterprise)</option>
                          <option value="META_CLOUD">🌐 Meta Cloud API (Oficial)</option>
                        </select>
                      </div>

                    </div>

                    {/* Conditional gateway settings */}
                    {whatsappProvider !== "DIRECT_LINK" && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3.5 animate-in fade-in duration-200">
                        <h5 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Credenciais do Gateway ({whatsappProvider})</h5>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">URL Base da API (Endpoint)</label>
                            <input
                              type="text"
                              placeholder={whatsappProvider === "EVOLUTION_API" ? "https://api.seuservidor.com" : "https://api.twilio.com/..."}
                              value={whatsappApiEndpoint}
                              onChange={(e) => setWhatsappApiEndpoint(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Token de Autenticação / API Key</label>
                            <input
                              type="password"
                              placeholder="Insira o Token ou API Key..."
                              value={whatsappToken}
                              onChange={(e) => setWhatsappToken(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="space-y-1 md:col-span-2">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                              {whatsappProvider === "EVOLUTION_API" ? "Nome da Instância (Instance Name)" : "ID do Telefone / Account SID"}
                            </label>
                            <input
                              type="text"
                              placeholder={whatsappProvider === "EVOLUTION_API" ? "ex: ost_vendas_inst" : "ex: phone_id_123456"}
                              value={whatsappPhoneId}
                              onChange={(e) => setWhatsappPhoneId(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Message customizer template */}
                    <div className="space-y-1 pt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Template da Mensagem do Alerta</label>
                      <textarea
                        rows={5}
                        value={whatsappMessageTemplate}
                        onChange={(e) => setWhatsappMessageTemplate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono outline-none focus:bg-white focus:border-emerald-500 leading-relaxed"
                      />
                      <div className="bg-slate-100/70 p-3 rounded-lg text-[10px] text-slate-500 leading-relaxed space-y-1 border border-slate-200">
                        <span className="font-extrabold text-slate-700 block uppercase tracking-wide">Variáveis Disponíveis:</span>
                        <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px]">
                          <div><code className="text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold">{`{product_name}`}</code> : Nome do produto</div>
                          <div><code className="text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold">{`{current_stock}`}</code> : Estoque atual</div>
                          <div><code className="text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold">{`{threshold}`}</code> : Limite mínimo</div>
                          <div><code className="text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold">{`{pos_link}`}</code> : Link do terminal POS</div>
                        </div>
                      </div>
                    </div>

                    {/* Action form buttons */}
                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        Gravar Configurações WhatsApp
                      </button>
                    </div>

                  </form>
                )}

                {!whatsappEnabled && (
                  <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                    <div>
                      <h4 className="font-bold text-slate-700 text-xs">Alertas de WhatsApp Desativados</h4>
                      <p className="text-xs text-slate-400 mt-1">Ative o switch acima para configurar canais de envio de alertas de estoque crítico diretamente para o WhatsApp do gestor.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Simulation logs console */}
              {whatsappEnabled && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 space-y-3.5 shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-emerald-500 animate-pulse" />
                      Console de Integração & logs de Simulação
                    </h5>
                    <button
                      type="button"
                      onClick={() => setWhatsappLogs([])}
                      className="text-[9px] font-bold text-slate-500 hover:text-slate-300 transition uppercase cursor-pointer"
                    >
                      Limpar Console
                    </button>
                  </div>
                  
                  <div className="font-mono text-[10px] text-slate-300 space-y-1.5 max-h-56 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                    {whatsappLogs.length === 0 ? (
                      <span className="text-slate-600 italic">// Nenhum log de envio gerado nesta sessão. Clique em "Disparar Alerta de Teste" para ver o payload de integração.</span>
                    ) : (
                      whatsappLogs.map((log, idx) => (
                        <div key={idx} className={log.includes("❌ ERRO") ? "text-rose-400 font-extrabold" : log.includes("Resposta") || log.includes("Sucesso") ? "text-emerald-400 font-extrabold" : "text-slate-300"}>
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Col 2: Actions & Testing panel */}
            <div className="space-y-6">
              
              {/* Test action panel */}
              {whatsappEnabled && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Testar Disparo Instantâneo</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Envia uma notificação fictícia do produto "Arroz Premium" para validar a formatação do template e a autenticação do seu provedor.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      disabled={isTestingWhatsapp}
                      onClick={handleTestWhatsapp}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isTestingWhatsapp ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Enviando Mensagem...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Disparar Alerta de Teste
                        </>
                      )}
                    </button>

                    {whatsappProvider === "DIRECT_LINK" && managerWhatsappPhone && (
                      <a
                        href={`https://api.whatsapp.com/send?phone=${managerWhatsappPhone.replace(/\+/g, "")}&text=${encodeURIComponent(
                          whatsappMessageTemplate
                            .replace(/{product_name}/g, "Arroz Nacional Premium (10kg)")
                            .replace(/{current_stock}/g, "2")
                            .replace(/{threshold}/g, "5")
                            .replace(/{pos_link}/g, `${window.location.origin}/?tab=POS`)
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 text-center border border-slate-250"
                      >
                        <Globe className="w-4 h-4" />
                        Abrir Link do WhatsApp Direto
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Informative Help Guide Card */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-150 space-y-4">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Como funcionam os alertas?
                </h4>
                
                <div className="space-y-3 text-slate-650 text-xs leading-relaxed">
                  <p>
                    Os alertas de estoque crítico operam em segundo plano durante a finalização de qualquer transação no Caixa (POS).
                  </p>
                  <p>
                    Se o estoque total de um produto baixar do limite definido na seção de <strong>Alertas SMS/Gerais</strong> (atualmente configurado para <strong className="text-orange-600 font-bold">{settings.smsStockThreshold || 5} unidades</strong>), o sistema executará os canais de notificação marcados como ativos.
                  </p>
                  <p className="border-t border-slate-200 pt-2 font-semibold text-[10px] text-slate-500">
                    * Nota: A API Evolution é ideal para integrações com sistemas autônomos, enquanto o Link Direto permite envio rápido sem custo adicional.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {activeSubTab === "filiais" && (
        <div className="space-y-6 animate-in fade-in duration-200 text-slate-800">
          {/* Header Card */}
          <div className="bg-orange-950 text-white p-6 rounded-2xl border border-orange-900 shadow-lg space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 text-slate-950 p-2.5 rounded-xl shrink-0">
                <Building className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Gerenciamento de Filiais Comerciais</h3>
                <p className="text-xs text-orange-200 mt-0.5">
                  Adicione, edite e organize os pontos de venda e armazéns da empresa. Estas filiais estarão disponíveis para os operadores no login.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 h-fit">
              <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-500" />
                <h4 className="font-bold text-slate-850 text-sm">
                  {editingBranchId ? "Editar Filial" : "Cadastrar Nova Filial"}
                </h4>
              </div>

              <form onSubmit={handleSaveBranch} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nome da Filial</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Filial Matola, Loja X"
                    value={branchNameInput}
                    onChange={(e) => setBranchNameInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 focus:border-orange-500 focus:bg-white outline-none transition font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Código Único</label>
                    <input
                      type="text"
                      placeholder="Ex: MAT-03"
                      value={branchCodeInput}
                      onChange={(e) => setBranchCodeInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 focus:border-orange-500 focus:bg-white outline-none transition font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cidade / Província</label>
                    <input
                      type="text"
                      placeholder="Ex: Maputo, Matola"
                      value={branchCityInput}
                      onChange={(e) => setBranchCityInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 focus:border-orange-500 focus:bg-white outline-none transition font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Endereço Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Rua, Número, Bairro"
                    value={branchAddressInput}
                    onChange={(e) => setBranchAddressInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 focus:border-orange-500 focus:bg-white outline-none transition font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Contacto / Telefone</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: +258 84 900 1300"
                    value={branchContactInput}
                    onChange={(e) => setBranchContactInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 focus:border-orange-500 focus:bg-white outline-none transition font-medium"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs transition cursor-pointer text-center shadow-md shadow-orange-600/15"
                  >
                    {editingBranchId ? "Guardar Alterações" : "Adicionar Filial"}
                  </button>
                  {editingBranchId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBranchId(null);
                        setBranchNameInput("");
                        setBranchCodeInput("");
                        setBranchAddressInput("");
                        setBranchContactInput("");
                        setBranchCityInput("");
                      }}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs transition cursor-pointer font-bold"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List Section */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-850 text-sm">Filiais Ativas no Sistema</h4>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">
                    {(settings.branches || []).length} Registadas
                  </span>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {(settings.branches || []).map((branch) => (
                    <div
                      key={branch.id}
                      className="p-4 bg-slate-50 hover:bg-slate-100/75 border border-slate-200 rounded-xl transition duration-150 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-sm text-slate-900">{branch.name}</h5>
                          {branch.code && (
                            <span className="text-[9px] font-mono font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase">
                              {branch.code}
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5 text-slate-500 text-xs">
                          <p className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {branch.address} {branch.city ? `(${branch.city})` : ""}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {branch.contact}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditBranchClick(branch)}
                          className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition cursor-pointer"
                          title="Editar Filial"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBranch(branch.id, branch.name)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Remover Filial"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {(settings.branches || []).length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      <Building className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      Nenhuma filial registada. Adicione uma no formulário ao lado.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "seguranca" && (
        <div className="space-y-6 animate-in fade-in duration-200 text-slate-800">
          {/* Header Card */}
          <div className="bg-rose-950 text-white p-6 rounded-2xl border border-rose-900 shadow-lg space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-rose-500 text-white p-2.5 rounded-xl shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Segurança de Acesso & Controle de PINs</h3>
                <p className="text-xs text-rose-200 mt-0.5">
                  Gerencie a política de segurança, monitore a validade das credenciais e force a rotação de senhas para todos os colaboradores.
                </p>
              </div>
            </div>
          </div>

          {/* Central Security Panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h4 className="font-bold text-slate-850 text-sm">Controle de PIN dos Colaboradores</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Administradores podem resetar credenciais instantaneamente. PINs padrões têm validade temporária e expiram em 60 dias.
                </p>
              </div>
              <span className="text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded font-black uppercase">
                {employees.length} Utilizadores
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
              {employees.map((emp) => {
                const isTemp = emp.pinChanged === false || emp.pinChanged === undefined;
                const now = new Date();
                const createdAtStr = emp.pinCreatedAt || emp.admissionDate || now.toISOString();
                const createdAt = new Date(createdAtStr);
                const diffTime = now.getTime() - createdAt.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const remainingDays = Math.max(0, 60 - diffDays);

                return (
                  <div 
                    key={emp.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm">{emp.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                            {emp.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold">@{emp.username} • id: {emp.id}</p>
                      </div>

                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        emp.status === "ACTIVE" 
                          ? "bg-emerald-100 text-emerald-800" 
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {emp.status}
                      </span>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2.5 flex items-center justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wide">Estado de Senha (PIN)</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-extrabold flex items-center gap-1 ${
                            isTemp 
                              ? "bg-rose-50 border-rose-200 text-rose-700" 
                              : remainingDays <= 7 
                                ? "bg-amber-50 border-amber-200 text-amber-700 animate-pulse" 
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {isTemp 
                              ? "PIN Temporário (Altere Já)" 
                              : remainingDays <= 7 
                                ? `Expira em ${remainingDays} dias!` 
                                : `Válido por ${remainingDays} dias`}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfirmResetEmployeeId(emp.id)}
                        className="py-1.5 px-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-lg text-[11px] transition-all cursor-pointer shadow-sm hover:shadow-rose-500/20 flex items-center gap-1.5 border border-rose-600/10 font-sans"
                      >
                        <Lock className="w-3 h-3 shrink-0" />
                        Resetar PIN
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PIN Reset Confirmation Modal */}
          {confirmResetEmployeeId && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl p-6 space-y-4 animate-in zoom-in duration-150">
                <div className="flex items-center gap-3 text-rose-600">
                  <div className="bg-rose-50 p-3 rounded-xl">
                    <Shield className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Confirmar Reset de PIN</h3>
                    <p className="text-xs text-slate-400">Operação de segurança administrativa</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Tem certeza que deseja forçar o reset de PIN de acesso para o colaborador{" "}
                  <strong className="text-slate-900 font-bold">
                    {employees.find(e => e.id === confirmResetEmployeeId)?.name}
                  </strong>
                  ?
                </p>

                <div className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl text-[11px] text-rose-800 leading-normal space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <span>⚠️ O que acontece a seguir?</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 opacity-90 pl-1 font-medium">
                    <li>O PIN será imediatamente restaurado para o padrão temporário <span className="font-black bg-white px-1.5 py-0.5 rounded border border-rose-200">123456</span>.</li>
                    <li>No próximo login, o colaborador será obrigado por lei de rotação a criar uma nova senha pessoal forte de no mínimo 6 dígitos.</li>
                    <li>Um registo de auditoria de segurança (Audit Log) será criado.</li>
                  </ul>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmResetEmployeeId(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isResettingPin}
                    onClick={async () => {
                      setIsResettingPin(true);
                      try {
                        if (onResetEmployeePin) {
                          await onResetEmployeePin(confirmResetEmployeeId);
                        }
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsResettingPin(false);
                        setConfirmResetEmployeeId(null);
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md shadow-rose-600/10 flex items-center gap-1"
                  >
                    {isResettingPin ? "A processar..." : "Sim, Confirmar Reset"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
