import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Product } from '@/backend/models/Product';
import { requireSuperAdminAccess, logSuperAdminAction } from '@/lib/middleware/superAdminGuard';
import { getAuthUser } from '@/lib/auth/server';
import { PermissionService } from '@/lib/permissions/PermissionService';
import { AdminActivityLog } from '@/models/AdminActivityLog';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const product = await Product.findOne({
      _id: id,
      isDeleted: { $ne: true }
    })
      .populate({
        path: 'category',
        select: 'id name'
      })
      .populate({
        path: 'unitOfMeasurement',
        select: 'id name abbreviation type'
      })
      .populate({
        path: 'supplierId',
        select: 'id name'
      })
      .populate({
        path: 'brand',
        select: 'id name'
      });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Check if user has permission to edit products
    if (!permissionService.hasPermission(user, 'inventory', 'canEditProducts')) {
      return NextResponse.json({
        error: 'Access denied: Missing inventory.canEditProducts permission',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredPermission: 'inventory.canEditProducts'
      }, { status: 403 });
    }

    const { id } = await params;
    const data = await request.json() as {
      category?: { id?: string } | string;
      supplier?: { id?: string } | string;
      brand?: { id?: string } | string;
      unitOfMeasurement?: { id?: string } | string;
      containerType?: { id?: string } | string;
      quantity?: number;
      costPrice?: number;
      sellingPrice?: number;
      reorderPoint?: number;
      currentStock?: number;
      totalQuantity?: number;
      hasBundle?: boolean | string | null;
      isActive?: boolean | string | null;
      autoReorderEnabled?: boolean | string | null;
      [key: string]: unknown;
    };
    await connectDB();
    
    // Get the existing product to compare values
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Ensure id is defined
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Transform the data to ensure proper types and object references
    const transformedData = {
      ...data,
      category: typeof data.category === 'object' && data.category?.id ? data.category.id : data.category,
      supplierId: typeof data.supplier === 'object' && data.supplier?.id ? data.supplier.id : data.supplier,
      brand: typeof data.brand === 'object' && data.brand?.id ? data.brand.id : data.brand,
      unitOfMeasurement: typeof data.unitOfMeasurement === 'object' && data.unitOfMeasurement?.id ? data.unitOfMeasurement.id : data.unitOfMeasurement,
      containerType: typeof data.containerType === 'object' && data.containerType?.id ? data.containerType.id : data.containerType,
      quantity: Number(data.quantity) || 0,
      costPrice: Number(data.costPrice) || 0,
      sellingPrice: Number(data.sellingPrice) || 0,
      reorderPoint: Number(data.reorderPoint) || 0,
      currentStock: Number(data.currentStock) || 0,
      totalQuantity: Number(data.totalQuantity) || undefined,
      updatedAt: new Date()
    };

    // Fix boolean fields - convert empty strings to false to prevent casting errors
    if (transformedData.hasBundle === '' || transformedData.hasBundle === null) {
      transformedData.hasBundle = false;
    }
    if (transformedData.isActive === '' || transformedData.isActive === null) {
      transformedData.isActive = true; // Default to active
    }
    if (transformedData.autoReorderEnabled === '' || transformedData.autoReorderEnabled === null) {
      transformedData.autoReorderEnabled = false;
    }

    // Remove the supplier field since we're using supplierId
    delete transformedData.supplier;

    // Check cost price editing permission
    if (transformedData.costPrice !== undefined && data.costPrice !== undefined) {
      // Check if the cost price is actually being changed
      if (existingProduct.costPrice !== transformedData.costPrice) {
        if (!permissionService.hasPermission(user, 'inventory', 'canEditCostPrices')) {
          // Revert to existing cost price if user doesn't have permission
          transformedData.costPrice = existingProduct.costPrice;
          // Log permission violation for audit purposes
          await AdminActivityLog.logActivity({
            userId: user._id,
            username: user.username,
            userRole: user.role,
            action: 'updated',
            entityType: 'product',
            entityId: id,
            entityName: `${existingProduct.name} (Permission denied - cost price edit attempt)`,
            changes: [{ 
              field: 'costPrice', 
              previousValue: existingProduct.costPrice,
              newValue: existingProduct.costPrice
            }],
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
            userAgent: request.headers.get('user-agent') || undefined
          });
        }
      }
    }
    
    // Check stock management permission
    if (transformedData.currentStock !== undefined && data.currentStock !== undefined) {
      // Check if the stock is actually being changed
      if (existingProduct.currentStock !== transformedData.currentStock) {
        if (!permissionService.hasPermission(user, 'inventory', 'canManageStock')) {
          // Revert to existing stock if user doesn't have permission
          transformedData.currentStock = existingProduct.currentStock;
          transformedData.quantity = existingProduct.quantity;
          transformedData.totalQuantity = existingProduct.totalQuantity;
          // Log permission violation for audit purposes
          await AdminActivityLog.logActivity({
            userId: user._id,
            username: user.username,
            userRole: user.role,
            action: 'updated',
            entityType: 'product',
            entityId: id,
            entityName: `${existingProduct.name} (Permission denied - stock management attempt)`,
            changes: [{ 
              field: 'currentStock',
              previousValue: existingProduct.currentStock,
              newValue: existingProduct.currentStock
            }],
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
            userAgent: request.headers.get('user-agent') || undefined
          });
        }
      }
    }

    const product = await Product.findByIdAndUpdate(
      id,
      transformedData,
      { new: true }
    )
      .populate('category')
      .populate('unitOfMeasurement')
      .populate('supplierId')
      .populate('brand');

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Log action for users with canEditCostPrices permission (typically super admins)
    if (user && transformedData.costPrice !== undefined && permissionService.hasPermission(user, 'inventory', 'canEditCostPrices')) {
      await logSuperAdminAction(user, 'product_management', 'update', {
        productId: id,
        productName: product.name,
        hasCostPrice: transformedData.costPrice > 0
      });
    }

    // Log activity for admin activity logs
    if (user && ['admin', 'super_admin'].includes(user.role)) {
      // Build changes array for the update
      const changes = [];
      const fieldsToTrack = ['name', 'costPrice', 'sellingPrice', 'currentStock', 'reorderPoint', 'isActive'];
      
      for (const field of fieldsToTrack) {
        const transformedValue = (transformedData as Record<string, unknown>)[field];
        const dataValue = (data as Record<string, unknown>)[field];
        if (transformedValue !== undefined && dataValue !== undefined) {
          changes.push({
            field,
            previousValue: 'previous_value', // In real implementation, you'd get the original product first
            newValue: transformedValue
          });
        }
      }

      await AdminActivityLog.logActivity({
        userId: user._id,
        username: user.username,
        userRole: user.role,
        action: 'updated',
        entityType: 'product',
        entityId: id,
        entityName: product.name,
        changes: changes.length > 0 ? changes : undefined,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    // Allow both super_admin and admin roles, or users with specific delete permission
    const canDeleteProducts = 
      user.role === 'super_admin' || 
      user.role === 'admin' ||
      permissionService.hasPermission(user, 'inventory', 'canAddProducts'); // Using canAddProducts as proxy for product management

    if (!canDeleteProducts) {
      return NextResponse.json({
        error: 'Access denied: Insufficient permissions to delete products',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRole: 'admin or super_admin'
      }, { status: 403 });
    }

    const { id } = await params;
    
    await connectDB();

    // Find the product first
    const product = await Product.findById(id);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if already deleted
    if (product.isDeleted) {
      return NextResponse.json(
        { error: 'Product is already deleted' },
        { status: 400 }
      );
    }

    // Perform soft delete
    product.isDeleted = true;
    product.isActive = false; // Also set isActive to false
    product.deletedAt = new Date();
    product.deletedBy = user?._id || 'system';
    product.deleteReason = 'User requested deletion';

    await product.save();


    // Log deletion action if user is super admin
    if (user && user.role === 'super_admin') {
      await logSuperAdminAction(user, 'product_management', 'delete', {
        productId: id,
        productName: product.name
      });
    }

    // Log activity for admin activity logs
    if (user) {
      await AdminActivityLog.logActivity({
        userId: user._id,
        username: user.username,
        userRole: user.role,
        action: 'deleted',
        entityType: 'product',
        entityId: id,
        entityName: product.name,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });
    }

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('🔍 DELETE PRODUCT DEBUG: Error in DELETE route:', error);
    console.error('🔍 DELETE PRODUCT DEBUG: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
} 