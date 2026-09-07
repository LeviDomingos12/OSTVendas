import React, { useState, useEffect } from "react";
import { Info, Keyboard, X, Sparkles, Command } from "lucide-react";

export interface ShortcutItem {
  key: string;
  action: string;
  description: string;
  badgeColor?: "indigo" | "orange" | "emerald" | "amber" | "rose" | "slate";
  category?: string;
}

export interface ModuleShortcutsHelpProps {
  moduleName: string;
  moduleCode: "POS" | "STOCK";
  shortcuts?: ShortcutItem[];
  tips?: string[];
  position?: "bottom-right" | "bottom-left";
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export const POS_DEFAULT_SHORTCUTS: ShortcutItem[] = [
  {
    key: "F1",
    action: "Painel de Atalhos & Ajuda",
    description: "Abre ou fecha este guia de teclas de atalho e dicas de operação.",
    badgeColor: "indigo",
    category: "Geral"
  },
  {
    key: "F2",
    action: "Focar Seleção de Cliente",
    description: "Direciona o cursor imediatamente para o seletor de clientes da venda.",
    badgeColor: "indigo",
    category: "Vendas"
  },
  {
    key: "F3",
    action: "Focar Pesquisa de Artigos",
    description: "Ativa a barra de busca para pesquisar produtos por nome ou bipar código de barras.",
    badgeColor: "indigo",
    category: "Vendas"
  },
  {
    key: "F4",
    action: "Registo Rápido de Cliente",
    description: "Abre o diálogo de cadastro expresso de novo cliente sem sair do atendimento.",
    badgeColor: "indigo",
    category: "Clientes"
  },
  {
    key: "F5",
    action: "Imprimir Recibo / Finalização Rápida",
    description: "Imprime o recibo atual ou conclui e emite instantaneamente a fatura da venda.",
    badgeColor: "amber",
    category: "Finalização"
  },
  {
    key: "F6",
    action: "Aplicar Desconto Comercial %",
    description: "Solicita a percentagem de desconto comercial direto a incidir sobre a venda.",
    badgeColor: "indigo",
    category: "Vendas"
  },
  {
    key: "F8",
    action: "Alternar Forma de Pagamento",
    description: "Alterna entre Dinheiro, M-Pesa, E-Mola, Cartão POS, Dívida (Crédito) ou Misto.",
    badgeColor: "indigo",
    category: "Finalização"
  },
  {
    key: "F9",
    action: "Pré-Checkout / Concluir Venda",
    description: "Abre a tela de confirmação de pagamento com cálculo dinâmico de troco.",
    badgeColor: "orange",
    category: "Finalização"
  },
  {
    key: "F10 / F11",
    action: "Modo Minimizado (Foco no POS)",
    description: "Oculta elementos secundários para maximizar a área de trabalho do caixa.",
    badgeColor: "slate",
    category: "Interface"
  },
  {
    key: "ESC",
    action: "Cancelar / Limpar ou Fechar Janela",
    description: "Fecha janelas abertas ou esvazia o carrinho atual mediante confirmação.",
    badgeColor: "rose",
    category: "Geral"
  }
];

export const STOCK_DEFAULT_SHORTCUTS: ShortcutItem[] = [
  {
    key: "F1",
    action: "Ajuda & Atalhos do Stock",
    description: "Abre ou fecha este guia com as teclas de atalho do módulo de Stock.",
    badgeColor: "indigo",
    category: "Geral"
  },
  {
    key: "F2 ou Ctrl + N",
    action: "Cadastrar Novo Produto",
    description: "Abre imediatamente o formulário lateral para registar um novo artigo no inventário.",
    badgeColor: "orange",
    category: "Catálogo"
  },
  {
    key: "F3 ou /",
    action: "Focar Pesquisa de Artigos",
    description: "Posiciona o cursor no campo de pesquisa por SKU, nome, categoria ou fornecedor.",
    badgeColor: "indigo",
    category: "Pesquisa"
  },
  {
    key: "Ctrl + S",
    action: "Reposição Rápida de Stock",
    description: "Abre o assistente de entrada de stock para receção e aumento de inventário.",
    badgeColor: "emerald",
    category: "Movimentação"
  },
  {
    key: "F4 ou Ctrl + E",
    action: "Importar / Exportar CSV",
    description: "Abre o utilitário de importação e exportação de catálogo via folha de cálculo CSV.",
    badgeColor: "indigo",
    category: "Gestão"
  },
  {
    key: "F8",
    action: "Alternar Filtros Avançados",
    description: "Abre ou recolhe a gaveta de filtros por fornecedor e margem mínima de lucro.",
    badgeColor: "slate",
    category: "Pesquisa"
  },
  {
    key: "ESC",
    action: "Fechar Painéis / Limpar Filtros",
    description: "Fecha formulários laterais, painéis de detalhes de produtos e modais abertos.",
    badgeColor: "rose",
    category: "Geral"
  }
];

export const ModuleShortcutsHelp: React.FC<ModuleShortcutsHelpProps> = ({
  moduleName,
  moduleCode,
  shortcuts,
  tips,
  position = "bottom-right",
  isOpen: controlledIsOpen,
  onOpenChange,
  className = ""
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  const setOpen = (open: boolean) => {
    if (!isControlled) {
      setInternalOpen(open);
    }
    onOpenChange?.(open);
  };

  const activeShortcuts = shortcuts || (moduleCode === "POS" ? POS_DEFAULT_SHORTCUTS : STOCK_DEFAULT_SHORTCUTS);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const badgeColorClasses = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
    orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    amber: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
    slate: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
  };

  const positionClasses = position === "bottom-left" ? "bottom-5 left-5" : "bottom-5 right-5";

  return (
    <>
      {/* Floating Info / Help Button */}
      <div className={`fixed ${positionClasses} z-40 ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex items-center justify-center w-9 h-9 rounded-full bg-white/95 dark:bg-zinc-900/95 text-slate-600 dark:text-zinc-300 hover:text-orange-600 dark:hover:text-orange-400 border border-slate-200/80 dark:border-zinc-700/80 shadow-md hover:shadow-lg backdrop-blur-md transition-all duration-150 transform hover:scale-105 active:scale-95 cursor-pointer"
          title={`Teclas de Atalho do ${moduleName} (Pressione F1)`}
          aria-label={`Ajuda e teclas de atalho de ${moduleName}`}
          id={`${moduleCode.toLowerCase()}-shortcuts-info-btn`}
        >
          <Info className="w-4.5 h-4.5 transition-transform group-hover:rotate-6" />

          {/* Tooltip on hover */}
          <span className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 dark:bg-white dark:text-slate-900 flex items-center gap-1.5">
            <Keyboard className="w-3 h-3" />
            <span>Atalhos ({moduleCode})</span>
            <kbd className="px-1 py-0.2 bg-slate-800 dark:bg-slate-100 rounded text-[9px] font-mono">F1</kbd>
          </span>
        </button>
      </div>

      {/* Modal / Dialog Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            id={`${moduleCode.toLowerCase()}-shortcuts-modal`}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-zinc-900/90 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                  <Keyboard className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Teclas de Atalho — {moduleName}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                      {moduleCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Acelere as operações sem necessidade de cliques com o rato
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/50 dark:hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
                title="Fechar (ESC)"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Atalhos Disponíveis
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                    <Command className="w-3 h-3" />
                    <span>Teclado Ativo</span>
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-slate-50/40 dark:bg-zinc-950/40">
                  {activeShortcuts.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 hover:bg-white dark:hover:bg-zinc-900/60 transition flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5 text-left flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800 dark:text-zinc-200">
                            {item.action}
                          </span>
                          {item.category && (
                            <span className="text-[9px] font-medium text-slate-400 dark:text-zinc-500 uppercase">
                              • {item.category}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <kbd
                        className={`px-2 py-1 rounded-md text-xs font-bold font-mono shrink-0 shadow-xs border ${
                          badgeColorClasses[item.badgeColor || "slate"]
                        }`}
                      >
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              {/* Module Tips & Automation Info */}
              <div className="bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 rounded-xl p-3 text-left flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-orange-900 dark:text-orange-200 space-y-1">
                  <p className="font-bold text-orange-950 dark:text-orange-100">
                    Dica de Produtividade
                  </p>
                  {tips && tips.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-orange-800/90 dark:text-orange-300">
                      {tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  ) : moduleCode === "POS" ? (
                    <p className="text-orange-800/90 dark:text-orange-300 leading-relaxed">
                      Pode ler códigos de barras com leitores USB diretamente no ecrã. O sistema deteta o código, adiciona o artigo ao carrinho e calcula o total automaticamente.
                    </p>
                  ) : (
                    <p className="text-orange-800/90 dark:text-orange-300 leading-relaxed">
                      Pressione <kbd className="font-mono bg-white dark:bg-zinc-800 border px-1 py-0.2 rounded shadow-xs">Ctrl + S</kbd> em qualquer momento para abrir a reposição rápida de stock, ou <kbd className="font-mono bg-white dark:bg-zinc-800 border px-1 py-0.2 rounded shadow-xs">F2</kbd> para cadastrar um novo produto.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 dark:bg-zinc-900/90 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono pl-2">
                Pressione <kbd className="bg-white dark:bg-zinc-800 border px-1 py-0.5 rounded text-[10px]">ESC</kbd> para fechar
              </span>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                Compreendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
