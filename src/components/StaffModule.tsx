import React, { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  UserCheck, 
  Plus, 
  History, 
  Search, 
  Terminal, 
  ShieldCheck, 
  Clock, 
  DollarSign, 
  Download,
  FileText,
  List,
  Grid,
  Table as TableIcon,
  Trash2,
  Edit3,
  Lock,
  KeyRound,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  ArrowUpDown,
  Send,
  Printer,
  Copy,
  Activity,
  UserX,
  FileSpreadsheet,
  MapPin,
  Globe,
  Calendar,
  Filter,
  BarChart3,
  TrendingUp,
  UserCheck2
} from "lucide-react";
import { Employee, AuditLog, UserRole, SystemSettings, PasswordRecoveryRequest } from "../types";
import { sendEmail } from "../lib/gmail";
import { authenticatedFetch } from "../lib/apiClient";
import { renderWelcomeAdminHtml } from "../templates/WelcomeAdminTemplate";
import { SupabaseSyncService } from "../services/supabaseService";
import { generateSecurePin, generateEntityId } from "../lib/deterministic";
import { hashSecurityPin } from "../lib/security";
const getRecoveryRequests = async () => SupabaseSyncService.getRecoveryRequests();
const resolveRecoveryRequest = async (id: string) => SupabaseSyncService.resolveRecoveryRequest(id);
import { useConfirm } from "../hooks/useConfirm";
import { StaffErrorsTab } from "./staff/StaffErrorsTab";
import { StaffAuditTab } from "./staff/StaffAuditTab";
import { StaffAccessChartTab } from "./staff/StaffAccessChartTab";
import { StaffEmployeeModal } from "./staff/StaffEmployeeModal";
import { StaffEditEmployeeModal } from "./staff/StaffEditEmployeeModal";
import { StaffPermissionsModal } from "./staff/StaffPermissionsModal";
import { StaffEmployeeDrawer } from "./staff/StaffEmployeeDrawer";
import { StaffDeleteModal } from "./staff/StaffDeleteModal";
import { StaffListTab } from "./staff/StaffListTab";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Error loading logo for PDF:", err);
    return "";
  }
};

interface StaffModuleProps {
  employees: Employee[];
  auditLogs: AuditLog[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployees: (updatedList: Employee[]) => void;
  activeUsername: string;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currentRole: UserRole;
  currency: string;
  settings?: SystemSettings;
}

export default function StaffModule({
  employees,
  auditLogs,
  onAddEmployee,
  onUpdateEmployees,
  activeUsername,
  onAddAuditLog,
  currentRole,
  currency,
  settings
}: StaffModuleProps) {
  const confirm = useConfirm();
  
  // Tab states
  const [activeTab, setActiveTab] = useState<"STAFF" | "AUDIT" | "ERRORS" | "ACCESS_CHART">("STAFF");

  // Access chart states
  const [accessPeriod, setAccessPeriod] = useState<"7d" | "30d" | "90d" | "custom">("7d");
  const [accessModule, setAccessModule] = useState("Todos");
  const [accessEmployee, setAccessEmployee] = useState("Todos");
  const [accessChartType, setAccessChartType] = useState<"line" | "bar" | "area">("line");
  const [accessStartDate, setAccessStartDate] = useState(() => {
    const today = new Date();
    const past = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    return past.toISOString().split("T")[0];
  });
  const [accessEndDate, setAccessEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  
  // States for diagnostic and system errors tab (manager tools)
  const [expandedErrorLogId, setExpandedErrorLogId] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    server: "ok" | "failed" | null;
    db: "ok" | "failed" | null;
    time: string | null;
  }>({ server: null, db: null, time: null });

  const systemErrors = useMemo(() => {
    return auditLogs.filter(l => l.module === "Erros do Sistema" || l.module === "ERRO_FRONTEND" || l.module === "ERROS_SISTEMA");
  }, [auditLogs]);

  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true);
    let serverStatus: "ok" | "failed" = "failed";
    let dbStatus: "ok" | "failed" = "failed";
    
    try {
      const res = await authenticatedFetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        serverStatus = "ok";
        dbStatus = data.status === "ok" ? "ok" : "failed";
      }
    } catch (err) {
      serverStatus = "failed";
      dbStatus = "failed";
    }
    
    setTimeout(() => {
      setDiagnosticResult({
        server: serverStatus,
        db: dbStatus,
        time: new Date().toLocaleTimeString()
      });
      setIsDiagnosing(false);
      
      if (serverStatus === "ok") {
        onAddAuditLog(
          "Autodiagnóstico Executado",
          "Erros do Sistema",
          `Painel de diagnóstico executado com sucesso. Status do Servidor: ${serverStatus.toUpperCase()}, Status do Banco: ${dbStatus.toUpperCase()}`
        );
      } else {
        onAddAuditLog(
          "Falha no Autodiagnóstico",
          "Erros do Sistema",
          "O autodiagnóstico detectou que o servidor API backend está inacessível ou offline."
        );
      }
    }, 1200);
  };

  const handleSimulateFailure = async () => {
    try {
      await authenticatedFetch("/api/force-diagnostic-404-error-for-testing");
    } catch (e) {
      // Ignored
    }
  };

  // Views and filters states for employees
  const [viewMode, setViewMode] = useState<"cards" | "list" | "table">("cards");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos"); // Todos, Ativos, Suspensos, Desativados
  const [roleFilter, setRoleFilter] = useState("Todos"); // Todos, Administrador, Supervisor, Caixa, Armazém
  const [sortBy, setSortBy] = useState<"name" | "date" | "salary" | "role">("name");
  
  // Selection states for payroll batch operations
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isSendingToHR, setIsSendingToHR] = useState(false);
  const [hrSuccessMessage, setHrSuccessMessage] = useState("");

  // Views and filters states for Audit Log
  const [auditSearch, setAuditSearch] = useState("");
  const [auditModuleFilter, setAuditModuleFilter] = useState("Todos");
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const past = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    return past.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // UI Modals / Drawers states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"RESUMO" | "PERMISSOES" | "ATENCION" | "FERIAS" | "SALARIO" | "HISTORICO">("RESUMO");

  // Recovery Requests tracking
  const [recoveryRequests, setRecoveryRequests] = useState<PasswordRecoveryRequest[]>([]);
  const [_isLoadingRecovery, setIsLoadingRecovery] = useState(false);
  const [pendingRecoveryId, setPendingRecoveryId] = useState<string | null>(null);

  // Form states for employee addition & modification
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("Operador de Caixa");
  const [contact, setContact] = useState("");
  const [salary, setSalary] = useState<number>(18000);
  const [employeeStatus, setEmployeeStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED">("ACTIVE");
  const [localError, setLocalError] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [sendEmailCredentials, setSendEmailCredentials] = useState(true);
  const [emailSendingStatus, setEmailSendingStatus] = useState<"IDLE" | "SENDING" | "SUCCESS" | "ERROR">("IDLE");
  const [copiedLogs, setCopiedLogs] = useState(false);

  const generateSuggestedUsername = (fullName: string, phoneContact: string = ""): string => {
    const nameParts = fullName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, " ").split(/\s+/).filter(Boolean);
    let letters = "";
    if (nameParts.length === 0) {
      letters = "user";
    } else if (nameParts.length === 1) {
      const namePart = nameParts[0];
      letters = namePart.padEnd(4, "x").slice(0, 4);
    } else {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      
      let firstPart = firstName.slice(0, 2);
      let lastPart = lastName.slice(0, 2);
      
      if (firstPart.length < 2) {
        lastPart = lastName.slice(0, 4 - firstPart.length);
      }
      if (lastPart.length < 2) {
        firstPart = firstName.slice(0, 4 - lastPart.length);
      }
      
      let combined = firstPart + lastPart;
      if (combined.length < 4) {
        for (let i = 1; i < nameParts.length - 1 && combined.length < 4; i++) {
          combined += nameParts[i].slice(0, 4 - combined.length);
        }
      }
      if (combined.length < 4) {
        combined = combined.padEnd(4, "x");
      }
      letters = combined.slice(0, 4);
    }

    const digits = phoneContact.replace(/\D/g, "");
    let numbers = "";
    if (digits.length < 3) {
      numbers = digits.padEnd(3, "0").slice(0, 3);
    } else {
      numbers = digits.slice(-3);
    }

    return `${letters}${numbers}`;
  };

  React.useEffect(() => {
    if (isFormOpen && !selectedEmp) {
      setUsername(generateSuggestedUsername(name, contact));
    }
  }, [name, contact, isFormOpen, selectedEmp]);

  const openAddForm = () => {
    setName("");
    setUsername("");
    setRole("Operador de Caixa");
    setContact("");
    setSalary(18000);
    const newPin = generateSecurePin(6);
    setPin(newPin);
    setEmail("");
    setIsFormOpen(true);
  };

  const loadRecoveryRequests = async () => {
    setIsLoadingRecovery(true);
    try {
      const data = await getRecoveryRequests();
      setRecoveryRequests(data);
    } catch (err) {
      console.error("Failed to fetch recovery requests:", err);
    } finally {
      setIsLoadingRecovery(false);
    }
  };

  React.useEffect(() => {
    loadRecoveryRequests();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      loadRecoveryRequests();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Quick state details for Permissions modal
  const [empPermissions, setEmpPermissions] = useState<string[]>(["POS", "STOCK"]);

  // Expandable state for audit logs
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Export dropdown states
  const [isExportStaffDropdownOpen, setIsExportStaffDropdownOpen] = useState(false);
  const [isExportAuditDropdownOpen, setIsExportAuditDropdownOpen] = useState(false);

  // Database Errors Friendly Translation helper
  const translateDatabaseMessage = (details: string | undefined | null): string => {
    const dStr = details || "";
    if (dStr.toLowerCase().includes("permission-denied") || dStr.toLowerCase().includes("permissions") || dStr.toLowerCase().includes("insufficient")) {
      return "Acesso negado ao recurso solicitado (permissões insuficientes de base de dados).";
    }
    if (dStr.toLowerCase().includes("unavailable") || dStr.toLowerCase().includes("network")) {
      return "Banco de dados indisponível temporariamente. Tentando recuperar conexão.";
    }
    return dStr;
  };

  const isDatabaseError = (details: string | undefined | null): boolean => {
    const dStr = details || "";
    const lower = dStr.toLowerCase();
    return lower.includes("permission") || lower.includes("insufficient") || lower.includes("database error") || lower.includes("sql error");
  };

  // Staff CSV Export (enhanced to standard comma-separated Excel format)
  const handleDownloadStaffCSV = () => {
    try {
      const header = "ID,Nome,Cargo,Contacto,Salario (MT),Admissao,Estado\n";
      const rows = employees.map(emp => 
        `"${emp.id}","${emp.name}","${emp.role}","${emp.contact}",${emp.salary},"${emp.admissionDate}","${
          emp.status === 'ACTIVE' ? 'Ativo' : emp.status === 'SUSPENDED' ? 'Suspenso' : 'Desativado'
        }"`
      ).join("\n");
      
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Funcionarios_ERP_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onAddAuditLog(
        "Exportar Funcionários CSV",
        "FUNCIONÁRIOS",
        `Quadro de funcionários exportado em formato CSV (${employees.length} registros).`
      );
      setIsExportStaffDropdownOpen(false);
    } catch (err) {
      console.warn(err);
    }
  };

  // Staff PDF Export
  const handleDownloadStaffPDF = async () => {
    try {
      const doc = new jsPDF();
      
      const logoData = await getBase64ImageFromUrl(settings?.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
      if (logoData) {
        doc.addImage(logoData, "JPEG", 165, 8, 30, 30);
      }
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("OST COMÉRCIO CENTRAL", 14, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("ERP Modern | NUIT: 400293112", 14, 28);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Quadro de Funcionários Registados", 14, 40);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Colaboradores: ${employees.length}`, 14, 47);
      doc.text(`Emitido em: ${new Date().toLocaleString()}`, 14, 52);

      const head = [["ID", "NOME", "CARGO", "CONTACTO", "SALÁRIO", "ADMISSÃO", "ESTADO"]];
      const body = employees.map(emp => [
        emp.id,
        emp.name,
        emp.role,
        emp.contact,
        `${emp.salary.toLocaleString()} ${currency}`,
        emp.admissionDate,
        emp.status === 'ACTIVE' ? 'Ativo' : emp.status === 'SUSPENDED' ? 'Suspenso' : 'Desativado'
      ]);

      autoTable(doc, {
        startY: 60,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [249, 115, 22] }, // orange-500
        styles: { fontSize: 8, cellPadding: 3 }
      });

      doc.save(`Quadro_Funcionarios_${new Date().toISOString().split('T')[0]}.pdf`);
      
      onAddAuditLog(
        "Exportar Funcionários PDF",
        "FUNCIONÁRIOS",
        `Quadro de funcionários exportado em PDF (${employees.length} registros).`
      );
      setIsExportStaffDropdownOpen(false);
    } catch (err) {
      console.warn(err);
    }
  };

  // Audit Logs CSV Export
  const handleDownloadAuditCSV = () => {
    try {
      const header = "Data,Usuario,Funcao,Accao,Modulo,Detalhes\n";
      const rows = filteredAuditLogs.map(log => 
        `"${new Date(log.timestamp).toLocaleString() || ''}","${log.user || ''}","${log.userRole || ''}","${log.action || ''}","${log.module || ''}","${(log.details || '').replace(/"/g, '""')}"`
      ).join("\n");
      
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Logs_Auditoria_ERP_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onAddAuditLog(
        "Exportar Auditoria CSV",
        "AUDIT",
        `Relatório detalhado de auditoria de logs exportado em CSV (${filteredAuditLogs.length} eventos).`
      );
      setIsExportAuditDropdownOpen(false);
    } catch (err) {
      console.warn(err);
    }
  };

  // Audit Logs PDF Export
  const handleDownloadAuditPDF = async (exportAll: boolean = false) => {
    try {
      const logsToExport = exportAll ? [...auditLogs].reverse() : filteredAuditLogs;
      if (logsToExport.length === 0) {
        alert("Nenhum log de auditoria disponível para exportar em PDF.");
        return;
      }

      const doc = new jsPDF();
      
      const logoData = await getBase64ImageFromUrl(settings?.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
      if (logoData) {
        doc.addImage(logoData, "JPEG", 165, 8, 30, 30);
      }
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("OST COMÉRCIO CENTRAL", 14, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("ERP Modern | Relatório de Segurança e Auditoria", 14, 28);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(exportAll ? "Relatório Completo de Audit Log de Segurança" : "Relatório de Audit Log de Segurança", 14, 40);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período: ${startDate || "Todos os Registos"} até ${endDate || "Atualidade"}`, 14, 47);
      doc.text(`Emitido em: ${new Date().toLocaleString()} por ${activeUsername || "Sistema"}`, 14, 52);

      // --- EXECUTIVE SECURITY SUMMARY CALCULATIONS ---
      const totalEvents = logsToExport.length;

      const securityEvents = logsToExport.filter(log => {
        const m = (log.module || "").toUpperCase();
        const a = (log.action || "").toUpperCase();
        const d = (log.details || "").toUpperCase();
        return m.includes("SEGURANÇA") || m.includes("AUTENTICAÇÃO") || m.includes("AUDIT") ||
               a.includes("LOGIN") || a.includes("ALTERAÇÃO DE SENHA") || a.includes("ALERTA") || a.includes("RECUPERAÇÃO") ||
               d.includes("SUSPEITO") || d.includes("IP INTERNACIONAL") || d.includes("INCOMPATÍVEL") || d.includes("ACESSO");
      });

      const criticalSecurityEvents = logsToExport.filter(log => {
        const d = (log.details || "").toUpperCase();
        const a = (log.action || "").toUpperCase();
        return d.includes("SUSPEITO") || d.includes("ALERTA DE SEGURANÇA") || d.includes("IP INTERNACIONAL") || d.includes("CRÍTICO") || a.includes("FALHA") || d.includes("FALHA DE LOGIN") || d.includes("INTRUSÃO");
      });

      const uniqueUsers = Array.from(new Set(logsToExport.map(log => log.user))).filter(Boolean);

      const summaryText = `Durante o período de auditoria correspondente, o sistema OST Vendas monitorou de forma contínua a integridade e os acessos ao ERP comercial. Foram auditados ${totalEvents} eventos totais de sistema, dos quais ${securityEvents.length} estão associados a fluxos de autenticação ou segurança de utilizadores. O sistema identificou ${criticalSecurityEvents.length} alertas ou acessos críticos em ${uniqueUsers.length} operador(es) único(s). Este documento serve para fins de análise de segurança externa e conformidade de TI.`;

      // Draw Soft-colored grey card for Executive Summary
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, 58, 182, 54, "F");
      
      // Border around Executive Summary card
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.rect(14, 58, 182, 54, "S");
      
      // Vertical left accent line for the card in Orange/Amber
      doc.setFillColor(249, 115, 22); // orange-500
      doc.rect(14, 58, 2.5, 54, "F");

      // Executive Summary Title
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("RESUMO EXECUTIVO - AUDITORIA DE SEGURANÇA EXTERNA", 20, 65);

      // Section Content
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105); // slate-600
      
      // Split paragraph text so it wraps beautifully
      const textLines = doc.splitTextToSize(summaryText, 172);
      doc.text(textLines, 20, 71);

      // Simple metric cards inside the summary block
      // 1. Total events card
      doc.setFillColor(255, 255, 255); // white
      doc.rect(20, 94, 50, 14, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, 94, 50, 14, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("TOTAL DE EVENTOS", 24, 98);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`${totalEvents}`, 24, 105);

      // 2. Authentication/Security events card
      doc.setFillColor(255, 255, 255); // white
      doc.rect(76, 94, 58, 14, "F");
      doc.rect(76, 94, 58, 14, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("EVENTOS SEGURANÇA", 80, 98);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(`${securityEvents.length}`, 80, 105);

      // 3. Critical events card
      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(254, 202, 202); // red-200
      doc.rect(140, 94, 50, 14, "F");
      doc.rect(140, 94, 50, 14, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(220, 38, 38); // red-600
      doc.text("ALERTAS CRÍTICOS", 144, 98);
      doc.setFontSize(10);
      doc.setTextColor(153, 27, 27); // red-800
      doc.text(`${criticalSecurityEvents.length}`, 144, 105);

      // Subtitle for log table
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("REGISTO DETALHADO DOS EVENTOS DE AUDITORIA", 14, 119);

      const head = [["DATA / HORA", "USUÁRIO", "CARGO", "ACÇÃO", "MÓDULO", "DETALHES"]];
      const body = logsToExport.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.user || "Sistema",
        log.userRole || "N/D",
        log.action || "Ação",
        log.module || "Geral",
        translateDatabaseMessage(log.details || "")
      ]);

      autoTable(doc, {
        startY: 123,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] }, // slate-700
        styles: { fontSize: 8, cellPadding: 3 }
      });

      const fileName = exportAll 
        ? `Relatorio_Auditoria_Completo_${new Date().toISOString().split('T')[0]}.pdf`
        : `Relatorio_Auditoria_${new Date().toISOString().split('T')[0]}.pdf`;

      doc.save(fileName);
      
      onAddAuditLog(
        "Exportar Auditoria PDF",
        "AUDIT",
        `Logs de auditoria exportados em PDF (${logsToExport.length} eventos, modo: ${exportAll ? "Completo" : "Filtrado"}).`
      );
      setIsExportAuditDropdownOpen(false);
    } catch (err) {
      console.warn(err);
    }
  };

  // Copy Logs to Clipboard as structured text
  const handleCopyLogs = () => {
    try {
      if (filteredAuditLogs.length === 0) {
        alert("Nenhum log disponível para copiar com os filtros atuais.");
        return;
      }

      const reportHeader = [
        "==================================================",
        "         RELATÓRIO DE AUDITORIA - OST VENDAS       ",
        `Exportado em: ${new Date().toLocaleString()}`,
        `Total de Eventos: ${filteredAuditLogs.length}`,
        `Filtros - Período: ${startDate || "Qualquer"} a ${endDate || "Qualquer"}`,
        `Filtros - Módulo: ${auditModuleFilter}`,
        `Filtros - Pesquisa: ${auditSearch || "Nenhuma"}`,
        "==================================================",
        ""
      ].join("\n");

      const reportBody = filteredAuditLogs.map((log, idx) => {
        const formattedTime = new Date(log.timestamp).toLocaleString();
        return [
          `[#${idx + 1}] DATA/HORA: ${formattedTime}`,
          `UTENTE: ${log.user || "Sistema"} (${log.userRole || "N/D"})`,
          `MÓDULO: ${log.module || "Geral"}`,
          `AÇÃO: ${log.action}`,
          `DETALHES: ${log.details}`,
          log.ip || log.device ? `ORIGEM: ${[log.ip, log.device].filter(Boolean).join(" / ")}` : null,
          "--------------------------------------------------"
        ].filter(Boolean).join("\n");
      }).join("\n\n");

      const fullText = reportHeader + "\n" + reportBody;

      navigator.clipboard.writeText(fullText)
        .then(() => {
          setCopiedLogs(true);
          onAddAuditLog(
            "Copiar Logs Auditoria",
            "AUDIT",
            `Logs de auditoria copiados para a área de transferência (${filteredAuditLogs.length} eventos).`
          );
          setTimeout(() => setCopiedLogs(false), 2000);
        })
        .catch((err) => {
          console.error("Falha ao copiar logs: ", err);
          alert("Erro ao copiar logs para a área de transferência.");
        });
    } catch (err) {
      console.warn(err);
    }
  };

  // Print individual payslip (Recibo de Salário)
  const handlePrintPayslip = async (emp: Employee) => {
    try {
      const doc = new jsPDF();
      
      const logoData = await getBase64ImageFromUrl(settings?.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
      if (logoData) {
        doc.addImage(logoData, "JPEG", 160, 13, 26, 26);
      }
      
      doc.setDrawColor(220, 220, 220);
      doc.rect(10, 10, 190, 277); // Outer border
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("OST COMÉRCIO CENTRAL", 20, 25);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Av. Marginal, Maputo, Moçambique", 20, 31);
      doc.text("NUIT: 400293112 | Email: rh@ost.co.mz", 20, 36);
      
      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DEMONSTRATIVO DE PAGAMENTO DE SALÁRIO", 20, 52);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Período de Referência: Junho de 2026`, 20, 58);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString()}`, 130, 58);
      
      // Employee Box
      doc.setFillColor(248, 250, 252);
      doc.rect(20, 65, 170, 35, "F");
      doc.rect(20, 65, 170, 35);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Colaborador:`, 25, 73);
      doc.text(`Cargo / Função:`, 25, 80);
      doc.text(`Contacto:`, 25, 87);
      doc.text(`Código ID:`, 25, 94);
      
      doc.setFont("helvetica", "normal");
      doc.text(emp.name, 55, 73);
      doc.text(emp.role, 55, 80);
      doc.text(emp.contact, 55, 87);
      doc.text(emp.id, 55, 94);
      
      // Earnings & Deductions Table
      const earningsHead = [["DESCRIÇÃO", "REFERÊNCIA", "VENCIMENTOS", "DESCONTOS"]];
      const earningsBody = [
        ["Salário Base Mensal", "30 Dias", `${emp.salary.toLocaleString()} ${currency}`, "-"],
        ["INSS (Segurança Social)", "3.0 %", "-", `${(emp.salary * 0.03).toLocaleString()} ${currency}`],
        ["IRPS (Retenção na Fonte)", "10.0 %", "-", `${(emp.salary * 0.10).toLocaleString()} ${currency}`],
      ];
      
      autoTable(doc, {
        startY: 110,
        head: earningsHead,
        body: earningsBody,
        theme: "grid",
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9 }
      });
      
      // Totals Box
      const finalY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 0) + 10;
      doc.setFillColor(248, 250, 252);
      doc.rect(110, finalY, 80, 25, "F");
      doc.rect(110, finalY, 80, 25);
      
      const inss = emp.salary * 0.03;
      const irps = emp.salary * 0.10;
      const netSalary = emp.salary - inss - irps;
      
      doc.setFont("helvetica", "bold");
      doc.text(`Total Bruto:`, 115, finalY + 8);
      doc.text(`Total Descontos:`, 115, finalY + 15);
      doc.text(`Salário Líquido:`, 115, finalY + 22);
      
      doc.setFont("helvetica", "normal");
      doc.text(`${emp.salary.toLocaleString()} ${currency}`, 155, finalY + 8);
      doc.text(`${(inss + irps).toLocaleString()} ${currency}`, 155, finalY + 15);
      doc.setFont("helvetica", "bold");
      doc.text(`${netSalary.toLocaleString()} ${currency}`, 155, finalY + 22);
      
      // Signatures
      doc.line(20, finalY + 60, 90, finalY + 60);
      doc.line(120, finalY + 60, 190, finalY + 60);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Assinatura do Responsável (RH)", 35, finalY + 65);
      doc.text("Assinatura do Colaborador", 135, finalY + 65);
      
      doc.save(`Recibo_Salario_${emp.name.replace(/\s+/g, '_')}.pdf`);
      
      onAddAuditLog(
        "Imprimir Recibo Individual",
        "FUNCIONÁRIOS",
        `Impresso recibo de vencimento individual para '${emp.name}' no valor bruto de ${emp.salary.toLocaleString()} ${currency}.`
      );
    } catch (err) {
      console.warn("Error printing individual payslip: ", err);
    }
  };

  // Batch HR Submission Simulation
  const handleSendToHR = () => {
    if (selectedEmployees.length === 0) return;
    setIsSendingToHR(true);
    setTimeout(() => {
      setIsSendingToHR(false);
      const names = employees.filter(e => selectedEmployees.includes(e.id)).map(e => e.name).join(", ");
      setHrSuccessMessage(`Folhas de salário de ${selectedEmployees.length} colaboradores (${names}) enviadas com sucesso ao departamento de RH central!`);
      
      onAddAuditLog(
        "Enviar Folhas ao RH",
        "FUNCIONÁRIOS",
        `Folhas de vencimento de ${selectedEmployees.length} colaboradores enviadas para processamento de depósitos centralizados pelo RH.`
      );
      
      setSelectedEmployees([]);
      setTimeout(() => setHrSuccessMessage(""), 6000);
    }, 1500);
  };

  // Disparar automaticamente e-mail de boas-vindas com credenciais para o colaborador / admin recém-criado
  const dispatchWelcomeEmail = async (
    recipientEmail: string,
    employeeName: string,
    username: string,
    tempPin: string,
    userRole?: string
  ) => {
    setEmailSendingStatus("SENDING");
    try {
      const emailSubject = `Credenciais de Acesso - OST Vendas ERP (${employeeName})`;
      const emailBody = renderWelcomeAdminHtml({
        adminName: employeeName,
        adminEmail: recipientEmail,
        tempPin: tempPin,
        role: userRole || "Utilizador / Operador",
        branchName: settings?.companyName || "OST Vendas ERP",
        adminCopyEmail: "levidomingos12@gmail.com"
      });

      // 1. Primary copy sent to the new user via sendEmail
      await sendEmail({
        to: recipientEmail.trim(),
        subject: emailSubject,
        body: emailBody,
        isHtml: true
      });

      // 2. Carbon copy (CC) sent to levidomingos12@gmail.com if different
      if (recipientEmail.trim().toLowerCase() !== "levidomingos12@gmail.com") {
        await sendEmail({
          to: "levidomingos12@gmail.com",
          subject: `[CÓPIA CC - AUDITORIA] ${emailSubject}`,
          body: emailBody,
          isHtml: true
        }).catch(err => console.error("Erro ao enviar cópia CC via sendEmail:", err));
      }

      // 3. Backup dispatch via API route endpoint
      authenticatedFetch("/api/email/dispatch-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: recipientEmail,
          employeeName: employeeName,
          username: username,
          tempPin: tempPin,
          role: userRole
        })
      }).catch(() => {});

      setEmailSendingStatus("SUCCESS");
      onAddAuditLog(
        "Notificação de Credenciais",
        "NOTIFICAÇÃO",
        `Credenciais de acesso enviadas com sucesso via sendEmail para ${employeeName} (${recipientEmail}) com cópia CC para levidomingos12@gmail.com. Username: '${username}'.`
      );
      setTimeout(() => {
        setEmailSendingStatus("IDLE");
      }, 4000);
      return { success: true };
    } catch (error: unknown) {
      console.error("Erro ao enviar credenciais por e-mail:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setEmailSendingStatus("ERROR");
      onAddAuditLog(
        "Falha de Envio de Credenciais",
        "Erros do Sistema",
        `Falha ao enviar credenciais para ${recipientEmail}: ${errMsg}`
      );
      setTimeout(() => {
        setEmailSendingStatus("IDLE");
      }, 4000);
      return { success: false, error: errMsg };
    }
  };

  // Password strength check helper
  const checkPasswordStrength = (password: string) => {
    if (!password) return { score: 0, label: "Sem senha", color: "bg-slate-300", isValidAdmin: false };

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    else if (/[a-zA-Z]/.test(password)) score += 0.5;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    let label = "Fraca";
    let color = "bg-rose-500";

    if (score >= 3.5) {
      label = "Muito Forte";
      color = "bg-emerald-500";
    } else if (score >= 2.5) {
      label = "Forte";
      color = "bg-green-500";
    } else if (score >= 1.5) {
      label = "Média";
      color = "bg-amber-500";
    } else {
      label = "Fraca";
      color = "bg-rose-500";
    }

    // Admin requirement: minimum 8 characters with at least letters and numbers
    const isValidAdmin = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

    return { score, label, color, isValidAdmin };
  };

  // Add/Contract new employee
  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) {
      setLocalError("Por favor, introduza o Nome e Contacto do trabalhador.");
      return;
    }

    const isAdminRole = role === "Administrador";

    // Verification of password strength for Administrators
    if (isAdminRole) {
      if (!email.trim()) {
        setLocalError("Para criar um Administrador, é obrigatório indicar um e-mail válido para envio das credenciais.");
        return;
      }
      if (pin.trim()) {
        const pStrength = checkPasswordStrength(pin.trim());
        if (!pStrength.isValidAdmin) {
          setLocalError("Para utilizadores Administradores, a senha deve ter pelo menos 8 caracteres, combinando letras e números (ex: Admin2026!).");
          return;
        }
      }
    }
    
    const finalUsername = username.trim() || generateSuggestedUsername(name, contact);
    // Generates a random strong password if empty
    const generateTempPass = () => {
      return `Admin#${generateSecurePin(4)}`;
    };
    const rawPin = pin.trim() || generateTempPass();
    const secureHashedPin = await hashSecurityPin(rawPin);
    setLocalError("");

    const payload: Employee = {
      id: generateEntityId("emp"),
      name,
      role,
      contact,
      salary,
      admissionDate: new Date().toISOString().split("T")[0],
      status: "ACTIVE",
      pin: secureHashedPin,
      email: email.trim() || undefined,
      username: finalUsername,
      pinCreatedAt: new Date().toISOString(),
      pinChanged: false
    };

    onAddEmployee(payload);
    
    let auditDetails = `Novo funcionário/admin '${payload.name}' (${role}) registado com username '${finalUsername}', Senha de Acesso: [PROTEGIDA COM HASH SHA-256] e salário de ${payload.salary.toLocaleString()} ${currency}.`;

    const recipientToNotify = email.trim() || (isAdminRole ? "levidomingos12@gmail.com" : "");
    if (recipientToNotify && (isAdminRole || sendEmailCredentials)) {
      auditDetails += ` Envio de credenciais com WelcomeAdminTemplate solicitado para o e-mail: ${recipientToNotify} (cópia CC para levidomingos12@gmail.com).`;
      dispatchWelcomeEmail(recipientToNotify, name.trim(), finalUsername, rawPin, role);
    }

    onAddAuditLog(
      "Contratar Funcionário",
      "FUNCIONÁRIOS",
      auditDetails
    );

    setIsFormOpen(false);
    setName("");
    setUsername("");
    setRole("Operador de Caixa");
    setContact("");
    setSalary(18000);
    setPin("");
    setEmail("");
  };

  // Edit employee information
  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp || !name.trim() || !contact.trim()) return;

    const finalUsername = username.trim() || generateSuggestedUsername(name, contact);
    const rawPin = pin.trim();
    const isPinUpdated = rawPin !== "" && rawPin !== selectedEmp.pin;

    let targetHashedPin = selectedEmp.pin || "";
    if (isPinUpdated) {
      targetHashedPin = await hashSecurityPin(rawPin);
    }

    const updated = employees.map(emp => {
      if (emp.id === selectedEmp.id) {
        return {
          ...emp,
          name,
          role,
          contact,
          salary,
          status: employeeStatus,
          pin: targetHashedPin,
          email: email.trim() || emp.email,
          username: finalUsername,
          pinCreatedAt: isPinUpdated ? new Date().toISOString() : (emp.pinCreatedAt || new Date().toISOString()),
          pinChanged: isPinUpdated ? false : (emp.pinChanged !== undefined ? emp.pinChanged : true)
        };
      }
      return emp;
    });

    onUpdateEmployees(updated);

    if (isPinUpdated) {
      const userEmail = email.trim() || selectedEmp.email;
      if (userEmail) {
        sendEmail({
          to: userEmail,
          subject: "Alteração de Senha / PIN de Acesso - OST Vendas",
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <div style="text-align: center; border-bottom: 2px solid #ff6b00; padding-bottom: 15px; margin-bottom: 20px;">
                <h1 style="color: #0f172a; margin: 0; font-size: 24px;">OST Vendas</h1>
                <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Notificação de Segurança</p>
              </div>
              <h2 style="color: #1e293b; font-size: 18px;">Olá, ${name}!</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.5;">Informamos que a sua palavra-passe (PIN) de acesso ao terminal foi alterada com sucesso pela Administração.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
                <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 5px; font-weight: bold; text-transform: uppercase;">Novo PIN de Acesso:</span>
                <strong style="color: #ff6b00; font-size: 22px; letter-spacing: 2px; font-family: monospace;">${pin.trim()}</strong>
              </div>
              <p style="color: #475569; font-size: 14px; line-height: 1.5;">Por motivos de segurança, guarde este PIN em local seguro e não o partilhe com terceiros.</p>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center;">Se não solicitou esta alteração ou se julga tratar-se de um erro, contacte imediatamente o Administrador.</p>
            </div>
          `,
          isHtml: true
        }).then(() => {
          console.log("Email de alteração de PIN enviado para:", userEmail);
        }).catch((err) => {
          console.error("Erro ao enviar email de alteração de PIN:", err);
        });
      }
    }
    
    onAddAuditLog(
      "Editar Funcionário",
      "FUNCIONÁRIOS",
      `Perfil do funcionário '${name}' atualizado (Username: '${finalUsername}'). Estado: ${employeeStatus}, Cargo: ${role}, PIN atualizado/confirmado, Salário: ${salary.toLocaleString()} ${currency}.`
    );

    if (pendingRecoveryId) {
      resolveRecoveryRequest(pendingRecoveryId).then(() => {
        loadRecoveryRequests();
      }).catch(err => {
        console.error("Error resolving recovery request:", err);
      });
      setPendingRecoveryId(null);
    }

    setIsEditModalOpen(false);
    setSelectedEmp(null);
    setPin("");
    setEmail("");
    setUsername("");
  };

  // Reset credentials directly for an employee
  const handleResetCredentialsDirectly = async (emp: Employee) => {
    if (currentRole !== "ADMIN" && currentRole !== "SUPERVISOR") {
      alert("Apenas administradores ou supervisores podem resetar a senha de colaboradores.");
      return;
    }

    const confirmReset = window.confirm(
      `Tem a certeza de que deseja redefinir e resetar a senha e PIN de acesso de "${emp.name}"? Um novo PIN temporário de 6 dígitos será gerado automaticamente.`
    );

    if (!confirmReset) return;

    const generatedPin = generateSecurePin(6);
    const hashedGeneratedPin = await hashSecurityPin(generatedPin);

    const updated = employees.map(e => {
      if (e.id === emp.id) {
        return {
          ...e,
          pin: hashedGeneratedPin,
          pinCreatedAt: new Date().toISOString(),
          pinChanged: false
        };
      }
      return e;
    });

    onUpdateEmployees(updated);

    onAddAuditLog(
      "Reset de Credenciais",
      "FUNCIONÁRIOS",
      `Administrador resetou as credenciais (Senha e PIN) do colaborador '${emp.name}'. Nova credencial temporária gerada.`
    );

    const userEmail = emp.email?.trim();
    if (userEmail) {
      sendEmail({
        to: userEmail,
        subject: "Redefinição de Palavra-passe / PIN - OST Vendas",
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="text-align: center; border-bottom: 2px solid #ff6b00; padding-bottom: 15px; margin-bottom: 20px;">
              <h1 style="color: #0f172a; margin: 0; font-size: 24px;">OST Vendas</h1>
              <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Notificação de Segurança</p>
            </div>
            <h2 style="color: #1e293b; font-size: 18px;">Olá, ${emp.name}!</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.5;">Informamos que a sua palavra-passe e PIN de acesso do sistema foram redefinidos pela Administração.</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
              <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 5px; font-weight: bold; text-transform: uppercase;">Nova Credencial Temporária:</span>
              <strong style="color: #ff6b00; font-size: 24px; letter-spacing: 2px; font-family: monospace;">${generatedPin}</strong>
            </div>
            <p style="color: #475569; font-size: 14px; line-height: 1.5;">Por motivos de segurança, utilize esta credencial temporária para aceder ao sistema e redefinir a sua senha para uma segura no seu primeiro acesso.</p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center;">Se não solicitou esta alteração, por favor contacte imediatamente o Administrador.</p>
          </div>
        `,
        isHtml: true
      }).then(() => {
        console.log("Email de redefinição de credenciais enviado para:", userEmail);
      }).catch(err => {
        console.error("Erro ao enviar email de redefinição:", err);
      });
    }

    alert(
      `A senha/PIN de "${emp.name}" foi redefinida com sucesso!\n\n` +
      `Nova Credencial Temporária: ${generatedPin}\n\n` +
      `Se o colaborador tiver um e-mail cadastrado, ele receberá uma cópia destas instruções.`
    );
  };

  // Save changes to permissions
  const handleSavePermissions = () => {
    if (!selectedEmp) return;
    
    onAddAuditLog(
      "Alterar Permissões",
      "FUNCIONÁRIOS",
      `Alterado privilégios de acesso de '${selectedEmp.name}'. Módulos habilitados: ${empPermissions.join(", ")}`
    );
    setIsPermissionsModalOpen(false);
  };

  // Delete / Dismiss employee
  const handleDeleteEmployee = async (emp: Employee) => {
    const isConfirmed = await confirm({
      title: "Você tem certeza?",
      message: `Deseja realmente desligar e remover o registro de "${emp.name}" permanentemente? Esta ação é definitiva, irreversível e revogará todos os privilégios de acesso dele ao sistema.`,
      confirmText: "Sim, Confirmar Remoção",
      cancelText: "Não, Cancelar",
      type: "danger"
    });

    if (isConfirmed) {
      const updated = employees.filter(e => e.id !== emp.id);
      onUpdateEmployees(updated);
      
      onAddAuditLog(
        "Remover Funcionário",
        "FUNCIONÁRIOS",
        `Funcionário '${emp.name}' com código '${emp.id}' foi desligado permanentemente do sistema.`
      );
    }
  };

  const confirmDeleteEmployee = () => {
    // Deprecated in favor of the beautiful async useConfirm hook
  };

  // Trigger quick salary payment simulation
  const handlePaySalary = (emp: Employee) => {
    onAddAuditLog(
      "Pagar Salário",
      "FUNCIONÁRIOS",
      `Salário Mensal de ${emp.salary.toLocaleString()} ${currency} pago via M-Pesa central ao funcionário '${emp.name}'.`
    );
    alert(`Salário de ${emp.salary.toLocaleString()} MT pago com sucesso para ${emp.name}! Transação de RH arquivada e comprovante gerado.`);
    handlePrintPayslip(emp);
  };

  // Toggle selection for batch payroll submissions
  const toggleSelectEmployee = (empId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map(e => e.id));
    }
  };

  // List of distinct modules for Audit logs with standard default categories
  const modules = useMemo(() => {
    const standardModules = ["Vendas", "Stock", "Segurança", "Caixa", "Clientes", "Funcionários", "Relatórios", "Sistema", "Assinaturas"];
    const set = new Set<string>();
    standardModules.forEach(m => set.add(m));
    auditLogs.forEach(l => {
      if (l.module) set.add(l.module);
    });
    return ["Todos", ...Array.from(set)];
  }, [auditLogs]);

  // Distinct modules list for collaborator accesses (excluding system errors)
  const accessModulesList = useMemo(() => {
    const list = new Set(auditLogs.map(l => l.module).filter(m => m && m !== "Erros do Sistema" && m !== "ERRO_FRONTEND" && m !== "ERROS_SISTEMA"));
    return ["Todos", ...Array.from(list)];
  }, [auditLogs]);

  // Computed start/end dates for system accesses
  const computedAccessDates = useMemo(() => {
    const today = new Date();
    let start = new Date();
    if (accessPeriod === "7d") {
      start.setDate(today.getDate() - 6);
    } else if (accessPeriod === "30d") {
      start.setDate(today.getDate() - 29);
    } else if (accessPeriod === "90d") {
      start.setDate(today.getDate() - 89);
    } else {
      return { startStr: accessStartDate, endStr: accessEndDate };
    }
    return {
      startStr: start.toISOString().split("T")[0],
      endStr: today.toISOString().split("T")[0],
    };
  }, [accessPeriod, accessStartDate, accessEndDate]);

  // Filtered and aggregated time-series data of accesses
  const accessChartData = useMemo(() => {
    const { startStr, endStr } = computedAccessDates;
    
    const logs = auditLogs.filter(log => {
      if (!log.timestamp) return false;
      let logDate = log.timestamp;
      if (log.timestamp.includes("T")) {
        logDate = log.timestamp.split("T")[0];
      } else if (log.timestamp.includes(" ")) {
        logDate = log.timestamp.split(" ")[0];
      }
      
      const matchDate = logDate >= startStr && logDate <= endStr;
      const matchModule = accessModule === "Todos" || log.module === accessModule;
      const matchEmployee = accessEmployee === "Todos" || 
                            log.user === accessEmployee || 
                            log.user === employees.find(e => e.username === accessEmployee)?.name;
      const isValidUser = log.user && log.user !== "System" && log.user !== "SISTEMA" && log.user.trim() !== "";
      const isNotSystemError = log.module !== "Erros do Sistema" && log.module !== "ERRO_FRONTEND" && log.module !== "ERROS_SISTEMA";
      return matchDate && matchModule && matchEmployee && isValidUser && isNotSystemError;
    });

    const dateList: string[] = [];
    const curr = new Date(startStr);
    const end = new Date(endStr);
    let limit = 0;
    while (curr <= end && limit < 180) {
      dateList.push(curr.toISOString().split("T")[0]);
      curr.setDate(curr.getDate() + 1);
      limit++;
    }

    const activeEmps = Array.from(new Set(logs.map(l => l.user).filter(Boolean))) as string[];

    const chartPoints = dateList.map(date => {
      const dayLogs = logs.filter(l => {
        if (!l.timestamp) return false;
        let logDate = l.timestamp;
        if (l.timestamp.includes("T")) {
          logDate = l.timestamp.split("T")[0];
        } else if (l.timestamp.includes(" ")) {
          logDate = l.timestamp.split(" ")[0];
        }
        return logDate === date;
      });

      const point: Record<string, unknown> = {
        dateStr: date,
        date: (() => {
          const parts = date.split("-");
          if (parts.length === 3) {
            const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]}`;
          }
          return date;
        })(),
      };

      activeEmps.forEach(emp => {
        point[emp] = 0;
      });

      dayLogs.forEach(l => {
        if (l.user) {
          point[l.user] = ((point[l.user] as number) || 0) + 1;
        }
      });

      point.total = dayLogs.length;
      return point;
    });

    return {
      points: chartPoints,
      activeEmployees: activeEmps,
      totalAccesses: logs.length,
    };
  }, [auditLogs, computedAccessDates, accessModule, accessEmployee, employees]);

  // Insights, ranking and distributions for accesses
  const accessInsights = useMemo(() => {
    const { points, totalAccesses } = accessChartData;
    const { startStr, endStr } = computedAccessDates;

    const empCounts: { [username: string]: number } = {};
    const moduleCounts: { [moduleName: string]: number } = {};
    
    const filteredLogs = auditLogs.filter(log => {
      if (!log.timestamp) return false;
      let logDate = log.timestamp;
      if (log.timestamp.includes("T")) {
        logDate = log.timestamp.split("T")[0];
      } else if (log.timestamp.includes(" ")) {
        logDate = log.timestamp.split(" ")[0];
      }
      
      const matchDate = logDate >= startStr && logDate <= endStr;
      const matchModule = accessModule === "Todos" || log.module === accessModule;
      const matchEmployee = accessEmployee === "Todos" || 
                            log.user === accessEmployee || 
                            log.user === employees.find(e => e.username === accessEmployee)?.name;
      const isValidUser = log.user && log.user !== "System" && log.user !== "SISTEMA" && log.user.trim() !== "";
      const isNotSystemError = log.module !== "Erros do Sistema" && log.module !== "ERRO_FRONTEND" && log.module !== "ERROS_SISTEMA";
      return matchDate && matchModule && matchEmployee && isValidUser && isNotSystemError;
    });

    filteredLogs.forEach(log => {
      if (log.user) {
        empCounts[log.user] = (empCounts[log.user] || 0) + 1;
      }
      if (log.module) {
        moduleCounts[log.module] = (moduleCounts[log.module] || 0) + 1;
      }
    });

    const ranking = Object.keys(empCounts).map(username => {
      const emp = employees.find(e => e.username === username || e.name === username);
      return {
        username,
        name: emp?.name || username,
        role: emp?.role || "Colaborador",
        count: empCounts[username],
        percentage: totalAccesses > 0 ? (empCounts[username] / totalAccesses) * 100 : 0,
        lastAccess: (() => {
          const userLogs = filteredLogs.filter(l => l.user === username);
          if (userLogs.length === 0) return "N/A";
          const sorted = [...userLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          return new Date(sorted[0].timestamp).toLocaleString();
        })()
      };
    }).sort((a, b) => b.count - a.count);

    const moduleDistribution = Object.keys(moduleCounts).map(name => {
      return {
        name,
        count: moduleCounts[name],
        percentage: totalAccesses > 0 ? (moduleCounts[name] / totalAccesses) * 100 : 0,
      };
    }).sort((a, b) => b.count - a.count);

    const mostActive = ranking[0] || null;
    const mostAccessedModule = moduleDistribution[0] || null;
    const numDays = points.length || 1;
    const avgDaily = totalAccesses / numDays;

    return {
      ranking,
      moduleDistribution,
      mostActive,
      mostAccessedModule,
      avgDaily,
      totalAccesses
    };
  }, [auditLogs, employees, accessChartData, computedAccessDates, accessModule, accessEmployee]);

  // Memoized stable color map for active/inactive employees
  const employeeColors = useMemo(() => {
    const colors = [
      "#f97316", // orange
      "#10b981", // emerald
      "#3b82f6", // blue
      "#6366f1", // indigo
      "#a855f7", // purple
      "#ec4899", // pink
      "#f59e0b", // amber
      "#06b6d4", // cyan
      "#14b8a6", // teal
      "#e11d48", // rose
    ];
    const map: { [username: string]: string } = {};
    employees.forEach((emp, index) => {
      map[emp.username] = colors[index % colors.length];
    });
    auditLogs.forEach((log) => {
      if (log.user && !map[log.user]) {
        const hash = Array.from(log.user).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        map[log.user] = colors[hash % colors.length];
      }
    });
    return map;
  }, [employees, auditLogs]);

  // Employee Statistics cards (interactive, clean, responsive)
  const staffStats = useMemo(() => {
    const total = employees.length;
    const activeCount = employees.filter(e => e.status === "ACTIVE").length;
    const totalSalarySheet = employees.filter(e => e.status === "ACTIVE").reduce((sum, e) => sum + e.salary, 0);
    const thisMonth = new Date().toISOString().substring(0, 7);
    const hiredThisMonth = employees.filter(e => e.admissionDate?.startsWith(thisMonth)).length || 2;
    
    return {
      total,
      activeCount,
      totalSalarySheet,
      hiredThisMonth
    };
  }, [employees]);

  // Helper for flexible module category matching
  const checkLogModuleMatch = (logModule: string, filter: string) => {
    if (!filter || filter === "Todos") return true;
    if (logModule === filter) return true;
    const filterUpper = filter.toUpperCase();
    const logUpper = (logModule || "").toUpperCase();
    if (logUpper === filterUpper) return true;

    if (filterUpper === "VENDAS") return logUpper.includes("VENDA") || logUpper.includes("POS");
    if (filterUpper === "STOCK" || filterUpper === "ESTOQUE") return logUpper.includes("STOCK") || logUpper.includes("ESTOQUE") || logUpper.includes("PRODUTO");
    if (filterUpper === "SEGURANÇA" || filterUpper === "SEGURANCA") return logUpper.includes("SEGURA") || logUpper.includes("AUTENTIC") || logUpper.includes("LOGIN") || logUpper.includes("AUDIT");
    if (filterUpper === "CAIXA") return logUpper.includes("CAIXA") || logUpper.includes("CASH");
    if (filterUpper === "CLIENTES") return logUpper.includes("CLIENTE");
    if (filterUpper === "FUNCIONÁRIOS" || filterUpper === "FUNCIONARIOS" || filterUpper === "EQUIPA") return logUpper.includes("FUNC") || logUpper.includes("STAFF") || logUpper.includes("RH") || logUpper.includes("EQUIP");
    if (filterUpper === "RELATÓRIOS" || filterUpper === "RELATORIOS") return logUpper.includes("RELAT") || logUpper.includes("REPORT");
    if (filterUpper === "SISTEMA") return logUpper.includes("SISTEMA") || logUpper.includes("CONFIG");
    if (filterUpper === "ASSINATURAS") return logUpper.includes("ASSINATURA") || logUpper.includes("PLANO");

    return false;
  };

  // Grouping/Aggregation helper for consecutive duplicate audit logs
  // Returns collapsed logs indicating duplicate counts for sequential identical warnings/errors/info
  const groupedAuditLogs = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();

    const sorted = [...auditLogs].reverse().filter(log => {
      const formattedDate = log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "";
      const formattedDateTime = log.timestamp ? new Date(log.timestamp).toLocaleString() : "";
      const rawTimestamp = log.timestamp || "";

      const matchSearch = !term || 
                          (log.user || "").toLowerCase().includes(term) || 
                          (log.userRole || "").toLowerCase().includes(term) || 
                          (log.module || "").toLowerCase().includes(term) || 
                          (log.action || "").toLowerCase().includes(term) || 
                          (log.details || "").toLowerCase().includes(term) ||
                          formattedDate.toLowerCase().includes(term) ||
                          formattedDateTime.toLowerCase().includes(term) ||
                          rawTimestamp.toLowerCase().includes(term);
      
      const matchModule = checkLogModuleMatch(log.module || "", auditModuleFilter);
      
      let matchDate = true;
      if (log.timestamp) {
        const logDate = log.timestamp.split("T")[0];
        matchDate = logDate >= startDate && logDate <= endDate;
      }
      return matchSearch && matchModule && matchDate;
    });

    const groups: { log: AuditLog; count: number; firstTime: string; lastTime: string; isGroup: boolean; originalLogs: AuditLog[] }[] = [];
    
    for (const log of sorted) {
      const lastGroup = groups[groups.length - 1];
      
      // Determine if this log should group with the previous one
      // Match criteria: same user, same action, same module, same details, and timestamp within 5 minutes (300,000ms)
      const isDuplicate = lastGroup && 
                          lastGroup.log.user === log.user && 
                          lastGroup.log.action === log.action && 
                          lastGroup.log.module === log.module &&
                          (new Date(lastGroup.log.timestamp).getTime() - new Date(log.timestamp).getTime() < 300000);

      if (isDuplicate) {
        lastGroup.count += 1;
        lastGroup.lastTime = new Date(log.timestamp).toLocaleTimeString();
        lastGroup.isGroup = true;
        lastGroup.originalLogs.push(log);
      } else {
        groups.push({
          log,
          count: 1,
          firstTime: new Date(log.timestamp).toLocaleTimeString(),
          lastTime: new Date(log.timestamp).toLocaleTimeString(),
          isGroup: false,
          originalLogs: [log]
        });
      }
    }
    
    return groups;
  }, [auditLogs, auditSearch, auditModuleFilter, startDate, endDate]);

  // Traditional filtered logs count helper
  const filteredAuditLogs = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();

    return [...auditLogs].reverse().filter(log => {
      const formattedDate = log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "";
      const formattedDateTime = log.timestamp ? new Date(log.timestamp).toLocaleString() : "";
      const rawTimestamp = log.timestamp || "";

      const matchSearch = !term || 
                          (log.user || "").toLowerCase().includes(term) || 
                          (log.userRole || "").toLowerCase().includes(term) || 
                          (log.module || "").toLowerCase().includes(term) || 
                          (log.action || "").toLowerCase().includes(term) || 
                          (log.details || "").toLowerCase().includes(term) ||
                          formattedDate.toLowerCase().includes(term) ||
                          formattedDateTime.toLowerCase().includes(term) ||
                          rawTimestamp.toLowerCase().includes(term);

      const matchModule = checkLogModuleMatch(log.module || "", auditModuleFilter);
      let matchDate = true;
      if (log.timestamp) {
        const logDate = log.timestamp.split("T")[0];
        matchDate = logDate >= startDate && logDate <= endDate;
      }
      return matchSearch && matchModule && matchDate;
    });
  }, [auditLogs, auditSearch, auditModuleFilter, startDate, endDate]);

  // Filter and sort the employee records
  const filteredEmployees = useMemo(() => {
    let result = [...employees];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(emp => 
        (emp.name || "").toLowerCase().includes(q) ||
        (emp.contact || "").toLowerCase().includes(q) ||
        (emp.role || "").toLowerCase().includes(q) ||
        (emp.id || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "Todos") {
      const map: Record<string, string> = {
        "Ativos": "ACTIVE",
        "Suspensos": "SUSPENDED",
        "Desativados": "INACTIVE"
      };
      result = result.filter(emp => emp.status === map[statusFilter]);
    }

    if (roleFilter !== "Todos") {
      result = result.filter(emp => {
        const rLower = (emp.role || "").toLowerCase();
        if (roleFilter === "Administrador") return rLower.includes("admin") || rLower.includes("gestor");
        if (roleFilter === "Supervisor") return rLower.includes("superv");
        if (roleFilter === "Caixa") return rLower.includes("caixa") || rLower.includes("operador");
        if (roleFilter === "Armazém") return rLower.includes("armaz") || rLower.includes("stock") || rLower.includes("sogro");
        return true;
      });
    }

    result.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "date") return (b.admissionDate || "").localeCompare(a.admissionDate || "");
      if (sortBy === "salary") return (b.salary || 0) - (a.salary || 0);
      if (sortBy === "role") return (a.role || "").localeCompare(b.role || "");
      return 0;
    });

    return result;
  }, [employees, searchTerm, statusFilter, roleFilter, sortBy]);

  // Form setup helper to update or edit employee
  const openEditModal = (emp: Employee, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEmp(emp);
    setName(emp.name);
    setRole(emp.role);
    setContact(emp.contact);
    setSalary(emp.salary);
    setEmployeeStatus(emp.status || "ACTIVE");
    setPin(emp.pin || "");
    setEmail(emp.email || "");
    setUsername(emp.username || "");
    setIsEditModalOpen(true);
  };

  const handleResetPasswordFromRequest = (req: { id?: string; employeeId?: string; email?: string; employeeName: string }) => {
    const emp = employees.find(e => 
      e.id === req.employeeId || 
      (req.email && e.email?.toLowerCase() === req.email.toLowerCase()) ||
      e.name.toLowerCase() === req.employeeName.toLowerCase()
    );

    if (!emp) {
      alert(`Colaborador "${req.employeeName}" não foi encontrado no Quadro de Funcionários.`);
      return;
    }

    setSelectedEmp(emp);
    setName(emp.name);
    setRole(emp.role);
    setContact(emp.contact);
    setSalary(emp.salary);
    setEmployeeStatus(emp.status || "ACTIVE");
    
    const generatedPin = generateSecurePin(6);
    setPin(generatedPin);
    
    setEmail(emp.email || "");
    setUsername(emp.username || "");
    setPendingRecoveryId(req.id);
    setIsEditModalOpen(true);
  };

  const openPermissionsModal = (emp: Employee, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEmp(emp);
    // Assign mock privileges or toggle from set
    setEmpPermissions(emp.role.includes("Admin") ? ["POS", "STOCK", "REPORTS", "STAFF", "CASHIER"] : ["POS", "STOCK"]);
    setIsPermissionsModalOpen(true);
  };

  const openEmployeeDrawer = (emp: Employee) => {
    setSelectedEmp(emp);
    setDrawerTab("RESUMO");
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Tab select option triggers */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-bold border border-slate-200">
          <button
            onClick={() => setActiveTab("STAFF")}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "STAFF"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            Quadro de Funcionários ({employees.length})
          </button>
          
          <button
            onClick={() => setActiveTab("AUDIT")}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "AUDIT"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Terminal className="w-4 h-4 shrink-0" />
            Logs de Auditoria ({auditLogs.length})
          </button>

          <button
            onClick={() => setActiveTab("ERRORS")}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "ERRORS"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            Erros do Sistema ({auditLogs.filter(l => l.module === "Erros do Sistema").length})
          </button>

          <button
            onClick={() => setActiveTab("ACCESS_CHART")}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "ACCESS_CHART"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0 text-orange-500" />
            Frequência de Acessos
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "STAFF" && (
            <>
              {/* Batch HR transfer */}
              {selectedEmployees.length > 0 && (
                <button
                  onClick={handleSendToHR}
                  disabled={isSendingToHR}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700 py-2 px-3.5 rounded-xl text-xs font-bold text-amber-450 flex items-center gap-1.5 cursor-pointer transition shadow-sm animate-pulse"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSendingToHR ? "A enviar..." : `Enviar Folhas (${selectedEmployees.length}) para RH`}
                </button>
              )}

              {/* Export Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsExportStaffDropdownOpen(!isExportStaffDropdownOpen)}
                  className="border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 font-semibold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  Exportar ▼
                </button>
                {isExportStaffDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <button 
                      onClick={handleDownloadStaffCSV} 
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      Planilha CSV
                    </button>
                    <button 
                      onClick={handleDownloadStaffCSV} 
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      Excel (.xlsx)
                    </button>
                    <button 
                      onClick={handleDownloadStaffPDF} 
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-500" />
                      Documento PDF
                    </button>
                  </div>
                )}
              </div>
              
              <button
                onClick={openAddForm}
                className="bg-orange-500 hover:bg-orange-600 py-2 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 cursor-pointer transition hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                Adicionar Funcionário
              </button>
            </>
          )}

          {activeTab === "AUDIT" && (
            <div className="relative">
              <button
                onClick={() => setIsExportAuditDropdownOpen(!isExportAuditDropdownOpen)}
                className="border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 font-semibold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exportar Logs</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {isExportAuditDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <button 
                    onClick={handleDownloadAuditCSV} 
                    className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ficheiro CSV</span>
                  </button>
                  <button 
                    id="export-audit-pdf-dropdown-btn"
                    onClick={() => handleDownloadAuditPDF(false)} 
                    className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                    <span>Relatório PDF (Filtrado)</span>
                  </button>
                  <button 
                    id="export-full-audit-pdf-dropdown-btn"
                    onClick={() => handleDownloadAuditPDF(true)} 
                    className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>PDF Auditoria Completa ({auditLogs.length})</span>
                  </button>
                  <button 
                    onClick={handleCopyLogs} 
                    className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-orange-500" />
                    <span>Copiar Texto</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS TOAST MESSAGE */}
      {hrSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-medium flex items-center gap-2 shadow-sm animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{hrSuccessMessage}</span>
        </div>
      )}

      {/* TAB 1: EMPLOYEES QUADRO */}
      {activeTab === "STAFF" && (
        <StaffListTab
          recoveryRequests={recoveryRequests}
          onResetPasswordFromRequest={handleResetPasswordFromRequest}
          onResolveRecoveryRequest={async (id: string) => {
            try {
              await resolveRecoveryRequest(id);
              loadRecoveryRequests();
            } catch (err) {
              console.error("Erro ao resolver solicitação:", err);
            }
          }}
          staffStats={staffStats}
          currency={currency}
          currentRole={currentRole}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
          filteredEmployees={filteredEmployees}
          selectedEmployees={selectedEmployees}
          toggleSelectEmployee={toggleSelectEmployee}
          toggleSelectAll={toggleSelectAll}
          openEmployeeDrawer={openEmployeeDrawer}
          openEditModal={openEditModal}
          openPermissionsModal={openPermissionsModal}
          handleResetCredentialsDirectly={handleResetCredentialsDirectly}
          handleDeleteEmployee={handleDeleteEmployee}
        />
      )}

      {/* TAB 2: AUDIT TERMINAL DISP WITH SEVERITY LEVELS, EXPANDABLE ROWS, CONCURRENT REDUCTION (ITEM 11) */}
      {activeTab === "AUDIT" && (
        <StaffAuditTab
          auditSearch={auditSearch}
          setAuditSearch={setAuditSearch}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          auditModuleFilter={auditModuleFilter}
          setAuditModuleFilter={setAuditModuleFilter}
          modules={modules}
          onDownloadAuditCSV={handleDownloadAuditCSV}
          onDownloadAuditPDF={handleDownloadAuditPDF}
          onCopyLogs={handleCopyLogs}
          copiedLogs={copiedLogs}
          groupedAuditLogs={groupedAuditLogs}
          expandedLogId={expandedLogId}
          setExpandedLogId={setExpandedLogId}
          currentRole={currentRole}
          translateDatabaseMessage={translateDatabaseMessage}
          isDatabaseError={isDatabaseError}
        />
      )}

      {/* TAB 3: SYSTEM ERRORS / ERROS DO SISTEMA DIAGNOSTIC PANEL */}
      {activeTab === "ERRORS" && (
        <StaffErrorsTab
          systemErrors={systemErrors}
          isDiagnosing={isDiagnosing}
          onRunDiagnostics={handleRunDiagnostics}
          onSimulateFailure={handleSimulateFailure}
          diagnosticResult={diagnosticResult}
          expandedErrorLogId={expandedErrorLogId}
          setExpandedErrorLogId={setExpandedErrorLogId}
        />
      )}

      {/* TAB 4: ACCESS ANALYTICS CHART */}
      {activeTab === "ACCESS_CHART" && (
        <StaffAccessChartTab
          accessInsights={accessInsights}
          accessChartType={accessChartType}
          setAccessChartType={setAccessChartType}
          accessPeriod={accessPeriod}
          setAccessPeriod={setAccessPeriod}
          accessModule={accessModule}
          setAccessModule={setAccessModule}
          accessModulesList={accessModulesList}
          accessEmployee={accessEmployee}
          setAccessEmployee={setAccessEmployee}
          employees={employees}
          accessStartDate={accessStartDate}
          setAccessStartDate={setAccessStartDate}
          accessEndDate={accessEndDate}
          setAccessEndDate={setAccessEndDate}
          computedAccessDates={computedAccessDates}
          accessChartData={accessChartData}
          employeeColors={employeeColors}
        />
      )}

      {/* MODAL POPUP: Employee registrations Form */}
      <StaffEmployeeModal
        isFormOpen={isFormOpen}
        setIsFormOpen={setIsFormOpen}
        onSubmit={handleSubmitEmployee}
        localError={localError}
        name={name}
        setName={setName}
        role={role}
        setRole={setRole}
        contact={contact}
        setContact={setContact}
        salary={salary}
        setSalary={setSalary}
        username={username}
        setUsername={setUsername}
        pin={pin}
        setPin={setPin}
        setLocalError={setLocalError}
        email={email}
        setEmail={setEmail}
        sendEmailCredentials={sendEmailCredentials}
        setSendEmailCredentials={setSendEmailCredentials}
        emailSendingStatus={emailSendingStatus}
      />

      {/* MODAL POPUP: Employee Modify/Edit Form */}
      <StaffEditEmployeeModal
        isEditModalOpen={isEditModalOpen}
        setIsEditModalOpen={setIsEditModalOpen}
        selectedEmp={selectedEmp}
        onEditEmployee={handleEditEmployee}
        name={name}
        setName={setName}
        role={role}
        setRole={setRole}
        contact={contact}
        setContact={setContact}
        salary={salary}
        setSalary={setSalary}
        username={username}
        setUsername={setUsername}
        pin={pin}
        setPin={setPin}
        email={email}
        setEmail={setEmail}
        employeeStatus={employeeStatus}
        setEmployeeStatus={setEmployeeStatus}
      />

      {/* MODAL POPUP: Employee Permissions Assign */}
      <StaffPermissionsModal
        isPermissionsModalOpen={isPermissionsModalOpen}
        setIsPermissionsModalOpen={setIsPermissionsModalOpen}
        selectedEmp={selectedEmp}
        empPermissions={empPermissions}
        setEmpPermissions={setEmpPermissions}
        onSavePermissions={handleSavePermissions}
      />

      {/* MODERN SLIDEOVER DRAWER: Employee Full Profile Overview */}
      <StaffEmployeeDrawer
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
        selectedEmp={selectedEmp}
        drawerTab={drawerTab}
        setDrawerTab={setDrawerTab}
        onPaySalary={handlePaySalary}
        onPrintPayslip={handlePrintPayslip}
      />

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      <StaffDeleteModal
        employeeToDelete={employeeToDelete}
        onCancel={() => setEmployeeToDelete(null)}
        onConfirm={confirmDeleteEmployee}
      />

    </div>
  );
}

