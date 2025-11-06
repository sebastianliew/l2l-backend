import { NextRequest, NextResponse } from 'next/server';
import { RestockService } from '../../../services/inventory/RestockService';
import { RestockValidator } from '../../../../lib/validations/restock';
import { AppError } from '../../../../lib/errors/AppError';
import dbConnect from '../../../../lib/mongoose';
// Import models to ensure they're registered with Mongoose
import '../../../../models/Supplier';
import '../../../../models/UnitOfMeasurement';
import '../../../../models/Category';
import '../../../../models/Brand';
import '../../../../models/ContainerType';

const restockService = new RestockService();

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const validationResult = RestockValidator.validateRestockOperation(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Validation failed', 
          errors: validationResult.errors 
        },
        { status: 400 }
      );
    }

    const createdBy = request.headers.get('x-user-id') || 'system';
    const result = await restockService.restockProduct(validationResult.data!, createdBy);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Restock operation failed', 
          error: result.error 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Product restocked successfully',
      data: result
    });

  } catch (error) {
    console.error('Restock API error:', error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { 
          success: false, 
          message: error.message 
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const history = await restockService.getRestockHistory(productId || undefined, limit);

    return NextResponse.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Restock history API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch restock history' 
      },
      { status: 500 }
    );
  }
}