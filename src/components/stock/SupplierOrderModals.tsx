import React from "react";
import { ShoppingCart, X, MessageSquare, Mail, Save, FileText, CheckCircle, Copy, Send } from "lucide-react";
import { Product, SystemSettings, Supplier, SupplierOrder } from "../../types";

export interface SupplierOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  registeredSuppliers: Supplier[];
  products: Product[];
  orderSupplierId: string;
  orderProductId: string;
  orderQtyRequested: number;
  orderUnitCost: number;
  orderPaymentStatus: "Pago" | "Crédito" | "Pendente";
  orderPaymentDueDate: string;
  orderDispatchChannel: "WHATSAPP" | "EMAIL" | "NONE";
  onSupplierChange: (id: string) => void;
  onProductChange: (id: string) => void;
  onQtyChange: (qty: number) => void;
  onUnitCostChange: (cost: number) => void;
  onPaymentStatusChange: (status: "Pago" | "Crédito" | "Pendente") => void;
  onDueDateChange: (date: string) => void;
  onDispatchChannelChange: (channel: "WHATSAPP" | "EMAIL" | "NONE") => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SupplierOrderModal: React.FC<SupplierOrderModalProps> = ({
  isOpen,
  onClose,
  registeredSuppliers,
  products,
  orderSupplierId,
  orderProductId,
  orderQtyRequested,
  orderUnitCost,
  orderPaymentStatus,
  orderPaymentDueDate,
  orderDispatchChannel,
  onSupplierChange,
  onProductChange,
  onQtyChange,
  onUnitCostChange,
  onPaymentStatusChange,
  onDueDateChange,
  onDispatchChannelChange,
  onSubmit
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="bg-slate-950 text-white p-5 flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500 animate-bounce" />
              Efetuar Pedido de Stock ao Fornecedor
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Crie uma ordem de compra para reabastecer seu inventário.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Selecione o Fornecedor *</label>
            <select
              required
              value={orderSupplierId}
              onChange={(e) => onSupplierChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none cursor-pointer text-slate-800 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200"
            >
              <option value="">-- Escolher Fornecedor Cadastrado --</option>
              {registeredSuppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name} (NUIT: {s.nuit || "N/A"})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Selecione o Produto *</label>
            <select
              required
              value={orderProductId}
              onChange={(e) => onProductChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none cursor-pointer text-slate-800 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200"
            >
              <option value="">-- Escolher Produto do Inventário --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (SKU: {p.code} | Stock: {p.stock})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade Solicitada *</label>
              <input
                type="number"
                required
                min="1"
                placeholder="Quantidade"
                value={orderQtyRequested || ""}
                onChange={(e) => onQtyChange(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Preço de Custo (MT) *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="Preço Unitário"
                value={orderUnitCost || ""}
                onChange={(e) => onUnitCostChange(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Estado do Pagamento inicial</label>
            <select
              value={orderPaymentStatus}
              onChange={(e) => onPaymentStatusChange(e.target.value as "Pago" | "Crédito" | "Pendente")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none cursor-pointer text-slate-800 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200"
            >
              <option value="Pago">Pago à Vista 🟢</option>
              <option value="Crédito">Comprar a Crédito (Fornecedor) 🔴</option>
              <option value="Pendente">Pagamento Pendente 🟡</option>
            </select>
          </div>

          {orderPaymentStatus !== "Pago" && (
            <div className="space-y-1 animate-in slide-in-from-top duration-200">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Prazo de Vencimento do Pagamento</label>
              <input
                type="date"
                value={orderPaymentDueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs outline-none dark:bg-zinc-950 dark:border-zinc-800 text-slate-800 dark:text-zinc-200"
              />
              <p className="text-[9px] text-slate-400">Deixe em branco para assumir o prazo padrão de 15 dias.</p>
            </div>
          )}

          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">
              Canal de Envio ao Fornecedor:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onDispatchChannelChange("WHATSAPP")}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  orderDispatchChannel === "WHATSAPP"
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => onDispatchChannelChange("EMAIL")}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  orderDispatchChannel === "EMAIL"
                    ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>E-mail</span>
              </button>
              <button
                type="button"
                onClick={() => onDispatchChannelChange("NONE")}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  orderDispatchChannel === "NONE"
                    ? "bg-slate-700 text-white border-slate-800 shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300"
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Só Salvar</span>
              </button>
            </div>
          </div>

          {orderQtyRequested > 0 && orderUnitCost > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-[11px] font-bold text-orange-850 flex justify-between items-center dark:bg-orange-950/20 dark:border-orange-800/40 dark:text-orange-300">
              <span>Valor Estimado do Pedido:</span>
              <span className="font-mono text-xs">{(orderQtyRequested * orderUnitCost).toLocaleString()} MT</span>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 border border-slate-200 bg-white text-slate-750 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-350"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`w-2/3 py-2.5 text-white font-bold rounded-xl text-xs cursor-pointer transition shadow-md flex items-center justify-center gap-1.5 ${
                orderDispatchChannel === "WHATSAPP"
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10"
                  : orderDispatchChannel === "EMAIL"
                  ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/10"
                  : "bg-orange-500 hover:bg-orange-600 shadow-orange-500/10"
              }`}
            >
              {orderDispatchChannel === "WHATSAPP" ? (
                <>
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Gravar & Enviar WhatsApp</span>
                </>
              ) : orderDispatchChannel === "EMAIL" ? (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  <span>Gravar & Enviar E-mail</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Apenas Gravar Pedido</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export interface SupplierEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: SupplierOrder | null;
  orderEmailRecipient: string;
  orderEmailSubject: string;
  orderEmailBody: string;
  onRecipientChange: (rec: string) => void;
  onSubjectChange: (sub: string) => void;
  onBodyChange: (body: string) => void;
  onReDownloadPDF: () => void;
  onConfirmSendEmail: () => void;
  onCopyText: () => void;
}

export const SupplierEmailModal: React.FC<SupplierEmailModalProps> = ({
  isOpen,
  onClose,
  selectedOrder,
  orderEmailRecipient,
  orderEmailSubject,
  orderEmailBody,
  onRecipientChange,
  onSubjectChange,
  onBodyChange,
  onReDownloadPDF,
  onConfirmSendEmail,
  onCopyText
}) => {
  if (!isOpen || !selectedOrder) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              Enviar Pedido ao Fornecedor por E-mail
            </h3>
            <p className="text-[10px] text-blue-200 mt-0.5">
              Ref do Pedido: <span className="font-mono font-bold text-white">{selectedOrder.id}</span> • {selectedOrder.supplierName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-blue-900/60 hover:bg-blue-800 text-blue-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 dark:bg-emerald-950/30 dark:border-emerald-800/40">
            <div className="p-2 bg-emerald-500 text-white rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                PDF com Logotipo Gerado
              </h4>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 leading-tight">
                O documento oficial da Ordem de Compra foi descarregado com o logotipo da sua empresa. Anexe este ficheiro ao enviar o e-mail.
              </p>
            </div>
            <button
              type="button"
              onClick={onReDownloadPDF}
              className="px-2.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-[10px] font-bold cursor-pointer transition shrink-0 dark:bg-zinc-800 dark:border-emerald-700 dark:text-emerald-300"
              title="Descarregar PDF do pedido novamente"
            >
              Re-descarregar
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
              <span>E-mail do Fornecedor (Destinatário) *</span>
              {!orderEmailRecipient.trim() && (
                <span className="text-rose-500 text-[10px] font-normal">Insira o e-mail de destino</span>
              )}
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={orderEmailRecipient}
                onChange={(e) => onRecipientChange(e.target.value)}
                placeholder="ex: fornecedor@empresa.co.mz"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
              />
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Assunto do E-mail</label>
            <input
              type="text"
              value={orderEmailSubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Conteúdo da Mensagem</label>
              <button
                type="button"
                onClick={onCopyText}
                className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-bold dark:text-blue-400 cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Copiar Texto
              </button>
            </div>
            <textarea
              rows={6}
              value={orderEmailBody}
              onChange={(e) => onBodyChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmSendEmail}
              className="w-2/3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Abrir Cliente de E-mail (Enviar)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
