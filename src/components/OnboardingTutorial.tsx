import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  ShoppingCart,
  Package,
  Users,
  Settings,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  SlidersHorizontal,
  HelpCircle,
  FileText,
  Printer,
  Zap,
  ArrowRight
} from "lucide-react";

export interface OnboardingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
  userName?: string;
  theme?: "day" | "night";
}

interface TutorialStep {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  content: string[];
  keyHighlights: { label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[];
  targetTab?: string;
  actionButtonText?: string;
}

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  userName = "Utilizador",
  theme = "day"
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const isNight = theme === "night";

  const steps: TutorialStep[] = [
    {
      id: "welcome",
      title: `Bem-vindo ao OST Vendas ERP, ${userName}!`,
      subtitle: "Sistema completo de Ponto de Venda (POS), Estoque, Clientes e Faturação",
      badge: "Início Rápido",
      badgeColor: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      icon: Sparkles,
      accentColor: "from-orange-500 to-amber-500",
      content: [
        "O OST Vendas foi desenhado para gerir o seu negócio com rapidez, segurança e total integridade de dados.",
        "Funciona perfeitamente em modo online e offline com sincronização automática na nuvem para manter as suas filiais sempre sincronizadas.",
        "Siga este guia breve para conhecer os módulos fundamentais e configurar os dados essenciais da sua empresa."
      ],
      keyHighlights: [
        { label: "Sincronização Nuvem", desc: "Dados guardados em tempo real de forma isolada e segura por empresa.", icon: Zap },
        { label: "Offline-First", desc: "Continue a vender mesmo se a internet oscilar ou cair temporariamente.", icon: ShieldCheck },
        { label: "Multi-Dispositivo", desc: "Utilize no computador, tablet ou telemóvel com a mesma facilidade.", icon: SlidersHorizontal }
      ]
    },
    {
      id: "pos",
      title: "Ponto de Venda (POS) & Frente de Caixa",
      subtitle: "Vendas rápidas, leituras de código de barras e emissão de recibos",
      badge: "Vendas & Caixa",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: ShoppingCart,
      accentColor: "from-emerald-500 to-teal-500",
      content: [
        "Aceda ao módulo 'Vender' para registrar vendas em segundos.",
        "Abra o turno de caixa informando o fundo de maneio inicial para controlo rigoroso de quebras ou sobras.",
        "Adicione itens ao carrinho por leitor de código de barras, pesquisa por texto ou toque direto nos produtos."
      ],
      keyHighlights: [
        { label: "Múltiplos Pagamentos", desc: "Aceite Numerário, M-Pesa, E-Mola, Cartão POS e vendas a prazo/crédito.", icon: CheckCircle2 },
        { label: "Impressão Térmica", desc: "Emita talões térmicos configuráveis de 80mm ou 58mm compatíveis com impressoras ESC/POS.", icon: Printer },
        { label: "Troco & Descontos", desc: "Cálculo instantâneo de troco, descontos em percentagem (%) ou valor fixo (MT).", icon: FileText }
      ],
      targetTab: "POS",
      actionButtonText: "Ver Ponto de Venda (POS)"
    },
    {
      id: "products",
      title: "Gestão de Produtos & Inventário",
      subtitle: "Catálogo completo, custos, preços de venda e alertas de estoque",
      badge: "Estoque",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      icon: Package,
      accentColor: "from-blue-500 to-indigo-500",
      content: [
        "No menu 'Produtos', você pode cadastrar todo o seu catálogo com códigos, categorias e fornecedores.",
        "Defina o preço de custo e o preço de venda para calcular a sua margem de lucro de forma transparente.",
        "Configure o estoque mínimo de cada item para receber avisos automáticos antes que o produto esgote."
      ],
      keyHighlights: [
        { label: "Código de Barras", desc: "Suporte total a leitores USB, Bluetooth e geração de códigos internos.", icon: SlidersHorizontal },
        { label: "Taxa de IVA", desc: "Defina produtos isentos ou aplique o IVA padrão (16%) de Moçambique.", icon: CheckCircle2 },
        { label: "Entrada e Ajustes", desc: "Registe reposições de estoque e acertos de inventário com rastreio de auditoria.", icon: Zap }
      ],
      targetTab: "PRODUCTS",
      actionButtonText: "Explorar Catálogo de Produtos"
    },
    {
      id: "customers",
      title: "Clientes & Vendas a Prazo (Crédito)",
      subtitle: "Fidelização, contas correntes, controle de dívidas e extratos em PDF",
      badge: "Clientes & Crédito",
      badgeColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      icon: Users,
      accentColor: "from-violet-500 to-purple-500",
      content: [
        "Registe os seus clientes regulares e empresariais com NUIT, contacto telefónico e morada.",
        "Permita vendas a prazo controlando o saldo pendente, pagamentos parciais e prazos de liquidação.",
        "Emita extratos de conta corrente e envie notificações de fatura por SMS ou E-mail com um clique."
      ],
      keyHighlights: [
        { label: "Controle de Saldo", desc: "Veja o total gasto, histórico de compras e dívidas acumuladas por cliente.", icon: CheckCircle2 },
        { label: "Emissão de Faturas", desc: "Gere faturas e recibos formais detalhados prontos para impressão ou envio digital.", icon: FileText },
        { label: "Pontos de Fidelidade", desc: "Acumule pontos em compras para premiar os seus clientes mais fiéis.", icon: Sparkles }
      ],
      targetTab: "CUSTOMERS",
      actionButtonText: "Gerir Clientes"
    },
    {
      id: "settings",
      title: "Configurações Principais da Empresa",
      subtitle: "Personalize os dados fiscais, logotipo, moeda e modelo de fatura",
      badge: "Configuração Essencial",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      icon: Settings,
      accentColor: "from-amber-500 to-orange-500",
      content: [
        "Aceda ao módulo 'Definições' para configurar a identidade da sua empresa.",
        "Estas informações serão exibidas automaticamente no cabeçalho e rodapé de todos os recibos e faturas impressas.",
        "Mantenha os dados fiscais sempre atualizados para conformidade legal e profissionalismo perante os seus clientes."
      ],
      keyHighlights: [
        { label: "Nome & NUIT", desc: "Indique a razão social da sua empresa e o NUIT fiscal oficial.", icon: FileText },
        { label: "Contactos & Morada", desc: "Telefone, WhatsApp e morada que saem no cabeçalho das faturas.", icon: SlidersHorizontal },
        { label: "Moeda & IVA", desc: "Defina a Moeda (MT por padrão) e a taxa de IVA aplicada às vendas.", icon: CheckCircle2 }
      ],
      targetTab: "SETTINGS",
      actionButtonText: "Ir para as Configurações Agora"
    },
    {
      id: "security",
      title: "Segurança, Equipa & Cópias de Segurança",
      subtitle: "Perfis de utilizador, integridade de dados e proteção em nuvem",
      badge: "Segurança & Nuvem",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      icon: ShieldCheck,
      accentColor: "from-rose-500 to-red-500",
      content: [
        "Cadastre os seus funcionários com papéis adequados: Administrador, Gerente ou Operador de Caixa.",
        "Cada operador possui a sua própria senha ou PIN de segurança, garantindo que as vendas sejam registradas com responsabilidade individual.",
        "Faça backups periódicos dos seus dados e acompanhe o registo de auditoria de tudo o que acontece no sistema."
      ],
      keyHighlights: [
        { label: "Isolamento Multitenant", desc: "Os seus dados pertencem estritamente à sua conta e empresa.", icon: ShieldCheck },
        { label: "Auditoria Completa", desc: "Histórico detalhado de aberturas de caixa, cancelamentos e alterações de preço.", icon: FileText },
        { label: "Cópia de Segurança", desc: "Exporte e importe backups a qualquer momento através do menu Segurança.", icon: Zap }
      ],
      targetTab: "SETTINGS",
      actionButtonText: "Concluir e Começar"
    }
  ];

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleActionClick = (targetTab?: string) => {
    onClose();
    if (targetTab && onNavigateTab) {
      onNavigateTab(targetTab);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isNight
            ? "bg-zinc-950 text-slate-100 border-zinc-800"
            : "bg-white text-slate-850 border-slate-200"
        }`}
      >
        {/* Header com gradiente e barra de progresso */}
        <div className="relative border-b border-slate-200 dark:border-zinc-800 p-5 sm:p-6 pb-4 bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-transparent">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl bg-gradient-to-br ${currentStep.accentColor} text-white shadow-md shadow-orange-500/20`}>
                <currentStep.icon className="w-5 h-5" />
              </div>
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border ${currentStep.badgeColor}`}>
                  {currentStep.badge}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  Passo {currentStepIndex + 1} de {steps.length}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-850 transition cursor-pointer"
              title="Fechar tutorial"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Barra de progresso linear */}
          <div className="w-full bg-slate-150 dark:bg-zinc-800 h-1.5 rounded-full mt-4 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
              initial={false}
              animate={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Corpo do conteúdo com scroll */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {currentStep.title}
            </h2>
            <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mt-1">
              {currentStep.subtitle}
            </p>
          </div>

          <div className="space-y-2.5 text-sm text-slate-650 dark:text-slate-350 leading-relaxed">
            {currentStep.content.map((paragraph, idx) => (
              <p key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 shrink-0" />
                <span>{paragraph}</span>
              </p>
            ))}
          </div>

          {/* Destaques visuais / Caixas explicativas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {currentStep.keyHighlights.map((hl, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-xl border transition-all ${
                  isNight
                    ? "bg-zinc-900/70 border-zinc-800 hover:border-zinc-700"
                    : "bg-slate-50 border-slate-200 hover:border-orange-200 shadow-xs"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <hl.icon className="w-4 h-4 text-orange-500 shrink-0" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {hl.label}
                  </h4>
                </div>
                <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-snug">
                  {hl.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Ação rápida para o módulo correspondente */}
          {currentStep.targetTab && (
            <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isNight ? "bg-orange-950/20 border-orange-900/40" : "bg-orange-50/70 border-orange-200"
            }`}>
              <div className="flex items-center gap-2.5 text-left w-full sm:w-auto">
                <HelpCircle className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Deseja saltar diretamente para este módulo?
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleActionClick(currentStep.targetTab)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
              >
                <span>{currentStep.actionButtonText || "Abrir Módulo"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Rodapé com Navegação */}
        <div className={`p-4 sm:p-5 border-t flex items-center justify-between gap-3 ${
          isNight ? "bg-zinc-900/60 border-zinc-800" : "bg-slate-50/80 border-slate-200"
        }`}>
          {/* Indicadores de bolinhas */}
          <div className="flex items-center gap-1.5">
            {steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? "w-6 bg-orange-500"
                    : "w-2 bg-slate-300 dark:bg-zinc-700 hover:bg-slate-400"
                }`}
                title={`Ir para ${step.title}`}
                aria-label={`Passo ${idx + 1}`}
              />
            ))}
          </div>

          {/* Botões Próximo / Anterior / Concluir */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isNight
                    ? "bg-zinc-900 border-zinc-800 text-slate-300 hover:bg-zinc-800"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isLastStep ? "Começar a Usar" : "Próximo"}</span>
              {isLastStep ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
export default OnboardingTutorial;
