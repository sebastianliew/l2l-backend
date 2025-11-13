import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb.js';
import { ContainerType } from '../../../models/ContainerType.js';
import { Document } from 'mongoose';

interface ContainerTypeDoc extends Document {
  name: string;
  description: string;
  allowedUoms: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const transformContainerType = (containerType: ContainerTypeDoc) => {
  const containerTypeObject = containerType.toObject();
  const { _id, allowedUoms, ...rest } = containerTypeObject;
  return {
    id: _id.toString(),
    ...rest,
    allowedUoms: Array.isArray(allowedUoms) ? allowedUoms.map((uom: any) => 
      typeof uom === 'string' ? uom : (uom.abbreviation || uom.name || String(uom))
    ) : []
  };
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const containerType = await ContainerType.findById(id)
      .populate('allowedUoms', 'name abbreviation');

    if (!containerType) {
      return NextResponse.json(
        { error: 'Container type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transformContainerType(containerType));
  } catch (error) {
    console.error('Error fetching container type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch container type' },
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
    await connectDB();

    const containerType = await ContainerType.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      { new: true }
    ).populate('allowedUoms', 'name abbreviation');

    if (!containerType) {
      return NextResponse.json(
        { error: 'Container type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transformContainerType(containerType));
  } catch (error) {
    console.error('Error updating container type:', error);
    return NextResponse.json(
      { error: 'Failed to update container type' },
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
    await connectDB();
    const containerType = await ContainerType.findByIdAndDelete(id);

    if (!containerType) {
      return NextResponse.json(
        { error: 'Container type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Container type deleted successfully' });
  } catch (error) {
    console.error('Error deleting container type:', error);
    return NextResponse.json(
      { error: 'Failed to delete container type' },
      { status: 500 }
    );
  }
}