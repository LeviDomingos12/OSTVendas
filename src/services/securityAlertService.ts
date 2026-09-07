import { Employee, SystemSettings, GeoLocationInfo } from "../types";
import { sendEmail } from "../lib/gmail";
import { sendSMS } from "../lib/sms";

export async function fetchGeoLocationInfo(): Promise<GeoLocationInfo> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) throw new Error("Failed to fetch IP details");
    const data = await res.json();
    if (data && data.ip) {
      return {
        ip: data.ip,
        city: data.city || "Maputo",
        region: data.region || "Maputo Cidade",
        country: data.country_name || "Moçambique",
        loc: data.latitude && data.longitude ? `${data.latitude},${data.longitude}` : "-25.9692,32.5732",
        org: data.org || "TDM / Tmcel Moçambique",
        timezone: data.timezone || "Africa/Maputo"
      };
    }
  } catch (e) {
    // Fallback on network failure or adblock
  }

  return {
    ip: "102.81.12.94",
    city: "Maputo",
    region: "Maputo Cidade",
    country: "Moçambique",
    loc: "-25.9692,32.5732",
    org: "TDM / Tmcel Moçambique",
    timezone: "Africa/Maputo"
  };
}

export function detectDeviceType(): string {
  if (typeof navigator === "undefined") return "Desktop";
  const ua = navigator.userAgent;
  let dev = "Desktop";
  if (/mobile/i.test(ua)) dev = "Telemóvel / Mobile";
  else if (/tablet/i.test(ua)) dev = "Tablet";

  if (ua.includes("Chrome")) dev += " (Chrome)";
  else if (ua.includes("Firefox")) dev += " (Firefox)";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) dev += " (Safari)";
  else if (ua.includes("Edge")) dev += " (Edge)";
  return dev;
}

export interface TriggerPanicParams {
  activeUser: Employee | null;
  userIpInfo: GeoLocationInfo | null;
  deviceInfo: string;
  employees: Employee[];
  settings: SystemSettings;
  onAddAuditLog: (action: string, module: string, details: string) => void;
}

export interface TriggerPanicResult {
  successfulEmailsCount: number;
  successfulSmsCount: number;
}

export async function triggerPanicAlert({
  activeUser,
  userIpInfo,
  deviceInfo,
  employees,
  settings,
  onAddAuditLog
}: TriggerPanicParams): Promise<TriggerPanicResult> {
  const operatorName = activeUser?.name || "Operador Desconhecido";
  const operatorRole = activeUser?.role || "Operador";
  const ipStr = userIpInfo ? userIpInfo.ip : "102.81.12.94";
  const locStr = userIpInfo ? `${userIpInfo.city}, ${userIpInfo.country}` : "Maputo, Moçambique";
  const devStr = deviceInfo || "Chrome Desktop";

  // 1. Add Immediate Critical Audit Log
  onAddAuditLog(
    "BOTÃO DE PÂNICO ACIONADO",
    "SEGURANÇA",
    `ALERTA EMERGENCIAL CRÍTICO! O operador ${operatorName} acionou o botão de pânico. IP: ${ipStr} (${locStr}). Dispositivo: ${devStr}. Notificações em massa enviadas aos administradores.`
  );

  // 2. Identify Administrators
  const admins = employees.filter(emp => {
    if (!emp.role) return false;
    const roleLower = emp.role.toLowerCase();
    return (
      roleLower.includes("admin") ||
      roleLower.includes("gestor") ||
      roleLower.includes("supervisor") ||
      roleLower.includes("gerente") ||
      roleLower.includes("diretor")
    );
  });

  // 3. Extract Emails and Phone numbers
  const emails = admins.map(a => a.email).filter(Boolean) as string[];
  const phones = admins.map(a => a.contact).filter(Boolean) as string[];

  if (settings.reportRecipientEmail && !emails.includes(settings.reportRecipientEmail)) {
    emails.push(settings.reportRecipientEmail);
  }

  // Default emergency contact as fallback if empty
  if (emails.length === 0) {
    emails.push("levidomingos12@gmail.com");
  }
  if (phones.length === 0) {
    phones.push("+258840000000");
  }

  // 4. Construct Alerta Body
  const subject = `🚨 [OST VENDAS] ALERTA DE PÂNICO EMERGENCIAL DE SEGURANÇA!`;
  const emailHtmlBody = `
    <div style="font-family: Arial, sans-serif; border: 3px solid #dc2626; border-radius: 16px; overflow: hidden; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 25px rgba(220, 38, 38, 0.2);">
      <div style="background-color: #dc2626; padding: 24px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px;">🚨 ALERTA CRÍTICO DE PÂNICO</h2>
        <p style="margin: 8px 0 0; font-size: 13px; font-weight: bold; text-transform: uppercase; background-color: rgba(0,0,0,0.2); display: inline-block; padding: 4px 12px; border-radius: 9999px;">SISTEMA COMERCIAL OST VENDAS</p>
      </div>
      <div style="padding: 28px; color: #1e293b; background-color: #ffffff;">
        <p style="font-size: 16px; line-height: 1.6; margin-top: 0; font-weight: 600; color: #991b1b;">
          ATENÇÃO ADMINISTRADOR! O Botão de Pânico foi acionado voluntariamente a partir do ponto de venda.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b; width: 140px;">Operador Ativo:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #0f172a;">${operatorName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Função do Utilizador:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #dc2626;">${operatorRole}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-family: monospace;">${new Date().toLocaleString('pt-MZ')} (Maputo)</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Endereço IP:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-family: monospace; font-weight: bold;">${ipStr}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Localização IP:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: bold;">${locStr}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Dispositivo/Browser:</td>
              <td style="padding: 8px 0; color: #334155;">${devStr}</td>
            </tr>
          </table>
        </div>
        <div style="background-color: #fef2f2; border-left: 5px solid #dc2626; padding: 18px; border-radius: 8px; margin: 20px 0;">
          <strong style="color: #991b1b; display: block; margin-bottom: 6px; font-size: 14px;">⚠️ PROCEDIMENTO DE SEGURANÇA:</strong>
          <p style="margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.6;">
            1. Verifique as câmeras ou canais de comunicação com a loja imediatamente.<br/>
            2. Caso não consiga contato com o operador, acione os canais policiais locais ou segurança patrimonial.<br/>
            3. O log crítico foi gravado permanentemente na auditoria do sistema para efeitos legais.
          </p>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 18px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0;">
        Enviado por: <strong>OST Vendas Moçambique Fiscal Cloud</strong>. Não responda a esta mensagem eletrônica.
      </div>
    </div>
  `;

  const smsText = `🚨 OST VENDAS - PANICO ATIVADO! Operador: ${operatorName} (${operatorRole}). IP: ${ipStr} (${locStr}). Verifique a loja de imediato!`;

  // 5. Send Email Notifications
  const emailPromises = emails.map(async (email) => {
    try {
      await sendEmail({
        to: email,
        subject,
        body: emailHtmlBody,
        isHtml: true
      });
      return { email, success: true };
    } catch (err: unknown) {
      console.error(`[Panic] Failed to send email alert to ${email}:`, err);
      return { email, success: false };
    }
  });

  // 6. Send SMS Notifications
  const smsPromises = phones.map(async (phone) => {
    try {
      await sendSMS(phone, smsText);
      return { phone, success: true };
    } catch (err: unknown) {
      console.error(`[Panic] Failed to send SMS alert to ${phone}:`, err);
      return { phone, success: false };
    }
  });

  const emailResults = await Promise.all(emailPromises);
  const smsResults = await Promise.all(smsPromises);

  return {
    successfulEmailsCount: emailResults.filter(r => r.success).length,
    successfulSmsCount: smsResults.filter(r => r.success).length
  };
}
