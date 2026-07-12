import { Transaction, SystemSettings } from "../types";

export function printInvoiceHTML(tx: Transaction, settings: SystemSettings) {
  const currency = settings.currency || "MT";
  const companyName = settings.companyName || "OST COMÉRCIO CENTRAL";
  const address = settings.companyAddress || settings.storeAddress || "Av. Marginal, Kiosk 14, Maputo";
  const nuit = settings.companyNuit || "400293112";
  const contact = settings.storeContact || "+258 84 000 0000";
  const logo = settings.logoUrl || "";
  const certificationNumber = settings.fiscalCertificationNumber || "OST/CERT/00249/2026";

  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) {
    alert("Por favor, permita pop-ups para imprimir a fatura.");
    return;
  }

  // Calculate some numbers
  const formattedDate = new Date(tx.timestamp).toLocaleString();
  const itemsRows = tx.items.map((item, index) => `
    <tr>
      <td style="text-align: center;">${String(index + 1).padStart(2, "0")}</td>
      <td>
        <div style="font-weight: 600; color: #1e293b;">${item.productName}</div>
      </td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">${item.price.toLocaleString()} ${currency}</td>
      <td style="text-align: right; font-weight: 600;">${(item.price * item.quantity).toLocaleString()} ${currency}</td>
    </tr>
  `).join("");

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tx.invoiceNumber)}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <title>Fatura #${tx.invoiceNumber} - ${companyName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Inter', sans-serif;
          background-color: #f8fafc;
          color: #334155;
          line-height: 1.5;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .receipt-card {
          background: #ffffff;
          width: 100%;
          max-width: 680px;
          border-radius: 20px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          padding: 40px;
          position: relative;
        }

        /* Company Header */
        .header {
          text-align: center;
          border-bottom: 2px dashed #e2e8f0;
          padding-bottom: 24px;
          margin-bottom: 24px;
        }

        .logo-container {
          margin-bottom: 12px;
        }

        .logo {
          width: 64px;
          height: 64px;
          object-fit: contain;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 4px;
          background: #fff;
        }

        .company-name {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.025em;
          text-transform: uppercase;
        }

        .company-info {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }

        /* Document Metadata */
        .metadata-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
          font-size: 13px;
        }

        .meta-box {
          background-color: #f8fafc;
          border-radius: 12px;
          padding: 16px;
          border: 1px solid #f1f5f9;
        }

        .meta-title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #94a3b8;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }

        .meta-value {
          font-weight: 600;
          color: #1e293b;
        }

        .meta-mono {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }

        /* Items Table */
        .items-table-container {
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .items-table th {
          background-color: #f8fafc;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .items-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .items-table tr:last-child td {
          border-bottom: none;
        }

        /* Financial Summary */
        .summary-container {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }

        .summary-box {
          width: 100%;
          max-width: 300px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          color: #64748b;
        }

        .summary-row.discount {
          color: #ef4444;
          font-weight: 500;
        }

        .summary-row.grand-total {
          border-top: 1px solid #e2e8f0;
          padding-top: 12px;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }

        /* Footer Certification & QR Code */
        .footer-cert {
          border-top: 2px dashed #e2e8f0;
          padding-top: 24px;
          text-align: center;
        }

        .qr-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 20px;
        }

        .qr-box {
          padding: 8px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          display: inline-block;
        }

        .qr-image {
          width: 100px;
          height: 100px;
          display: block;
        }

        .cert-badge {
          display: inline-block;
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }

        .fiscal-details {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #64748b;
          line-height: 1.6;
          max-width: 480px;
          margin: 0 auto;
          background-color: #f8fafc;
          border-radius: 8px;
          padding: 12px;
          border: 1px solid #f1f5f9;
        }

        .fiscal-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #f1f5f9;
          padding: 4px 0;
        }

        .fiscal-row:last-child {
          border-bottom: none;
        }

        .fiscal-key {
          font-weight: 700;
          color: #334155;
        }

        .thank-you {
          margin-top: 24px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Print Actions (No-print) */
        .actions-bar {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 24px;
          width: 100%;
          max-width: 680px;
          margin-left: auto;
          margin-right: auto;
        }

        .btn {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 700;
          padding: 12px 24px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
        }

        .btn-primary {
          background-color: #0f172a;
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 6px -1px rgba(15,23,42,0.1), 0 2px 4px -2px rgba(15,23,42,0.1);
        }

        .btn-primary:hover {
          background-color: #1e293b;
        }

        .btn-secondary {
          background-color: #ffffff;
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        .btn-secondary:hover {
          background-color: #f8fafc;
          color: #1e293b;
        }

        @media print {
          body {
            background-color: #ffffff;
            padding: 0;
          }

          .receipt-card {
            box-shadow: none;
            border: none;
            padding: 0;
            max-width: 100%;
          }

          .actions-bar {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
        <!-- Actions Bar -->
        <div class="actions-bar">
          <button class="btn btn-secondary" onclick="window.close()">Fechar Janela</button>
          <button class="btn btn-primary" onclick="window.print()">Imprimir Fatura</button>
        </div>

        <!-- Receipt Card -->
        <div class="receipt-card">
          <!-- Header -->
          <div class="header">
            ${logo ? `
              <div class="logo-container">
                <img src="${logo}" alt="Logo" class="logo" />
              </div>
            ` : ""}
            <h1 class="company-name">${companyName}</h1>
            <p class="company-info">${address}</p>
            <p class="company-info" style="font-weight: 500; color: #475569;">NUIT: ${nuit} | Tel: ${contact}</p>
          </div>

          <!-- Metadata -->
          <div class="metadata-section">
            <div class="meta-box">
              <div class="meta-title">Dados do Documento</div>
              <div class="meta-value meta-mono" style="color: #0f172a; font-size: 14px; font-weight: 700; margin-bottom: 4px;">
                ${tx.invoiceNumber}
              </div>
              <div style="color: #64748b; font-size: 11px;">
                Emissão: <span style="font-weight: 500; color: #334155;">${formattedDate}</span>
              </div>
              <div style="color: #64748b; font-size: 11px;">
                Filial: <span style="font-weight: 500; color: #334155; text-transform: uppercase;">${tx.branchId || "Central"}</span>
              </div>
            </div>

            <div class="meta-box">
              <div class="meta-title">Cliente & Operador</div>
              <div class="meta-value" style="margin-bottom: 4px;">
                ${tx.customerName || "Consumidor Geral"}
              </div>
              ${tx.nuit ? `
                <div style="color: #64748b; font-size: 11px;">
                  NUIT Cliente: <span style="font-weight: 500; color: #334155;">${tx.nuit}</span>
                </div>
              ` : ""}
              <div style="color: #64748b; font-size: 11px;">
                Operador: <span style="font-weight: 500; color: #334155;">${tx.cashierName}</span>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="items-table-container">
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">Item</th>
                  <th style="text-align: left;">Descrição</th>
                  <th style="width: 60px; text-align: center;">Qtd</th>
                  <th style="width: 110px; text-align: right;">P. Unitário</th>
                  <th style="width: 120px; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </div>

          <!-- Summary -->
          <div class="summary-container">
            <div class="summary-box">
              <div class="summary-row">
                <span>Subtotal</span>
                <span style="font-family: 'JetBrains Mono', monospace;">${tx.subtotal.toLocaleString()} ${currency}</span>
              </div>
              ${tx.discountTotal > 0 ? `
                <div class="summary-row discount">
                  <span>Desconto</span>
                  <span style="font-family: 'JetBrains Mono', monospace;">-${tx.discountTotal.toLocaleString()} ${currency}</span>
                </div>
              ` : ""}
              <div class="summary-row">
                <span>IVA Incluído</span>
                <span style="font-family: 'JetBrains Mono', monospace;">${tx.vatTotal.toLocaleString()} ${currency}</span>
              </div>
              <div class="summary-row grand-total">
                <span>Total Pago</span>
                <span style="font-family: 'JetBrains Mono', monospace;">${tx.grandTotal.toLocaleString()} ${currency}</span>
              </div>
              <div style="text-align: right; margin-top: 4px; font-size: 11px; color: #64748b; font-style: italic;">
                Método de Pagamento: <strong>${tx.paymentMethod}</strong>
                ${tx.paymentDetails ? `<br><span style="color: #64748b; font-weight: normal;">(${tx.paymentDetails})</span>` : ""}
              </div>
            </div>
          </div>

          <!-- Fiscal Section / Footer -->
          <div class="footer-cert">
            <div class="qr-section">
              <div class="qr-box">
                <img class="qr-image" src="${qrCodeUrl}" alt="Código QR Fiscal" />
              </div>
              <span class="cert-badge">Documento Fiscal Homologado</span>
            </div>

            <div class="fiscal-details">
              <div class="fiscal-row">
                <span>Autoridade Tributária (AT):</span>
                <span style="font-weight: 700;">PROCESSO DE CERTIFICAÇÃO</span>
              </div>
              <div class="fiscal-row">
                <span>Certificado Nº:</span>
                <span class="fiscal-key">${certificationNumber}</span>
              </div>
              ${tx.fiscalKeys ? `
                <div class="fiscal-row">
                  <span>Chaves de Assinatura:</span>
                  <span class="fiscal-key">${tx.fiscalKeys}</span>
                </div>
              ` : ""}
              ${tx.fiscalHash ? `
                <div class="fiscal-row">
                  <span>Assinatura Digital (Hash):</span>
                  <span style="word-break: break-all; text-align: right;">${tx.fiscalHash}</span>
                </div>
              ` : ""}
              <div class="fiscal-row">
                <span>Software de Faturação:</span>
                <span>OST VENDAS ERP v10.4.2</span>
              </div>
            </div>

            <p class="thank-you">*** Muito obrigado pela preferência! Volte sempre! ***</p>
          </div>
        </div>
      </div>

      <script>
        // Auto print upon load
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 350);
        });
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
