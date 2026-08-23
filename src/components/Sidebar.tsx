import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  PiggyBank, 
  Users, 
  FileText, 
  Settings, 
  Lock,
  LogOut,
  X,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { UserRole, Employee, SubscriptionPlan } from "../types";
import { canAccessModule } from "../lib/planPermissions";
import { canRoleAccessModule, getRoleDisplayName, normalizeUserRole } from "../lib/rolePermissions";
import { useSystemVersion } from "../lib/versionManager";

interface SidebarProps {
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  activeModule: string;
  onChangeModule: (module: string) => void;
  companyName: string;
  logoUrl?: string;
  onLogout?: () => void;
  theme?: string;
  isOpen?: boolean;
  onClose?: () => void;
  activeUser?: Employee | null;
  onSwitchUser?: () => void;
  subscriptionPlan?: SubscriptionPlan;
}

export default function Sidebar({
  currentRole,
  activeModule,
  onChangeModule,
  companyName,
  logoUrl,
  onLogout,
  theme,
  isOpen,
  onClose,
  activeUser,
  subscriptionPlan = "OURO"
}: SidebarProps) {
  const { formattedVersion } = useSystemVersion();
  const effectivePlan: SubscriptionPlan = activeUser?.subscriptionPlan || subscriptionPlan || "OURO";
  const userRole: UserRole = normalizeUserRole(activeUser || ({ role: currentRole } as any));

  // Itens do menu com restrições por perfil estritas
  const allMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "SUPERVISOR", "AUDITOR", "FINANCEIRO"] },
    { id: "pos", label: "Vendas (POS)", icon: ShoppingCart, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "stock", label: "Gestão de Stock", icon: Package, roles: ["ADMIN", "SUPERVISOR"] },
    { id: "cash", label: "Gestão de Caixa", icon: PiggyBank, roles: ["ADMIN", "SUPERVISOR", "CASHIER", "FINANCEIRO"] },
    { id: "customers", label: "Gestão de Clientes", icon: Users, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "reports", label: "Relatórios & Faturação", icon: FileText, roles: ["ADMIN", "SUPERVISOR", "AUDITOR", "FINANCEIRO"] },
    { id: "settings", label: "Configurações Gerais", icon: Settings, roles: ["ADMIN"] },
  ];

  // Se for Caixa (CASHIER), filtramos os itens para exibir apenas os seus módulos permitidos
  const visibleMenuItems = userRole === "CASHIER"
    ? allMenuItems.filter(item => item.roles.includes("CASHIER"))
    : allMenuItems;

  const isNight = theme === "night";

  return (
    <>
      {/* Drawer Overlay Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] cursor-pointer animate-in fade-in duration-200"
        />
      )}

      <aside className={`fixed lg:static lg:translate-x-0 lg:shadow-none inset-y-0 left-0 z-[101] w-72 flex flex-col shrink-0 h-screen overflow-y-auto custom-scrollbar border-r transition-all duration-300 ${
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      } ${
        isNight 
          ? "bg-zinc-950 text-slate-100 border-zinc-900" 
          : "bg-white text-slate-800 border-slate-100 shadow-[4px_0_24px_rgba(249,115,22,0.03)]"
      }`}>
        {/* Brand Header */}
        <div className={`p-5 border-b flex items-center justify-between gap-3 transition-colors ${
          isNight ? "border-zinc-900 bg-zinc-950" : "border-slate-100 bg-slate-50/40"
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl || "/src/assets/images/app_logo_1782658148089.jpg"}
              alt="OST Vendas Logo"
              className="w-10 h-10 rounded-xl object-contain bg-white p-1 shrink-0 shadow-md shadow-orange-500/10 border border-orange-500/20"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h1 className={`font-black tracking-tight leading-none text-sm uppercase truncate ${
                isNight ? "text-slate-100" : "text-slate-800"
              }`}>
                OST Vendas
              </h1>
              <span className="text-[9px] text-orange-500 font-extrabold uppercase tracking-widest font-mono mt-0.5 block">
                Comercial {formattedVersion}
              </span>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-zinc-900 transition shrink-0 cursor-pointer"
              title="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className={`text-[10px] uppercase font-black tracking-widest ${
              isNight ? "text-slate-500" : "text-slate-400"
            }`}>
              Módulos Principais
            </p>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
              userRole === "ADMIN" 
                ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                : userRole === "SUPERVISOR"
                  ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            }`}>
              {getRoleDisplayName(userRole)}
            </span>
          </div>
          
          {visibleMenuItems.map((item) => {
            const roleCheck = canRoleAccessModule(userRole, item.id);
            const planCheck = canAccessModule(item.id, effectivePlan);
            const authorized = roleCheck.allowed && planCheck.allowed;
            const active = activeModule.toLowerCase() === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (authorized) {
                    onChangeModule(item.id);
                    if (onClose) onClose();
                  }
                }}
                disabled={!authorized}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all group relative ${
                  active 
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" 
                    : authorized 
                      ? isNight 
                        ? "text-slate-300 hover:text-white hover:bg-zinc-900 cursor-pointer" 
                        : "text-slate-650 hover:text-orange-600 hover:bg-orange-50/70 cursor-pointer"
                      : "opacity-40 text-slate-400 cursor-not-allowed bg-slate-100/30 dark:bg-zinc-900/30"
                }`}
                title={!roleCheck.allowed ? "Módulo restrito para o seu cargo" : !planCheck.allowed ? `Requer plano ${planCheck.requiredPlan}` : item.label}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                    active 
                      ? "text-white" 
                      : authorized 
                        ? isNight 
                          ? "text-slate-400 group-hover:text-orange-400" 
                          : "text-slate-500 group-hover:text-orange-500"
                        : "text-slate-400"
                  }`} />
                  <span>{item.label}</span>
                </div>
                
                {!roleCheck.allowed ? (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : !planCheck.allowed ? (
                  <span className="text-[9px] font-mono font-bold bg-amber-500/15 text-amber-500 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    {planCheck.requiredPlan}
                  </span>
                ) : null}
              </button>
            );
          })}

          {onLogout && (
            <div className={`pt-3 mt-4 border-t ${isNight ? "border-zinc-900" : "border-slate-100"}`}>
              <button
                onClick={onLogout}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isNight 
                    ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" 
                    : "text-red-600 hover:text-red-700 hover:bg-red-50"
                }`}
              >
                <LogOut className="w-4 h-4 shrink-0 text-red-500" />
                <span>Terminar Sessão</span>
              </button>
            </div>
          )}
        </nav>

        {/* Footer Branding Area */}
        <div className={`p-4 border-t transition-colors ${
          isNight ? "border-zinc-900 bg-zinc-950/40" : "border-slate-100 bg-slate-50/50"
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={`truncate ${isNight ? "text-slate-400" : "text-slate-700"}`}>
              {companyName || "OST Vendas"}
            </span>
            <span className="text-[9px] text-orange-500 font-extrabold tracking-widest font-mono">
              MZ
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
