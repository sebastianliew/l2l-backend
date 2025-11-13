import { NextRequest, NextResponse } from 'next/server';
import { PermissionService, FeaturePermissions } from '../lib/permissions/PermissionService.js';
import { User } from '../models/User.js';
import dbConnect from '../lib/mongodb.js';

export interface PermissionConfig {
  resource?: string;
  action?: string;
  category?: keyof FeaturePermissions;
  permission?: string;
  requiresRole?: string[];
  customCheck?: (user: { _id: string; role: string; permissions?: Record<string, unknown> }, req: NextRequest) => boolean | Promise<boolean>;
}

export class PermissionMiddleware {
  private static instance: PermissionMiddleware;
  private permissionService: PermissionService;

  constructor() {
    this.permissionService = PermissionService.getInstance();
  }

  public static getInstance(): PermissionMiddleware {
    if (!PermissionMiddleware.instance) {
      PermissionMiddleware.instance = new PermissionMiddleware();
    }
    return PermissionMiddleware.instance;
  }

  // Route-based permission mapping
  private routePermissions: Record<string, PermissionConfig> = {
    // User Management Routes
    'GET /api/users': { category: 'userManagement', permission: 'canViewAuditLogs' },
    'POST /api/users': { category: 'userManagement', permission: 'canCreateUsers' },
    'PUT /api/users/[id]': { category: 'userManagement', permission: 'canEditUsers' },
    'DELETE /api/users/[id]': { category: 'userManagement', permission: 'canDeleteUsers' },
    'POST /api/users/[id]/reset-password': { category: 'userManagement', permission: 'canResetPasswords' },
    'GET /api/users/audit-logs': { category: 'userManagement', permission: 'canViewAuditLogs' },

    // Inventory Management Routes
    'GET /api/inventory/products': { category: 'inventory', permission: 'canAddProducts' }, // Basic read access
    'POST /api/inventory/products': { category: 'inventory', permission: 'canAddProducts' },
    'PUT /api/inventory/products/[id]': { category: 'inventory', permission: 'canEditProducts' },
    'DELETE /api/inventory/products/[id]': { category: 'inventory', permission: 'canDeleteProducts' },
    'POST /api/inventory/products/add-stock': { category: 'inventory', permission: 'canManageStock' },
    'POST /api/inventory/restock': { category: 'inventory', permission: 'canCreateRestockOrders' },
    'POST /api/inventory/restock/bulk': { category: 'inventory', permission: 'canBulkOperations' },

    // Transaction Routes
    'GET /api/transactions': { category: 'transactions', permission: 'canCreateTransactions' }, // Basic read access
    'POST /api/transactions': { category: 'transactions', permission: 'canCreateTransactions' },
    'PUT /api/transactions/[id]': { category: 'transactions', permission: 'canEditTransactions' },
    'DELETE /api/transactions/[id]': { category: 'transactions', permission: 'canDeleteTransactions' },
    'GET /api/transactions/[id]/invoice': { category: 'transactions', permission: 'canCreateTransactions' },

    // Patient Data Routes
    'GET /api/patients': { category: 'patients', permission: 'canAccessAllPatients' },
    'POST /api/patients': { category: 'patients', permission: 'canCreatePatients' },
    'PUT /api/patients/[id]': { category: 'patients', permission: 'canEditPatients' },
    'DELETE /api/patients/[id]': { category: 'patients', permission: 'canDeletePatients' },
    'POST /api/patients/bulk-delete': { category: 'patients', permission: 'canDeletePatients' },

    // Bundle Management Routes
    'GET /api/bundles': { category: 'bundles', permission: 'canCreateBundles' }, // Basic read access
    'POST /api/bundles': { category: 'bundles', permission: 'canCreateBundles' },
    'PUT /api/bundles/[id]': { category: 'bundles', permission: 'canEditBundles' },
    'DELETE /api/bundles/[id]': { category: 'bundles', permission: 'canDeleteBundles' },
    'POST /api/bundles/calculate-pricing': { category: 'bundles', permission: 'canSetPricing' },
    'GET /api/bundles/stats': { category: 'bundles', permission: 'canCreateBundles' },

    // Reports Routes
    'GET /api/reports/item-sales': { category: 'reports', permission: 'canViewFinancialReports' },
    'GET /api/dashboard/stats': { category: 'reports', permission: 'canViewInventoryReports' },

    // System Admin Routes
    'GET /api/admin/security-metrics': { category: 'security', permission: 'canViewSecurityLogs' },

    // Customer/Appointment Routes
    'GET /api/customers': { category: 'patients', permission: 'canAccessAllPatients' },
    'POST /api/customers': { category: 'patients', permission: 'canCreatePatients' },
    'GET /api/appointments': { category: 'appointments', permission: 'canViewAllAppointments' },
    'POST /api/appointments': { category: 'appointments', permission: 'canCreateAppointments' },

    // Special Routes
    'POST /api/auth/create-admin': { requiresRole: ['super_admin'] },
  };

  // Get permission config for a route
  private getRoutePermission(method: string, pathname: string): PermissionConfig | null {
    // Try exact match first
    const exactKey = `${method} ${pathname}`;
    if (this.routePermissions[exactKey]) {
      return this.routePermissions[exactKey];
    }

    // Try pattern matching for dynamic routes
    for (const [pattern, config] of Object.entries(this.routePermissions)) {
      const [patternMethod, patternPath] = pattern.split(' ');
      if (patternMethod === method && this.matchesPattern(pathname, patternPath)) {
        return config;
      }
    }

    return null;
  }

  // Simple pattern matching for dynamic routes
  private matchesPattern(path: string, pattern: string): boolean {
    const pathParts = path.split('/');
    const patternParts = pattern.split('/');

    if (pathParts.length !== patternParts.length) {
      return false;
    }

    for (let i = 0; i < pathParts.length; i++) {
      if (patternParts[i] !== pathParts[i] && !patternParts[i].startsWith('[')) {
        return false;
      }
    }

    return true;
  }

  // Main permission check middleware
  public async checkPermission(request: NextRequest): Promise<NextResponse | null> {
    const { pathname } = request.nextUrl;
    const method = request.method;

    // Skip permission check for auth routes and public paths
    const skipPermissionCheck = [
      '/api/auth/',
      '/api/health',
    ].some(path => pathname.startsWith(path));

    if (skipPermissionCheck) {
      return null; // Continue with request
    }

    // Get user information from headers (set by main middleware)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: { message: 'User information missing', code: 'USER_INFO_MISSING' } },
        { status: 401 }
      );
    }

    // Super admin has unlimited access
    if (userRole === 'super_admin') {
      return null; // Continue with request
    }

    // Get permission config for this route
    const permissionConfig = this.getRoutePermission(method, pathname);
    
    if (!permissionConfig) {
      // If no specific permission is configured, allow request (backward compatibility)
      return null;
    }

    try {
      // Connect to database and get user
      await dbConnect();
      const user = await User.findById(userId);

      if (!user) {
        return NextResponse.json(
          { error: { message: 'User not found', code: 'USER_NOT_FOUND' } },
          { status: 401 }
        );
      }

      // Check role-based permissions
      if (permissionConfig.requiresRole && !permissionConfig.requiresRole.includes(user.role)) {
        return NextResponse.json(
          { error: { message: 'Insufficient role permissions', code: 'INSUFFICIENT_ROLE' } },
          { status: 403 }
        );
      }

      // Check feature permissions
      if (permissionConfig.category && permissionConfig.permission) {
        const hasPermission = this.permissionService.hasPermission(
          user,
          permissionConfig.category,
          permissionConfig.permission
        );

        if (!hasPermission) {
          return NextResponse.json(
            { 
              error: { 
                message: `Access denied: Missing ${permissionConfig.category}.${permissionConfig.permission} permission`, 
                code: 'INSUFFICIENT_PERMISSIONS',
                requiredPermission: `${permissionConfig.category}.${permissionConfig.permission}`
              } 
            },
            { status: 403 }
          );
        }
      }

      // Check legacy resource/action permissions
      if (permissionConfig.resource && permissionConfig.action) {
        const hasPermission = user.canPerformAction(permissionConfig.resource, permissionConfig.action);

        if (!hasPermission) {
          return NextResponse.json(
            { 
              error: { 
                message: `Access denied: Cannot ${permissionConfig.action} ${permissionConfig.resource}`, 
                code: 'INSUFFICIENT_PERMISSIONS',
                requiredPermission: `${permissionConfig.resource}:${permissionConfig.action}`
              } 
            },
            { status: 403 }
          );
        }
      }

      // Custom permission check
      if (permissionConfig.customCheck) {
        const customResult = await permissionConfig.customCheck(user, request);
        if (!customResult) {
          return NextResponse.json(
            { error: { message: 'Access denied by custom permission check', code: 'CUSTOM_PERMISSION_DENIED' } },
            { status: 403 }
          );
        }
      }

      return null; // Permission granted, continue with request
    } catch {
      return NextResponse.json(
        { error: { message: 'Permission check failed', code: 'PERMISSION_CHECK_ERROR' } },
        { status: 500 }
      );
    }
  }

  // Helper method to check discount permissions for API endpoints
  public async checkDiscountPermission(
    user: { _id: string; role: string; discountPermissions?: { maxDiscountPercent?: number; maxDiscountAmount?: number; unlimitedDiscounts?: boolean } },
    discountPercent: number,
    discountAmount: number,
    type: 'product' | 'bill' = 'bill'
  ): Promise<{ allowed: boolean; reason?: string }> {
    return this.permissionService.checkDiscountPermission(user, discountPercent, discountAmount, type);
  }

  // Add custom permission config for specific routes
  public addRoutePermission(route: string, config: PermissionConfig): void {
    this.routePermissions[route] = config;
  }

  // Update existing route permission
  public updateRoutePermission(route: string, config: Partial<PermissionConfig>): void {
    if (this.routePermissions[route]) {
      this.routePermissions[route] = { ...this.routePermissions[route], ...config };
    }
  }

  // Get all configured route permissions (for debugging/admin UI)
  public getRoutePermissions(): Record<string, PermissionConfig> {
    return { ...this.routePermissions };
  }
}

export default PermissionMiddleware;