import { NextRequest, NextResponse } from 'next/server';
import { RestockService } from '../../../../services/inventory/RestockService';
import dbConnect from '../../../../../lib/mongoose';
// Import models to ensure they're registered with Mongoose
import '../../../../../models/Supplier';
import '../../../../../models/UnitOfMeasurement';
import '../../../../../models/Category';
import '../../../../../models/Brand';
import '../../../../../models/ContainerType';

const restockService = new RestockService();

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const batches = await restockService.getBatchHistory(limit);

    return NextResponse.json({
      success: true,
      data: batches
    });

  } catch (error) {
    console.error('Restock batches API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch restock batches' 
      },
      { status: 500 }
    );
  }
}