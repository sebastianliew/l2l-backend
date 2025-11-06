import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Product } from '@/models';
import { StockAdditionData } from '@/types/inventory';

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body: StockAdditionData = await req.json();
    const { productId, quantity, batchNumber, notes } = body;

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Invalid product ID or quantity' },
        { status: 400 }
      );
    }

    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    product.currentStock += quantity;
    product.totalQuantity += quantity;
    
    if (product.containerCapacity && product.containerCapacity > 0) {
      const fullContainers = Math.floor(product.currentStock / product.containerCapacity);
      const partialQuantity = product.currentStock % product.containerCapacity;
      
      // Initialize containers object properly
      product.containers = {
        full: fullContainers,
        partial: partialQuantity > 0 ? [{
          id: `CONTAINER_${Date.now()}`,
          remaining: partialQuantity,
          capacity: product.containerCapacity,
          status: 'partial'
        }] : []
      };
    }

    await product.save();

    const populatedProduct = await Product.findById(product._id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('unitOfMeasurement', 'name abbreviation')
      .populate('containerType', 'name');

    return NextResponse.json({
      message: 'Stock added successfully',
      product: populatedProduct,
      addedQuantity: quantity,
      batchNumber,
      notes
    });
  } catch (error) {
    console.error('Error adding stock:', error);
    return NextResponse.json(
      { error: 'Failed to add stock' },
      { status: 500 }
    );
  }
}