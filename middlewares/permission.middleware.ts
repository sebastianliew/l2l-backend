import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';
import { PermissionService } from '../lib/permissions/PermissionService.js';
import type { FeaturePermissions } from '../lib/permissions/types.js';
import { Transaction } from '../models/Transaction.js';

const permissionService = PermissionService.getInstance();

/**
 * Middleware to check if user has a specific permission
 * @param category - The permission category (e.g., 'inventory', 'transactions', 'patients')
 * @param permission - The specific permission to check (e.g., 'canViewInventory', 'canCreateTransactions')
 */
export const requirePermission = (category: keyof FeaturePermissions, permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hasPermission = permissionService.hasPermission(user, category, permission);

    // Debug logging for permission checks
    if (!hasPermission) {
      console.log('[Permission Debug]', {
        userId: user._id,
        username: user.username,
        role: user.role,
        category,
        permission,
        userFeaturePermissions: user.featurePermissions,
        categoryPermissions: user.featurePermissions?.[category],
        hasPermission
      });
    }

    if (!hasPermission) {
      res.status(403).json({
        error: 'Permission denied',
        required: { category, permission }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check multiple permissions (user must have ALL specified permissions)
 * @param permissions - Array of { category, permission } objects
 */
export const requireAllPermissions = (permissions: Array<{ category: keyof FeaturePermissions; permission: string }>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const missingPermissions = permissions.filter(
      ({ category, permission }) => !permissionService.hasPermission(user, category, permission)
    );

    if (missingPermissions.length > 0) {
      res.status(403).json({
        error: 'Permission denied',
        required: permissions,
        missing: missingPermissions
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check multiple permissions (user must have at least ONE specified permission)
 * @param permissions - Array of { category, permission } objects
 */
export const requireAnyPermission = (permissions: Array<{ category: keyof FeaturePermissions; permission: string }>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hasAnyPermission = permissions.some(
      ({ category, permission }) => permissionService.hasPermission(user, category, permission)
    );

    if (!hasAnyPermission) {
      res.status(403).json({
        error: 'Permission denied',
        required: 'At least one of the following permissions',
        options: permissions
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check permission for editing transactions.
 * - For drafts: Requires canEditDrafts AND user must be the creator
 * - For non-drafts: Requires canEditTransactions
 */
export const requireDraftOrEditPermission = () => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    try {
      // Fetch the transaction to check its status and owner
      const transaction = await Transaction.findById(id).select('status createdBy').lean();

      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      // For drafts: check canEditDrafts AND ownership
      if (transaction.status === 'draft') {
        const canEditDrafts = permissionService.hasPermission(user, 'transactions', 'canEditDrafts');
        const isOwner = transaction.createdBy?.toString() === user._id?.toString();

        if (canEditDrafts && isOwner) {
          next();
          return;
        }

        // Debug logging for draft permission checks
        console.log('[Permission Debug - Draft]', {
          userId: user._id,
          username: user.username,
          role: user.role,
          transactionId: id,
          createdBy: transaction.createdBy,
          isOwner,
          canEditDrafts
        });

        res.status(403).json({
          error: 'Permission denied',
          required: { category: 'transactions', permission: 'canEditDrafts' },
          message: isOwner ? 'You do not have permission to edit drafts' : 'You can only edit your own drafts'
        });
        return;
      }

      // For non-drafts: require canEditTransactions
      const canEdit = permissionService.hasPermission(user, 'transactions', 'canEditTransactions');

      if (canEdit) {
        next();
        return;
      }

      res.status(403).json({
        error: 'Permission denied',
        required: { category: 'transactions', permission: 'canEditTransactions' }
      });
    } catch (error) {
      console.error('Error in requireDraftOrEditPermission middleware:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
