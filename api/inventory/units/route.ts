import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { UnitOfMeasurement } from '@/backend/models/UnitOfMeasurement';
import { Document } from 'mongoose';

const transformUnit = (unit: Document) => {
  const unitObject = unit.toObject();
  const { _id, ...rest } = unitObject;
  return {
    id: String(_id),
    ...rest
  };
};

export async function GET() {
  try {
    await connectDB();
    const units = await UnitOfMeasurement.find().sort({ name: 1 });
    const transformedUnits = units.map(transformUnit);
    return NextResponse.json(transformedUnits);
  } catch (error) {
    console.error('Error fetching units:', error);
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    await connectDB();

    const unit = new UnitOfMeasurement(data);
    await unit.save();

    return NextResponse.json(transformUnit(unit), { status: 201 });
  } catch (error) {
    console.error('Error creating unit:', error);
    return NextResponse.json(
      { error: 'Failed to create unit' },
      { status: 500 }
    );
  }
} 