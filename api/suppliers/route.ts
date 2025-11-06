import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/backend/lib/mongodb';
import { Supplier } from '@/backend/models/Supplier';
import { requireSuperAdminAccess, logSuperAdminAction } from '@/lib/middleware/superAdminGuard';

export async function GET() {
  try {
    await connectDB();
    const suppliers = await Supplier.find().sort({ createdAt: -1 });
    // Transform MongoDB documents to match our interface
    const transformedSuppliers = suppliers.map(supplier => ({
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    }));
    return NextResponse.json(transformedSuppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check Super Admin access for supplier management
    const { user, error } = await requireSuperAdminAccess(request, { 
      feature: 'supplier_management' 
    });
    
    if (error) {
      return error;
    }

    await connectDB();
    const data = await request.json();

    // Remove any fields that aren't in our schema
    const supplierData = {
      name: data.name,
      description: data.description,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      fax: data.fax,
      website: data.website,
      address: data.address,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
      businessType: data.businessType,
      status: data.status,
      isActive: data.isActive,
      isPreferred: data.isPreferred,
      requiresApproval: data.requiresApproval,
      createdBy: user?._id || 'system',
      lastModifiedBy: user?._id || 'system'
    };

    const supplier = await Supplier.create(supplierData);
    
    // Log Super Admin action
    if (user) {
      await logSuperAdminAction(user, 'supplier_management', 'create', {
        supplierId: supplier._id,
        supplierName: supplier.name
      });
    }
    
    // Transform MongoDB document to match our interface
    const transformedSupplier = {
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    };
    
    return NextResponse.json(transformedSupplier, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    );
  }
}