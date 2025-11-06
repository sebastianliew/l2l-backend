import { NextResponse } from 'next/server';
import { BrandService } from '../../services/brands/BrandService';
import type { BrandFilters } from '../../types/brands/brand.types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Build filters from query params
    const filters: BrandFilters = {};
    
    const status = searchParams.get('status');
    if (status) {
      filters.status = status as BrandFilters['status'];
    }
    
    const isActive = searchParams.get('isActive');
    if (isActive !== null) {
      filters.isActive = isActive === 'true';
    }
    
    const isExclusive = searchParams.get('isExclusive');
    if (isExclusive !== null) {
      filters.isExclusive = isExclusive === 'true';
    }
    
    const search = searchParams.get('search');
    if (search) {
      filters.search = search;
    }
    
    const brands = await BrandService.getAllBrands(filters);
    return NextResponse.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Basic validation
    if (!data.name) {
      return NextResponse.json(
        { error: 'Brand name is required' },
        { status: 400 }
      );
    }
    
    // Check if brand with same name exists
    const exists = await BrandService.brandExistsByName(data.name);
    if (exists) {
      return NextResponse.json(
        { error: 'A brand with this name already exists' },
        { status: 409 }
      );
    }
    
    const brand = await BrandService.createBrand(data);
    return NextResponse.json(brand, { status: 201 });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { error: 'Failed to create brand' },
      { status: 500 }
    );
  }
}