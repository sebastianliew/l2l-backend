import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Product } from '@/backend/models/Product';

interface QuickAddProductData {
  name: string;
  categoryName?: string;
  brandName?: string;
  unitName?: string;
  containerTypeName?: string;
  costPrice?: number;
  sellingPrice?: number;
  currentStock?: number;
  reorderPoint?: number;
  containerCapacity?: number;
  bundleInfo?: string;
  bundlePrice?: number;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const data: QuickAddProductData = await request.json();
    
    // Validate required fields
    if (!data.name || data.name.trim() === '') {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    // Create new product with simplified data
    const product = new Product({
      name: data.name.trim(),
      categoryName: data.categoryName?.trim() || '',
      brandName: data.brandName?.trim() || '',
      unitName: data.unitName?.trim() || 'pcs',
      containerTypeName: data.containerTypeName?.trim() || 'bottle',
      costPrice: data.costPrice || 0,
      sellingPrice: data.sellingPrice || 0,
      currentStock: data.currentStock || 0,
      totalQuantity: data.currentStock || 0,
      availableStock: data.currentStock || 0,
      reorderPoint: data.reorderPoint || 10,
      containerCapacity: data.containerCapacity || 1,
      bundleInfo: data.bundleInfo?.trim() || '',
      bundlePrice: data.bundlePrice || 0,
      hasBundle: Boolean(data.bundleInfo && data.bundleInfo.trim() !== '' && data.bundleInfo !== '-'),
      status: 'active',
      isActive: true
    });

    // Generate SKU automatically
    await product.generateSKU();

    // Auto-populate reference data
    await product.populateReferences();

    // Save the product
    await product.save();

    // Return simplified response
    return NextResponse.json({
      success: true,
      product: {
        id: product._id,
        name: product.name,
        sku: product.sku,
        categoryName: product.categoryName,
        brandName: product.brandName,
        currentStock: product.currentStock,
        sellingPrice: product.sellingPrice
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Quick-add product error:', error);
    
    if (error instanceof Error) {
      // Handle duplicate SKU errors
      if (error.message.includes('sku_1 dup key')) {
        return NextResponse.json(
          { error: 'Product with similar name already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to create product: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}