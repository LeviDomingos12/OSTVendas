export const generateInvoiceEmailHtml = (transaction: any, companyName: string = "OST COMÉRCIO CENTRAL") => {
  const invoiceNumber = transaction.invoiceNumber;
  const customerName = transaction.customerName || "Consumidor Geral";
  const date = new Date(transaction.timestamp).toLocaleString();
  const total = transaction.grandTotal.toLocaleString();
  const items = transaction.items || [];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .container { max-w-4xl; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
        .header p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
        .details { margin-bottom: 30px; }
        .details table { width: 100%; }
        .details td { padding: 5px 0; font-size: 14px; }
        .details .label { font-weight: bold; color: #475569; width: 120px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .items-table th { background-color: #f1f5f9; text-align: left; padding: 12px; font-size: 12px; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
        .items-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
        .items-table .text-right { text-align: right; }
        .totals { width: 100%; max-width: 300px; margin-left: auto; margin-bottom: 30px; }
        .totals table { width: 100%; }
        .totals td { padding: 8px 0; font-size: 14px; }
        .totals .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #0f172a; padding-top: 12px; }
        .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #94a3b8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${companyName}</h1>
          <p>Resumo de Faturamento - Fatura ${invoiceNumber}</p>
        </div>
        
        <div class="details">
          <table>
            <tr><td class="label">Fatura:</td><td>${invoiceNumber}</td></tr>
            <tr><td class="label">Data:</td><td>${date}</td></tr>
            <tr><td class="label">Cliente:</td><td>${customerName}</td></tr>
            <tr><td class="label">Método Pag.:</td><td>${transaction.paymentMethod}</td></tr>
          </table>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Produto/Serviço</th>
              <th class="text-right">Qtd</th>
              <th class="text-right">Preço Unit.</th>
              <th class="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any) => `
              <tr>
                <td>${item.name}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${item.price.toLocaleString()} MT</td>
                <td class="text-right">${(item.quantity * item.price).toLocaleString()} MT</td>
              </tr>
            `).join('')}
            ${items.length === 0 ? `
              <tr>
                <td colspan="4" style="text-align: center; color: #64748b; font-style: italic;">Resumo geral sem itens discriminados.</td>
              </tr>
            ` : ''}
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr>
              <td>Subtotal</td>
              <td style="text-align: right">${transaction.subtotal.toLocaleString()} MT</td>
            </tr>
            <tr>
              <td>Desconto</td>
              <td style="text-align: right">-${transaction.discount.toLocaleString()} MT</td>
            </tr>
            <tr>
              <td>IVA (16%)</td>
              <td style="text-align: right">+${transaction.vatTotal.toLocaleString()} MT</td>
            </tr>
            <tr>
              <td class="total-row">Total Geral</td>
              <td class="total-row" style="text-align: right">${total} MT</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          <p>Obrigado pela sua preferência!</p>
          <p>Este é um e-mail gerado automaticamente, por favor não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
