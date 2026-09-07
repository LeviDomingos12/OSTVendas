import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  PiggyBank,
  Users,
  FileText,
  Settings,
  LucideIcon
} from "lucide-react";
import { UserRole } from "../../types";

export interface NavMenuItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export const NAV_MENU_ITEMS: NavMenuItem[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "SUPERVISOR", "AUDITOR", "FINANCEIRO"] },
  { id: "pos", label: "Vendas (POS)", shortLabel: "Vendas", icon: ShoppingCart, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "stock", label: "Gestão de Stock", shortLabel: "Stock", icon: Package, roles: ["ADMIN", "SUPERVISOR"] },
  { id: "cash", label: "Gestão de Caixa", shortLabel: "Caixa", icon: PiggyBank, roles: ["ADMIN", "SUPERVISOR", "CASHIER", "FINANCEIRO"] },
  { id: "customers", label: "Gestão de Clientes", shortLabel: "Clientes", icon: Users, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "reports", label: "Relatórios & Faturação", shortLabel: "Relatórios", icon: FileText, roles: ["ADMIN", "SUPERVISOR", "AUDITOR", "FINANCEIRO"] },
  { id: "settings", label: "Configurações Gerais", shortLabel: "Configurações", icon: Settings, roles: ["ADMIN"] },
];
