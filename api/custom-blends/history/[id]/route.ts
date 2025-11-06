import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongoose';
import { CustomBlendHistory } from '../../../../models/CustomBlendHistory';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const blend = await CustomBlendHistory.findById(id)
      .populate('ingredients.productId')
      .populate('ingredients.unitOfMeasurementId');
    
    if (!blend) {
      return NextResponse.json(
        { success: false, error: 'Custom blend not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: blend
    });
    
  } catch (error) {
    console.error('Error fetching custom blend:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch custom blend' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const blend = await CustomBlendHistory.findById(id);
    
    if (!blend) {
      return NextResponse.json(
        { success: false, error: 'Custom blend not found' },
        { status: 404 }
      );
    }
    
    // Record usage
    await blend.recordUsage();
    
    return NextResponse.json({
      success: true,
      data: blend
    });
    
  } catch (error) {
    console.error('Error updating custom blend usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update custom blend usage' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const blend = await CustomBlendHistory.findById(id);
    
    if (!blend) {
      return NextResponse.json(
        { success: false, error: 'Custom blend not found' },
        { status: 404 }
      );
    }
    
    // Soft delete by setting isActive to false
    blend.isActive = false;
    await blend.save();
    
    return NextResponse.json({
      success: true,
      message: 'Custom blend deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting custom blend:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete custom blend' },
      { status: 500 }
    );
  }
} 