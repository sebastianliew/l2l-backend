import { NextResponse } from 'next/server';
import { CustomBlendService } from '../../../services/CustomBlendService';
import type { BlendIngredient } from '../../../types/blend.js';

const customBlendService = new CustomBlendService();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { ingredients, multiplier = 1 }: { ingredients: BlendIngredient[], multiplier?: number } = data;
    
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'Ingredients array is required' },
        { status: 400 }
      );
    }

    // Validate each ingredient structure
    for (const ingredient of ingredients) {
      if (!ingredient.productId || !ingredient.name || !ingredient.quantity || ingredient.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each ingredient must have productId, name, and positive quantity' },
          { status: 400 }
        );
      }
    }

    const validationResult = await customBlendService.validateIngredients(ingredients, multiplier);
    
    return NextResponse.json(validationResult);
  } catch (error: unknown) {
    console.error('Error validating blend ingredients:', error);
    return NextResponse.json(
      { error: 'Failed to validate ingredients', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 