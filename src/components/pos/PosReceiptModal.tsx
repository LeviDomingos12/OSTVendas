import React from "react";
import { 
  CheckCircle2, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  Printer, 
  QrCode,
  UserPlus 
} from "lucide-react";
import { Transaction, SystemSettings, Customer } from "../../types";
import { printThermal80mmReceipt, printInvoiceHTML } from "../../lib/printHelper";

export interface PosReceiptModalProps {
  completedTx: Transaction | null;
  selectedCustomer?: Customer | null;
  printMode: "receipt" | "invoice";
  setPrintMode: (mode: "receipt" | "invoice") => void;
  settings: SystemSettings;
  qrCodeDataUrl: string;
  formattedVersion: string;
  sendEmailStatus: "idle" | "sending" | "success" | "error";
  sendSmsStatus: "idle" | "sending" | "success" | "error";
  sendWhatsAppStatus: "idle" | "sending" | "success" | "error";
  onSendEmail: () => void;
  onSendSms: () => void;
  onOpenWhatsAppModal: () => void;
  onTriggerPrintReceipt: (mode: "receipt" | "invoice") => void;
  onRegisterCustomerForEmail?: () => void;
  onRegisterCustomerForWhatsApp?: () => void;
  onReset: () => void;
}

export const PosReceiptModal: React.FC<PosReceiptModalProps> = ({
  completedTx,
  selectedCustomer,
  printMode,
  setPrintMode,
  settings,
  qrCodeDataUrl,
  formattedVersion,
  sendEmailStatus,
  sendSmsStatus,
  sendWhatsAppStatus,
  onSendEmail,
  onSendSms,
  onOpenWhatsAppModal,
  onTriggerPrintReceipt,
  onRegisterCustomerForEmail,
  onRegisterCustomerForWhatsApp,
  onReset
}) => {
  if (!completedTx) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl flex flex-col gap-4 animate-in fade-in duration-200">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto mb-2.5">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">Venda Concluída com Sucesso!</h3>
          <p className="text-xs text-slate-400 mt-1">Transação consolidada e stock comercial deduzido.</p>
        </div>

        {/* Simulated Receipt Display */}
        <div id="pos-completed-receipt" className="border border-slate-200 bg-slate-50 rounded-xl p-4 font-mono text-[11px] leading-tight text-slate-700 select-all max-h-60 overflow-y-auto">
          <style>{`
            @media print {
              @page {
                size: ${printMode === "invoice" ? "A4 portrait" : "80mm auto"};
                margin: ${printMode === "invoice" ? "10mm" : "0mm"};
              }
              body * {
                visibility: hidden !important;
              }
              ${printMode === "invoice" ? `
              #pos-completed-invoice, #pos-completed-invoice * {
                visibility: visible !important;
              }
              #pos-completed-invoice {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                border: none !important;
                background: white !important;
                color: #1e293b !important;
                padding: 40px !important;
                margin: 0 !important;
                box-shadow: none !important;
                overflow: visible !important;
                display: block !important;
              }
              ` : `
              #pos-completed-receipt, #pos-completed-receipt * {
                visibility: visible !important;
              }
              #pos-completed-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 76mm !important;
                max-width: 80mm !important;
                height: auto !important;
                border: none !important;
                background: white !important;
                color: black !important;
                padding: ${settings?.thermalMarginTop !== undefined ? settings.thermalMarginTop : 4}mm 1mm ${settings?.thermalMarginBottom !== undefined ? settings.thermalMarginBottom : 8}mm 1mm !important;
                margin: 0 auto !important;
                box-shadow: none !important;
                overflow: visible !important;
                display: block !important;
                font-family: 'Courier New', Courier, monospace !important;
                font-size: 11px !important;
                line-height: 1.25 !important;
              }
              `}
              .no-print {
                display: none !important;
              }
            }
          `}</style>
          <div className="text-center font-bold text-slate-800 mb-2 border-b border-dashed border-slate-300 pb-2">
            {settings.logoUrl && (
              <img
                src={settings.logoUrl}
                alt="Logo Recibo"
                className="w-10 h-10 object-contain mx-auto mb-1.5 bg-white p-0.5 rounded border border-slate-200"
                referrerPolicy="no-referrer"
              />
            )}
            <p className="uppercase">{settings.companyName || "OST COMÉRCIO CENTRAL"}</p>
            <p className="font-normal text-[9px] text-slate-500 font-sans">{settings.storeAddress || "Av. Marginal, Kiosk 14, Maputo"}</p>
            <p className="font-normal text-[9px] text-slate-500 font-sans">NUIT: {settings.companyNuit || "400293112"}</p>
          </div>

          <div className="space-y-1 mb-2">
            <p><span className="text-slate-450">Fatura:</span> {completedTx.invoiceNumber}</p>
            <p><span className="text-slate-450">Data/Hora:</span> {new Date(completedTx.timestamp).toLocaleString()}</p>
            <p><span className="text-slate-450">Operador:</span> {completedTx.cashierName}</p>
            <p><span className="text-slate-450">Cliente:</span> {completedTx.customerName || "Consumidor Geral"}</p>
            {completedTx.nuit && <p><span className="text-slate-450">NUIT Cli:</span> {completedTx.nuit}</p>}
          </div>

          <div className="border-b border-dashed border-slate-300 py-1 mb-2">
            <div className="grid grid-cols-12 gap-1 font-bold text-slate-800 text-[10px]">
              <span className="col-span-6 truncate">PRODUTO</span>
              <span className="col-span-2 text-center">QTD</span>
              <span className="col-span-4 text-right">VALOR</span>
            </div>
            {completedTx.items.map((item, i) => (
              <div key={`${item.productId}-${i}`} className="grid grid-cols-12 gap-1 py-0.5 text-slate-600">
                <span className="col-span-6 truncate">{item.productName}</span>
                <span className="col-span-2 text-center">{item.quantity}</span>
                <span className="col-span-4 text-right">{(item.price * item.quantity).toLocaleString()} MT</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-slate-600 text-right">
            <p>SUBTOTAL: {completedTx.subtotal.toLocaleString()} MT</p>
            {completedTx.discountTotal > 0 && <p className="text-red-650 font-bold">DESC. GER: -{completedTx.discountTotal.toLocaleString()} MT</p>}
            <p>TOTAL IVA COBRADO: {completedTx.vatTotal.toLocaleString()} MT</p>
            <p className="text-slate-900 font-bold text-xs border-t border-dashed border-slate-300 pt-1">
              TOTAL PAGO: {completedTx.grandTotal.toLocaleString()} MT
            </p>
            <p className="text-[10px] text-slate-500 font-medium italic mt-1">Método: {completedTx.paymentMethod}</p>
            {completedTx.paymentDetails && (
              <p className="text-[9.5px] text-red-600 font-semibold italic mt-0.5">{completedTx.paymentDetails}</p>
            )}
          </div>

          <p className="text-center font-semibold text-[9px] text-slate-500 mt-3 border-t border-dashed border-slate-300 pt-2 block">
            *** Muito Obrigado Pela Visita! ***
          </p>

          {/* Unique QR Code Generator for Digital Receipt */}
          {qrCodeDataUrl && (
            <div className="mt-3 pt-3 border-t border-dashed border-slate-300 flex flex-col items-center justify-center gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm animate-in zoom-in-95 duration-200">
              <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                <img
                  src={qrCodeDataUrl}
                  alt={`QR Code Fatura ${completedTx.invoiceNumber}`}
                  className="w-24 h-24 object-contain"
                />
              </div>
              <div className="text-center">
                <span className="text-[8px] font-black text-slate-700 tracking-wider font-sans uppercase">RECIBO DIGITAL</span>
                <p className="text-[7.5px] text-slate-400 font-sans mt-0.5 max-w-[180px] mx-auto leading-tight">
                  Aponte a câmara para visualizar a fatura digital <strong className="font-semibold text-slate-600">#{completedTx.invoiceNumber}</strong>
                </p>
              </div>
            </div>
          )}

          {completedTx.fiscalCertified && (
            <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-500 font-sans space-y-2 animate-in fade-in duration-300">
              <div className="flex flex-col items-center justify-center gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} className="w-14 h-14 object-contain bg-white p-0.5 rounded border border-slate-200" alt="QR Code Fiscal" />
                ) : (
                  <QrCode className="w-14 h-14 text-slate-800" />
                )}
                <span className="text-[7.5px] font-bold text-slate-600 tracking-wide font-mono uppercase">Controle Fiscal - AGT/MEF</span>
              </div>
              <div className="space-y-0.5">
                <p className="font-extrabold text-slate-700 tracking-wider">DOCUMENTO FISCAL HOMOLOGADO</p>
                <p className="text-[8px]">Certificação Nº: {settings.fiscalCertificationNumber || "OST/CERT/00249/2026"}</p>
                <p className="font-mono text-[8px] bg-white py-0.5 rounded border border-slate-200 px-1 font-bold text-slate-800 select-all">Chave: {completedTx.fiscalKeys}</p>
                <p className="font-mono text-[6.5px] text-slate-400 break-all leading-tight">Assinatura: {completedTx.fiscalHash}</p>
              </div>
            </div>
          )}
        </div>

        {/* Printable Invoice Container (A4 Layout) */}
        <div 
          id="pos-completed-invoice" 
          className="hidden print:block bg-white p-10 font-sans text-slate-800 border border-slate-200 rounded-2xl w-full max-w-[800px] mx-auto text-sm"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-slate-200 pb-6 mb-6">
            {settings.logoUrl && (
              <div className="mb-3">
                <img
                  src={settings.logoUrl}
                  alt="Logo"
                  className="w-16 h-16 object-contain mx-auto bg-white p-1 rounded-xl border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <h1 className="text-xl font-extrabold uppercase text-slate-900 tracking-tight">
              {settings.companyName || "OST COMÉRCIO CENTRAL"}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{settings.companyAddress || settings.storeAddress || "Av. Marginal, Kiosk 14, Maputo"}</p>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              NUIT: {settings.companyNuit || "400293112"} | Tel: {settings.storeContact || "+258 84 000 0000"}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-left">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dados do Documento</span>
              <span className="font-mono font-bold text-slate-900 text-sm block">
                {completedTx.invoiceNumber}
              </span>
              <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                <p>Emissão: <strong className="text-slate-700">{new Date(completedTx.timestamp).toLocaleString()}</strong></p>
                <p>Filial: <strong className="text-slate-700 uppercase">{completedTx.branchId || "Central"}</strong></p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cliente & Operador</span>
              <span className="font-semibold text-slate-900 text-sm block">
                {completedTx.customerName || "Consumidor Geral"}
              </span>
              <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                {completedTx.nuit && <p>NUIT: <strong className="text-slate-700">{completedTx.nuit}</strong></p>}
                <p>Operador: <strong className="text-slate-700">{completedTx.cashierName}</strong></p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 text-center w-12">Item</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4 text-center w-16">Qtd</th>
                  <th className="py-3 px-4 text-right w-28">P. Unitário</th>
                  <th className="py-3 px-4 text-right w-32">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedTx.items.map((item, index) => (
                  <tr key={`${item.productId}-${index}`} className="text-slate-700">
                    <td className="py-3 px-4 text-center font-mono text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {item.productName}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {item.price.toLocaleString()} {settings.currency || "MT"}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold font-mono text-slate-900">
                      {(item.price * item.quantity).toLocaleString()} {settings.currency || "MT"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Grid */}
          <div className="flex justify-end mb-6 text-right">
            <div className="w-full max-w-xs space-y-2 text-xs border-b border-slate-100 pb-4">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-mono">{completedTx.subtotal.toLocaleString()} {settings.currency || "MT"}</span>
              </div>
              {completedTx.discountTotal > 0 && (
                <div className="flex justify-between text-red-650 font-semibold">
                  <span>Desconto</span>
                  <span className="font-mono">-{completedTx.discountTotal.toLocaleString()} {settings.currency || "MT"}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>IVA Incluído</span>
                <span className="font-mono">{completedTx.vatTotal.toLocaleString()} {settings.currency || "MT"}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Pago</span>
                <span className="font-mono">{completedTx.grandTotal.toLocaleString()} {settings.currency || "MT"}</span>
              </div>
              <div className="text-right text-[10px] text-slate-400 italic mt-1">
                Método: <strong>{completedTx.paymentMethod}</strong>
                {completedTx.paymentDetails && ` (${completedTx.paymentDetails})`}
              </div>
            </div>
          </div>

          {/* Fiscal Cert & QR Section */}
          <div className="border-t-2 border-dashed border-slate-200 pt-6 text-center">
            <div className="flex flex-col items-center justify-center gap-2 mb-4">
              {qrCodeDataUrl ? (
                <div className="p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <img
                    src={qrCodeDataUrl}
                    alt="Código QR Fiscal"
                    className="w-24 h-24 object-contain"
                  />
                </div>
              ) : (
                <QrCode className="w-20 h-20 text-slate-400" />
              )}
              <span className="inline-block bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Documento Fiscal Homologado
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 max-w-md mx-auto text-[10px] font-mono text-slate-500 space-y-1.5 text-left">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>Autoridade Tributária (AT):</span>
                <span className="font-bold text-slate-700">PROCESSO DE CERTIFICAÇÃO</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>Certificado Nº:</span>
                <span className="font-bold text-slate-700">{settings.fiscalCertificationNumber || "OST/CERT/00249/2026"}</span>
              </div>
              {completedTx.fiscalKeys && (
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span>Chaves de Assinatura:</span>
                  <span className="font-bold text-slate-700 text-right truncate max-w-xs">{completedTx.fiscalKeys}</span>
                </div>
              )}
              {completedTx.fiscalHash && (
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span>Assinatura Digital (Hash):</span>
                  <span className="font-bold text-slate-750 text-right break-all max-w-xs leading-tight">{completedTx.fiscalHash}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Software de Faturação:</span>
                <span className="text-slate-700">OST VENDAS ERP {formattedVersion}</span>
              </div>
            </div>

            <div className="mt-4 text-[9px] text-slate-400 italic">
              Processado por Programa Certificado nº {settings.fiscalCertificationNumber || "00249/AGT/2026"} • Emitido por OST Vendas ERP
            </div>
          </div>
        </div>

        {/* Buttons / Actions */}
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Comunicações Digitais</p>

          {!selectedCustomer && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-[10.5px] leading-relaxed text-amber-850 space-y-1">
              <p className="font-extrabold flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Cliente não Registado
              </p>
              <p className="text-slate-600">
                O cliente atual é Consumidor Geral. Deseja registá-lo agora para enviar o recibo?
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-bold">
                {onRegisterCustomerForEmail && (
                  <button
                    type="button"
                    onClick={onRegisterCustomerForEmail}
                    className="text-orange-600 hover:text-orange-750 hover:underline cursor-pointer"
                  >
                    Registar e Enviar Email
                  </button>
                )}
                {onRegisterCustomerForEmail && onRegisterCustomerForWhatsApp && (
                  <span className="text-slate-300">|</span>
                )}
                {onRegisterCustomerForWhatsApp && (
                  <button
                    type="button"
                    onClick={onRegisterCustomerForWhatsApp}
                    className="text-orange-600 hover:text-orange-750 hover:underline cursor-pointer"
                  >
                    Registar e Enviar WhatsApp
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action Row: Email, SMS, WhatsApp */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onSendEmail}
              disabled={sendEmailStatus !== "idle"}
              className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-blue-50 text-blue-750 hover:bg-blue-100 transition border border-blue-100 disabled:opacity-75 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {sendEmailStatus === "idle" ? "Email" : sendEmailStatus === "sending" ? "..." : "✓"}
            </button>
            <button
              onClick={onSendSms}
              disabled={sendSmsStatus !== "idle"}
              className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition border border-indigo-100 disabled:opacity-75 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              {sendSmsStatus === "idle" ? "SMS" : sendSmsStatus === "sending" ? "..." : "✓"}
            </button>
            <button
              onClick={onOpenWhatsAppModal}
              disabled={sendWhatsAppStatus === "sending"}
              className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-850 hover:bg-emerald-100 transition border border-emerald-150 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              {sendWhatsAppStatus === "idle" ? "WhatsApp" : sendWhatsAppStatus === "sending" ? "..." : "✓"}
            </button>
          </div>

          {/* Primary 80mm Thermal Receipt Button */}
          <button
            type="button"
            onClick={() => onTriggerPrintReceipt("receipt")}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-xl text-xs font-bold text-white transition shadow-lg shadow-orange-600/20 cursor-pointer active:scale-[0.99]"
            title="Imprimir Fita Térmica de 80mm (Atalho: F5)"
          >
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 shrink-0" />
              <span>Imprimir Recibo</span>
              <kbd className="px-1.5 py-0.5 bg-white/20 text-white rounded text-[10px] font-mono font-bold shadow-inner">
                F5
              </kbd>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono font-semibold tracking-wide">
              Térmica 80mm
            </span>
          </button>

          {/* Secondary A4 Invoice Button */}
          <button
            type="button"
            onClick={() => onTriggerPrintReceipt("invoice")}
            className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
            title="Imprimir Fatura em Folha A4"
          >
            <div className="flex items-center gap-2">
              <Printer className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              <span>Imprimir Fatura (A4)</span>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-sans">
              Folha A4
            </span>
          </button>

          {/* Popup window options */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                try {
                  printThermal80mmReceipt(completedTx, settings || { companyName: "OST VENDAS", currency: "MT" } as SystemSettings);
                } catch (err) {
                  console.error(err);
                }
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 border border-orange-200 bg-orange-50/50 hover:bg-orange-100/80 text-orange-800 text-[10.5px] font-semibold transition rounded-lg cursor-pointer"
            >
              <Printer className="w-3 h-3 text-orange-600" />
              <span>Janela Recibo 80mm</span>
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  printInvoiceHTML(completedTx, settings || { companyName: "OST VENDAS", currency: "MT" } as SystemSettings);
                } catch (err) {
                  console.error(err);
                }
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10.5px] font-semibold transition rounded-lg cursor-pointer"
            >
              <Printer className="w-3 h-3 text-slate-400" />
              <span>Janela Fatura A4</span>
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onReset}
          className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer text-center"
        >
          Completar e Iniciar Nova Venda
        </button>
      </div>
    </div>
  );
};
