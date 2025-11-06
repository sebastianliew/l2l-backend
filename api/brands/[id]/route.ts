import { NextResponse } from 'next/server';
import { BrandService } from '../../../services/brands/BrandService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const brand = await BrandService.getBrandById(id);
    
    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(brand);
  } catch (error) {
    console.error('Error fetching brand:', error);
    
    if (error instanceof Error && error.message === 'Invalid brand ID') {
      return NextResponse.json(
        { error: 'Invalid brand ID' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch brand' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    
    // Check if brand exists
    const existingBrand = await BrandService.getBrandById(id);
    if (!existingBrand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }
    
    // Check if new name conflicts with another brand
    if (data.name && data.name !== existingBrand.name) {
      const nameExists = await BrandService.brandExistsByName(data.name, id);
      if (nameExists) {
        return NextResponse.json(
          { error: 'A brand with this name already exists' },
          { status: 409 }
        );
      }
    }
    
    const brand = await BrandService.updateBrand(id, data);
    
    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(brand);
  } catch (error) {
    console.error('Error updating brand:', error);
    
    if (error instanceof Error && error.message === 'Invalid brand ID') {
      return NextResponse.json(
        { error: 'Invalid brand ID' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update brand' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const success = await BrandService.deleteBrand(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    
    if (error instanceof Error && error.message === 'Invalid brand ID') {
      return NextResponse.json(
        { error: 'Invalid brand ID' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete brand' },
      { status: 500 }
    );
  }
}