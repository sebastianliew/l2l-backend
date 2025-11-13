import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Bundle } from '@/models/Bundle';
import { getAuthUser } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const authResult = await getAuthUser();
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const isPromoted = searchParams.get('isPromoted');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minSavings = searchParams.get('minSavings');
    const tags = searchParams.get('tags');

    // Build query
    const query: Record<string, any> = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }
    
    if (isActive !== null && isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (isPromoted !== null && isPromoted !== undefined) {
      query.isPromoted = isPromoted === 'true';
    }
    
    if (minPrice || maxPrice) {
      query.bundlePrice = {};
      if (minPrice) query.bundlePrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.bundlePrice.$lte = parseFloat(maxPrice);
    }
    
    if (minSavings) {
      query.savingsPercentage = { $gte: parseFloat(minSavings) };
    }
    
    if (tags) {
      query.tags = { $in: tags.split(',') };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Execute query with safe populate - handle invalid ObjectIds gracefully
    let bundles, total;
    try {
      [bundles, total] = await Promise.all([
        Bundle.find(query)
          .populate('bundleProducts.productId', 'name sku availableStock')
          .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Bundle.countDocuments(query)
      ]);
      
      // Manually populate createdBy for bundles with valid ObjectIds
      if (bundles && bundles.length > 0) {
        const User = require('@/models/User.server');
        
        for (const bundle of bundles) {
          if (bundle.createdBy && typeof bundle.createdBy === 'string' && bundle.createdBy.match(/^[0-9a-fA-F]{24}$/)) {
            try {
              const user = await User.findById(bundle.createdBy).select('email name').lean();
              bundle.createdBy = user;
            } catch (error) {
              console.warn(`Failed to populate createdBy for bundle ${bundle._id}:`, error.message);
              bundle.createdBy = null;
            }
          } else {
            bundle.createdBy = null;
          }
        }
      }
    } catch (error) {
      // If the error is specifically about ObjectId casting, try without populate
      if (error.message.includes('Cast to ObjectId failed')) {
        console.warn('ObjectId casting error in bundles query, fetching without createdBy populate');
        [bundles, total] = await Promise.all([
          Bundle.find(query)
            .populate('bundleProducts.productId', 'name sku availableStock')
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          Bundle.countDocuments(query)
        ]);
        
        // Set createdBy to null for all bundles to avoid issues
        bundles.forEach(bundle => {
          bundle.createdBy = null;
        });
      } else {
        throw error;
      }
    }
    
    return NextResponse.json({
      bundles,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching bundles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bundles' },
      { status: 500 }
    );
  }
}

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

    // Check if user has permission to create bundles
    if (!['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Access denied: Admin privileges required' },
        { status: 403 }
      );
    }

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

    // Create bundle
    const bundle = new Bundle({
      ...data,
      createdBy: user._id
    });

    await bundle.save();

    // Populate for response
    await bundle.populate('bundleProducts.productId', 'name sku availableStock');
    await bundle.populate('createdBy', 'email name');

    return NextResponse.json(bundle, { status: 201 });
  } catch (error) {
    console.error('Error creating bundle:', error);
    return NextResponse.json(
      { error: 'Failed to create bundle' },
      { status: 500 }
    );
  }
}