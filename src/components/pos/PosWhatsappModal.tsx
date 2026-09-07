import React from "react";
import { MessageSquare } from "lucide-react";
import { SystemSettings } from "../../types";

interface PosWhatsappModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  whatsappPhone: string;
  setWhatsappPhone: (phone: string) => void;
  whatsappMessage: string;
  setWhatsappMessage: (msg: string) => void;
  sendWhatsAppStatus: "idle" | "sending" | "sent" | "error";
  onDispatch: (useDirectLink: boolean) => void;
}

export const PosWhatsappModal: React.FC<PosWhatsappModalProps> = ({
  isOpen,
  onClose,
  settings,
  whatsappPhone,
  setWhatsappPhone,
  whatsappMessage,
  setWhatsappMessage,
  sendWhatsAppStatus,
  onDispatch,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-slate-800">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              <span>Enviar Recibo via WhatsApp</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Revise o contacto e o formato do documento antes de despachar.
            </p>
          </div>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
              settings.whatsappEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
            }`}
          >
            {settings.whatsappEnabled ? `API: ${settings.whatsappProvider}` : "Modo Link Direto"}
          </span>
        </div>

        <div className="space-y-3.5">
          {/* Phone number field */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              Número do Cliente (Com WhatsApp)
            </label>
            <div className="relative">
              <input
                type="text"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="Ex: +258 84 900 1202"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-10 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="absolute left-3.5 top-2.5 text-slate-400 text-xs font-bold font-mono">🇲🇿</span>
            </div>
            <p className="text-[9px] text-slate-400">
              Insira com o indicativo (Ex: +258 ou 258) ou apenas o número celular de Moçambique de 9 dígitos.
            </p>
          </div>

          {/* Message preview body */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Mensagem de Texto Pré-formatada
              </label>
              <span className="text-[9.5px] font-mono text-slate-400">{whatsappMessage.length} caracteres</span>
            </div>
            <textarea
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              rows={8}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-[10.5px] font-mono leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500 max-h-60"
            />
          </div>

          {/* Helper guide on chosen provider */}
          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-[10px] space-y-1 font-mono text-slate-500">
            <p className="font-bold text-slate-700">⚙️ Canal de Comunicação Ativo:</p>
            {settings.whatsappEnabled && settings.whatsappProvider !== "DIRECT_LINK" ? (
              <>
                <p>
                  • Provedor: <span className="text-emerald-700 font-bold">{settings.whatsappProvider}</span>
                </p>
                <p>
                  • Endpoint: <span className="truncate block max-w-full">{settings.whatsappApiEndpoint || "Configurado"}</span>
                </p>
                <p className="text-[9px] text-slate-400">
                  As mensagens serão disparadas via servidor invisível sem intervenção manual. Se houver falha, reverteremos para Link Direto.
                </p>
              </>
            ) : (
              <>
                <p>
                  • Provedor: <span className="text-orange-600 font-bold">Link Direto (wa.me)</span>
                </p>
                <p>
                  • Custo: <span className="text-emerald-700 font-bold">100% Grátis e Ilimitado</span>
                </p>
                <p className="text-[9px] text-slate-400">
                  O sistema abrirá uma nova aba do navegador para o WhatsApp Web ou aplicação móvel do operador com a mensagem pré-carregada.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Actions choosing triggers */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            Voltar
          </button>

          {settings.whatsappEnabled && settings.whatsappProvider !== "DIRECT_LINK" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onDispatch(true)}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-[10px] font-bold text-slate-700 transition cursor-pointer"
                title="Usar link wa.me direto em vez de gateway"
              >
                Link Direto
              </button>
              <button
                type="button"
                onClick={() => onDispatch(false)}
                disabled={sendWhatsAppStatus === "sending"}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-[10px] font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-600/15"
              >
                {sendWhatsAppStatus === "sending" ? "A Enviar..." : "Disparar API ✓"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onDispatch(true)}
              className="py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-600/15"
            >
              Abrir WhatsApp Link ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
