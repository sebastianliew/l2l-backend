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
  console.log('🔵 POST /api/brands endpoint hit');
  try {
    const data = await request.json();
    console.log('🔵 Received brand data:', data);
    
    // Basic validation
    if (!data.name) {
      console.error('🔴 Brand name is missing');
      return NextResponse.json(
        { error: 'Brand name is required' },
        { status: 400 }
      );
    }
    
    // Check if brand with same name exists
    console.log('🔵 Checking if brand exists with name:', data.name);
    const exists = await BrandService.brandExistsByName(data.name);
    console.log('🔵 Brand exists?', exists);
    
    if (exists) {
      console.error('🔴 Brand already exists');
      return NextResponse.json(
        { error: 'A brand with this name already exists' },
        { status: 409 }
      );
    }
    
    console.log('🔵 Creating brand...');
    const brand = await BrandService.createBrand(data);
    console.log('🟢 Brand created successfully:', brand);
    
    return NextResponse.json(brand, { status: 201 });
  } catch (error) {
    console.error('🔴 Error creating brand:', error);
    return NextResponse.json(
      { error: 'Failed to create brand' },
      { status: 500 }
    );
  }
}