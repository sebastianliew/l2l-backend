import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { UnitOfMeasurement } from '@/backend/models/UnitOfMeasurement';
import { Document } from 'mongoose';

interface UnitOfMeasurementDoc extends Document {
  name: string;
  abbreviation: string;
  type: 'weight' | 'volume' | 'count' | 'length' | 'area' | 'temperature';
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const transformUnit = (unit: UnitOfMeasurementDoc) => {
  const { _id, ...rest } = unit.toObject();
  return {
    id: _id.toString(),
    ...rest
  };
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const unit = await UnitOfMeasurement.findById(id);

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transformUnit(unit));
  } catch (error) {
    console.error('Error fetching unit:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unit' },
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

    const unit = await UnitOfMeasurement.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      { new: true }
    );

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transformUnit(unit));
  } catch (error) {
    console.error('Error updating unit:', error);
    return NextResponse.json(
      { error: 'Failed to update unit' },
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
    const unit = await UnitOfMeasurement.findByIdAndDelete(id);

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    console.error('Error deleting unit:', error);
    return NextResponse.json(
      { error: 'Failed to delete unit' },
      { status: 500 }
    );
  }
} 