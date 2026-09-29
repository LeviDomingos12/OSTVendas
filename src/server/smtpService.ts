import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  enabled: boolean;
  senderName?: string;
  fromEmail?: string;
  source: "database" | "env" | "none";
  lastTestedAt?: string;
}

const DB_DIR = path.join(process.cwd(), "db_store");
const SETTINGS_FILE = path.join(DB_DIR, "settings.json");

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

/**
 * Lê as credenciais SMTP do banco de dados (settings.json / PostgreSQL).
 * Se configuradas no banco de dados, substituem integralmente as variáveis de ambiente .env.
 */
export function getActiveSmtpConfig(): SmtpConfig {
  let dbSettings: any = null;

  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      dbSettings = JSON.parse(content);
    } catch (err) {
      console.warn("[SMTP SERVICE] Falha ao ler settings.json:", err);
    }
  }

  // 1. Prioridade absoluta: Banco de Dados
  if (dbSettings && (dbSettings.smtpHost || dbSettings.smtpUser)) {
    const host = dbSettings.smtpHost || "";
    const port = Number(dbSettings.smtpPort || 587);
    const user = dbSettings.smtpUser || "";
    const pass = dbSettings.smtpPassword || "";
    const secure = dbSettings.smtpSecure === true || dbSettings.smtpSecure === "true" || port === 465;
    const enabled = dbSettings.smtpEnabled !== false;
    const senderName = dbSettings.smtpSenderName || dbSettings.companyName || "OST Vendas";
    const fromEmail = dbSettings.smtpFromEmail || user;

    return {
      host,
      port,
      user,
      pass,
      secure,
      enabled,
      senderName,
      fromEmail,
      source: "database",
      lastTestedAt: dbSettings.smtpLastTestedAt
    };
  }

  // 2. Fallback secundário: Variáveis de ambiente .env (caso ainda não configurado no banco de dados)
  if (process.env.SMTP_HOST || process.env.SMTP_USER) {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const enabled = true;
    const senderName = process.env.SMTP_SENDER_NAME || "OST Vendas";
    const fromEmail = process.env.SMTP_FROM || user;

    return {
      host,
      port,
      user,
      pass,
      secure,
      enabled,
      senderName,
      fromEmail,
      source: "env"
    };
  }

  // 3. Nenhuma credencial configurada
  return {
    host: "",
    port: 587,
    user: "",
    pass: "",
    secure: false,
    enabled: false,
    source: "none"
  };
}

/**
 * Salva as credenciais SMTP no banco de dados local (settings.json), substituindo as variáveis .env.
 */
export function saveActiveSmtpConfig(config: {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  smtpEnabled?: boolean;
  smtpSenderName?: string;
  smtpFromEmail?: string;
  smtpLastTestedAt?: string;
}): SmtpConfig {
  ensureDbDir();
  let currentSettings: any = {};

  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      currentSettings = JSON.parse(content);
    } catch {
      currentSettings = {};
    }
  }

  const updatedSettings = {
    ...currentSettings,
    smtpHost: config.smtpHost !== undefined ? config.smtpHost : (currentSettings.smtpHost || ""),
    smtpPort: config.smtpPort !== undefined ? Number(config.smtpPort) : (currentSettings.smtpPort || 587),
    smtpUser: config.smtpUser !== undefined ? config.smtpUser : (currentSettings.smtpUser || ""),
    // Preserva a senha existente caso não venha uma nova (evita apagar ao salvar outras configurações)
    smtpPassword: config.smtpPassword !== undefined && config.smtpPassword !== "" 
      ? config.smtpPassword 
      : (currentSettings.smtpPassword || ""),
    smtpSecure: config.smtpSecure !== undefined ? Boolean(config.smtpSecure) : (currentSettings.smtpSecure ?? false),
    smtpEnabled: config.smtpEnabled !== undefined ? Boolean(config.smtpEnabled) : (currentSettings.smtpEnabled ?? true),
    smtpSenderName: config.smtpSenderName !== undefined ? config.smtpSenderName : (currentSettings.smtpSenderName || ""),
    smtpFromEmail: config.smtpFromEmail !== undefined ? config.smtpFromEmail : (currentSettings.smtpFromEmail || ""),
    smtpLastTestedAt: config.smtpLastTestedAt !== undefined ? config.smtpLastTestedAt : currentSettings.smtpLastTestedAt,
    smtpSource: "database",
    updated_at: new Date().toISOString()
  };

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updatedSettings, null, 2), "utf-8");
  return getActiveSmtpConfig();
}

/**
 * Cria uma instância de transporte Nodemailer usando prioritariamente o banco de dados.
 */
export function createActiveSmtpTransporter(customOverride?: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
}) {
  const active = getActiveSmtpConfig();

  const host = customOverride?.host || active.host;
  const port = customOverride?.port !== undefined ? Number(customOverride.port) : active.port;
  const user = customOverride?.user !== undefined ? customOverride.user : active.user;
  const pass = customOverride?.pass !== undefined ? customOverride.pass : active.pass;
  const secure = customOverride?.secure !== undefined ? customOverride.secure : active.secure;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000
  });
}

/**
 * Testa o handshake com o servidor SMTP (sem enviar e-mail).
 */
export async function verifySmtpConnection(customConfig?: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
}) {
  const transporter = createActiveSmtpTransporter(customConfig);
  if (!transporter) {
    throw new Error("Credenciais incompletas: Host, Usuário e Senha são obrigatórios para validar a conexão.");
  }

  await transporter.verify();
  return { success: true, message: "Conexão com o servidor SMTP estabelecida com sucesso!" };
}

/**
 * Envia um e-mail de teste real usando as credenciais do banco de dados.
 */
export async function sendTestEmail(params: {
  recipient: string;
  customConfig?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    secure?: boolean;
    senderName?: string;
    fromEmail?: string;
  };
}) {
  const { recipient, customConfig } = params;
  if (!recipient) {
    throw new Error("E-mail destinatário é obrigatório.");
  }

  const active = getActiveSmtpConfig();
  const transporter = createActiveSmtpTransporter(customConfig);
  if (!transporter) {
    throw new Error("Servidor SMTP não configurado. Por favor, preencha o Host, Usuário e Palavra-passe.");
  }

  const senderName = customConfig?.senderName || active.senderName || "OST Vendas";
  const fromEmail = customConfig?.fromEmail || customConfig?.user || active.fromEmail || active.user || "noreply@ostvendas.com";
  const usedHost = customConfig?.host || active.host;
  const usedPort = customConfig?.port || active.port;
  const usedUser = customConfig?.user || active.user;

  const mailOptions = {
    from: `"${senderName}" <${fromEmail}>`,
    to: recipient,
    subject: "Teste de Conexão SMTP - OST Vendas ERP",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #0f172a;">
        <div style="border-bottom: 2px solid #f97316; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #ea580c; margin: 0; font-size: 20px;">OST Vendas - Validação de Servidor SMTP</h2>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Configuração Direta no Banco de Dados (Substituição de .env)</p>
        </div>

        <p style="font-size: 15px; line-height: 1.5; color: #334155;">
          Olá! Se você está a visualizar este e-mail, o seu servidor de envio SMTP foi <strong>configurado e validado com sucesso no banco de dados</strong> do sistema.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Parâmetros Utilizados na Conexão</h4>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 140px;">Servidor (Host):</td>
              <td style="padding: 4px 0; font-family: monospace; font-weight: bold; color: #0f172a;">${usedHost}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Porta de Envio:</td>
              <td style="padding: 4px 0; font-family: monospace; font-weight: bold; color: #0f172a;">${usedPort}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Usuário Autenticado:</td>
              <td style="padding: 4px 0; font-family: monospace; font-weight: bold; color: #0f172a;">${usedUser}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Origem das Definições:</td>
              <td style="padding: 4px 0; font-weight: bold; color: #16a34a;">Banco de Dados do Sistema (Substitui .env)</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Data do Envio:</td>
              <td style="padding: 4px 0; color: #0f172a;">${new Date().toLocaleString("pt-MZ")}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.4;">
          A partir de agora, relatórios automatizados, cópias de segurança para e-mail, comprovativos de faturas e alertas de stock utilizarão estas credenciais diretamente da base de dados.
        </p>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
          Documento gerado automaticamente pelo núcleo de comunicação do OST Vendas ERP.
        </div>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  return {
    success: true,
    messageId: info.messageId,
    message: `E-mail de teste enviado com sucesso para ${recipient}!`
  };
}
