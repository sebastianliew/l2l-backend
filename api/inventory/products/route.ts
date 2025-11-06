import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb.js';
import { Product } from '../../../models/Product.js';
import { AdminActivityLog } from '../../../models/AdminActivityLog.js';

interface ProductDocument {
  _id: string;
  name: string;
  sku: string;
  category: unknown;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  unitOfMeasurement: unknown;
  containerCapacity: number;
  containerType: unknown;
  isActive: boolean;
  [key: string]: unknown;
}

export async function GET(request: Request) {
  try {
    await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const includeInactive = searchParams.get('includeInactive');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Build query filter
    const filter: Record<string, any> = {
      isDeleted: { $ne: true } // Exclude soft-deleted products
    };

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add category filter
    if (category) {
      filter.category = category;
    }
    
    // Add status filter
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Filter out inactive products by default unless explicitly requested
    if (!includeInactive) {
      filter.isActive = true;
    }
    
    // Fetch products with populated fields
    const products = await Product.find(filter)
      .populate('category')
      .populate('brand')
      .populate('unitOfMeasurement')
      .populate('containerType')
      .limit(limit)
      .lean();
    
    return NextResponse.json({
      products: products || [],
      pagination: {
        totalCount: products.length,
        currentPage: 1,
        totalPages: 1
      }
    });
  } catch (error) {
    console.error('GET /api/inventory/products error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch products',
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : 'An error occurred'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let data: Record<string, unknown> = {};
  
  try {
    data = await request.json() as Record<string, unknown>;
    await connectDB();

    // Validate required fields
    if (!data.name || !data.category || !data.unitOfMeasurement) {
      const error = {
        error: 'Missing required fields',
        message: 'name, category, and unitOfMeasurement are required',
        receivedData: data
      };
      return NextResponse.json(error, { status: 400 });
    }

    // Transform data
    const transformedData = {
      name: String(data.name).substring(0, 200),
      description: String(data.description || '').substring(0, 1000),
      category: String(data.category),
      brand: data.brand ? String(data.brand) : null,
      unitOfMeasurement: String(data.unitOfMeasurement),
      containerType: data.containerType ? String(data.containerType) : null,
      quantity: Number(data.quantity) || 0,
      reorderPoint: Number(data.reorderPoint) || 10,
      currentStock: Number(data.currentStock) || 0,
      availableStock: Number(data.currentStock) || 0,
      reservedStock: 0,
      costPrice: Number(data.costPrice) || 0,
      sellingPrice: Number(data.sellingPrice) || 0,
      status: data.status || 'active',
      isActive: data.isActive !== undefined ? data.isActive : true,
      expiryDate: data.expiryDate || null,
      containerCapacity: 0,
      sku: data.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Create product
    const product = new Product(transformedData);
    await product.save();

    // Populate and return
    const populatedProduct = await Product.findById(product._id)
      .populate('category')
      .populate('brand')
      .populate('unitOfMeasurement')
      .populate('containerType');

    return NextResponse.json(populatedProduct, { status: 201 });
  } catch (error) {
    // Handle specific MongoDB errors
    if (error instanceof Error) {
      // Handle duplicate key error (likely SKU)
      if (error.message.includes('duplicate key error') || error.message.includes('E11000')) {
        const errorDetails = {
          error: 'Duplicate SKU',
          message: 'A product with this SKU already exists. Please try again.',
          details: error.message,
          receivedData: data
        };
        return NextResponse.json(errorDetails, { status: 409 });
      }
      
      // Handle validation errors
      if (error.message.includes('validation')) {
        const errorDetails = {
          error: 'Validation Error',
          message: error.message,
          details: error.message,
          receivedData: data
        };
        return NextResponse.json(errorDetails, { status: 400 });
      }
    }
    
    // Generic error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorDetails = {
      error: 'Failed to create product',
      message: errorMessage,
      details: error instanceof Error ? error.stack : String(error),
      receivedData: data,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(errorDetails, { status: 500 });
  }
} 