import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  PiggyBank, 
  Users, 
  UserCheck, 
  FileText, 
  BookOpen, 
  TrendingUp, 
  Settings, 
  Lock,
  ChevronDown,
  Smartphone,
  LogOut,
  X
} from "lucide-react";
import { UserRole, UserProfile, Employee } from "../types";

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
}

export default function Sidebar({
  currentRole,
  onChangeRole,
  activeModule,
  onChangeModule,
  companyName,
  logoUrl,
  onLogout,
  theme,
  isOpen,
  onClose,
  activeUser,
  onSwitchUser
}: SidebarProps) {
  
  const profiles: UserProfile[] = [
    { id: "p-admin", name: "Levi Domingos", role: "ADMIN", avatar: "👨‍💼" },
    { id: "p-super", name: "Inácio Macamo", role: "SUPERVISOR", avatar: "👨‍💻" },
    { id: "p-cash", name: "Marta Ubisse", role: "CASHIER", avatar: "👩‍💼" }
  ];

  const currentProfile = profiles.find(p => p.role === currentRole) || profiles[0];

  const menuItems = [
    { id: "dashboard", label: "Dashboard Inteligente", icon: LayoutDashboard, roles: ["ADMIN", "SUPERVISOR"] },
    { id: "pos", label: "Vendas (POS)", icon: ShoppingCart, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "stock", label: "Gestão de Stock", icon: Package, roles: ["ADMIN", "SUPERVISOR"] },
    { id: "cash", label: "Gestão de Caixa", icon: PiggyBank, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "customers", label: "Gestão de Clientes", icon: Users, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "staff", label: "Funcionários & Auditoria", icon: UserCheck, roles: ["ADMIN"] },
    { id: "ai", label: "Previsão AI (Premium)", icon: TrendingUp, roles: ["ADMIN", "SUPERVISOR"] },
    { id: "reports", label: "Relatórios & Faturação", icon: FileText, roles: ["ADMIN", "SUPERVISOR"] },
    { id: "training", label: "Centro de Formação", icon: BookOpen, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "settings", label: "Configurações Gerais", icon: Settings, roles: ["ADMIN"] },
    { id: "gateway", label: "Integração Mobile Money", icon: Smartphone, roles: ["ADMIN"] },
  ];

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "ADMIN": return "Administrador";
      case "SUPERVISOR": return "Supervisor";
      case "CASHIER": return "Vendedor / Caixa";
    }
  };

  const hasAccess = (allowedRoles: string[]) => {
    return allowedRoles.includes(currentRole);
  };

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
        <div className={`p-6 border-b flex items-center justify-between gap-3 transition-colors ${
          isNight ? "border-zinc-900 bg-zinc-950" : "border-slate-100 bg-slate-50/40"
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl || "/src/assets/images/app_logo_1782658148089.jpg"}
              alt="OST Vendas Logo"
              className="w-11 h-11 rounded-xl object-contain bg-white p-1 shrink-0 shadow-md shadow-orange-500/10 border border-orange-500/20"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h1 className={`font-black tracking-tight leading-none text-sm uppercase truncate ${
                isNight ? "text-slate-100" : "text-slate-800"
              }`}>
                OST Vendas
              </h1>
              <span className="text-[9px] text-orange-500 font-extrabold uppercase tracking-widest font-mono mt-0.5 block">
                Comercial v1.0
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

      {/* Profile Switcher */}
      <div className={`p-4 mx-4 my-4 rounded-2xl border transition-all ${
        isNight 
          ? "bg-zinc-900 text-slate-150 border-zinc-800" 
          : "bg-orange-50/50 text-slate-700 border-orange-100/50 shadow-sm"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`text-2xl w-10 h-10 rounded-xl flex items-center justify-center border transition-all overflow-hidden ${
            isNight ? "bg-zinc-950 border-zinc-850" : "bg-white border-orange-200/40 shadow-sm"
          }`}>
            {activeUser ? (
              activeUser.fotoPerfil ? (
                activeUser.fotoPerfil.startsWith("data:") || activeUser.fotoPerfil.startsWith("http") || activeUser.fotoPerfil.startsWith("/") ? (
                  <img src={activeUser.fotoPerfil} className="w-full h-full object-cover" alt="Perfil" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-xl leading-none">{activeUser.fotoPerfil}</span>
                )
              ) : (
                (activeUser.role || "").toUpperCase().includes("ADMIN") || (activeUser.role || "").toUpperCase().includes("GESTOR") ? "👨‍💼" : (activeUser.role || "").toUpperCase().includes("SUPERVISOR") ? "👨‍💻" : "👩‍💼"
              )
            ) : currentProfile.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className={`text-xs font-black truncate leading-none ${
              isNight ? "text-slate-200" : "text-slate-800"
            }`}>{activeUser ? activeUser.name : currentProfile.name}</h4>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1.5 inline-block border transition-colors ${
              isNight 
                ? "bg-zinc-950 text-slate-400 border-zinc-850" 
                : "bg-orange-100 text-orange-700 border-orange-200/30"
            }`}>
              {activeUser ? activeUser.role : getRoleLabel(currentRole)}
            </span>
          </div>
        </div>

        {onSwitchUser && (
          <button
            id="sidebar-change-user-btn"
            onClick={onSwitchUser}
            className={`w-full mt-3.5 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              isNight
                ? "bg-zinc-950 border-zinc-850 text-orange-400 hover:text-orange-350 hover:bg-zinc-900"
                : "bg-white border-orange-150 text-orange-600 hover:bg-orange-500/5 hover:text-orange-700 shadow-[0_2px_8px_rgba(249,115,22,0.04)]"
            }`}
            title="Alterar Operador / Vincular Conta"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Alterar Usuário 🔄</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 pb-6 space-y-1">
        <p className={`text-[9px] uppercase font-black tracking-widest px-3 mb-2.5 ${
          isNight ? "text-slate-500" : "text-slate-400"
        }`}>
          Acesso e Módulos
        </p>
        
        {menuItems.map((item) => {
          const authorized = hasAccess(item.roles);
          const active = activeModule === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => authorized && onChangeModule(item.id)}
              disabled={!authorized && currentRole !== "ADMIN"} // Lock visual simulation
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all group relative ${
                active 
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" 
                  : authorized 
                    ? isNight 
                      ? "text-slate-400 hover:text-slate-200 hover:bg-zinc-900" 
                      : "text-slate-600 hover:text-orange-600 hover:bg-orange-50/60"
                    : "opacity-45 cursor-not-allowed text-slate-400"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                  active 
                    ? "text-white" 
                    : authorized 
                      ? isNight 
                        ? "text-slate-500 group-hover:text-slate-300" 
                        : "text-slate-400 group-hover:text-orange-500"
                      : "text-slate-400"
                }`} />
                <span>{item.label}</span>
              </div>
              
              {!authorized && (
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
            </button>
          );
        })}

        {onLogout && (
          <div className={`pt-2 mt-4 border-t ${isNight ? "border-zinc-800" : "border-slate-100"}`}>
            <button
              onClick={onLogout}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                isNight 
                  ? "text-red-400 hover:text-red-350 hover:bg-red-500/10" 
                  : "text-red-600 hover:text-red-700 hover:bg-red-50"
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0 text-red-500" />
              <span>Terminar Sessão 🔒</span>
            </button>
          </div>
        )}
      </nav>

      {/* Footer Branding Area */}
      <div className={`p-4 border-t transition-colors ${
        isNight ? "border-zinc-900 bg-zinc-950/40" : "border-slate-100 bg-slate-50/50"
      }`}>
        <div className={`text-xs font-bold truncate text-center ${isNight ? "text-slate-400" : "text-slate-700"}`}>{companyName}</div>
        <div className="text-[9px] text-orange-500 font-extrabold tracking-widest text-center mt-1 font-mono">MOÇAMBIQUE</div>
      </div>
    </aside>
    </>
  );
}
