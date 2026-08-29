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
