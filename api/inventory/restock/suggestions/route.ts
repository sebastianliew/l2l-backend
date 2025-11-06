import { NextRequest, NextResponse } from 'next/server';
import { RestockService } from '../../../../services/inventory/RestockService';
import { RestockValidator } from '../../../../../lib/validations/restock';
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
    const queryData = {
      threshold: parseFloat(searchParams.get('threshold') || '1.0'),
      category: searchParams.get('category') || undefined,
      supplier: searchParams.get('supplier') || undefined,
      includeInactive: searchParams.get('includeInactive') === 'true'
    };

    const validationResult = RestockValidator.validateRestockSuggestionQuery(queryData);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid query parameters', 
          errors: validationResult.errors 
        },
        { status: 400 }
      );
    }

    const suggestions = await restockService.getRestockSuggestions(
      validationResult.data!.threshold,
      validationResult.data!.category,
      validationResult.data!.supplier
    );

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        summary: {
          total: suggestions.length,
          high: suggestions.filter(s => s.priority === 'high').length,
          medium: suggestions.filter(s => s.priority === 'medium').length,
          low: suggestions.filter(s => s.priority === 'low').length
        }
      }
    });

  } catch (error) {
    console.error('Restock suggestions API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch restock suggestions' 
      },
      { status: 500 }
    );
  }
}