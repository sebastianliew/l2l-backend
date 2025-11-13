import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Bundle } from '@/models/Bundle';
import { getAuthUser } from '@/lib/auth/server';

export async function GET(
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

    const { id } = await params;
    await connectDB();
    
    const bundle = await Bundle.findById(id)
      .populate('bundleProducts.productId', 'name sku availableStock sellingPrice')
      .populate('createdBy', 'email name')
      .populate('lastModifiedBy', 'email name')
      .lean();
    
    if (!bundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Error fetching bundle:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bundle' },
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

    // Check if user has permission to update bundles
    if (!['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Access denied: Admin privileges required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectDB();
    
    const data = await request.json() as {
      name?: string;
      description?: string;
      category?: string;
      bundleProducts?: Array<{
        productId: string;
        name: string;
        quantity: number;
        individualPrice: number;
      }>;
      isActive?: boolean;
      isPromoted?: boolean;
      promotionText?: string;
      tags?: string[];
    };
    
    const bundle = await Bundle.findByIdAndUpdate(
      id,
      {
        ...data,
        lastModifiedBy: user._id,
        updatedAt: new Date()
      },
      { new: true }
    )
      .populate('bundleProducts.productId', 'name sku availableStock')
      .populate('createdBy', 'email name')
      .populate('lastModifiedBy', 'email name');
    
    if (!bundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Error updating bundle:', error);
    return NextResponse.json(
      { error: 'Failed to update bundle' },
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

    // Check if user has permission to delete bundles
    if (!['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Access denied: Admin privileges required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectDB();
    
    const bundle = await Bundle.findByIdAndDelete(id);
    
    if (!bundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Bundle deleted successfully' });
  } catch (error) {
    console.error('Error deleting bundle:', error);
    return NextResponse.json(
      { error: 'Failed to delete bundle' },
      { status: 500 }
    );
  }
}