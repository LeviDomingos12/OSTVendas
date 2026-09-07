import React from "react";
import { Printer } from "lucide-react";
import { Transaction, SystemSettings } from "../../types";
import { printInvoiceHTML } from "../../lib/printHelper";

export interface ReportsPrintModalProps {
  showPrintModal: Transaction | null;
  settings: SystemSettings;
  currency: string;
  onClose: () => void;
}

export const ReportsPrintModal: React.FC<ReportsPrintModalProps> = ({
  showPrintModal,
  settings,
  currency,
  onClose
}) => {
  if (!showPrintModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 flex flex-col gap-4">
        
        {/* Modal Header (No-Print) */}
        <div className="no-print flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-orange-500" />
            <h3 className="font-extrabold text-slate-900 text-sm">Comprovativo de Venda</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
          >
            Fechar ×
          </button>
        </div>

        {/* Printable Receipt Layout */}
        <div id="print-modal-container" className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-[11px] leading-tight text-slate-705 max-h-[420px] overflow-y-auto select-all">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #print-modal-container, #print-modal-container * {
                visibility: visible !important;
              }
              #print-modal-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                border: none !important;
                background: white !important;
                color: black !important;
                padding: 20px !important;
                margin: 0 !important;
                box-shadow: none !important;
                overflow: visible !important;
              }
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
            <p><span className="text-slate-500">Fatura:</span> {showPrintModal.invoiceNumber}</p>
            <p><span className="text-slate-500">Data/Hora:</span> {new Date(showPrintModal.timestamp).toLocaleString()}</p>
            <p><span className="text-slate-500">Operador:</span> {showPrintModal.cashierName}</p>
            <p><span className="text-slate-500">Cliente:</span> {showPrintModal.customerName || "Consumidor Geral"}</p>
            {showPrintModal.nuit && <p><span className="text-slate-500">NUIT Cli:</span> {showPrintModal.nuit}</p>}
          </div>

          <div className="border-b border-dashed border-slate-300 py-1 mb-2">
            <div className="grid grid-cols-12 gap-1 font-bold text-slate-800 text-[10px]">
              <span className="col-span-6 truncate">PRODUTO</span>
              <span className="col-span-2 text-center">QTD</span>
              <span className="col-span-4 text-right">VALOR</span>
            </div>
            {showPrintModal.items.map((item, i) => (
              <div key={`${item.productId}-${i}`} className="grid grid-cols-12 gap-1 py-0.5 text-slate-600">
                <span className="col-span-6 truncate">{item.productName}</span>
                <span className="col-span-2 text-center">{item.quantity}</span>
                <span className="col-span-4 text-right">{(item.price * item.quantity).toLocaleString()} {currency}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-slate-600 text-right">
            <p>SUBTOTAL: {showPrintModal.subtotal.toLocaleString()} {currency}</p>
            {showPrintModal.discountTotal > 0 && <p className="text-red-650 font-bold">DESC. GER: -{showPrintModal.discountTotal.toLocaleString()} {currency}</p>}
            <p>TOTAL IVA COBRADO: {showPrintModal.vatTotal.toLocaleString()} {currency}</p>
            <p className="text-slate-900 font-bold text-xs border-t border-dashed border-slate-300 pt-1">
              TOTAL PAGO: {showPrintModal.grandTotal.toLocaleString()} {currency}
            </p>
            <p className="text-[10px] text-slate-500 font-medium italic mt-1">Método: {showPrintModal.paymentMethod}</p>
            {showPrintModal.paymentDetails && (
              <p className="text-[9.5px] text-red-600 font-semibold italic mt-0.5">{showPrintModal.paymentDetails}</p>
            )}
          </div>

          <p className="text-center font-semibold text-[9px] text-slate-500 mt-3 border-t border-dashed border-slate-300 pt-2 block">
            *** Muito Obrigado Pela Visita! ***
          </p>

          {/* Unique QR Code Generator for Digital Receipt */}
          <div className="mt-3 pt-3 border-t border-dashed border-slate-300 flex flex-col items-center justify-center gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm no-print">
            <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(showPrintModal.invoiceNumber)}`}
                alt={`QR Code Fatura ${showPrintModal.invoiceNumber}`}
                className="w-20 h-20 object-contain"
              />
            </div>
            <div className="text-center">
              <span className="text-[8px] font-black text-slate-700 tracking-wider font-sans uppercase">RECIBO DIGITAL</span>
              <p className="text-[7.5px] text-slate-400 font-sans mt-0.5 max-w-[180px] mx-auto leading-tight">
                Aponte a câmara para visualizar a fatura digital <strong className="font-semibold text-slate-600">#{showPrintModal.invoiceNumber}</strong>
              </p>
            </div>
          </div>

          {showPrintModal.fiscalCertified && (
            <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-500 font-sans space-y-2">
              <div className="space-y-0.5">
                <p className="font-extrabold text-slate-700 tracking-wider">DOCUMENTO FISCAL HOMOLOGADO</p>
                <p className="text-[8px]">Certificação Nº: {settings.fiscalCertificationNumber || "OST/CERT/00249/2026"}</p>
                {showPrintModal.fiscalKeys && <p className="font-mono text-[8px] bg-white py-0.5 rounded border border-slate-200 px-1 font-bold text-slate-800 select-all">Chave: {showPrintModal.fiscalKeys}</p>}
                {showPrintModal.fiscalHash && <p className="font-mono text-[6.5px] text-slate-400 break-all leading-tight">Assinatura: {showPrintModal.fiscalHash}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Print Action Buttons (No-Print) */}
        <div className="no-print flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              try {
                printInvoiceHTML(showPrintModal, settings);
              } catch (err) {
                console.error(err);
              }
            }}
            className="w-full py-2.5 font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-orange-650/20 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Fatura (Nova Janela)
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition cursor-pointer text-center"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  window.print();
                } catch (err) {
                  console.warn(err);
                }
              }}
              className="w-1/2 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              Via Térmica
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
