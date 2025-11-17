import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '../lib/auth/server.js';
import { PermissionService } from '../lib/permissions/PermissionService.js';

interface SuperAdminFeatureCheck {
  feature: 'cost_price_edit' | 'package_pricing' | 'inventory_management' | 
           'product_management' | 'reports' | 'supplier_management' | 'fixed_blends';
  action?: 'create' | 'read' | 'update' | 'delete';
}

interface FeaturePermissionMap {
  [key: string]: {
    category: keyof import('../lib/permissions/PermissionService.js').FeaturePermissions;
    permission: string;
    displayName: string;
  };
}

const FEATURE_PERMISSION_MAP: FeaturePermissionMap = {
  cost_price_edit: {
    category: 'inventory',
    permission: 'canEditCostPrices',
    displayName: 'Cost Price Editing'
  },
  package_pricing: {
    category: 'bundles',
    permission: 'canManageBundlePricing',
    displayName: 'Package Price Setup'
  },
  inventory_management: {
    category: 'inventory',
    permission: 'canManageStock',
    displayName: 'Inventory Management'
  },
  product_management: {
    category: 'inventory',
    permission: 'canAddProducts',
    displayName: 'Product Management'
  },
  reports: {
    category: 'reports',
    permission: 'canViewFinancialReports',
    displayName: 'Reports Access'
  },
  supplier_management: {
    category: 'suppliers',
    permission: 'canAddSuppliers',
    displayName: 'Supplier Management'
  },
  fixed_blends: {
    category: 'blends',
    permission: 'canCreateFixedBlends',
    displayName: 'Fixed Blend Management'
  }
};

/**
 * Middleware to protect API routes with Super Admin access control
 * 
 * @param request - NextRequest object
 * @param featureCheck - Feature and action being protected
 * @returns Promise<{user: { _id: string; username: string; role: string } | null, error?: NextResponse}> - Returns user if authorized, error response if not
 */
export async function requireSuperAdminAccess(
  request: NextRequest,
  featureCheck: SuperAdminFeatureCheck
): Promise<{ user: { _id: string; username: string; role: string } | null; error?: NextResponse }> {
  try {
    
    // Get authenticated user
    const authResult = await getAuthUser(request);
    
    
    if (!authResult.success || !authResult.user) {
      return {
        user: null,
        error: NextResponse.json(
          { 
            error: 'Authentication required',
            message: authResult.error || 'You must be logged in to access this resource.',
            code: 'AUTH_REQUIRED'
          },
          { status: 401 }
        )
      };
    }

    const user = authResult.user;

    // Super Admin always has access
    if (user.role === 'super_admin') {
      return { user };
    }

    // Check if feature exists in our map
    const featureConfig = FEATURE_PERMISSION_MAP[featureCheck.feature];
    
    if (!featureConfig) {
      // Unknown feature in Super Admin guard
      return {
        user: null,
        error: NextResponse.json(
          { 
            error: 'Invalid feature configuration',
            message: 'The requested feature is not properly configured.',
            code: 'CONFIG_ERROR'
          },
          { status: 500 }
        )
      };
    }

    // Check if Super Admin has delegated this permission
    const permissionService = PermissionService.getInstance();
    const hasPermission = permissionService.hasPermission(
      user,
      featureConfig.category,
      featureConfig.permission
    );
    

    if (!hasPermission) {
      return {
        user: null,
        error: NextResponse.json(
          {
            error: 'Insufficient permissions',
            message: `${featureConfig.displayName} requires Super Admin access or delegated permissions.`,
            feature: featureCheck.feature,
            requiredRole: 'super_admin',
            userRole: user.role,
            code: 'SUPER_ADMIN_REQUIRED'
          },
          { status: 403 }
        )
      };
    }

    return { user };

  } catch (error) {
    console.error('🔍 SUPER ADMIN GUARD DEBUG: Error in permission check:', error);
    return {
      user: null,
      error: NextResponse.json(
        {
          error: 'Authorization check failed',
          message: 'Unable to verify your permissions. Please try again.',
          code: 'AUTH_CHECK_FAILED'
        },
        { status: 500 }
      )
    };
  }
}

/**
 * Higher-order function to create protected API route handlers
 * 
 * @param feature - The feature being protected
 * @param handler - The actual API route handler
 * @returns Protected API route handler
 */
export function withSuperAdminProtection<T extends unknown[]>(
  feature: SuperAdminFeatureCheck['feature'],
  handler: (request: NextRequest, user: { _id: string; username: string; role: string }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const { user, error } = await requireSuperAdminAccess(request, { feature });
    
    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return handler(request, user, ...args);
  };
}

/**
 * Utility to check specific action permissions for Super Admin features
 * 
 * @param user - User object
 * @param feature - Feature to check
 * @param action - Specific action (create, read, update, delete)
 * @returns boolean indicating if user has permission
 */
export function hasSuperAdminFeatureAccess(
  user: { role: string; _id?: string },
  feature: SuperAdminFeatureCheck['feature'],
  action: SuperAdminFeatureCheck['action'] = 'read'
): boolean {
  if (!user) return false;
  
  // Super Admin always has access
  if (user.role === 'super_admin') return true;

  const featureConfig = FEATURE_PERMISSION_MAP[feature];
  if (!featureConfig) return false;

  const permissionService = PermissionService.getInstance();
  
  // Map actions to specific permissions where needed
  const actionPermissionMap: Record<string, Record<string, string>> = {
    inventory_management: {
      create: 'canAddProducts',
      update: 'canManageStock',
      delete: 'canDeleteProducts'
    },
    product_management: {
      create: 'canAddProducts',
      update: 'canEditProducts',
      delete: 'canDeleteProducts'
    },
    supplier_management: {
      create: 'canAddSuppliers',
      update: 'canEditSuppliers',
      delete: 'canDeleteSuppliers',
      read: 'canViewSuppliers'
    },
    fixed_blends: {
      create: 'canCreateFixedBlends',
      update: 'canEditFixedBlends',
      delete: 'canDeleteFixedBlends',
      read: 'canViewFixedBlends'
    }
  };

  const specificPermission = actionPermissionMap[feature]?.[action] || featureConfig.permission;

  return permissionService.hasPermission(user, featureConfig.category, specificPermission);
}

/**
 * Audit log helper for Super Admin protected actions
 * 
 * @param user - User performing the action
 * @param feature - Feature being accessed
 * @param action - Action being performed
 * @param details - Additional details about the action
 */
export async function logSuperAdminAction(
  _user: { username: string; role: string; _id: string },
  _feature: SuperAdminFeatureCheck['feature'],
  _action: string,
  _details?: Record<string, unknown>
): Promise<void> {
  try {
    // This could be expanded to write to an audit log collection
    // Audit log: User performed action (would be logged to database in production)
    
    // TODO: Implement actual audit logging to database
    // const auditLog = new AuditLog({
    //   userId: user._id,
    //   userRole: user.role,
    //   feature,
    //   action,
    //   details,
    //   timestamp: new Date(),
    //   ipAddress: request.ip,
    //   userAgent: request.headers.get('user-agent')
    // });
    // await auditLog.save();
    
  } catch {
    // Failed to log Super Admin action
  }
}

export default requireSuperAdminAccess;