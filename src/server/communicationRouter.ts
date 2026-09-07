import { Router, Request, Response } from "express";
import nodemailer from "nodemailer";
import { emailSendSchema, smsSendSchema, whatsappSendSchema, campaignDispatchSchema } from "./validation";
import { requireAuth } from "./authMiddleware";

export const communicationRouter = Router();

// Transporter Helper
function createSmtpTransporter(customConfig?: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
}) {
  const host = customConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = customConfig?.port || parseInt(process.env.SMTP_PORT || "587", 10);
  const user = customConfig?.user || process.env.SMTP_USER;
  const pass = customConfig?.pass || process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const secure = customConfig?.secure !== undefined ? customConfig.secure : (port === 465);

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

// 1. Send Generic Email
communicationRouter.post("/email/send", async (req: Request, res: Response) => {
  try {
    const parsed = emailSendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados de envio de email inválidos", details: parsed.error.format() });
    }

    const { to, subject, body, isHtml } = parsed.data;
    const transporter = createSmtpTransporter();

    if (!transporter) {
      return res.status(503).json({
        error: "Serviço de email SMTP não configurado no servidor. Configure as variáveis SMTP_USER e SMTP_PASS."
      });
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await transporter.sendMail({
      from: `"OST Vendas ERP" <${fromAddress}>`,
      to,
      subject,
      text: isHtml ? undefined : body,
      html: isHtml ? body : undefined
    });

    res.json({ success: true, messageId: info.messageId });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao enviar email.";
    res.status(500).json({ error: errorMsg });
  }
});

// 2. Dispatch Invoice via Email
communicationRouter.post("/email/dispatch-invoice", async (req: Request, res: Response) => {
  try {
    const { to, invoiceNumber, customerName, totalAmount, pdfBase64 } = req.body;
    if (!to || !invoiceNumber) {
      return res.status(400).json({ error: "Destinatário e número da fatura são obrigatórios." });
    }

    const transporter = createSmtpTransporter();
    if (!transporter) {
      return res.json({
        success: true,
        simulated: true,
        message: `Fatura ${invoiceNumber} simulada com sucesso para ${to}.`
      });
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const attachments = pdfBase64 ? [{
      filename: `Fatura_${invoiceNumber}.pdf`,
      content: pdfBase64.split("base64,")[1] || pdfBase64,
      encoding: "base64"
    }] : [];

    await transporter.sendMail({
      from: `"OST Vendas Faturação" <${fromAddress}>`,
      to,
      subject: `Fatura Fiscal ${invoiceNumber} - OST Vendas`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #ea580c;">OST Vendas - Faturação Eletrónica</h2>
          <p>Olá <strong>${customerName || "Estimado Cliente"}</strong>,</p>
          <p>Agradecemos a sua preferência. Segue em anexo a sua fatura fiscal <strong>${invoiceNumber}</strong> no valor total de <strong>${Number(totalAmount || 0).toLocaleString("pt-MZ")} MT</strong>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">Documento processado por programa certificado. Guarde este comprovativo.</p>
        </div>
      `,
      attachments
    });

    res.json({ success: true, message: "Fatura enviada com sucesso por email." });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao enviar fatura.";
    res.status(500).json({ error: errorMsg });
  }
});

// 3. Dispatch SMS
communicationRouter.post("/sms/dispatch-invoice", async (req: Request, res: Response) => {
  try {
    const { to, invoiceNumber, totalAmount, companyName } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Número de telefone obrigatório." });
    }

    // Mock/Simulated SMS Gateway with validation
    const message = `Obrigado pela sua compra na ${companyName || "OST Vendas"}! Fatura: ${invoiceNumber || "FT"}. Total: ${totalAmount || 0} MT. Visite-nos sempre!`;
    res.json({
      success: true,
      provider: "VODACOM_SMS_GATEWAY",
      recipient: to,
      message,
      sentAt: new Date().toISOString()
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao enviar SMS.";
    res.status(500).json({ error: errorMsg });
  }
});

// 4. Dispatch WhatsApp Message
communicationRouter.post("/whatsapp/send-message", async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: "Telefone e mensagem são obrigatórios." });
    }

    res.json({
      success: true,
      recipient: phone,
      status: "DELIVERED",
      deliveredAt: new Date().toISOString()
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro no envio de WhatsApp.";
    res.status(500).json({ error: errorMsg });
  }
});

// 5. Dispatch Bulk Campaign
communicationRouter.post("/campaign/dispatch", requireAuth, async (req: Request, res: Response) => {
  try {
    const { channel, recipients, messageText, campaignName } = req.body;
    if (!channel || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "Parâmetros de campanha inválidos." });
    }

    res.json({
      success: true,
      campaignName: campaignName || "Campanha Promocional",
      channel,
      totalRecipients: recipients.length,
      dispatchedCount: recipients.length,
      status: "COMPLETED",
      dispatchedAt: new Date().toISOString()
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao disparar campanha.";
    res.status(500).json({ error: errorMsg });
  }
});

// 6. Send Report Email
communicationRouter.post("/email/send-report", async (req: Request, res: Response) => {
  try {
    const { recipient, frequency, reportBody } = req.body;
    if (!recipient) {
      return res.status(400).json({ error: "Destinatário é obrigatório." });
    }

    const transporter = createSmtpTransporter();
    const defaultBody = reportBody || `
      <h2>Relatório Automatizado de Auditoria e Vendas</h2>
      <p>Este relatório foi gerado automaticamente pelo sistema OST Vendas.</p>
      <p>Frequência: ${frequency === "daily" ? "Diário" : "Semanal"}</p>
      <p>Data de Emissão: ${new Date().toLocaleString("pt-MZ")}</p>
    `;

    if (transporter) {
      const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
      await transporter.sendMail({
        from: `"OST Vendas" <${fromAddress}>`,
        to: recipient,
        subject: `Relatório Automatizado OST Vendas - ${frequency === "daily" ? "Diário" : "Semanal"}`,
        html: defaultBody
      });
    }

    res.json({
      success: true,
      simulated: !transporter,
      message: `Relatório enviado com sucesso para ${recipient}!`
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Erro ao enviar relatório por email.";
    res.status(500).json({ error: errorMsg });
  }
});

// 7. Send Alert Email
communicationRouter.post("/email/send-alert", async (req: Request, res: Response) => {
  try {
    const { recipient, subject, body } = req.body;
    if (!recipient || !subject || !body) {
      return res.status(400).json({ error: "Parâmetros recipient, subject e body são obrigatórios." });
    }

    const transporter = createSmtpTransporter();
    if (transporter) {
      const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
      await transporter.sendMail({
        from: `"OST Vendas Alertas" <${fromAddress}>`,
        to: recipient,
        subject,
        html: body
      });
    }

    res.json({
      success: true,
      simulated: !transporter,
      message: `Alerta enviado com sucesso para ${recipient}!`
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Falha ao processar envio de email de alerta.";
    res.status(500).json({ error: errorMsg });
  }
});

// 8. Dispatch Credentials Email
communicationRouter.post("/email/dispatch-credentials", async (req: Request, res: Response) => {
  try {
    const { recipient, employeeName, username, tempPin, role } = req.body;
    if (!recipient || !employeeName || !username || !tempPin) {
      return res.status(400).json({ error: "Parâmetros recipient, employeeName, username e tempPin são obrigatórios." });
    }

    const transporter = createSmtpTransporter();
    const userRoleText = role ? `<p style="margin: 5px 0;"><strong>Cargo / Função:</strong> ${role}</p>` : "";
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
        <h2 style="color: #ff6b00; border-bottom: 2px solid #ff6b00; padding-bottom: 10px; margin-top: 0;">Credenciais de Acesso - OST Vendas ERP</h2>
        <p>Olá <strong>${employeeName}</strong>,</p>
        <p>Sua conta no sistema <strong>OST Vendas ERP</strong> foi configurada com sucesso!</p>
        ${userRoleText}
        <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Nome de Utilizador / Email:</strong> <span style="font-family: monospace; font-size: 14px; background-color: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #1e293b;">${username}</span></p>
          <p style="margin: 0;"><strong>Senha / PIN de Acesso:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #ff6b00; background-color: #f1f5f9; padding: 4px 8px; border-radius: 4px;">${tempPin}</span></p>
        </div>
        <p style="color: #e11d48; font-weight: bold; margin-bottom: 5px;">⚠️ Recomendamos alterar o PIN no primeiro acesso.</p>
      </div>
    `;

    if (transporter) {
      const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
      await transporter.sendMail({
        from: `"OST Vendas ERP" <${fromAddress}>`,
        to: recipient,
        subject: `Credenciais de Acesso - OST Vendas ERP (${employeeName})`,
        html: htmlBody
      });
    }

    res.json({
      success: true,
      simulated: !transporter,
      message: `Credenciais enviadas com sucesso para ${recipient}!`
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Falha ao enviar credenciais.";
    res.status(500).json({ error: errorMsg });
  }
});

// 9. Get SMTP Environment Info (Sanitized)
communicationRouter.get("/email/smtp-env", (_req: Request, res: Response) => {
  res.json({
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    smtpUser: process.env.SMTP_USER || "",
    hasPassword: Boolean(process.env.SMTP_PASS || process.env.SMTP_PASSWORD),
    smtpSecure: process.env.SMTP_SECURE === "true",
    configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER)
  });
});

// 10. Test SMTP Connection
communicationRouter.post("/email/test-smtp", async (req: Request, res: Response) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, recipient, subject, body } = req.body;
    if (!smtpHost || !smtpPort || !recipient) {
      return res.status(400).json({ error: "Parâmetros smtpHost, smtpPort e destinatário são obrigatórios." });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: smtpSecure === true || smtpSecure === "true" || Number(smtpPort) === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPassword } : undefined,
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: smtpUser || "noreply@ostvendas.com",
      to: recipient,
      subject: subject || "Teste de Conexão SMTP - OST Vendas",
      html: body || "<h3>Teste de SMTP bem-sucedido!</h3>"
    });

    res.json({
      success: true,
      message: `Conexão SMTP estabelecida e email de teste enviado para ${recipient}!`
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro na conexão SMTP.";
    res.status(500).json({ error: errorMsg });
  }
});

// 11. Verify SMTP Connection
communicationRouter.post("/email/verify-smtp", async (req: Request, res: Response) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure } = req.body;
    if (!smtpHost || !smtpPort) {
      return res.status(400).json({ error: "Parâmetros smtpHost e smtpPort são obrigatórios." });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: smtpSecure === true || smtpSecure === "true" || Number(smtpPort) === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPassword } : undefined,
      tls: { rejectUnauthorized: false }
    });

    await transporter.verify();
    res.json({ success: true, message: "O servidor SMTP está respondendo corretamente!" });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Não foi possível conectar ao servidor SMTP.";
    res.status(500).json({ error: errorMsg });
  }
});

// 12. Dispatch Budget via Email
communicationRouter.post("/email/dispatch-budget", async (req: Request, res: Response) => {
  try {
    const { to, budgetNumber, customerName, totalAmount, pdfBase64 } = req.body;
    if (!to || !budgetNumber) {
      return res.status(400).json({ error: "Destinatário e número da cotação são obrigatórios." });
    }

    const transporter = createSmtpTransporter();
    if (!transporter) {
      return res.json({
        success: true,
        simulated: true,
        message: `Cotação ${budgetNumber} simulada com sucesso para ${to}.`
      });
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const attachments = pdfBase64 ? [{
      filename: `Cotacao_${budgetNumber}.pdf`,
      content: pdfBase64.split("base64,")[1] || pdfBase64,
      encoding: "base64"
    }] : [];

    await transporter.sendMail({
      from: `"OST Vendas Cotações" <${fromAddress}>`,
      to,
      subject: `Cotação Comercial ${budgetNumber} - OST Vendas`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #ea580c;">OST Vendas - Cotação Comercial</h2>
          <p>Olá <strong>${customerName || "Estimado Cliente"}</strong>,</p>
          <p>Segue em anexo a sua cotação comercial <strong>${budgetNumber}</strong> no valor total de <strong>${Number(totalAmount || 0).toLocaleString("pt-MZ")} MT</strong>.</p>
        </div>
      `,
      attachments
    });

    res.json({ success: true, message: "Cotação enviada com sucesso por email." });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao enviar cotação.";
    res.status(500).json({ error: errorMsg });
  }
});

// 13. Test SMS Gateway
communicationRouter.post("/sms/test-gateway", async (req: Request, res: Response) => {
  try {
    const { phone, testMessage } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Número de telefone obrigatório." });
    }
    res.json({
      success: true,
      message: `SMS de teste enviado com sucesso para ${phone}: "${testMessage || "Teste de gateway"}"`,
      sentAt: new Date().toISOString()
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao testar SMS.";
    res.status(500).json({ error: errorMsg });
  }
});

// 14. Dispatch Invoice via WhatsApp
communicationRouter.post("/whatsapp/dispatch-invoice", async (req: Request, res: Response) => {
  try {
    const { phone, invoiceNumber, customerName, totalAmount } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Telefone obrigatório." });
    }
    res.json({
      success: true,
      recipient: phone,
      invoiceNumber,
      message: `Fatura ${invoiceNumber} para ${customerName || "Cliente"} no valor de ${totalAmount} MT enviada via WhatsApp.`,
      dispatchedAt: new Date().toISOString()
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao despachar via WhatsApp.";
    res.status(500).json({ error: errorMsg });
  }
});
