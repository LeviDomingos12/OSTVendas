export type UserRole = "ADMIN" | "SUPERVISOR" | "CASHIER";

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
}

export interface Product {
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
  emoji?: string;
  promotion?: string; // e.g. "PROMO", "MAIS_VENDIDO", "NOVO", "DESCONTO"
  isFavorite?: boolean;
  brand?: string;
  weightBased?: boolean; // True if sold per kg
  barcode?: string;
  branchStocks?: Record<string, number>; // Stock per branch ID
  batches?: ProductBatch[]; // Batches associated with this product
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // percentage or fixed
  vatRate: number;
}

export interface Customer {
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
  loyaltyPoints: number;
  creditBlocked?: boolean;
  settlements?: { id: string, date: string, amount: number, method: string }[];
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  timestamp: string;
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
  nuit?: string;
  branchId?: string; // Associated branch ID
  fiscalHash?: string; // AGT/MEF Fiscal Hash signature
  fiscalKeys?: string; // Short sign key e.g. "D4-F5-G6-A2"
  fiscalCertified?: boolean; // Certified indicator
}

export interface CashFlowEntry {
  id: string;
  timestamp: string;
  type: "INPUT" | "REINFORCEMENT" | "EXPENSE" | "QUEBRA";
  amount: number;
  reason: string;
  responsibleUser: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userRole: UserRole;
  action: string;
  module: string;
  details: string;
  ip?: string;
  device?: string;
}

export interface Employee {
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
}

export interface SystemSettings {
  companyName: string;
  companyAddress: string;
  companyNuit: string;
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
  printerEnabled?: boolean;
  printerName?: string;
  printerConnectionType?: "USB" | "BLUETOOTH" | "NETWORK";
  printerIpAddress?: string;
  printerPort?: string;
  printerBaudRate?: string;
  printerType?: "RECEIPT" | "LABEL";
  paperSize?: "A4" | "80MM" | "58MM";
  printerAutoCut?: boolean;
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
