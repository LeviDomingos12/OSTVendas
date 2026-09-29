import React, { useState, useEffect } from "react";
import { 
  Server, 
  Mail, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Send, 
  Save, 
  RefreshCw, 
  Database, 
  Check, 
  Info, 
  Zap, 
  Lock, 
  Key, 
  FileText
} from "lucide-react";
import { SystemSettings, UserRole, Employee } from "../types";

interface SmtpConfigModuleProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
  activeUser: Employee | null;
  currentRole: UserRole;
}

export default function SmtpConfigModule({
  settings,
  onUpdateSettings,
  onAddAuditLog,
  onShowToast,
  activeUser,
  currentRole: _currentRole
}: SmtpConfigModuleProps) {
  // Form fields
  const [smtpHost, setSmtpHost] = useState(settings.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState<number>(settings.smtpPort || 587);
  const [smtpUser, setSmtpUser] = useState(settings.smtpUser || "");
  const [smtpPassword, setSmtpPassword] = useState(settings.smtpPassword || "");
  const [smtpSecure, setSmtpSecure] = useState<boolean>(settings.smtpSecure ?? false);
  const [smtpEnabled, setSmtpEnabled] = useState<boolean>(settings.smtpEnabled ?? true);
  const [smtpSenderName, setSmtpSenderName] = useState(settings.smtpSenderName || settings.companyName || "OST Vendas");
  const [smtpFromEmail, setSmtpFromEmail] = useState(settings.smtpFromEmail || settings.smtpUser || "");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState(
    settings.reportRecipientEmail || activeUser?.email || settings.smtpUser || ""
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastVerifyResult, setLastVerifyResult] = useState<{
    success: boolean;
    message: string;
    timestamp?: string;
  } | null>(null);
  const [lastTestResult, setLastTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp?: string;
  } | null>(null);
  const [serverSource, setServerSource] = useState<"database" | "env" | "none">("database");
  const [serverHasStoredPass, setServerHasStoredPass] = useState(false);

  // Carrega status atual do servidor backend
  useEffect(() => {
    fetchServerSmtpStatus();
  }, []);

  // Sincroniza estados caso as props mudem externamente
  useEffect(() => {
    if (settings.smtpHost !== undefined && settings.smtpHost !== smtpHost) {
      setSmtpHost(settings.smtpHost || "");
    }
    if (settings.smtpPort !== undefined && settings.smtpPort !== smtpPort) {
      setSmtpPort(settings.smtpPort || 587);
    }
    if (settings.smtpUser !== undefined && settings.smtpUser !== smtpUser) {
      setSmtpUser(settings.smtpUser || "");
    }
    if (settings.smtpPassword !== undefined && settings.smtpPassword !== smtpPassword) {
      setSmtpPassword(settings.smtpPassword || "");
    }
    if (settings.smtpSecure !== undefined && settings.smtpSecure !== smtpSecure) {
      setSmtpSecure(settings.smtpSecure);
    }
    if (settings.smtpEnabled !== undefined && settings.smtpEnabled !== smtpEnabled) {
      setSmtpEnabled(settings.smtpEnabled);
    }
    if (settings.smtpSenderName !== undefined && settings.smtpSenderName !== smtpSenderName) {
      setSmtpSenderName(settings.smtpSenderName || settings.companyName || "OST Vendas");
    }
    if (settings.smtpFromEmail !== undefined && settings.smtpFromEmail !== smtpFromEmail) {
      setSmtpFromEmail(settings.smtpFromEmail || settings.smtpUser || "");
    }
  }, [settings]);

  const fetchServerSmtpStatus = async () => {
    try {
      const res = await fetch("/api/settings/smtp");
      if (res.ok) {
        const data = await res.json();
        setServerSource(data.source || (data.smtpHost ? "database" : "none"));
        setServerHasStoredPass(Boolean(data.hasPassword));
        if (data.smtpHost && !smtpHost) setSmtpHost(data.smtpHost);
        if (data.smtpPort && !smtpPort) setSmtpPort(data.smtpPort);
        if (data.smtpUser && !smtpUser) setSmtpUser(data.smtpUser);
        if (data.smtpSenderName && !smtpSenderName) setSmtpSenderName(data.smtpSenderName);
        if (data.smtpFromEmail && !smtpFromEmail) setSmtpFromEmail(data.smtpFromEmail);
        if (data.lastTestedAt) {
          setLastVerifyResult({
            success: true,
            message: "Configuração validada e registrada no banco de dados.",
            timestamp: new Date(data.lastTestedAt).toLocaleTimeString("pt-MZ")
          });
        }
      }
    } catch {
      // Ignora erro silenciosamente
    }
  };

  // Preset rápido de provedores
  const applyPreset = (preset: "gmail" | "outlook" | "cpanel" | "custom") => {
    if (preset === "gmail") {
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(587);
      setSmtpSecure(false);
      if (onShowToast) {
        onShowToast("Preset do Gmail aplicado. Lembre-se de utilizar uma 'Palavra-passe de Aplicação' de 16 caracteres se possuir 2FA ativado.", "info", "Preset Gmail");
      }
    } else if (preset === "outlook") {
      setSmtpHost("smtp.office365.com");
      setSmtpPort(587);
      setSmtpSecure(false);
      if (onShowToast) {
        onShowToast("Preset do Outlook / Office 365 aplicado. Porta 587 (STARTTLS).", "info", "Preset Microsoft");
      }
    } else if (preset === "cpanel") {
      setSmtpHost(smtpHost || "mail.seudominio.co.mz");
      setSmtpPort(465);
      setSmtpSecure(true);
      if (onShowToast) {
        onShowToast("Preset cPanel / SSL aplicado. Porta 465 com SSL/TLS.", "info", "Preset cPanel");
      }
    }
  };

  // Validação e Handshake (Sem enviar e-mail)
  const handleVerifyConnection = async () => {
    if (!smtpHost.trim()) {
      if (onShowToast) onShowToast("Por favor, preencha o Servidor SMTP (Host).", "warning");
      return;
    }
    if (!smtpUser.trim()) {
      if (onShowToast) onShowToast("Por favor, preencha o Utilizador SMTP.", "warning");
      return;
    }

    setIsVerifying(true);
    setLastVerifyResult(null);

    try {
      const res = await fetch("/api/email/verify-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort),
          smtpUser: smtpUser.trim(),
          smtpPassword: smtpPassword || undefined,
          smtpSecure
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao conectar ao servidor SMTP.");
      }

      setLastVerifyResult({
        success: true,
        message: "Conexão bem-sucedida! O servidor SMTP respondeu com sucesso.",
        timestamp: new Date().toLocaleTimeString("pt-MZ")
      });
      if (onShowToast) {
        onShowToast("Conexão SMTP validada com sucesso!", "success", "Servidor Conectado");
      }
      onAddAuditLog("Teste de Conexão SMTP", "SERVIÇO DE E-MAIL", `Handshake com ${smtpHost}:${smtpPort} efetuado com sucesso.`);
    } catch (err: any) {
      setLastVerifyResult({
        success: false,
        message: err.message || "Erro de conexão ao servidor SMTP.",
        timestamp: new Date().toLocaleTimeString("pt-MZ")
      });
      if (onShowToast) {
        onShowToast(err.message, "error", "Falha de Conexão");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Envio de E-mail de Teste Real
  const handleSendTestEmail = async () => {
    if (!smtpHost.trim()) {
      if (onShowToast) onShowToast("Por favor, preencha o Servidor SMTP (Host).", "warning");
      return;
    }
    if (!testRecipient.trim()) {
      if (onShowToast) onShowToast("Informe o e-mail de destino para o teste.", "warning");
      return;
    }

    setIsSendingTest(true);
    setLastTestResult(null);

    try {
      const res = await fetch("/api/email/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort),
          smtpUser: smtpUser.trim(),
          smtpPassword: smtpPassword || undefined,
          smtpSecure,
          senderName: smtpSenderName.trim() || "OST Vendas",
          fromEmail: smtpFromEmail.trim() || smtpUser.trim(),
          recipient: testRecipient.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao enviar e-mail de teste.");
      }

      setLastTestResult({
        success: true,
        message: `E-mail enviado com sucesso para ${testRecipient}! Verifique a caixa de entrada.`,
        timestamp: new Date().toLocaleTimeString("pt-MZ")
      });
      if (onShowToast) {
        onShowToast(`E-mail de teste despachado para ${testRecipient}!`, "success", "E-mail Enviado");
      }
      onAddAuditLog(
        "Disparo E-mail de Teste",
        "SERVIÇO DE E-MAIL",
        `E-mail de teste enviado para ${testRecipient} via servidor ${smtpHost}.`
      );
    } catch (err: any) {
      setLastTestResult({
        success: false,
        message: err.message || "Falha no disparo do e-mail de teste.",
        timestamp: new Date().toLocaleTimeString("pt-MZ")
      });
      if (onShowToast) {
        onShowToast(err.message, "error", "Erro no Envio");
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  // Salvar no Banco de Dados (Substitui .env)
  const handleSaveToDatabase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!smtpHost.trim()) {
      if (onShowToast) onShowToast("O Host do servidor SMTP é obrigatório.", "warning");
      return;
    }
    if (!smtpUser.trim()) {
      if (onShowToast) onShowToast("O Usuário/E-mail do servidor SMTP é obrigatório.", "warning");
      return;
    }

    setIsSaving(true);

    const newSettingsPayload: Partial<SystemSettings> = {
      smtpHost: smtpHost.trim(),
      smtpPort: Number(smtpPort) || 587,
      smtpUser: smtpUser.trim(),
      smtpPassword: smtpPassword.trim(),
      smtpSecure,
      smtpEnabled,
      smtpSenderName: smtpSenderName.trim() || "OST Vendas",
      smtpFromEmail: smtpFromEmail.trim() || smtpUser.trim(),
      smtpSource: "database",
      smtpLastTestedAt: new Date().toISOString()
    };

    try {
      // 1. Atualiza estado central e banco de dados via serviço React (Supabase / PostgreSQL)
      onUpdateSettings(newSettingsPayload);

      // 2. Persiste diretamente no backend Express (settings.json e Cloud SQL) para substituição imediata de .env
      const response = await fetch("/api/settings/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newSettingsPayload,
          smtpLastTestedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao salvar credenciais no servidor backend.");
      }

      setServerSource("database");
      setServerHasStoredPass(Boolean(smtpPassword.trim() || serverHasStoredPass));

      onAddAuditLog(
        "Configurações SMTP Salvas",
        "SERVIÇO DE E-MAIL",
        `Credenciais do servidor SMTP (${smtpHost.trim()}:${smtpPort}) gravadas no banco de dados, substituindo variáveis .env.`
      );

      if (onShowToast) {
        onShowToast(
          "Credenciais SMTP salvas no banco de dados com sucesso! O sistema não depende mais do arquivo .env.",
          "success",
          "Banco de Dados Atualizado"
        );
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(err.message || "Erro ao gravar credenciais SMTP.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-black font-sans">
      {/* Top Banner: Informação de Substituição do .env */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-orange-100 text-black rounded-xl shrink-0 mt-0.5">
              <Server className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-black">
                  Configurações de Servidor SMTP & E-mail
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-black rounded-full text-[11px] font-bold border border-emerald-300 flex items-center gap-1">
                  <Database className="w-3 h-3 text-black" />
                  Salvo no Banco de Dados
                </span>
                <span className="px-2.5 py-0.5 bg-orange-100 text-black rounded-full text-[11px] font-bold border border-orange-300">
                  Substitui .env
                </span>
              </div>
              <p className="text-xs text-black mt-1 leading-relaxed max-w-3xl">
                Configure as credenciais SMTP diretamente nesta tela para envio de faturas, relatórios automáticos, alertas de stock e reposição de PINs.
                As configurações são guardadas com segurança na base de dados, eliminando qualquer necessidade de variáveis de ambiente manuais no arquivo <code className="bg-slate-100 px-1 py-0.5 rounded text-black font-mono font-bold">.env</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={fetchServerSmtpStatus}
              title="Recarregar estado do servidor"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-black rounded-xl border border-slate-300 cursor-pointer transition flex items-center gap-1.5 text-xs font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5 text-black" />
              Sincronizar
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black block">Origem Ativa</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${serverSource === "database" ? "bg-emerald-600" : "bg-amber-600"}`} />
              <span className="text-xs font-bold text-black">
                {serverSource === "database" ? "Banco de Dados (Autoritativo)" : serverSource === "env" ? "Variáveis .env (Fallback)" : "Não configurado"}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black block">Servidor de Envio</span>
            <div className="flex items-center gap-2 mt-1">
              <Mail className="w-3.5 h-3.5 text-black" />
              <span className="text-xs font-bold text-black truncate">
                {smtpHost ? `${smtpHost}:${smtpPort}` : "Nenhum host definido"}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black block">Credencial Protegida</span>
            <div className="flex items-center gap-2 mt-1">
              <Lock className="w-3.5 h-3.5 text-black" />
              <span className="text-xs font-bold text-black">
                {smtpPassword || serverHasStoredPass ? "Palavra-passe configurada ✓" : "Sem senha"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Form on Left, Diagnostic & Presets on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLUMNS: Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveToDatabase} className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-black flex items-center gap-2">
                  <Key className="w-4 h-4 text-black" />
                  Credenciais de Autenticação SMTP
                </h3>
                <p className="text-[11px] text-black">
                  Preencha os dados do seu provedor de e-mail (Gmail, Outlook, Hostinger, cPanel, etc.).
                </p>
              </div>

              {/* Toggle de Ativação do Serviço */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtpEnabled}
                  onChange={(e) => setSmtpEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                />
                <span className="text-xs font-bold text-black">
                  Ativar Envio de E-mails
                </span>
              </label>
            </div>

            {/* Presets Rápidos */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-black block">
                Atalhos Rápidos de Provedor
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset("gmail")}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-black text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-black" />
                  Google / Gmail (587 TLS)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("outlook")}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-black text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-black" />
                  Outlook / Office 365 (587)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("cpanel")}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-black text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-black" />
                  cPanel / Webmail (465 SSL)
                </button>
              </div>
            </div>

            {/* Host & Porta */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-black block">
                  Servidor SMTP (Host) <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Server className="absolute left-3 top-2.5 w-4 h-4 text-black" />
                  <input
                    type="text"
                    required
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="ex: smtp.gmail.com ou mail.suaempresa.co.mz"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs font-mono font-bold text-black placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-black block">
                  Porta de Conexão <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs font-mono font-bold text-black focus:outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => { setSmtpPort(587); setSmtpSecure(false); }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${smtpPort === 587 ? "bg-black text-white" : "bg-slate-200 text-black"}`}
                  >
                    587
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSmtpPort(465); setSmtpSecure(true); }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${smtpPort === 465 ? "bg-black text-white" : "bg-slate-200 text-black"}`}
                  >
                    465
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSmtpPort(25); setSmtpSecure(false); }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${smtpPort === 25 ? "bg-black text-white" : "bg-slate-200 text-black"}`}
                  >
                    25
                  </button>
                </div>
              </div>
            </div>

            {/* Usuário e Senha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-black block">
                  Utilizador / E-mail de Autenticação <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-black" />
                  <input
                    type="text"
                    required
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="ex: faturacao@empresa.co.mz"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs font-mono font-bold text-black placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-black block">
                  Palavra-passe / Senha de Aplicação <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-black" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder={serverHasStoredPass ? "•••••••••••• (Já gravada no banco)" : "Digite a senha do e-mail"}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-9 pr-10 text-xs font-mono font-bold text-black placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-2.5 text-black hover:opacity-70 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-black">
                  No Gmail com 2FA, crie uma <strong>Palavra-passe de Aplicação</strong> de 16 letras na sua Conta Google.
                </p>
              </div>
            </div>

            {/* Segurança e Criptografia */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-bold text-black block">
                Segurança de Conexão & Criptografia
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${!smtpSecure ? "border-orange-500 bg-orange-50/60" : "border-slate-300 bg-slate-50"}`}>
                  <input
                    type="radio"
                    name="smtpSecurity"
                    checked={!smtpSecure}
                    onChange={() => setSmtpSecure(false)}
                    className="mt-0.5 text-orange-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-black block">STARTTLS / TLS (Recomendado para Porta 587)</span>
                    <span className="text-[11px] text-black block mt-0.5">
                      Inicia conexão padrão e atualiza para canal cifrado seguro. Padrão do Gmail e Outlook.
                    </span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${smtpSecure ? "border-orange-500 bg-orange-50/60" : "border-slate-300 bg-slate-50"}`}>
                  <input
                    type="radio"
                    name="smtpSecurity"
                    checked={smtpSecure}
                    onChange={() => setSmtpSecure(true)}
                    className="mt-0.5 text-orange-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-black block">SSL / TLS Implícito (Porta 465)</span>
                    <span className="text-[11px] text-black block mt-0.5">
                      Conexão encriptada de ponta a ponta desde o início. Comum em cPanel, Hostinger e servidores dedicados.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Remetente Visual (From Name e From Email) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-black block">
                  Nome do Remetente Exibido aos Clientes
                </label>
                <input
                  type="text"
                  value={smtpSenderName}
                  onChange={(e) => setSmtpSenderName(e.target.value)}
                  placeholder="ex: OST Vendas - Faturação"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs font-bold text-black placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white"
                />
                <span className="text-[10px] text-black block">
                  Aparecerá como o remetente nos e-mails recebidos pelos clientes e gestores.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-black block">
                  E-mail de Envio (From Address)
                </label>
                <input
                  type="email"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  placeholder="ex: noreply@suaempresa.co.mz (opcional)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs font-mono font-bold text-black placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white"
                />
                <span className="text-[10px] text-black block">
                  Caso em branco, utiliza o mesmo e-mail de autenticação informado acima.
                </span>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-black">
                <Database className="w-4 h-4 text-black" />
                <span>Armazenamento: <strong>PostgreSQL / settings (Base de Dados)</strong></span>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>A Gravar no Banco...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-white" />
                    <span>Salvar no Banco de Dados</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT 1 COLUMN: Diagnostics & Real Tests */}
        <div className="space-y-6">
          {/* Card: Testes e Diagnóstico em Tempo Real */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <ShieldCheck className="w-4 h-4 text-black" />
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">
                Diagnóstico & Testes em Tempo Real
              </h3>
            </div>

            {/* Ação 1: Testar Handshake do Servidor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-black">1. Teste de Handshake SMTP</span>
                <span className="text-[10px] font-mono text-black">Sem envio de e-mail</span>
              </div>
              <p className="text-[11px] text-black leading-snug">
                Verifica se o servidor de e-mail responde no host e porta indicados e aceita a autenticação.
              </p>
              <button
                type="button"
                onClick={handleVerifyConnection}
                disabled={isVerifying}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>A Testar Conexão...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-black" />
                    <span>Testar Conexão SMTP</span>
                  </>
                )}
              </button>

              {lastVerifyResult && (
                <div className={`p-2.5 rounded-xl border text-[11px] font-bold mt-2 ${
                  lastVerifyResult.success 
                    ? "bg-emerald-50 text-black border-emerald-300" 
                    : "bg-red-50 text-black border-red-300"
                }`}>
                  <div className="flex items-center gap-1.5">
                    {lastVerifyResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                    )}
                    <span>{lastVerifyResult.message}</span>
                  </div>
                  {lastVerifyResult.timestamp && (
                    <span className="block text-[10px] text-black mt-1 font-mono">
                      Testado às {lastVerifyResult.timestamp}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Ação 2: Envio de E-mail de Teste */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-black">2. Disparo de E-mail Real</span>
                <span className="text-[10px] font-mono text-black">Teste ponta-a-ponta</span>
              </div>
              <p className="text-[11px] text-black leading-snug">
                Envia uma mensagem de demonstração formatada em HTML para confirmar a entrega na caixa postal.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-black uppercase block">Destinatário do Teste</label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="ex: seu.email@gmail.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-1.5 px-3 text-xs font-mono font-bold text-black focus:outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTest}
                className="w-full py-2 px-3 bg-black hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-xs disabled:opacity-50"
              >
                {isSendingTest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>A Disparar E-mail...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span>Disparar E-mail de Teste</span>
                  </>
                )}
              </button>

              {lastTestResult && (
                <div className={`p-2.5 rounded-xl border text-[11px] font-bold mt-2 ${
                  lastTestResult.success 
                    ? "bg-emerald-50 text-black border-emerald-300" 
                    : "bg-red-50 text-black border-red-300"
                }`}>
                  <div className="flex items-center gap-1.5">
                    {lastTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                    )}
                    <span>{lastTestResult.message}</span>
                  </div>
                  {lastTestResult.timestamp && (
                    <span className="block text-[10px] text-black mt-1 font-mono">
                      Despachado às {lastTestResult.timestamp}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card: Guia de Provedores e Instruções */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <Info className="w-4 h-4 text-black" />
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">
                Orientações de Configuração
              </h3>
            </div>

            <div className="space-y-2.5 text-xs text-black">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-black block mb-1">Gmail / Google Workspace</span>
                <p className="text-[11px] leading-relaxed text-black">
                  1. Aceda à Segurança da Conta Google.<br />
                  2. Ative a <strong>Verificação em 2 Passos</strong>.<br />
                  3. Em "Palavras-passe de aplicação", gere uma senha para "Outra (OST Vendas)".<br />
                  4. Cole a chave de 16 caracteres no campo de palavra-passe.
                </p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-black block mb-1">Substituição Permanente de .env</span>
                <p className="text-[11px] leading-relaxed text-black">
                  Quando gravadas aqui, estas credenciais são carregadas pelo servidor em tempo de execução e possuem prioridade sobre quaisquer variáveis do arquivo .env. Não é necessário reiniciar o servidor.
                </p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-black block mb-1">Serviços do Sistema que Usam SMTP</span>
                <ul className="text-[11px] list-disc list-inside space-y-0.5 text-black">
                  <li>Envio de comprovativos fiscais de faturas em PDF</li>
                  <li>Relatórios financeiros executivos programados</li>
                  <li>Alertas automáticos de stock mínimo</li>
                  <li>Recuperação segura de PINs de colaboradores</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
