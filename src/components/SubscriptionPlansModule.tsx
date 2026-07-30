import React, { useState } from "react";
import { 
  Crown, 
  Check, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Users, 
  ArrowUpRight, 
  Lock, 
  CreditCard,
  Award,
  Layers,
  ChevronRight,
  Mail,
  Smartphone,
  Info
} from "lucide-react";
import { SubscriptionPlan, Employee, SystemSettings } from "../types";

interface SubscriptionPlansModuleProps {
  currentPlan: SubscriptionPlan;
  activeUser: Employee | null;
  employees: Employee[];
  settings: SystemSettings;
  onUpdateUserPlan: (employeeId: string, newPlan: SubscriptionPlan) => void;
  onUpdateSystemPlan: (newPlan: SubscriptionPlan) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
  onNavigateToModule?: (module: string) => void;
}

export const PLAN_FEATURES = [
  {
    category: "Ponto de Venda & Operações",
    items: [
      { name: "Caixa & Faturação Básica (POS)", bronze: true, prata: true, ouro: true, desc: "Abertura, fecho de caixa e emissão de recibos" },
      { name: "Gestão Básica de Produtos & Clientes", bronze: true, prata: true, ouro: true, desc: "Cadastro de até 200 produtos e clientes" },
      { name: "Múltiplos Meios de Pagamento (Dinheiro/Cartão)", bronze: true, prata: true, ouro: true, desc: "Registo de pagamento em numerário e TPA" },
      { name: "Impressão de Recibos em Térmica (80mm/58mm)", bronze: false, prata: true, ouro: true, desc: "Suporte a impressoras térmicas USB e Bluetooth" },
    ]
  },
  {
    category: "Estoque & Gestão Avançada",
    items: [
      { name: "Controlo de Estoque Avançado & Alertas", bronze: false, prata: true, ouro: true, desc: "Notificação de estoque baixo por e-mail/SMS" },
      { name: "Gestão de Lotes & Alertas de Validade", bronze: false, prata: true, ouro: true, desc: "Rastreio por lotes, datas de expiração e FIFO" },
      { name: "Multi-Filiais & Transferência de Estoque", bronze: false, prata: false, ouro: true, desc: "Gestão centralizada de múltiplas lojas e armazéns" },
    ]
  },
  {
    category: "Integrações & Inteligência Artificial",
    items: [
      { name: "Gateway M-Pesa & e-Mola Integrado (Paga Fácil)", bronze: false, prata: true, ouro: true, desc: "Pagamentos móveis instantâneos via API" },
      { name: "Previsão de Vendas com Inteligência Artificial", bronze: false, prata: false, ouro: true, desc: "Modelos preditivos IA com sugestões de campanhas" },
      { name: "Gerador Automático de Flyers Promocionais IA", bronze: false, prata: false, ouro: true, desc: "Criação visual de encartes de desconto automatizados" },
      { name: "Gráficos Interativos D3 & Auditoria Completa", bronze: false, prata: false, ouro: true, desc: "Análise de logs de auditoria e gráficos dinâmicos D3" },
    ]
  }
];

export default function SubscriptionPlansModule({
  currentPlan = "OURO",
  activeUser,
  employees = [],
  settings,
  onUpdateUserPlan,
  onUpdateSystemPlan,
  onShowToast,
  onNavigateToModule
}: SubscriptionPlansModuleProps) {
  const [selectedPlanTab, setSelectedPlanTab] = useState<SubscriptionPlan>("OURO");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployeeForPlan, setSelectedEmployeeForPlan] = useState<Employee | null>(null);

  const isCreatorOrAdmin = activeUser?.role === "ADMIN" || activeUser?.email === "levidomingos12@gmail.com";

  const getPlanBadgeColor = (plan: SubscriptionPlan) => {
    switch (plan) {
      case "OURO":
        return "bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20";
      case "PRATA":
        return "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-950 font-bold";
      case "BRONZE":
        return "bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 font-bold";
      default:
        return "bg-slate-800 text-slate-300";
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.email && emp.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-slate-100">
      {/* Banner de Topo - Estado Atual da Assinatura */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs tracking-wider uppercase flex items-center gap-1.5 ${getPlanBadgeColor(currentPlan)}`}>
                <Crown className="w-3.5 h-3.5" />
                Plano {currentPlan} Ativo
              </span>
              <span className="text-xs text-slate-400 font-mono bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                Licença Comercial
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Planos de Acesso & Subscrições OST Vendas
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              O sistema OST Vendas possui 3 modalidades de subscrição comercial (Bronze, Prata e Ouro).
              O Plano Ouro desbloqueia todas as funcionalidades premium com Inteligência Artificial e gestão multi-filial.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => {
                if (onShowToast) {
                  onShowToast("Para atualizar ou adquirir planos adicionais, entre em contacto pelo suporte oficial.", "info", "Suporte de Vendas");
                }
              }}
              className="px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Solicitar Upgrade Plano Ouro
            </button>
          </div>
        </div>
      </div>

      {/* Cartões dos 3 Planos (Bronze, Prata, Ouro) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plano BRONZE */}
        <div className={`relative rounded-2xl bg-slate-900/90 border transition-all p-6 flex flex-col justify-between ${
          currentPlan === "BRONZE" ? "border-amber-600/80 ring-2 ring-amber-600/30" : "border-slate-800 hover:border-slate-700"
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono tracking-widest text-amber-500 uppercase">
                Essencial
              </span>
              {currentPlan === "BRONZE" && (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Seu Plano
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                Plano Bronze
              </h3>
              <p className="text-xs text-slate-400 mt-1">Ideal para pequenos negócios e comércio inicial.</p>
            </div>

            <div className="py-3 border-y border-slate-800/80">
              <span className="text-2xl font-black text-white">Sob Consulta</span>
              <span className="text-xs text-slate-500 block">Acesso às funções operacionais do Caixa</span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ponto de Venda (Caixa POS)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Cadastro Básico de Produtos e Clientes</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Emissão de Faturas / Recibos</span>
              </li>
              <li className="flex items-center gap-2 text-slate-500 line-through">
                <X className="w-4 h-4 text-slate-600 shrink-0" />
                <span>Gateway M-Pesa & e-Mola</span>
              </li>
              <li className="flex items-center gap-2 text-slate-500 line-through">
                <X className="w-4 h-4 text-slate-600 shrink-0" />
                <span>Previsão de Vendas por IA</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            {isCreatorOrAdmin && (
              <button
                onClick={() => {
                  onUpdateSystemPlan("BRONZE");
                  if (onShowToast) onShowToast("Plano do sistema alterado para BRONZE", "info");
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Ativar Plano Bronze (Admin)
              </button>
            )}
          </div>
        </div>

        {/* Plano PRATA */}
        <div className={`relative rounded-2xl bg-slate-900/90 border transition-all p-6 flex flex-col justify-between ${
          currentPlan === "PRATA" ? "border-slate-400/80 ring-2 ring-slate-400/30" : "border-slate-800 hover:border-slate-700"
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono tracking-widest text-slate-300 uppercase">
                Avançado
              </span>
              {currentPlan === "PRATA" && (
                <span className="text-[10px] font-bold bg-slate-300/20 text-slate-200 border border-slate-300/30 px-2 py-0.5 rounded-full">
                  Seu Plano
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                Plano Prata
              </h3>
              <p className="text-xs text-slate-400 mt-1">Para lojas em expansão com controlo de estoque avançado.</p>
            </div>

            <div className="py-3 border-y border-slate-800/80">
              <span className="text-2xl font-black text-white">Sob Consulta</span>
              <span className="text-xs text-slate-500 block">Inclui M-Pesa, Lotes & Impressão Térmica</span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Tudo do Plano Bronze</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Gateway M-Pesa & e-Mola (Paga Fácil)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Gestão de Lotes & Alertas de Validade</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Suporte a Impressora Térmica</span>
              </li>
              <li className="flex items-center gap-2 text-slate-500 line-through">
                <X className="w-4 h-4 text-slate-600 shrink-0" />
                <span>Previsão de Vendas com IA & Flyers Promocionais</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            {isCreatorOrAdmin && (
              <button
                onClick={() => {
                  onUpdateSystemPlan("PRATA");
                  if (onShowToast) onShowToast("Plano do sistema alterado para PRATA", "info");
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Ativar Plano Prata (Admin)
              </button>
            )}
          </div>
        </div>

        {/* Plano OURO (Destaque VIP) */}
        <div className={`relative rounded-2xl bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border-2 transition-all p-6 flex flex-col justify-between shadow-2xl ${
          currentPlan === "OURO" ? "border-amber-500 ring-4 ring-amber-500/20" : "border-amber-500/60 hover:border-amber-500"
        }`}>
          <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] tracking-widest px-3 py-1 rounded-full uppercase shadow-md flex items-center gap-1">
            <Crown className="w-3 h-3" /> Recomendado VIP
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono tracking-widest text-amber-400 uppercase">
                Completo & Ilimitado
              </span>
              {currentPlan === "OURO" && (
                <span className="text-[10px] font-bold bg-amber-500/30 text-amber-200 border border-amber-500/40 px-2 py-0.5 rounded-full">
                  Seu Plano
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-amber-300 flex items-center gap-2">
                Plano Ouro
              </h3>
              <p className="text-xs text-amber-200/70 mt-1">Acesso irrestrito a todos os módulos, Inteligência Artificial e Multi-Filiais.</p>
            </div>

            <div className="py-3 border-y border-amber-500/20">
              <span className="text-2xl font-black text-amber-300">Sob Consulta</span>
              <span className="text-xs text-amber-200/60 block">Módulos de IA, Gráficos D3 e Múltiplas Lojas</span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-200">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold text-amber-200">Acesso Total Sem Restrições</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Previsão de Vendas com Inteligência Artificial</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Gerador de Flyers Promocionais por IA</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Gestão Centralizada Multi-Filiais</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Gráficos D3 com Média Móvel & Zoom/Pan</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-amber-500/20">
            {isCreatorOrAdmin && (
              <button
                onClick={() => {
                  onUpdateSystemPlan("OURO");
                  if (onShowToast) onShowToast("Plano do sistema alterado para OURO (Ilimitado)", "success");
                }}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Ativar Plano Ouro Completo (Admin)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Comparação Completa dos Recurso dos 3 Planos */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-500" />
              Comparativo de Funcionalidades
            </h2>
            <p className="text-xs text-slate-400">Verifique o que cada plano inclui na sua licença do sistema.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-3 px-4 font-semibold w-1/2">Funcionalidade / Módulo</th>
                <th className="py-3 px-4 font-semibold text-center text-amber-600">Bronze</th>
                <th className="py-3 px-4 font-semibold text-center text-slate-300">Prata</th>
                <th className="py-3 px-4 font-semibold text-center text-amber-400 bg-amber-500/10 rounded-t-lg">Ouro (VIP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {PLAN_FEATURES.map((cat, idx) => (
                <React.Fragment key={idx}>
                  <tr className="bg-slate-950/60 font-bold text-slate-300 text-[11px]">
                    <td colSpan={4} className="py-2.5 px-4 text-orange-400 uppercase tracking-wider">
                      {cat.category}
                    </td>
                  </tr>
                  {cat.items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-850/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{item.desc}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.bronze ? (
                          <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-slate-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.prata ? (
                          <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-slate-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-center bg-amber-500/5">
                        {item.ouro ? (
                          <Check className="w-4 h-4 text-amber-400 mx-auto font-bold" />
                        ) : (
                          <X className="w-4 h-4 text-slate-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Painel do Criador / Administrador: Concessão e Atribuição de Planos por Usuário */}
      {isCreatorOrAdmin && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-amber-500/30 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">
                  Painel de Gestão de Subscrições dos Usuários (Criador / Admin)
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Como criador/administrador do sistema, você pode atribuir individualmente o Plano (Bronze, Prata, Ouro) a cada utilizador ou loja.
              </p>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Pesquisar utilizador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2.5 px-3">Utilizador / Colaborador</th>
                  <th className="py-2.5 px-3">Cargo</th>
                  <th className="py-2.5 px-3">Contacto / E-mail</th>
                  <th className="py-2.5 px-3">Plano Atual</th>
                  <th className="py-2.5 px-3 text-right">Ação do Criador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredEmployees.map((emp) => {
                  const userPlan: SubscriptionPlan = emp.subscriptionPlan || currentPlan || "OURO";

                  return (
                    <tr key={emp.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">
                            {emp.name.charAt(0)}
                          </span>
                          {emp.name}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {emp.role}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {emp.email || emp.contact || "Sem e-mail"}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] ${getPlanBadgeColor(userPlan)}`}>
                          Plano {userPlan}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1">
                        <button
                          onClick={() => {
                            onUpdateUserPlan(emp.id, "BRONZE");
                            if (onShowToast) onShowToast(`Plano de ${emp.name} alterado para BRONZE`, "info");
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                            userPlan === "BRONZE" 
                              ? "bg-amber-800 text-white border-amber-600" 
                              : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                          }`}
                        >
                          Bronze
                        </button>
                        <button
                          onClick={() => {
                            onUpdateUserPlan(emp.id, "PRATA");
                            if (onShowToast) onShowToast(`Plano de ${emp.name} alterado para PRATA`, "info");
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                            userPlan === "PRATA" 
                              ? "bg-slate-300 text-slate-950 border-slate-200" 
                              : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                          }`}
                        >
                          Prata
                        </button>
                        <button
                          onClick={() => {
                            onUpdateUserPlan(emp.id, "OURO");
                            if (onShowToast) onShowToast(`Plano de ${emp.name} ativado para OURO (Completo)`, "success");
                          }}
                          className={`px-2.5 py-1 rounded text-[10px] font-extrabold transition cursor-pointer shadow-sm ${
                            userPlan === "OURO" 
                              ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950" 
                              : "bg-slate-950 text-amber-400 border border-amber-500/40 hover:bg-amber-500/10"
                          }`}
                        >
                          👑 Ouro VIP
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
