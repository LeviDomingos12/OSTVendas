import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Menu, LogOut, X, Compass, LucideIcon } from "lucide-react";
import { Employee, UserRole } from "../../types";

export interface NavMenuItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  roles: string[];
}

interface FloatingNavFabProps {
  isPOSFullscreen: boolean;
  isFabOpen: boolean;
  onToggleFab: () => void;
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  navMenuItems: NavMenuItem[];
  canRoleAccess: (role: UserRole, moduleId: string) => { allowed: boolean; reason?: string };
  simplifiedRole: UserRole;
  activeUser: Employee | null;
  theme: "day" | "night" | string;
  onOpenSidebar: () => void;
  onLogout: () => void;
}

export const FloatingNavFab: React.FC<FloatingNavFabProps> = ({
  isPOSFullscreen,
  isFabOpen,
  onToggleFab,
  activeTab,
  onSelectTab,
  navMenuItems,
  canRoleAccess,
  simplifiedRole,
  activeUser,
  theme,
  onOpenSidebar,
  onLogout
}) => {
  if (isPOSFullscreen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3 no-print">
      <AnimatePresence>
        {isFabOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={`p-4 rounded-3xl border shadow-2xl w-64 md:w-72 max-h-[75vh] overflow-y-auto backdrop-blur-xl flex flex-col gap-2 ${
              theme === "night"
                ? "bg-zinc-950/95 border-zinc-850/80 shadow-zinc-950/50 text-slate-100"
                : "bg-white/95 border-slate-200 shadow-slate-350/30 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between pb-2 mb-1 border-b border-dashed border-slate-700/20 dark:border-zinc-800">
              <span className="text-[10px] font-black tracking-widest uppercase text-orange-500 font-mono">
                Navegação Rápida
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-900 border dark:border-zinc-800 font-mono">
                {activeUser ? activeUser.role : "Sessão"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1">
              {navMenuItems.map((item) => {
                const roleCheck = canRoleAccess(simplifiedRole, item.id);
                const authorized = roleCheck.allowed;
                const active = activeTab.toLowerCase() === item.id;

                return (
                  <button
                    key={item.id}
                    disabled={!authorized}
                    onClick={() => {
                      if (authorized) {
                        onSelectTab(item.id.toUpperCase());
                        onToggleFab();
                      }
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all group ${
                      active
                        ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                        : authorized
                        ? theme === "night"
                          ? "text-slate-300 hover:text-white hover:bg-zinc-900 cursor-pointer"
                          : "text-slate-700 hover:text-orange-600 hover:bg-orange-50/50 cursor-pointer"
                        : "opacity-35 cursor-not-allowed text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active
                            ? "text-white"
                            : authorized
                            ? theme === "night"
                              ? "text-slate-500 group-hover:text-slate-300"
                              : "text-slate-400 group-hover:text-orange-500"
                            : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {!authorized && (
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-700/10 dark:border-zinc-800/80 pt-2 mt-1 flex flex-col gap-1">
              <button
                onClick={() => {
                  onOpenSidebar();
                  onToggleFab();
                }}
                className={`w-full flex items-center justify-center gap-2 p-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                  theme === "night"
                    ? "bg-zinc-900/60 border-zinc-850 text-orange-400 hover:bg-zinc-900 hover:text-orange-300"
                    : "bg-orange-50/40 border-orange-100 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                }`}
              >
                <Menu className="w-3.5 h-3.5" />
                <span>Ver Painel Lateral 📋</span>
              </button>

              <button
                onClick={() => {
                  onToggleFab();
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Terminar Sessão 🔒</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onToggleFab}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer border relative group ${
          isFabOpen
            ? "bg-slate-900 text-white border-slate-800 hover:bg-slate-800 scale-105"
            : theme === "night"
            ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-600 hover:scale-110"
            : "bg-orange-500 hover:bg-orange-600 text-white border-orange-400 hover:scale-110"
        }`}
        title="Menu de Navegação Rápida"
      >
        {isFabOpen ? (
          <X className="w-6 h-6 animate-in spin-in duration-200" />
        ) : (
          <Compass className="w-6 h-6 group-hover:rotate-45 transition-transform duration-300 animate-pulse" />
        )}

        {/* Soft pulsing visual outer ring */}
        {!isFabOpen && (
          <span className="absolute -inset-0.5 rounded-full border border-orange-500 animate-ping opacity-25 pointer-events-none"></span>
        )}
      </button>
    </div>
  );
};
