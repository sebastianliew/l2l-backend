import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongoose';
import { CustomBlendHistory } from '../../../models/CustomBlendHistory';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');
    const popular = searchParams.get('popular') === 'true';
    
    let blends;
    
    if (popular) {
      blends = await CustomBlendHistory.getPopular(limit, customerId || undefined);
    } else if (search) {
      blends = await CustomBlendHistory.searchBlends(search, customerId || undefined, limit);
    } else if (customerId) {
      blends = await CustomBlendHistory.getByCustomer(customerId, limit);
    } else {
      blends = await CustomBlendHistory.find({ isActive: true })
        .sort({ lastUsed: -1, createdAt: -1 })
        .limit(limit)
        .populate('ingredients.productId')
        .populate('ingredients.unitOfMeasurementId');
    }
    
    return NextResponse.json({
      success: true,
      data: blends
    });
    
  } catch (error) {
    console.error('Error fetching custom blend history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch custom blend history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const data = await request.json();
    
    const blendHistory = new CustomBlendHistory({
      blendName: data.blendName,
      customerId: data.customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      ingredients: data.ingredients,
      totalIngredientCost: data.totalIngredientCost,
      sellingPrice: data.sellingPrice,
      marginPercent: data.marginPercent || 100,
      preparationNotes: data.preparationNotes,
      mixedBy: data.mixedBy,
      transactionId: data.transactionId,
      transactionNumber: data.transactionNumber,
      createdBy: data.createdBy || 'system'
    });
    
    await blendHistory.save();
    
    return NextResponse.json({
      success: true,
      data: blendHistory
    });
    
  } catch (error) {
    console.error('Error creating custom blend history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create custom blend history' },
      { status: 500 }
    );
  }
} 