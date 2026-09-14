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
  { id: "dashboard", label: "Painel Principal", shortLabel: "Início", icon: LayoutDashboard, roles: ["ADMIN", "SUPERVISOR", "AUDITOR", "FINANCEIRO"] },
  { id: "pos", label: "Registar Vendas", shortLabel: "Vendas", icon: ShoppingCart, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "stock", label: "Produtos em Stock", shortLabel: "Produtos", icon: Package, roles: ["ADMIN", "SUPERVISOR"] },
  { id: "cash", label: "Livro de Caixa", shortLabel: "Caixa", icon: PiggyBank, roles: ["ADMIN", "SUPERVISOR", "CASHIER", "FINANCEIRO"] },
  { id: "customers", label: "Clientes", shortLabel: "Clientes", icon: Users, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "reports", label: "Relatórios de Vendas", shortLabel: "Relatórios", icon: FileText, roles: ["ADMIN", "SUPERVISOR", "AUDITOR", "FINANCEIRO"] },
  { id: "settings", label: "Configurações da Loja", shortLabel: "Definições", icon: Settings, roles: ["ADMIN"] },
];
