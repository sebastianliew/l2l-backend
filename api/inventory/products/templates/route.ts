import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Product } from '@/models';

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '200');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { 'category.name': { $regex: search, $options: 'i' } },
          { 'brand.name': { $regex: search, $options: 'i' } }
        ]
      };
    }

    const products = await Product.find(query)
      .populate('category')
      .populate('brand')
      .populate('unitOfMeasurement')
      .select('name sku category brand currentStock unitOfMeasurement sellingPrice costPrice')
      .sort({ createdAt: -1, name: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(query);

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching product templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product templates' },
      { status: 500 }
    );
  }
}