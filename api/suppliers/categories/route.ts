import { NextResponse } from 'next/server';
import connectDB from '@/backend/lib/mongodb';
import { SupplierCategory } from '@/backend/models/SupplierCategory';

export async function GET() {
  try {
    await connectDB();
    const categories = await SupplierCategory.find()
      .sort({ name: 1 });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching supplier categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    await connectDB();

    const category = new SupplierCategory(data);
    await category.save();

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier category:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier category' },
      { status: 500 }
    );
  }
}