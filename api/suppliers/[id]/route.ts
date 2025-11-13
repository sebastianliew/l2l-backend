import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/backend/lib/mongodb';
import { Supplier } from '@/backend/models/Supplier';
import { requireSuperAdminAccess, logSuperAdminAction } from '@/lib/middleware/superAdminGuard';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: 'Supplier ID is required' },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const supplier = await Supplier.findById(id);

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Transform to match our interface
    const transformedSupplier = {
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    };

    return NextResponse.json(transformedSupplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: 'Supplier ID is required' },
      { status: 400 }
    );
  }

  try {
    // Check Super Admin access for supplier management
    const { user, error } = await requireSuperAdminAccess({ 
      feature: 'supplier_management' 
    });
    
    if (error) {
      return error;
    }

    await connectDB();
    const data = await request.json();

    const supplier = await Supplier.findByIdAndUpdate(
      id,
      { ...data, lastModifiedBy: 'system' },
      { new: true }
    );

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Transform to match our interface
    const transformedSupplier = {
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    };

    // Log Super Admin action
    if (user) {
      await logSuperAdminAction(user, 'supplier_management', 'update', {
        supplierId: id,
        supplierName: supplier.name
      });
    }

    return NextResponse.json(transformedSupplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: 'Supplier ID is required' },
      { status: 400 }
    );
  }

  try {
    // Check Super Admin access for supplier deletion
    const { user, error } = await requireSuperAdminAccess({ 
      feature: 'supplier_management' 
    });
    
    if (error) {
      return error;
    }

    await connectDB();
    const supplier = await Supplier.findByIdAndDelete(id);

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Log Super Admin action
    if (user) {
      await logSuperAdminAction(user, 'supplier_management', 'delete', {
        supplierId: id,
        supplierName: supplier.name
      });
    }

    return NextResponse.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    );
  }
}