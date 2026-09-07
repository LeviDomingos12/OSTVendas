import React from "react";
import { Keyboard } from "lucide-react";

interface PosShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PosShortcutsHelpModal: React.FC<PosShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        id="pos-shortcuts-help-modal"
      >
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
              <Keyboard className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="font-extrabold text-slate-900 text-sm">Ajuda e Atalhos do POS</h3>
              <p className="text-[11px] text-slate-500 font-medium">Aumente a sua eficiência de atendimento</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer font-bold text-xs"
            title="Fechar (ESC)"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Shortcut Rows */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Atalhos de Operação do POS</p>
            <div className="grid grid-cols-1 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
              
              {/* F1 */}
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Painel de Ajuda / Atalhos</span>
                </div>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F1</kbd>
              </div>

              {/* F2 */}
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Focar Seleção de Cliente</span>
                </div>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F2</kbd>
              </div>

              {/* F3 */}
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Focar Pesquisa de Artigos</span>
                </div>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F3</kbd>
              </div>

              {/* F4 */}
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Registo Rápido de Cliente</span>
                </div>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F4</kbd>
              </div>

              {/* F5 */}
              <div className="flex items-center justify-between p-3 hover:bg-amber-50/70 transition bg-amber-50/40">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <div>
                    <span className="text-xs font-bold text-amber-950 block">Imprimir Recibo / Finalização Rápida</span>
                    <span className="text-[10.5px] text-amber-800/80">Imprime o recibo atual ou fatura imediatamente com emissão</span>
                  </div>
                </div>
                <kbd className="px-2.5 py-1 bg-amber-500 text-white border border-amber-600 rounded-lg text-xs font-bold font-mono shadow-sm">F5</kbd>
              </div>

              {/* F6 */}
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Aplicar Desconto Comercial %</span>
                </div>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F6</kbd>
              </div>

              {/* F8 */}
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Alternar Método de Pagamento</span>
                </div>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F8</kbd>
              </div>

              {/* F9 */}
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Abrir Confirmação / Pré-Checkout</span>
                </div>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">F9</kbd>
              </div>

              {/* ESC */}
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-xs font-semibold text-slate-700">Esvaziar / Cancelar Venda Atual</span>
                </div>
                <kbd className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 font-mono shadow-sm">ESC</kbd>
              </div>

            </div>
          </div>

          {/* Advanced info section */}
          <div className="space-y-3 pt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Recursos de Automação & Eficiência</p>
            
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                <span className="text-lg">🏷️</span>
                <div>
                  <h4 className="text-xs font-extrabold text-orange-950">Leitura Inteligente por Código de Barras</h4>
                  <p className="text-[11px] text-orange-800/80 leading-relaxed mt-0.5">
                    O POS suporta o uso de leitores USB emulando teclado. Ao bipar um artigo em qualquer lugar, o sistema processa o código instantaneamente e insere-o no carrinho, prevenindo cliques desnecessários.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-lg">⚖️</span>
                <div>
                  <h4 className="text-xs font-extrabold text-amber-950">Solicitação Automática de Peso</h4>
                  <p className="text-[11px] text-amber-800/80 leading-relaxed mt-0.5">
                    Para artigos vendidos ao quilo/peso, o sistema detecta de forma automática e abre um diálogo interativo para inserção da massa em gramas/kg, calculando com rigor a faturação.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-lg">💡</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Agilidade no Trabalho</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                    Você pode fechar esta janela de ajuda a qualquer momento pressionando a tecla <kbd className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded shadow-sm">ESC</kbd> ou <kbd className="font-mono text-[10px] bg-white border px-1 py-0.5 rounded shadow-sm">F1</kbd>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
          >
            Compreendi! Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
