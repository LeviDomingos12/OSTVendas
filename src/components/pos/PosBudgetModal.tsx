import React, { useState } from "react";
import { Receipt, Mail, Smartphone, MessageSquare, Printer } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SystemSettings } from "../../types";
import { SYSTEM_THEMES } from "../../lib/themes";
import { sendEmail } from "../../lib/gmail";
import { authenticatedFetch } from "../../lib/apiClient";

export interface PosBudgetData {
  budgetNumber: string;
  timestamp: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerNuit?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  grandTotal: number;
}

interface PosBudgetModalProps {
  completedBudget: PosBudgetData | null;
  settings: SystemSettings;
  activeUsername: string;
  onClose: () => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function getFormatFromBase64(base64Str: string): "PNG" | "JPEG" {
  if (base64Str.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}

export const PosBudgetModal: React.FC<PosBudgetModalProps> = ({
  completedBudget,
  settings,
  activeUsername,
  onClose,
  onAddAuditLog,
  onShowToast,
}) => {
  const [budgetPrintFormat, setBudgetPrintFormat] = useState<"ESC_POS" | "A4_DOC">("ESC_POS");
  const [selectedPaperSize, setSelectedPaperSize] = useState<"80MM" | "58MM">("80MM");
  const [budgetTab, setBudgetTab] = useState<"PREVIEW" | "RAW_COMMANDS">("PREVIEW");
  const [budgetTargetEmail, setBudgetTargetEmail] = useState<string>("");
  const [budgetTargetPhone, setBudgetTargetPhone] = useState<string>("");
  const [sendBudgetEmailStatus, setSendBudgetEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sendBudgetSmsStatus, setSendBudgetSmsStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sendBudgetWhatsAppStatus, setSendBudgetWhatsAppStatus] = useState<"idle" | "sending" | "sent">("idle");

  if (!completedBudget) return null;

  const getEscPosText = (budget: PosBudgetData, paperSize: "80MM" | "58MM") => {
    const width = paperSize === "58MM" ? 32 : 48;
    
    const padChar = (str: string, len: number, char = " ", right = false) => {
      const cleanStr = String(str || "");
      if (cleanStr.length >= len) return cleanStr.substring(0, len);
      const pad = char.repeat(len - cleanStr.length);
      return right ? pad + cleanStr : cleanStr + pad;
    };
    
    const centerText = (str: string) => {
      const cleanStr = String(str || "");
      if (cleanStr.length >= width) return cleanStr.substring(0, width);
      const leftPad = Math.floor((width - cleanStr.length) / 2);
      return " ".repeat(leftPad) + cleanStr;
    };

    const lineSeparator = "-".repeat(width);
    const doubleLineSeparator = "=".repeat(width);

    let out = "";
    out += "[ESC @] -- INICIALIZAR IMPRESSORA\n";
    out += "[ESC a 1] -- ALINHAMENTO AO CENTRO\n";
    out += centerText(settings.companyName || "OST COMÉRCIO CENTRAL") + "\n";
    if (settings.slogan) out += centerText(settings.slogan) + "\n";
    out += centerText(settings.storeAddress || "Av. Marginal, Maputo") + "\n";
    out += centerText(`NUIT EMPRESA: ${settings.companyNuit || "400293112"}`) + "\n";
    if (settings.storeContact) out += centerText(`Tel: ${settings.storeContact}`) + "\n";
    out += lineSeparator + "\n";
    
    out += "[ESC a 0] -- ALINHAMENTO À ESQUERDA\n";
    out += `PROPOSTA COMERCIAL (ORÇAMENTO)\n`;
    out += `NÚMERO : ${budget.budgetNumber}\n`;
    out += `EMISSÃO: ${new Date(budget.timestamp).toLocaleString("pt-MZ")}\n`;
    out += `VALIDADE: 15 DIAS DEPOIS\n`;
    out += `OPERADOR: ${activeUsername}\n`;
    out += lineSeparator + "\n";
    out += `DADOS DO CLIENTE:\n`;
    out += `NOME   : ${budget.customerName}\n`;
    if (budget.customerNuit)  out += `NUIT   : ${budget.customerNuit}\n`;
    if (budget.customerPhone) out += `CONTAC : ${budget.customerPhone}\n`;
    if (budget.customerEmail) out += `EMAIL  : ${budget.customerEmail}\n`;
    out += doubleLineSeparator + "\n";
    
    const itemLen = paperSize === "58MM" ? 14 : 24;
    const qtyLen = paperSize === "58MM" ? 4 : 6;
    const valLen = paperSize === "58MM" ? 14 : 18;
    
    out += padChar("ARTIGO", itemLen) + padChar("QTD", qtyLen, " ", true) + padChar("VALOR", valLen, " ", true) + "\n";
    out += lineSeparator + "\n";
    
    budget.items.forEach((item) => {
      const name = item.productName.substring(0, itemLen - 1);
      const qty = String(item.quantity);
      const val = (item.price * item.quantity).toLocaleString() + " MT";
      out += padChar(name, itemLen) + padChar(qty, qtyLen, " ", true) + padChar(val, valLen, " ", true) + "\n";
    });
    
    out += lineSeparator + "\n";
    out += padChar("SUBTOTAL:", itemLen + qtyLen) + padChar(budget.subtotal.toLocaleString() + " MT", valLen, " ", true) + "\n";
    if (budget.discountTotal > 0) {
      out += padChar("DESCONTO:", itemLen + qtyLen) + padChar("-" + budget.discountTotal.toLocaleString() + " MT", valLen, " ", true) + "\n";
    }
    out += padChar("IVA ESTIMADO (16%):", itemLen + qtyLen) + padChar(budget.vatTotal.toLocaleString() + " MT", valLen, " ", true) + "\n";
    out += doubleLineSeparator + "\n";
    out += "[ESC ! 17] -- DOUBLE HEIGHT & DOUBLE WIDTH BOLD\n";
    out += padChar("TOTAL PROP:", itemLen + qtyLen) + padChar(budget.grandTotal.toLocaleString() + " MT", valLen, " ", true) + "\n";
    out += "[ESC ! 0] -- FONTE NORMAL\n";
    out += doubleLineSeparator + "\n";
    out += "[ESC a 1] -- ALINHAMENTO AO CENTRO\n";
    out += centerText("*** VALIDADE 15 DIAS ***") + "\n";
    out += centerText("Este documento nao serve como fatura.") + "\n";
    out += centerText("Obrigado pela preferência!") + "\n";
    out += "[GS V 66 0] -- CORTE TOTAL DE PAPEL\n";
    
    return out;
  };

  const handleSendBudgetEmail = async () => {
    if (!completedBudget) return;
    setSendBudgetEmailStatus("sending");
    const targetEmail = budgetTargetEmail || completedBudget.customerEmail || "vendas.central@ost.co.mz";
    try {
      const activeTheme = SYSTEM_THEMES.find(t => t.id === settings.theme) || SYSTEM_THEMES[0];
      const rgbArray = activeTheme.rgb.split(",").map(Number);

      const doc = new jsPDF();
      doc.setFillColor(rgbArray[0], rgbArray[1], rgbArray[2]);
      doc.rect(0, 0, 210, 8, "F");

      const logoData = await getBase64ImageFromUrl(settings.logoUrl || "/src/assets/images/app_logo_1782658148089.jpg");
      if (logoData) {
        const format = getFormatFromBase64(logoData);
        doc.addImage(logoData, format, 165, 12, 30, 30);
      }
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(settings.companyName || "OST COMÉRCIO CENTRAL", 14, 22);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`NUIT: ${settings.companyNuit || "400293112"}`, 14, 28);
      doc.text(`Endereço: ${settings.storeAddress || "Av. Marginal, Maputo"}`, 14, 33);
      doc.text(`Contacto: ${settings.storeContact || "+258 84 900 1202"}`, 14, 38);
      
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 44, 196, 44);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 83, 9);
      doc.text(`PROPOSTA DE ORÇAMENTO: ${completedBudget.budgetNumber}`, 14, 52);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Data Emissão: ${new Date(completedBudget.timestamp).toLocaleString("pt-MZ")}`, 14, 59);
      doc.text(`Validade: 15 Dias (Até ${new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ")})`, 14, 64);
      doc.text(`Caixa/Operador: ${activeUsername || "Operador"}`, 14, 69);
      doc.text(`Cliente: ${completedBudget.customerName}`, 14, 74);
      if (completedBudget.customerNuit) {
        doc.text(`NUIT Cliente: ${completedBudget.customerNuit}`, 14, 79);
      }

      const tableHead = [["ARTIGO / PRODUTO", "QUANTIDADE", "PREÇO UNIT.", "SUBTOTAL"]];
      const tableBody = completedBudget.items.map(item => [
        item.productName,
        item.quantity.toString(),
        `${item.price.toLocaleString()} MT`,
        `${(item.price * item.quantity).toLocaleString()} MT`
      ]);

      autoTable(doc, {
        startY: completedBudget.customerNuit ? 85 : 80,
        head: tableHead,
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [rgbArray[0], rgbArray[1], rgbArray[2]] as [number, number, number] },
        styles: { fontSize: 8, cellPadding: 3 }
      });

      const finalY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 100) + 10;
      
      doc.setFillColor(248, 250, 252);
      doc.rect(120, finalY, 76, 30, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(120, finalY, 76, 30, "S");

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Subtotal:`, 124, finalY + 6);
      doc.text(`${completedBudget.subtotal.toLocaleString()} MT`, 192, finalY + 6, { align: "right" });
      if (completedBudget.discountTotal > 0) {
        doc.setTextColor(239, 68, 68);
        doc.text(`Desconto:`, 124, finalY + 12);
        doc.text(`-${completedBudget.discountTotal.toLocaleString()} MT`, 192, finalY + 12, { align: "right" });
        doc.setTextColor(71, 85, 105);
      }
      doc.text(`IVA Estimado:`, 124, finalY + 18);
      doc.text(`${completedBudget.vatTotal.toLocaleString()} MT`, 192, finalY + 18, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(180, 83, 9);
      doc.text(`TOTAL PROPOSTO:`, 124, finalY + 25);
      doc.text(`${completedBudget.grandTotal.toLocaleString()} MT`, 192, finalY + 25, { align: "right" });

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Este documento constitui apenas uma proposta comercial.", 105, finalY + 40, { align: "center" });

      const pdfBase64DataUri = doc.output('datauristring');
      const base64Content = pdfBase64DataUri.split(',')[1];

      const itemsHtml = completedBudget.items
        .map(item => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left;">${item.productName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.price.toLocaleString()} MT</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${(item.price * item.quantity).toLocaleString()} MT</td>
          </tr>
        `).join("");

      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #ea580c; margin: 0;">${settings.companyName || "OST Vendas"}</h2>
            <p style="color: #64748b; margin: 5px 0 0 0;">Orçamento Comercial</p>
          </div>
          <p><strong>Orçamento Nº:</strong> ${completedBudget.budgetNumber}</p>
          <p><strong>Data de Emissão:</strong> ${new Date(completedBudget.timestamp).toLocaleString("pt-MZ")}</p>
          <p><strong>Validade:</strong> 15 Dias (Até ${new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ")})</p>
          <p><strong>Operador:</strong> ${activeUsername}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          <p>Olá <strong>${completedBudget.customerName}</strong>,</p>
          <p>Abaixo encontra-se o orçamento comercial solicitado para a sua apreciação:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1;">Artigo</th>
                <th style="padding: 8px; text-align: center; border-bottom: 2px solid #cbd5e1;">Qtd</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Preço Un.</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="text-align: right; font-size: 13px; color: #475569; line-height: 1.6; border-top: 2px solid #e2e8f0; padding-top: 10px;">
            <p style="margin: 4px 0;"><strong>Subtotal:</strong> ${completedBudget.subtotal.toLocaleString()} MT</p>
            ${completedBudget.discountTotal > 0 ? `<p style="margin: 4px 0; color: #ef4444;"><strong>Desconto:</strong> -${completedBudget.discountTotal.toLocaleString()} MT</p>` : ""}
            <p style="margin: 4px 0;"><strong>IVA Estimado:</strong> ${completedBudget.vatTotal.toLocaleString()} MT</p>
            <p style="margin: 8px 0 4px 0; font-size: 16px; color: #ea580c;"><strong>Total Proposto: ${completedBudget.grandTotal.toLocaleString()} MT</strong></p>
          </div>

          <div style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #ea580c; font-size: 11px; color: #64748b; line-height: 1.5; margin-top: 25px;">
            <strong>Nota:</strong> Este documento constitui apenas uma proposta comercial válida por 15 dias e não serve como recibo ou comprovativo de pagamento.
          </div>

          <p style="margin-top: 30px; font-size: 12px; color: #64748b; text-align: center;">Estamos à sua disposição!<br><em>${settings.companyName || "OST Vendas"}</em></p>
        </div>
      `;

      try {
        await sendEmail({
          to: targetEmail,
          subject: `Orçamento ${completedBudget.budgetNumber} - ${settings.companyName || "OST Vendas"}`,
          body: emailBody,
          isHtml: true,
          attachments: [{
            filename: `Orcamento_${completedBudget.budgetNumber}.pdf`,
            content: base64Content,
            mimeType: "application/pdf"
          }]
        });

        setSendBudgetEmailStatus("sent");
        onAddAuditLog("Enviar Orçamento por Email", "VENDAS", `Orçamento ${completedBudget.budgetNumber} enviado via e-mail real para ${targetEmail} com PDF anexo.`);
        if (onShowToast) onShowToast("Orçamento enviado por e-mail com sucesso via Gmail API!", "success");
      } catch (gmailErr: unknown) {
        console.warn("Could not send email via Gmail API, falling back to server-side SMTP:", gmailErr);
        
        const res = await authenticatedFetch("/api/email/dispatch-budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: targetEmail,
            budgetNumber: completedBudget.budgetNumber,
            grandTotal: completedBudget.grandTotal,
            cashier: activeUsername,
            customer: completedBudget.customerName,
            items: completedBudget.items,
            subtotal: completedBudget.subtotal,
            discountTotal: completedBudget.discountTotal,
            vatTotal: completedBudget.vatTotal,
            pdfAttachment: base64Content
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Erro desconhecido no servidor.");
        }

        setSendBudgetEmailStatus("sent");
        onAddAuditLog("Enviar Orçamento por Email", "VENDAS", `Orçamento ${completedBudget.budgetNumber} enviado via e-mail do servidor (SMTP) para ${targetEmail} com PDF.`);
        if (onShowToast) onShowToast("Orçamento enviado por e-mail com sucesso!", "success");
      }
    } catch (err: unknown) {
      console.error("Could not send budget email:", err);
      setSendBudgetEmailStatus("idle");
      const errTxt = err instanceof Error ? err.message : String(err);
      if (onShowToast) onShowToast(`Erro ao enviar orçamento: ${errTxt}`, "error");
    }
  };

  const handleSendBudgetSms = async () => {
    if (!completedBudget) return;
    setSendBudgetSmsStatus("sending");
    const targetPhone = budgetTargetPhone || completedBudget.customerPhone || "+258 84 900 1202";
    try {
      const resp = await authenticatedFetch("/api/sms/dispatch-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: targetPhone,
          invoiceNumber: completedBudget.budgetNumber,
          grandTotal: completedBudget.grandTotal
        })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.message || data?.error || `HTTP ${resp.status}`);
      }
      setSendBudgetSmsStatus("sent");
      onAddAuditLog("Enviar Orçamento por SMS", "VENDAS", `Orçamento ${completedBudget.budgetNumber} enviado via SMS para ${targetPhone}.`);
      if (onShowToast) onShowToast("Orçamento enviado por SMS com sucesso!", "success");
    } catch (err: unknown) {
      setSendBudgetSmsStatus("idle");
      const errTxt = err instanceof Error ? err.message : "Falha ao enviar SMS do orçamento.";
      if (onShowToast) onShowToast(errTxt, "error");
    }
  };

  const handleOpenBudgetWhatsApp = () => {
    if (!completedBudget) return;
    
    const dateStr = new Date(completedBudget.timestamp).toLocaleDateString("pt-MZ");
    const validUntilStr = new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ");
    const itemsText = completedBudget.items
      .map(item => `▪️ ${item.quantity}x ${item.productName} - ${(item.price * item.quantity).toLocaleString()} MT`)
      .join("\n");

    const text = `📝 *ORÇAMENTO COMERCIAL* - ${settings.companyName || "OST Vendas"} 🇲🇿\n` +
      `------------------------------------------\n` +
      `*Orçamento:* ${completedBudget.budgetNumber}\n` +
      `*Data de Emissão:* ${dateStr}\n` +
      `*Validade:* 15 dias (Até ${validUntilStr})\n` +
      `*Operador:* ${activeUsername}\n` +
      `*Cliente:* ${completedBudget.customerName}\n` +
      `------------------------------------------\n` +
      `*Artigos:*\n${itemsText}\n` +
      `------------------------------------------\n` +
      `*Subtotal:* ${completedBudget.subtotal.toLocaleString()} MT\n` +
      (completedBudget.discountTotal > 0 ? `*Desconto:* -${completedBudget.discountTotal.toLocaleString()} MT\n` : "") +
      `*IVA:* ${completedBudget.vatTotal.toLocaleString()} MT\n` +
      `*TOTAL PROPOSTO: ${completedBudget.grandTotal.toLocaleString()} MT*\n` +
      `------------------------------------------\n\n` +
      `Este documento é uma proposta comercial. Ficamos a aguardar o seu contacto! ✨`;

    const cleanPhone = (budgetTargetPhone || completedBudget.customerPhone || "").replace(/\D/g, "");
    const defaultPhone = cleanPhone.length === 9 && (cleanPhone.startsWith("84") || cleanPhone.startsWith("85") || cleanPhone.startsWith("82") || cleanPhone.startsWith("87") || cleanPhone.startsWith("86"))
      ? `258${cleanPhone}`
      : cleanPhone;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${defaultPhone}&text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setSendBudgetWhatsAppStatus("sent");
    onAddAuditLog("Enviar Orçamento WhatsApp", "VENDAS", `Orçamento ${completedBudget.budgetNumber} enviado via WhatsApp para o telemóvel ${defaultPhone}.`);
    if (onShowToast) onShowToast("Link do WhatsApp aberto com sucesso!", "success");
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      {/* Dynamic Print Overrides */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
            background: none !important;
          }
          #budget-print-area, #budget-print-area * {
            visibility: visible !important;
          }
          #budget-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            width: ${budgetPrintFormat === "ESC_POS" ? (selectedPaperSize === "58MM" ? "58mm" : "80mm") : "210mm"} !important;
            max-width: ${budgetPrintFormat === "ESC_POS" ? (selectedPaperSize === "58MM" ? "58mm" : "80mm") : "210mm"} !important;
            padding: ${budgetPrintFormat === "ESC_POS" ? "4mm" : "15mm"} !important;
            font-family: ${budgetPrintFormat === "ESC_POS" ? "monospace" : "sans-serif"} !important;
            font-size: ${budgetPrintFormat === "ESC_POS" ? "11px" : "13px"} !important;
            line-height: 1.2 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white p-6 rounded-2xl max-w-2xl w-full border border-slate-100 shadow-2xl flex flex-col gap-4 animate-in fade-in duration-200 no-print">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="font-extrabold text-slate-900 text-sm">Template de Orçamento POS</h3>
              <p className="text-[11px] text-slate-400">Emissão e formatação de propostas comerciais.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {settings.printerEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ESC/POS Ativo ({settings.paperSize || "80MM"})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-slate-50 text-slate-500 rounded-full border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                Impressora Térmica Desativada
              </span>
            )}
          </div>
        </div>

        {/* Template & Size Controllers */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setBudgetPrintFormat("A4_DOC")}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
              budgetPrintFormat === "A4_DOC" 
                ? "bg-white text-slate-950 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📄 Proposta A4 Corporativa</span>
          </button>
          <button
            type="button"
            onClick={() => setBudgetPrintFormat("ESC_POS")}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
              budgetPrintFormat === "ESC_POS" 
                ? "bg-white text-slate-950 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📠 Recibo Térmico ESC/POS</span>
          </button>
        </div>

        {/* Sub-selectors for ESC/POS mode */}
        {budgetPrintFormat === "ESC_POS" && (
          <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBudgetTab("PREVIEW")}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer ${
                  budgetTab === "PREVIEW" ? "bg-amber-100 text-amber-800" : "text-amber-600 hover:bg-amber-100/40"
                }`}
              >
                Fita Térmica Simulada
              </button>
              <button
                type="button"
                onClick={() => setBudgetTab("RAW_COMMANDS")}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer ${
                  budgetTab === "RAW_COMMANDS" ? "bg-amber-100 text-amber-800" : "text-amber-600 hover:bg-amber-100/40"
                }`}
              >
                Comandos Brutos (Raw ESC/POS)
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
              <span>Papel:</span>
              <select
                value={selectedPaperSize}
                onChange={(e) => setSelectedPaperSize(e.target.value as "80MM" | "58MM")}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] outline-none"
              >
                <option value="80MM">80mm (Largo)</option>
                <option value="58MM">58mm (Estreito)</option>
              </select>
            </div>
          </div>
        )}

        {/* PREVIEW CONTAINER */}
        <div className="max-h-80 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50 p-4 shadow-inner">
          {budgetPrintFormat === "A4_DOC" ? (
            /* Template A4 CORPORATIVO */
            <div id="budget-print-area" className="bg-white p-6 rounded-xl border border-slate-200 text-left font-sans text-xs text-slate-700 shadow-md">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
                <div>
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Logo Empresa"
                      className="h-10 w-auto object-contain mb-2 bg-white rounded"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-sm mb-1.5">
                      OST
                    </div>
                  )}
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">{settings.companyName || "OST COMÉRCIO CENTRAL"}</h4>
                  {settings.slogan && <p className="text-[10px] text-slate-400 italic font-medium">{settings.slogan}</p>}
                  <p className="text-[10px] text-slate-500 mt-1">{settings.storeAddress || "Av. Marginal, Kiosk 14, Maputo"}</p>
                  <p className="text-[10px] text-slate-500">NUIT: {settings.companyNuit || "400293112"}</p>
                  {settings.storeContact && <p className="text-[10px] text-slate-500">Contacto: {settings.storeContact}</p>}
                </div>

                <div className="text-right">
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-extrabold text-[10px] uppercase rounded-full tracking-wider border border-amber-200">
                    Proposta de Orçamento
                  </span>
                  <h3 className="font-black text-slate-950 text-lg mt-3">{completedBudget.budgetNumber}</h3>
                  <p className="text-[10px] text-slate-500">Emissão: {new Date(completedBudget.timestamp).toLocaleString("pt-MZ")}</p>
                  <p className="text-[10px] text-amber-700 font-semibold mt-1">Validade: 15 dias (Até {new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ")})</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-150 mb-4">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Destinatário (Cliente)</span>
                  <p className="font-extrabold text-slate-955 text-xs">{completedBudget.customerName}</p>
                  {completedBudget.customerNuit && <p className="text-[10px] mt-0.5">NUIT: <span className="font-mono">{completedBudget.customerNuit}</span></p>}
                  {completedBudget.customerPhone && <p className="text-[10px] mt-0.5">Tel: {completedBudget.customerPhone}</p>}
                  {completedBudget.customerEmail && <p className="text-[10px] mt-0.5">E-mail: {completedBudget.customerEmail}</p>}
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Emissor / Responsável</span>
                  <p className="font-extrabold text-slate-955 text-xs">{activeUsername}</p>
                  <p className="text-[10px] mt-0.5">Terminal: POS-01 Central</p>
                  <p className="text-[10px] text-slate-500 italic mt-1">Este orçamento é uma proposta provisória para fornecimento.</p>
                </div>
              </div>

              <table className="w-full text-left border-collapse mb-4">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-200">
                    <th className="py-2.5 px-2">Artigo / Descrição</th>
                    <th className="py-2.5 px-2 text-center w-16">Qtd</th>
                    <th className="py-2.5 px-2 text-right w-24">Preço Unitário</th>
                    <th className="py-2.5 px-2 text-right w-28">Total Parcial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {completedBudget.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 text-slate-650">
                      <td className="py-2.5 px-2 font-bold text-slate-800">{item.productName}</td>
                      <td className="py-2.5 px-2 text-center font-mono">{item.quantity}</td>
                      <td className="py-2.5 px-2 text-right font-mono">{item.price.toLocaleString()} MT</td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-950">{(item.price * item.quantity).toLocaleString()} MT</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-end border-t border-slate-200 pt-4">
                <div className="text-[10px] text-slate-400 max-w-sm">
                  <p className="font-bold text-slate-500">Termos e Condições:</p>
                  <p className="mt-1 leading-normal">1. Os preços apresentados incluem IVA à taxa em vigor.<br/>2. Esta proposta comercial é válida por 15 dias de calendário.<br/>3. O fornecimento dos artigos está sujeito ao stock disponível.</p>
                </div>
                <div className="w-64 space-y-1.5 text-right font-mono text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span>{completedBudget.subtotal.toLocaleString()} MT</span>
                  </div>
                  {completedBudget.discountTotal > 0 && (
                    <div className="flex justify-between text-red-600 font-bold">
                      <span>DESCONTO:</span>
                      <span>-{completedBudget.discountTotal.toLocaleString()} MT</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>IVA ESTIMADO (16%):</span>
                    <span>{completedBudget.vatTotal.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black text-sm border-t border-dashed border-slate-200 pt-2 mt-1">
                    <span>TOTAL PROPOSTO:</span>
                    <span className="text-amber-800">{completedBudget.grandTotal.toLocaleString()} MT</span>
                  </div>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-400 mt-8 border-t border-dashed border-slate-150 pt-4">
                <p className="uppercase tracking-widest font-bold text-slate-500">{settings.companyName || "OST COMÉRCIO CENTRAL"}</p>
                <p className="mt-1">Obrigado pela preferência! Processado por computador.</p>
              </div>
            </div>
          ) : budgetTab === "PREVIEW" ? (
            /* Template ESC/POS RECIBO TÉRMICO */
            <div className="flex justify-center">
              <div 
                id="budget-print-area" 
                className="bg-white p-4 text-left font-mono text-[10px] leading-snug text-zinc-800 border border-zinc-200 shadow-lg relative rounded-md select-all"
                style={{ width: selectedPaperSize === "58MM" ? "240px" : "320px" }}
              >
                <div className="absolute inset-x-0 -top-1.5 h-1.5 bg-zinc-100 border-b border-dashed border-zinc-300"></div>
                <div className="absolute inset-x-0 -bottom-1.5 h-1.5 bg-zinc-100 border-t border-dashed border-zinc-300"></div>

                <div className="text-center mb-2.5">
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt="Logo Recibo"
                      className="w-12 h-12 object-contain mx-auto mb-1.5 bg-white p-0.5 rounded border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <p className="font-extrabold uppercase text-xs tracking-wider">{settings.companyName || "OST COMÉRCIO CENTRAL"}</p>
                  {settings.slogan && <p className="text-[8px] text-zinc-500 italic mt-0.5">{settings.slogan}</p>}
                  <p className="text-[8px] text-zinc-500 mt-1">{settings.storeAddress || "Av. Marginal, Kiosk 14, Maputo"}</p>
                  <p className="text-[8px] text-zinc-500">NUIT Empr: {settings.companyNuit || "400293112"}</p>
                  {settings.storeContact && <p className="text-[8px] text-zinc-500">Tel: {settings.storeContact}</p>}
                </div>

                <div className="border-b border-dashed border-zinc-300 pb-1.5 mb-2.5 space-y-0.5">
                  <p className="font-bold text-amber-700 text-[11px]">*** PROPOSTA COMERCIAL ***</p>
                  <p><span className="text-zinc-500">ORÇAMENTO Nº:</span> <span className="font-bold">{completedBudget.budgetNumber}</span></p>
                  <p><span className="text-zinc-500">EMISSÃO:</span> {new Date(completedBudget.timestamp).toLocaleString("pt-MZ")}</p>
                  <p><span className="text-zinc-500">VALIDADE:</span> 15 Dias (Até {new Date(completedBudget.timestamp + 15 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-MZ")})</p>
                  <p><span className="text-zinc-500">OPERADOR:</span> {activeUsername}</p>
                  <p className="border-t border-dashed border-zinc-200 pt-1 mt-1"><span className="text-zinc-500">CLIENTE:</span> <span className="font-bold">{completedBudget.customerName}</span></p>
                  {completedBudget.customerNuit && <p><span className="text-zinc-500">NUIT CLI:</span> {completedBudget.customerNuit}</p>}
                  {completedBudget.customerPhone && <p><span className="text-zinc-500">CONTAC :</span> {completedBudget.customerPhone}</p>}
                </div>

                <div className="border-b border-dashed border-zinc-300 pb-1 mb-1 font-bold text-zinc-900 grid grid-cols-12 gap-1 text-[9px]">
                  <span className="col-span-6">ARTIGO</span>
                  <span className="col-span-2 text-center">QTD</span>
                  <span className="col-span-4 text-right">VALOR</span>
                </div>

                <div className="space-y-1 py-1 border-b border-dashed border-zinc-300 mb-2">
                  {completedBudget.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 text-[9px] text-zinc-700">
                      <span className="col-span-6 truncate font-medium">{item.productName}</span>
                      <span className="col-span-2 text-center font-mono">{item.quantity}</span>
                      <span className="col-span-4 text-right font-mono">{(item.price * item.quantity).toLocaleString()} MT</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 text-right text-[9px] text-zinc-600">
                  <p>SUBTOTAL: {completedBudget.subtotal.toLocaleString()} MT</p>
                  {completedBudget.discountTotal > 0 && <p className="text-red-650 font-bold">DESCONTO: -{completedBudget.discountTotal.toLocaleString()} MT</p>}
                  <p>IVA ESTIMADO: {completedBudget.vatTotal.toLocaleString()} MT</p>
                  <p className="text-zinc-900 font-bold text-[11px] border-t border-dashed border-zinc-300 pt-1.5 mt-1">
                    TOTAL PROP: {completedBudget.grandTotal.toLocaleString()} MT
                  </p>
                </div>

                <div className="text-center mt-4 border-t border-dashed border-zinc-300 pt-2 text-[8px] text-zinc-400 space-y-0.5">
                  <p className="font-bold uppercase tracking-wider text-zinc-500">*** PROPOSTA SEM VALOR FISCAL ***</p>
                  <p>Obrigado pela preferência e confiança!</p>
                  <p>Emitido via Terminal Térmico ESC/POS.</p>
                </div>
              </div>
            </div>
          ) : (
            /* RAW ESC/POS COMMAND TEXT */
            <div className="bg-zinc-950 p-4 rounded-xl text-left font-mono text-[10px] text-emerald-400 leading-normal select-all whitespace-pre">
              {getEscPosText(completedBudget, selectedPaperSize)}
            </div>
          )}
        </div>

        {/* Quick Dispatchers */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5 text-left">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">E-mail de Envio</label>
              <input
                type="email"
                placeholder="exemplo@cliente.com"
                value={budgetTargetEmail}
                onChange={(e) => setBudgetTargetEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition"
              />
            </div>
            <div className="space-y-0.5 text-left">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Telemóvel (WhatsApp/SMS)</label>
              <input
                type="text"
                placeholder="+258 84 000 0000"
                value={budgetTargetPhone}
                onChange={(e) => setBudgetTargetPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide text-left">Entregar / Enviar ao Cliente</p>
          
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={handleSendBudgetEmail}
              disabled={sendBudgetEmailStatus !== "idle"}
              className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-blue-50 text-blue-750 hover:bg-blue-100 transition border border-blue-100 disabled:opacity-75 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {sendBudgetEmailStatus === "idle" ? "E-mail" : sendBudgetEmailStatus === "sending" ? "..." : "✓ Enviado"}
            </button>
            <button
              type="button"
              onClick={handleSendBudgetSms}
              disabled={sendBudgetSmsStatus !== "idle"}
              className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition border border-indigo-100 disabled:opacity-75 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              {sendBudgetSmsStatus === "idle" ? "SMS" : sendBudgetSmsStatus === "sending" ? "..." : "✓ Enviado"}
            </button>
            <button
              type="button"
              onClick={handleOpenBudgetWhatsApp}
              disabled={sendBudgetWhatsAppStatus === "sending"}
              className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-850 hover:bg-emerald-100 transition border border-emerald-150 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              WhatsApp
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              try {
                window.print();
              } catch (err) {
                console.warn("Dispositivo em iFrame bloqueado para window.print. Impressora Virtual Ativada.");
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-amber-600/15"
            title="Imprimir Orçamento (Atalho: F5)"
          >
            <Printer className="w-4 h-4 text-amber-100" />
            <span>{budgetPrintFormat === "ESC_POS" ? `Imprimir Fita Térmica (${selectedPaperSize})` : "Imprimir Proposta A4"}</span>
            <kbd className="px-1.5 py-0.5 bg-white/20 text-white rounded text-[10px] font-mono font-bold shadow-inner ml-1">
              F5
            </kbd>
          </button>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer text-center hover:bg-slate-800"
        >
          Fechar Orçamento (Manter Carrinho)
        </button>
      </div>
    </div>
  );
};
