import { NextRequest, NextResponse } from 'next/server';
import { RestockService } from '../../../../services/inventory/RestockService';
import { RestockValidator } from '../../../../../lib/validations/restock';
import { AppError } from '../../../../../lib/errors/AppError';
import dbConnect from '../../../../../lib/mongoose';
// Import models to ensure they're registered with Mongoose
import '../../../../../models/Supplier';
import '../../../../../models/UnitOfMeasurement';
import '../../../../../models/Category';
import '../../../../../models/Brand';
import '../../../../../models/ContainerType';

const restockService = new RestockService();

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const validationResult = RestockValidator.validateBulkRestockRequest(body);
    
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
    const result = await restockService.bulkRestock(validationResult.data!, createdBy);

    return NextResponse.json({
      success: true,
      message: `Bulk restock completed: ${result.successCount}/${result.totalOperations} successful`,
      data: result
    });

  } catch (error) {
    console.error('Bulk restock API error:', error);
    
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