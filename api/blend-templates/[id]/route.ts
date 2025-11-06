import { NextRequest, NextResponse } from 'next/server';
import { BlendTemplateService } from '../../../services/BlendTemplateService';
import type { UpdateBlendTemplateData } from '../../../types/blend.js';
import { getAuthUser } from '../../../../lib/auth/server';
import { AdminActivityLog } from '../../../../models/AdminActivityLog';

const blendTemplateService = new BlendTemplateService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const template = await blendTemplateService.getTemplate(id);
    
    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error('Error fetching blend template:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Blend template not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch blend template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { error: 'Admin privileges required for blend template modification' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const data: UpdateBlendTemplateData = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Validate ingredients if provided
    if (data.ingredients) {
      if (data.ingredients.length === 0) {
        return NextResponse.json(
          { error: 'At least one ingredient is required' },
          { status: 400 }
        );
      }

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
        if (!ingredient.unitOfMeasurementId) {
          return NextResponse.json(
            { error: 'Each ingredient must have a unit of measurement' },
            { status: 400 }
          );
        }
      }
    }

    // Validate batch size if provided
    if (data.batchSize !== undefined && data.batchSize <= 0) {
      return NextResponse.json(
        { error: 'Batch size must be greater than 0' },
        { status: 400 }
      );
    }

    const template = await blendTemplateService.updateTemplate(id, data);
    
    // Log activity for admin activity logs
    if (template && user) {
      await AdminActivityLog.logActivity({
        userId: user._id,
        username: user.username,
        userRole: user.role,
        action: 'updated',
        entityType: 'blend_template',
        entityId: id,
        entityName: template.name,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });
    }
    
    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error('Error updating blend template:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Blend template not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update blend template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { error: 'Admin privileges required for blend template deletion' },
        { status: 403 }
      );
    }

    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Get template name before deletion
    const template = await blendTemplateService.getTemplate(id);
    const templateName = template?.name || 'Unknown Template';
    
    await blendTemplateService.deleteTemplate(id);
    
    // Log activity for admin activity logs
    if (user) {
      await AdminActivityLog.logActivity({
        userId: user._id,
        username: user.username,
        userRole: user.role,
        action: 'deleted',
        entityType: 'blend_template',
        entityId: id,
        entityName: templateName,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      });
    }
    
    return NextResponse.json({ message: 'Blend template deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting blend template:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Blend template not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete blend template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 