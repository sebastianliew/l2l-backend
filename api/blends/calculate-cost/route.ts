import { NextResponse } from 'next/server';
import { CustomBlendService } from '../../../services/CustomBlendService';
import type { BlendIngredient } from '../../../types/blend.js';

const customBlendService = new CustomBlendService();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { ingredients, marginPercent = 100 }: { ingredients: BlendIngredient[], marginPercent?: number } = data;
    
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

    const costCalculation = await customBlendService.calculateBlendCost(ingredients);
    const pricingSuggestion = await customBlendService.suggestPricing(costCalculation.totalCost, marginPercent);
    
    return NextResponse.json({
      cost: costCalculation,
      pricing: pricingSuggestion
    });
  } catch (error: unknown) {
    console.error('Error calculating blend cost:', error);
    return NextResponse.json(
      { error: 'Failed to calculate blend cost', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 