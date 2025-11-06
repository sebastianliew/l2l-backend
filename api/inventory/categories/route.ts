import { NextResponse } from 'next/server';
import connectDB from '@/backend/lib/mongodb';
import { Category } from '@/backend/models/Category';

export async function GET() {
  try {
    await connectDB();
    const categories = await Category.find().sort({ name: 1 });
    
    // Transform MongoDB documents to match the frontend type
    const transformedCategories = categories.map(category => ({
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      level: category.level,
      isActive: category.status === 'active',
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    }));
    
    return NextResponse.json(transformedCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    await connectDB();

    if (!data.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const category = new Category(data);
    await category.save();

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
} 