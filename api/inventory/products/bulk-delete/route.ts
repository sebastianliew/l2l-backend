import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Product } from '@/backend/models/Product';
import { logSuperAdminAction } from '@/lib/middleware/superAdminGuard';
import { AdminActivityLog } from '@/models/AdminActivityLog';
import { getAuthUser } from '@/lib/auth/server';
import { PermissionService } from '@/lib/permissions/PermissionService';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const authResult = await getAuthUser();
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const permissionService = PermissionService.getInstance();

    // Check if user has permission to delete products
    const canDeleteProducts = 
      user.role === 'super_admin' || 
      user.role === 'admin' ||
      permissionService.hasPermission(user, 'inventory', 'canAddProducts');

    if (!canDeleteProducts) {
      return NextResponse.json({
        error: 'Access denied: Insufficient permissions to delete products',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRole: 'admin or super_admin'
      }, { status: 403 });
    }

    const { productIds } = await request.json() as { productIds: string[] };
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'Product IDs array is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find products that exist and are not already deleted
    const products = await Product.find({
      _id: { $in: productIds },
      isDeleted: { $ne: true }
    });

    if (products.length === 0) {
      return NextResponse.json(
        { error: 'No products found or all products are already deleted' },
        { status: 404 }
      );
    }

    // Perform soft delete on found products
    const updateResult = await Product.updateMany(
      { 
        _id: { $in: products.map(p => p._id) },
        isDeleted: { $ne: true }
      },
      {
        $set: {
          isDeleted: true,
          isActive: false, // Also set isActive to false
          deletedAt: new Date(),
          deletedBy: user?._id || 'system',
          deleteReason: 'Bulk deletion requested by user'
        }
      }
    );

    // Log Super Admin action for bulk deletion if user is super admin
    if (user && user.role === 'super_admin') {
      await logSuperAdminAction(user, 'product_management', 'bulk_delete', {
        productCount: updateResult.modifiedCount,
        productIds: products.map(p => p._id.toString()),
        productNames: products.map(p => p.name)
      });
    }

    // Log individual activities for admin activity logs
    if (user) {
      for (const product of products) {
        await AdminActivityLog.logActivity({
          userId: user._id,
          username: user.username,
          userRole: user.role,
          action: 'deleted',
          entityType: 'product',
          entityId: product._id.toString(),
          entityName: product.name,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
      }
    }

    return NextResponse.json({
      message: `Successfully deactivated ${updateResult.modifiedCount} products`,
      deactivatedCount: updateResult.modifiedCount,
      requestedCount: productIds.length,
      notFoundCount: productIds.length - products.length,
      products: products.map(p => ({ id: p._id, name: p.name }))
    });

  } catch (error) {
    console.error('🔍 BULK DELETE DEBUG: Error in bulk delete route:', error);
    console.error('🔍 BULK DELETE DEBUG: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to delete products' },
      { status: 500 }
    );
  }
}