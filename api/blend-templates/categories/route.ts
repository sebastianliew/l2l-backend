import { NextResponse } from 'next/server';
import { BlendTemplateService } from '../../../services/BlendTemplateService';

const blendTemplateService = new BlendTemplateService();

export async function GET() {
  try {
    const categories = await blendTemplateService.getCategories();
    
    return NextResponse.json(categories);
  } catch (error: unknown) {
    console.error('Error fetching blend template categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 