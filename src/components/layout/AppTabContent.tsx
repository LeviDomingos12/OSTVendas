import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Product, 
  Customer, 
  Transaction, 
  CashFlowEntry, 
  Employee, 
  AuditLog, 
  SystemSettings, 
  UserRole,
  SubscriptionPlan 
} from "../../types";
import { ErpSnapshotData } from "../../lib/indexedDbStorage";
import { canRoleAccessModule } from "../../lib/rolePermissions";
import { RoleAccessDeniedScreen } from "../RoleAccessDeniedScreen";
import POSModule from "../POSModule";
import DashboardModule from "../DashboardModule";
import CashRegisterModule from "../CashRegisterModule";
import StockModule from "../StockModule";
import CustomersModule from "../CustomersModule";
import ReportsModule from "../ReportsModule";
import SettingsModule from "../SettingsModule";

export interface AppTabContentProps {
  activeTab: string;
  isPOSFullscreen: boolean;
  simplifiedRole: UserRole;
  activeUser: Employee | null;
  activeUserDisplayName: string;
  theme: "daily" | "night" | string;
  settings: SystemSettings;
  currency: string;
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  cashFlow: CashFlowEntry[];
  filteredCashFlow: CashFlowEntry[];
  employees: Employee[];
  auditLogs: AuditLog[];
  pendingSyncQueue: Record<string, unknown>;
  isManualSyncing: boolean;
  isOnline: boolean;
  activeColorTheme: string;
  currentSystemVersion: string;

  // Actions and state setters
  onNavigateToModule: (mod: string) => void;
  onOpenUserSwitch: () => void;
  onChangePOSFullscreen: (val: boolean) => void;
  onShowToast: (message: string, type?: "success" | "error" | "info" | "warning", title?: string) => void;
  onAddAuditLog: (action: string, module: string, details: string, customUser?: Employee) => void;
  onManualSync: () => void;
  onUpdateSettings: (settings: Partial<SystemSettings>) => void;
  onThemeChange: (themeId: string) => void;
  onExportLocalDB: () => void;
  onImportLocalDB: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTriggerLocalBackup: () => void;
  onGetBackupPayload: () => ErpSnapshotData;
  onPurgeMockData: () => void;
  onUpdateUserPlan: (employeeId: string, newPlan: SubscriptionPlan) => Promise<void>;
  onUpdateSystemPlan: (newPlan: SubscriptionPlan) => void;
  onCompleteSale: (transaction: Transaction) => void;
  onReturnSale: (
    transaction: Transaction,
    returnReason: string,
    returnedItems: { productId: string; quantity: number; price: number }[],
    refundMethod?: string
  ) => void;
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onImportProductsBatch: (products: Product[]) => void;
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onAddCashFlowEntry: (entry: CashFlowEntry) => void;
  onAddEmployee: (employee: Employee) => void;
  onUpdateEmployees: (employees: Employee[]) => void;
  onResetEmployeePin: (empId: string) => Promise<void>;
  onUpdateEmployeeTheme: (empId: string, themeId: string) => Promise<void>;
  onUpdateProductsList: (products: Product[]) => void;
}

export const AppTabContent: React.FC<AppTabContentProps> = ({
  activeTab,
  isPOSFullscreen,
  simplifiedRole,
  activeUser,
  activeUserDisplayName,
  theme,
  settings,
  currency,
  products,
  customers,
  transactions,
  filteredTransactions,
  cashFlow,
  filteredCashFlow,
  employees,
  auditLogs,
  pendingSyncQueue,
  isManualSyncing,
  isOnline,
  activeColorTheme,
  currentSystemVersion,

  onNavigateToModule,
  onOpenUserSwitch,
  onChangePOSFullscreen,
  onShowToast,
  onAddAuditLog,
  onManualSync,
  onUpdateSettings,
  onThemeChange,
  onExportLocalDB,
  onImportLocalDB,
  onTriggerLocalBackup,
  onGetBackupPayload,
  onPurgeMockData,
  onUpdateUserPlan,
  onUpdateSystemPlan,
  onCompleteSale,
  onReturnSale,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onImportProductsBatch,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAddCashFlowEntry,
  onAddEmployee,
  onUpdateEmployees,
  onResetEmployeePin,
  onUpdateEmployeeTheme,
  onUpdateProductsList
}) => {
  return (
    <main className={`flex-1 overflow-y-auto relative ${isPOSFullscreen ? "p-0" : "p-4 md:p-6"}`}>
      <AnimatePresence mode="wait">
        {/* POS DIRECT CHECKOUT */}
        {activeTab === "POS" && (
          <motion.div
            key="POS"
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {!canRoleAccessModule(simplifiedRole, "pos").allowed ? (
              <RoleAccessDeniedScreen
                moduleId="pos"
                userRole={simplifiedRole}
                activeUser={activeUser}
                theme={theme}
                onNavigateToModule={(mod) => onNavigateToModule(mod.toUpperCase())}
                onSwitchUser={onOpenUserSwitch}
              />
            ) : (
              <POSModule
                products={products}
                customers={customers}
                transactions={filteredTransactions}
                onCompleteSale={onCompleteSale}
                onReturnSale={onReturnSale}
                activeUsername={activeUserDisplayName}
                settings={settings}
                onAddAuditLog={onAddAuditLog}
                currency={currency}
                onShowToast={onShowToast}
                isPOSFullscreen={isPOSFullscreen}
                onChangePOSFullscreen={onChangePOSFullscreen}
              />
            )}
          </motion.div>
        )}

        {/* STATS ANALYTICS CONTROL PANEL */}
        {activeTab === "DASHBOARD" && (
          <motion.div
            key="DASHBOARD"
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {!canRoleAccessModule(simplifiedRole, "dashboard").allowed ? (
              <RoleAccessDeniedScreen
                moduleId="dashboard"
                userRole={simplifiedRole}
                activeUser={activeUser}
                theme={theme}
                onNavigateToModule={(mod) => onNavigateToModule(mod.toUpperCase())}
                onSwitchUser={onOpenUserSwitch}
              />
            ) : (
              <DashboardModule
                transactions={transactions}
                products={products}
                customers={customers}
                cashFlow={cashFlow}
                currency={currency}
                activeUser={activeUser}
                onChangeModule={(mod) => onNavigateToModule(mod.toUpperCase())}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                onUpdateProduct={onUpdateProduct}
                onAddAuditLog={onAddAuditLog}
                onShowToast={onShowToast}
                onCompleteSale={onCompleteSale}
                pendingSyncQueue={pendingSyncQueue}
                isManualSyncing={isManualSyncing}
                isOnline={isOnline}
                onManualSync={onManualSync}
                theme={theme}
              />
            )}
          </motion.div>
        )}

        {/* DAILY BOOK BALANCE CASH OPERATIONS */}
        {activeTab === "CASH" && (
          <motion.div
            key="CASH"
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {!canRoleAccessModule(simplifiedRole, "cash").allowed ? (
              <RoleAccessDeniedScreen
                moduleId="cash"
                userRole={simplifiedRole}
                activeUser={activeUser}
                theme={theme}
                onNavigateToModule={(mod) => onNavigateToModule(mod.toUpperCase())}
                onSwitchUser={onOpenUserSwitch}
              />
            ) : (
              <CashRegisterModule
                cashFlow={filteredCashFlow}
                transactions={filteredTransactions}
                onAddCashFlowEntry={onAddCashFlowEntry}
                activeUsername={activeUserDisplayName}
                activeUser={activeUser}
                employees={employees}
                currentRole={simplifiedRole}
                onAddAuditLog={onAddAuditLog}
                currency={currency}
                settings={settings}
                theme={theme}
                onShowToast={onShowToast}
              />
            )}
          </motion.div>
        )}

        {/* ACTIVE STOCK INVENTORY MANAGER */}
        {activeTab === "STOCK" && (
          <motion.div
            key="STOCK"
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {!canRoleAccessModule(simplifiedRole, "stock").allowed ? (
              <RoleAccessDeniedScreen
                moduleId="stock"
                userRole={simplifiedRole}
                activeUser={activeUser}
                theme={theme}
                onNavigateToModule={(mod) => onNavigateToModule(mod.toUpperCase())}
                onSwitchUser={onOpenUserSwitch}
              />
            ) : (
              <StockModule
                products={products}
                transactions={filteredTransactions}
                onAddProduct={onAddProduct}
                onUpdateProduct={onUpdateProduct}
                onDeleteProduct={onDeleteProduct}
                onAddAuditLog={onAddAuditLog}
                currentRole={simplifiedRole}
                currency={currency}
                settings={settings}
                onShowToast={onShowToast}
                onUpdateSettings={onUpdateSettings}
                onImportProductsBatch={onImportProductsBatch}
              />
            )}
          </motion.div>
        )}

        {/* CUSTOMER LOYALTY CRM & MARKETING SMS */}
        {(activeTab === "CUSTOMERS" || activeTab === "CLIENTES") && (
          <motion.div
            key="CUSTOMERS"
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {!canRoleAccessModule(simplifiedRole, "customers").allowed ? (
              <RoleAccessDeniedScreen
                moduleId="customers"
                userRole={simplifiedRole}
                activeUser={activeUser}
                theme={theme}
                onNavigateToModule={(mod) => onNavigateToModule(mod.toUpperCase())}
                onSwitchUser={onOpenUserSwitch}
              />
            ) : (
              <CustomersModule
                customers={customers}
                transactions={transactions}
                settings={settings}
                onAddCustomer={onAddCustomer}
                onUpdateCustomer={onUpdateCustomer}
                onAddCashFlowEntry={onAddCashFlowEntry}
                onDeleteCustomer={onDeleteCustomer}
                onAddAuditLog={onAddAuditLog}
                currentRole={simplifiedRole}
                activeUsername={activeUserDisplayName}
                currency={currency}
                onShowToast={onShowToast}
              />
            )}
          </motion.div>
        )}

        {/* FINANCIAL REPORTS & SMTP TRIGGERS */}
        {activeTab === "REPORTS" && (
          <motion.div
            key="REPORTS"
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {!canRoleAccessModule(simplifiedRole, "reports").allowed ? (
              <RoleAccessDeniedScreen
                moduleId="reports"
                userRole={simplifiedRole}
                activeUser={activeUser}
                theme={theme}
                onNavigateToModule={(mod) => onNavigateToModule(mod.toUpperCase())}
                onSwitchUser={onOpenUserSwitch}
              />
            ) : (
              <ReportsModule
                transactions={transactions}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                onAddAuditLog={onAddAuditLog}
                currency={currency}
                onShowToast={onShowToast}
                auditLogs={auditLogs}
              />
            )}
          </motion.div>
        )}

        {/* COMPANY GENERAL IDENTITIES AND MAIN SETTINGS */}
        {(activeTab === "SETTINGS" || activeTab === "STAFF" || activeTab === "GATEWAY") && (
          <motion.div
            key="SETTINGS"
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {!canRoleAccessModule(simplifiedRole, activeTab.toLowerCase()).allowed ? (
              <RoleAccessDeniedScreen
                moduleId={activeTab.toLowerCase()}
                userRole={simplifiedRole}
                activeUser={activeUser}
                theme={theme}
                onNavigateToModule={(mod) => onNavigateToModule(mod.toUpperCase())}
                onSwitchUser={onOpenUserSwitch}
              />
            ) : (
              <SettingsModule
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                onAddAuditLog={onAddAuditLog}
                currentRole={simplifiedRole}
                currency={currency}
                onShowToast={onShowToast}
                activeUser={activeUser}
                activeColorTheme={activeColorTheme}
                onChangeColorTheme={onThemeChange}
                onExportLocalDB={onExportLocalDB}
                onImportLocalDB={onImportLocalDB}
                onTriggerLocalBackup={onTriggerLocalBackup}
                onGetBackupPayload={onGetBackupPayload}
                onPurgeMockData={onPurgeMockData}
                systemVersion={currentSystemVersion}
                employees={employees}
                auditLogs={auditLogs}
                products={products}
                onUpdateProduct={onUpdateProduct}
                onUpdateProducts={onUpdateProductsList}
                transactions={filteredTransactions}
                customers={customers}
                onAddEmployee={onAddEmployee}
                onUpdateEmployees={onUpdateEmployees}
                theme={theme}
                onUpdateUserPlan={onUpdateUserPlan}
                onUpdateSystemPlan={onUpdateSystemPlan}
                initialSubTab={
                  activeTab === "STAFF" ? "staff" :
                  activeTab === "GATEWAY" ? "gateway" : undefined
                }
                onChangeModule={(mod) => onNavigateToModule(mod.toUpperCase())}
                onResetEmployeePin={onResetEmployeePin}
                onUpdateEmployeeTheme={onUpdateEmployeeTheme}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};
