export type UserRole = "ADMIN" | "SUPERVISOR" | "CASHIER" | "AUDITOR" | "RH" | "FINANCEIRO";
export type SubscriptionPlan = "BRONZE" | "PRATA" | "OURO";

export interface PlanFeature {
  name: string;
  bronze: boolean;
  prata: boolean;
  ouro: boolean;
  description: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  companyId?: string;
}

export interface MultiTenantMetadata {
  ownerId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  companyId?: string;
  tenantId?: string;
  role?: string;
}

export interface Product extends MultiTenantMetadata {
  id: string;
  name: string;
  code: string;
  category: string;
  supplier: string;
  costPrice: number;
  salePrice: number;
  vatRate: number; // e.g. 16 for Moçambique
  stock: number;
  minStock: number;
  expiryDate?: string;
  image?: string;
  imageUrl?: string;
  unit?: string;
  emoji?: string;
  promotion?: string; // e.g. "PROMO", "MAIS_VENDIDO", "NOVO", "DESCONTO"
  isFavorite?: boolean;
  brand?: string;
  weightBased?: boolean; // True if sold per kg
  barcode?: string;
  branchStocks?: Record<string, number>; // Stock per branch ID
  batches?: ProductBatch[]; // Batches associated with this product
  isDemo?: boolean;
  isSample?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // percentage or fixed
  vatRate: number;
}

export interface Customer extends MultiTenantMetadata {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  nuit: string; // Moçambique Tax ID
  totalSpent: number;
  purchaseCount: number;
  lastPurchaseDate?: string;
  debt: number;
  balance?: number;
  notes?: string;
  creditLimit?: number;
  loyaltyPoints: number;
  creditBlocked?: boolean;
  preferredPaymentMethod?: string;
  oneClickCheckoutEnabled?: boolean;
  settlements?: { id: string, date: string, amount: number, method: string }[];
  isDemo?: boolean;
  isSample?: boolean;
}

export interface Transaction extends MultiTenantMetadata {
  id: string;
  invoiceNumber: string;
  timestamp: string;
  status?: "COMPLETED" | "CANCELLED" | "REFUNDED";
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    vatAmount: number;
    discountAmount: number;
    subtotal: number;
  }[];
  subtotal: number;
  vatTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: "CASH" | "MPESA_PAGA_FACIL" | "EMOLA" | "POS_CARD" | "CREDIT_CARD" | "BANK_TRANSFER" | "MIXED" | "DEBT";
  paymentDetails?: string;
  cashierName: string;
  customerName?: string;
  customerId?: string;
  customerPhone?: string;
  customerEmail?: string;
  nuit?: string;
  branchId?: string; // Associated branch ID
  fiscalHash?: string; // AGT/MEF Fiscal Hash signature
  fiscalKeys?: string; // Short sign key e.g. "D4-F5-G6-A2"
  fiscalCertified?: boolean; // Certified indicator
}

export interface CashFlowEntry extends MultiTenantMetadata {
  id: string;
  timestamp: string;
  type: "INPUT" | "REINFORCEMENT" | "EXPENSE" | "QUEBRA" | "SANGRIA" | "DEVOLUTION" | "SOBRA";
  amount: number;
  reason: string;
  responsibleUser: string;
  shiftId?: string;
  registerId?: string;
  paymentMethod?: "CASH" | "MPESA_PAGA_FACIL" | "EMOLA" | "POS_CARD" | "BANK_TRANSFER" | "OTHER";
  category?: "SUPRIMENTO" | "SANGRIA" | "DESPESA_OPERACIONAL" | "PAGAMENTO_FORNECEDOR" | "DEVOLUCAO_VENDA" | "QUEBRA_CAIXA" | "SOBRA_CAIXA" | "RECEBIMENTO_DIVIDA" | "OUTRO";
  reference?: string;
  destination?: string;
  supplierOrClient?: string;
  authorizedSupervisor?: string;
  supervisorPinVerified?: boolean;
  notes?: string;
}

export interface CashShift extends MultiTenantMetadata {
  id: string;
  shiftId?: string;
  shiftNumber?: number;
  registerId?: string;
  openedAt: string;
  openedBy: string;
  openingBalance: number;
  openingSupervisor?: string;
  openingNotes?: string;
  status?: "OPEN" | "CLOSED";
  closedAt?: string;
  closedBy?: string;
  closingSupervisor?: string;
  theoreticalBalance: number;
  physicalBalance: number;
  difference: number;
  differenceType?: "EXACT" | "SURPLUS" | "SHORTAGE";
  closingNotes?: string;
  denominations?: Record<string, number>;
  reconciliation?: {
    cashSales: number;
    mpesaSales: number;
    emolaSales: number;
    posCardSales: number;
    transferSales: number;
    totalSales: number;
    reinforcements: number;
    inputs: number;
    sangrias: number;
    expenses: number;
    devolutions: number;
    quebras: number;
  };
}

export interface CashClosure extends CashShift {}

export interface AuditLog extends MultiTenantMetadata {
  id: string;
  timestamp: string;
  user: string;
  userId?: string;
  userRole: UserRole;
  action: string;
  module: string;
  details: string;
  ip?: string;
  device?: string;
}

export interface Employee extends MultiTenantMetadata {
  id: string;
  name: string;
  role: string;
  contact: string;
  salary: number;
  admissionDate: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED";
  pin?: string;
  email?: string;
  username?: string;
  pinCreatedAt?: string;
  pinChanged?: boolean;
  password?: string;
  fotoPerfil?: string;
  theme?: string;
  twoFactorEmailEnabled?: boolean;
  twoFactorSmsEnabled?: boolean;
  isPhoneValidated?: boolean;
  whatsapp?: string;
  observacoes?: string;
  expirationDate?: string;
  logoUrl?: string;
  webAuthnEnabled?: boolean;
  webAuthnCredentialId?: string;
  subscriptionPlan?: SubscriptionPlan;
  planGrantedBy?: string;
  branch?: string;
  isDemo?: boolean;
  isSample?: boolean;
}

export interface SystemSettings extends MultiTenantMetadata {
  companyName: string;
  companyAddress: string;
  companyNuit: string;
  companyNif?: string;
  invoiceSeries?: string;
  securityPin?: string;
  systemVersion?: string;
  nuit?: string;
  email?: string;
  storeEmail?: string;
  vatDefaultRate: number;
  currency: string; // e.g. MT, Meticais
  logoUrl?: string;
  autoBackup: boolean;
  smsGateway: string;
  smtpServer: string;
  reportRecipientEmail: string;
  theme?: string; // Color theme ID, e.g. "laranja", "azul", etc.
  reportHour: string;
  reportFrequency: "daily" | "weekly";
  smtpEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  emailStockAlertsEnabled?: boolean;
  isSmtpVerified?: boolean;
  slogan?: string;
  storeAddress?: string;
  storeContact?: string;
  companyPhone?: string;
  companyEmail?: string;
  receiptFooterMessage?: string;
  enableVat?: boolean;
  lowStockThreshold?: number;
  defaultPrinter?: string;
  defaultVat?: number;
  cloudBackupEnabled?: boolean;
  backupFrequency?: string;
  backupCron?: string;
  backupTime?: string;
  cloudProvider?: string;
  backupExportToCloud?: boolean;
  backupExportToEmail?: boolean;
  mpesaEnabled?: boolean;
  mpesaShortcode?: string;
  mpesaApiKey?: string;
  mpesaSecret?: string;
  mpesaWebhookUrl?: string;
  emolaEnabled?: boolean;
  emolaShortcode?: string;
  emolaApiKey?: string;
  emolaSecret?: string;
  emolaWebhookUrl?: string;
  whatsappEnabled?: boolean;
  whatsappProvider?: "DIRECT_LINK" | "EVOLUTION_API" | "TWILIO" | "META_CLOUD";
  whatsappApiEndpoint?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  managerWhatsappPhone?: string;
  whatsappMessageTemplate?: string;
  alertsRecipientEmail?: string;
  stockAlertEmailSubject?: string;
  stockAlertEmailBody?: string;
  smsAlertsEnabled?: boolean;
  smsProviderType?: "TWILIO" | "CUSTOM_HTTP";
  smsTwilioSid?: string;
  smsTwilioToken?: string;
  smsTwilioFrom?: string;
  smsCustomUrl?: string;
  smsManagerPhone?: string;
  smsStockThreshold?: number;
  stockAlertAutoSendOnSale?: boolean;
  stockAlertSoundEnabled?: boolean;
  stockAlertIncludeDeficit?: boolean;
  printerEnabled?: boolean;
  twoFactorEmailEnabled?: boolean;
  twoFactorNewLocationEmail?: boolean;
  printerName?: string;
  printerConnectionType?: "USB" | "BLUETOOTH" | "NETWORK";
  printerIpAddress?: string;
  printerPort?: string;
  printerBaudRate?: string;
  printerType?: "RECEIPT" | "LABEL";
  paperSize?: "A4" | "80MM" | "58MM";
  printerAutoCut?: boolean;
  thermalMarginTop?: number;
  thermalMarginBottom?: number;
  branches?: Branch[];
  stockTransfers?: StockTransfer[];
  batches?: ProductBatch[];
  activeBranchId?: string;
  fiscalCertificationNumber?: string;
  fiscalLogoUrl?: string;
  fiscalModeEnabled?: boolean;
  inventoryStrategy?: "FIFO" | "LIFO" | "NORMAL";
  expiryAlertDays?: number;
  expiryAlertsEnabled?: boolean;
  expiryNotificationMethod?: "EMAIL" | "SMS" | "BOTH";
  expiryEmailSubject?: string;
  expiryEmailBody?: string;
  aiAutoMonitoring?: boolean;
  aiHealthSensitivity?: number;
  suppliers?: Supplier[];
  supplierOrders?: SupplierOrder[];
  supplierOverdueToleranceDays?: number;
  subscriptionPlan?: SubscriptionPlan;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  nuit?: string;
  status: "Ativo" | "Inativo";
}

export interface SupplierOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  quantityRequested: number;
  unitCost: number;
  totalValue: number;
  status: "Pendente" | "Recebido" | "Cancelado";
  paymentStatus: "Pago" | "Crédito" | "Pendente";
  paymentDueDate?: string;
  requestDate: string;
  receivedDate?: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  contact: string;
  city?: string;
  code?: string;
}

export interface StockTransfer {
  id: string;
  originBranchId: string;
  destinationBranchId: string;
  productId: string;
  productName: string;
  quantity: number;
  timestamp: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  responsibleUser: string;
}

export interface ProductBatch {
  id: string;
  productId: string;
  productName: string;
  batchCode: string;
  quantity: number;
  initialQuantity: number;
  expiryDate: string; // YYYY-MM-DD
  costPrice: number;
  receivedDate: string;
  supplier?: string;
}

export interface MasterclassVideo {
  id: string;
  title: string;
  duration: string;
  description: string;
  thumbnail: string;
  category: string;
  steps: string[];
  instructor?: string;
  youtubeId?: string;
}

export interface SalesForecast {
  forecastText: string;
  growthRate: number;
  growthTrend: "up" | "down" | "stable";
  suggestedCampaigns: string[];
}

export type SystemUser = Employee;

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  time?: string;
  completed: boolean;
  priority?: "low" | "medium" | "high";
  date?: string;
}

export interface RecurringReminder {
  id: string;
  title: string;
  description?: string;
  frequency: "daily" | "weekly" | "monthly";
  daysOfWeek?: number[];
  time?: string;
  active: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

export interface DatabaseState {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  cashFlow: CashFlowEntry[];
  employees: Employee[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
}

export interface BackupLogEntry {
  id: string;
  date: string;
  type: "Manual" | "Automático";
  frequency: string;
  size: number;
  itemCount: number;
  status: string;
}

export interface GeoLocationInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  loc: string;
  org: string;
  timezone: string;
}

export interface OfflineMutationEntry {
  id?: string;
  type: string;
  action: string;
  data: unknown;
  timestamp: string;
  tenantId?: string;
  retryCount?: number;
}

export interface PosBudgetData {
  budgetNumber: string;
  timestamp: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerNuit?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  vatTotal?: number;
  discountTotal?: number;
  grandTotal?: number;
}

export interface SupabaseProductRow {
  id: string;
  name: string;
  code?: string;
  category?: string;
  supplier?: string;
  cost_price?: number;
  sale_price?: number;
  vat_rate?: number;
  stock?: number;
  min_stock?: number;
  expiry_date?: string;
  image_url?: string;
  barcode?: string;
  unit?: string;
  branch_stocks?: Record<string, number>;
  batches?: ProductBatch[];
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseCustomerRow {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  nuit?: string;
  total_spent?: number;
  purchase_count?: number;
  last_purchase_date?: string;
  debt?: number;
  balance?: number;
  credit_limit?: number;
  loyalty_points?: number;
  credit_blocked?: boolean;
  notes?: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseTransactionRow {
  id: string;
  invoice_number: string;
  created_at?: string;
  timestamp?: string;
  subtotal?: number;
  vat_total?: number;
  discount_total?: number;
  grand_total?: number;
  payment_method?: string;
  payment_details?: string;
  cashier_name?: string;
  customer_name?: string;
  customer_id?: string;
  customer_phone?: string;
  customer_email?: string;
  nuit?: string;
  branch_id?: string;
  status?: "COMPLETED" | "CANCELLED" | "REFUNDED";
  fiscal_hash?: string;
  fiscal_keys?: string;
  fiscal_certified?: boolean;
  tenant_id?: string;
  items?: Transaction["items"];
}

export interface SupabaseCashFlowRow {
  id: string;
  created_at?: string;
  timestamp?: string;
  type: string;
  amount: number;
  reason?: string;
  responsible_user?: string;
  shift_id?: string;
  register_id?: string;
  payment_method?: string;
  category?: string;
  reference?: string;
  tenant_id?: string;
}

export interface SupabaseEmployeeRow {
  id: string;
  name: string;
  role?: string;
  contact?: string;
  salary?: number;
  admission_date?: string;
  status?: string;
  email?: string;
  username?: string;
  pin?: string;
  password?: string;
  foto_perfil?: string;
  pin_created_at?: string;
  pin_changed?: boolean;
  subscription_plan?: SubscriptionPlan;
  branch?: string;
  tenant_id?: string;
  auth_uid?: string;
}

export interface SupabaseAuditLogRow {
  id: string;
  created_at?: string;
  timestamp?: string;
  user_name?: string;
  user_role?: UserRole;
  action: string;
  module?: string;
  details?: string;
  ip?: string;
  device?: string;
  tenant_id?: string;
}

export interface PasswordRecoveryRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  requestedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  processedAt?: string;
  processedBy?: string;
  tenantId?: string;
}

export interface LocalBackupEntry {
  id: string;
  date: string;
  type: string;
  frequency: string;
  size: number;
  itemCount: number;
  status: string;
}

export interface AiForecastResult {
  next7DaysRevenue?: number;
  next30DaysRevenue?: number;
  confidence?: number;
  topMovingProducts?: { name: string; estimatedUnits: number }[];
  lowStockAlerts?: { name: string; currentStock: number; suggestedOrder: number }[];
  insights?: string[];
  recommendations?: string[];
  generatedAt?: string;
}

export interface AppUser {
  id: string;
  name: string;
  role: UserRole | string;
  email?: string;
  tenantId?: string;
  companyId?: string;
  avatar?: string;
  pin?: string;
}


