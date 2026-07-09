import { getAccessToken } from "./firebase";

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: { filename: string; content: string; mimeType: string }[];
}

export const sendEmail = async ({ to, subject, body, isHtml = true, attachments }: SendEmailParams) => {
  try {
    // 1. Try sending via server-side SMTP first (which uses settings/env configs)
    const serverResponse = await fetch("/api/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        body,
      }),
    });

    if (serverResponse.ok) {
      const data = await serverResponse.json();
      return data;
    } else {
      console.warn("[SMTP FAILED] Falling back to client-side Gmail API if token is available.");
    }
  } catch (error) {
    console.error("[SMTP ERROR] Failed to send via SMTP, trying Google API fallback:", error);
  }

  // 2. Fallback to client-side Google Gmail API if access token is available
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error(
      "Nenhuma configuração de SMTP ativa no servidor e não há nenhuma conta Google autenticada " +
      "para envio via API do Gmail. Por favor, configure as credenciais SMTP nas Definições ou faça login com Google."
    );
  }

  let emailContent = "";

  if (attachments && attachments.length > 0) {
    const boundary = "----=_NextPart_" + Math.random().toString(36).substring(2);
    emailContent += `To: ${to}\r\n`;
    emailContent += `Subject: ${subject}\r\n`;
    emailContent += `MIME-Version: 1.0\r\n`;
    emailContent += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    
    emailContent += `--${boundary}\r\n`;
    emailContent += `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=utf-8\r\n\r\n`;
    emailContent += `${body}\r\n\r\n`;

    for (const attachment of attachments) {
      emailContent += `--${boundary}\r\n`;
      emailContent += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
      emailContent += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
      emailContent += `Content-Transfer-Encoding: base64\r\n\r\n`;
      emailContent += `${attachment.content}\r\n\r\n`;
    }
    
    emailContent += `--${boundary}--\r\n`;
  } else {
    emailContent = `To: ${to}\r\n` +
      `Subject: ${subject}\r\n` +
      `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=utf-8\r\n\r\n` +
      `${body}`;
  }

  // Use btoa and encodeURIComponent to safely base64 encode
  const base64EncodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: base64EncodedEmail,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to send email: ${errorData.error?.message || response.statusText}`);
  }

  return response.json();
};
