export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export interface DiscountPermissions {
  canApplyProductDiscounts: boolean;
  canApplyBillDiscounts: boolean;
  maxDiscountPercent: number;
  maxDiscountAmount: number;
  unlimitedDiscounts: boolean;
  [key: string]: boolean | number;
}

export interface ReportPermissions {
  canViewFinancialReports: boolean;
  canViewInventoryReports: boolean;
  canViewUserReports: boolean;
  canViewSecurityMetrics: boolean;
  canExportReports: boolean;
  [key: string]: boolean | number;
}

export interface InventoryPermissions {
  canAddProducts: boolean;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canManageStock: boolean;
  canCreateRestockOrders: boolean;
  canBulkOperations: boolean;
  canEditCostPrices: boolean;
  [key: string]: boolean | number;
}

export interface UserManagementPermissions {
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canAssignRoles: boolean;
  canManagePermissions: boolean;
  canViewSecurityLogs: boolean;
  [key: string]: boolean | number;
}

export interface PatientPermissions {
  canCreatePatients: boolean;
  canEditPatients: boolean;
  canDeletePatients: boolean;
  canViewMedicalHistory: boolean;
  canManagePrescriptions: boolean;
  canAccessAllPatients: boolean;
  [key: string]: boolean | number;
}

export interface TransactionPermissions {
  canCreateTransactions: boolean;
  canEditTransactions: boolean;
  canDeleteTransactions: boolean;
  canApplyDiscounts: boolean;
  canRefundTransactions: boolean;
  canViewFinancialDetails: boolean;
  [key: string]: boolean | number;
}

export interface BundlePermissions {
  canCreateBundles: boolean;
  canEditBundles: boolean;
  canDeleteBundles: boolean;
  canSetPricing: boolean;
  [key: string]: boolean | number;
}

export interface SupplierPermissions {
  canManageSuppliers: boolean;
  canCreateSuppliers: boolean;
  canEditSuppliers: boolean;
  canDeleteSuppliers: boolean;
  [key: string]: boolean | number;
}

export interface BlendPermissions {
  canCreateFixedBlends: boolean;
  canEditFixedBlends: boolean;
  canDeleteFixedBlends: boolean;
  canCreateCustomBlends: boolean;
  [key: string]: boolean | number;
}

export interface PrescriptionPermissions {
  canCreatePrescriptions: boolean;
  canEditPrescriptions: boolean;
  canDeletePrescriptions: boolean;
  canViewAllPrescriptions: boolean;
  canPrintPrescriptions: boolean;
  canManageTemplates: boolean;
  [key: string]: boolean | number;
}

export interface AppointmentPermissions {
  canCreateAppointments: boolean;
  canEditAppointments: boolean;
  canDeleteAppointments: boolean;
  canViewAllAppointments: boolean;
  canManageSchedules: boolean;
  canOverrideBookings: boolean;
  [key: string]: boolean | number;
}

export interface ContainerPermissions {
  canManageContainerTypes: boolean;
  canCreateTypes: boolean;
  canEditTypes: boolean;
  canDeleteTypes: boolean;
  [key: string]: boolean | number;
}

export interface BrandPermissions {
  canManageBrands: boolean;
  canCreateBrands: boolean;
  canEditBrands: boolean;
  canDeleteBrands: boolean;
  [key: string]: boolean | number;
}

export interface DosageFormPermissions {
  canManageDosageForms: boolean;
  canCreateForms: boolean;
  canEditForms: boolean;
  canDeleteForms: boolean;
  [key: string]: boolean | number;
}

export interface CategoryPermissions {
  canManageCategories: boolean;
  canCreateCategories: boolean;
  canEditCategories: boolean;
  canDeleteCategories: boolean;
  [key: string]: boolean | number;
}

export interface UnitPermissions {
  canManageUnits: boolean;
  canCreateUnits: boolean;
  canEditUnits: boolean;
  canDeleteUnits: boolean;
  [key: string]: boolean | number;
}

export interface DocumentPermissions {
  canUploadDocuments: boolean;
  canViewDocuments: boolean;
  canDeleteDocuments: boolean;
  canManageFolders: boolean;
  [key: string]: boolean | number;
}

export interface SecurityPermissions {
  canViewSecurityLogs: boolean;
  canManageSecurity: boolean;
  canViewAuditTrails: boolean;
  canManageApiKeys: boolean;
  [key: string]: boolean | number;
}

export interface SettingsPermissions {
  canViewSettings: boolean;
  canEditSettings: boolean;
  canManageIntegrations: boolean;
  canConfigureSystem: boolean;
  [key: string]: boolean | number;
}

export interface FeaturePermissions {
  discounts: DiscountPermissions;
  reports: ReportPermissions;
  inventory: InventoryPermissions;
  userManagement: UserManagementPermissions;
  patients: PatientPermissions;
  transactions: TransactionPermissions;
  bundles: BundlePermissions;
  suppliers: SupplierPermissions;
  blends: BlendPermissions;
  prescriptions: PrescriptionPermissions;
  appointments: AppointmentPermissions;
  containers: ContainerPermissions;
  brands: BrandPermissions;
  dosageForms: DosageFormPermissions;
  categories: CategoryPermissions;
  units: UnitPermissions;
  documents: DocumentPermissions;
  security: SecurityPermissions;
  settings: SettingsPermissions;
}