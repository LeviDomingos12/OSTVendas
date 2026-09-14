import React from "react";
import { Menu, Sparkles, Users, Lock } from "lucide-react";
import { NAV_MENU_ITEMS } from "./navigationItems";
import { UserRole } from "../../types";

interface AppHeaderProps {
  isPOSFullscreen: boolean;
  theme: string;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSidebar: () => void;
  activeUserDisplayName: string;
  onOpenTutorial?: () => void;
  onOpenUserSwitch: () => void;
  simplifiedRole: UserRole;
  canRoleAccessModule: (role: UserRole, moduleId: string) => { allowed: boolean; reason?: string };
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  isPOSFullscreen,
  theme,
  activeTab,
  onSelectTab,
  onOpenSidebar,
  activeUserDisplayName,
  onOpenUserSwitch,
  simplifiedRole,
  canRoleAccessModule
}) => {
  if (isPOSFullscreen) return null;

  return (
    <>
      {/* TOP MINIMALIST STATUS BAR */}
      <header className={`border-b h-14 px-4 md:px-6 shrink-0 flex items-center justify-between shadow-sm backdrop-blur-md relative z-20 transition-all ${
        theme === "night" ? "bg-zinc-950/80 border-zinc-800/80" : "bg-white border-slate-200"
      }`}>
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Toggle - Visible on mobile/tablet */}
          <button
            type="button"
            onClick={onOpenSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-zinc-900 transition shrink-0 cursor-pointer"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${theme === "night" ? "text-slate-200" : "text-slate-800"}`}>
              {NAV_MENU_ITEMS.find(m => m.id === activeTab.toLowerCase())?.label || "Sistema de Gestão"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* Nome do Operador Ativo */}
          <span className={`font-bold text-xs tracking-tight ${
            theme === "night" ? "text-slate-200" : "text-slate-800"
          }`}>
            {activeUserDisplayName}
          </span>

          {/* Botão Alterar Utilizador */}
          <button
            id="quick-switch-user-btn"
            onClick={onOpenUserSwitch}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-xs font-bold ${
              theme === "night" 
                ? "bg-zinc-900 border-zinc-800 text-orange-400 hover:text-orange-300 hover:border-orange-500/50" 
                : "bg-white border-slate-200 text-orange-600 hover:bg-slate-50 hover:text-orange-700 shadow-sm"
            }`}
            title="Trocar operador ativo"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Mudar Operador</span>
          </button>
        </div>
      </header>

      {/* COMPACT HORIZONTAL TOP NAVIGATION MODULES BAR */}
      <div className={`border-b px-4 md:px-6 py-2 shrink-0 flex items-center gap-2 overflow-x-auto scrollbar-none z-15 transition-all ${
        theme === "night" 
          ? "bg-zinc-900/60 border-zinc-850/60 text-slate-300" 
          : "bg-white border-slate-150 text-slate-700 shadow-sm"
      }`}>
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none py-1 font-sans">
          {NAV_MENU_ITEMS
            .filter((item) => {
              if (simplifiedRole === "CASHIER") {
                return item.roles.includes("CASHIER");
              }
              return true;
            })
            .map((item) => {
              const roleCheck = canRoleAccessModule(simplifiedRole, item.id);
              const authorized = roleCheck.allowed;
              const active = activeTab.toLowerCase() === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => authorized && onSelectTab(item.id.toUpperCase())}
                  disabled={!authorized}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap select-none shrink-0 group ${
                    active 
                      ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20" 
                      : authorized 
                        ? theme === "night" 
                          ? "text-slate-400 hover:text-slate-150 hover:bg-zinc-850 cursor-pointer" 
                          : "text-slate-650 hover:text-orange-600 hover:bg-orange-50/50 cursor-pointer"
                        : "opacity-35 cursor-not-allowed text-slate-400"
                  }`}
                  title={authorized ? item.label : "Acesso Restrito para " + simplifiedRole}
                >
                  <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                    active 
                      ? "text-white" 
                      : authorized 
                        ? theme === "night" 
                          ? "text-slate-500 group-hover:text-slate-300" 
                          : "text-slate-400 group-hover:text-orange-500"
                        : "text-slate-400"
                  }`} />
                  <span>{item.shortLabel}</span>
                  {!authorized && (
                    <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                  )}
                </button>
              );
            })}
        </div>
      </div>
    </>
  );
};
