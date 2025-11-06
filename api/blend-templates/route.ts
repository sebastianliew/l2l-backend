import { NextRequest, NextResponse } from 'next/server';
import { BlendTemplateService } from '../../services/BlendTemplateService';
import type { CreateBlendTemplateData, TemplateFilters } from '../../types/blend.js';
import { getAuthUser } from '../../../lib/auth/server';
import { AdminActivityLog } from '../../../models/AdminActivityLog';

const blendTemplateService = new BlendTemplateService();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: TemplateFilters = {
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      search: searchParams.get('search') || undefined,
    };

    const templates = await blendTemplateService.getTemplates(filters);
    
    return NextResponse.json(templates);
  } catch (error: unknown) {
    console.error('Error fetching blend templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blend templates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const authResult = await getAuthUser(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    
    // Check if user is admin or super_admin
    if (!['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Admin privileges required for blend template creation' },
        { status: 403 }
      );
    }

    const data: CreateBlendTemplateData = await request.json();
    
    // Basic validation
    if (!data.name || !data.ingredients || data.ingredients.length === 0) {
      return NextResponse.json(
        { error: 'Name and at least one ingredient are required' },
        { status: 400 }
      );
    }

    // Validate batch size only if provided (now optional)
    if (data.batchSize !== undefined && data.batchSize <= 0) {
      return NextResponse.json(
        { error: 'Batch size must be greater than 0 when provided' },
        { status: 400 }
      );
    }

    if (!data.unitOfMeasurementId) {
      return NextResponse.json(
        { error: 'Unit of measurement is required' },
        { status: 400 }
      );
    }

    if (!data.createdBy) {
      return NextResponse.json(
        { error: 'Created by field is required' },
        { status: 400 }
      );
    }

    // Validate ingredients - relaxed validation since backend handles missing units
    for (const ingredient of data.ingredients) {
      if (!ingredient.productId || !ingredient.name) {
        return NextResponse.json(
          { error: 'Each ingredient must have a product ID and name' },
          { status: 400 }
        );
      }
      if (!ingredient.quantity || ingredient.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each ingredient must have a quantity greater than 0' },
          { status: 400 }
        );
      }
      // Removed strict unit validation since backend handles missing units
    }

    const template = await blendTemplateService.createTemplate(data);
    
    // Log activity for admin activity logs
    if (template && user) {
      await AdminActivityLog.logActivity({
        userId: user._id,
        username: user.username,
        userRole: user.role,
        action: 'created',
        entityType: 'blend_template',
        entityId: template._id,
        entityName: template.name,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });
    }
    
    return NextResponse.json(template, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating blend template:', error);
    return NextResponse.json(
      { error: 'Failed to create blend template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 