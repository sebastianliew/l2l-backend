import { NextResponse } from 'next/server';
import connectDB from '../../lib/mongodb.js';
import { ContainerType } from '../../models/ContainerType.js';
import { Document } from 'mongoose';

const transformContainerType = (containerType: Document) => {
  const containerTypeObject = containerType.toObject();
  const { _id, allowedUoms, ...rest } = containerTypeObject;
  
  const transformedUoms = Array.isArray(allowedUoms) ? allowedUoms.map((uom: any) => {
    if (typeof uom === 'string') {
      return uom;
    }
    if (uom && typeof uom === 'object') {
      return uom.abbreviation || uom.name || String(uom);
    }
    return String(uom);
  }) : [];
  
  return {
    id: String(_id),
    ...rest,
    allowedUoms: transformedUoms
  };
};

export async function GET() {
  try {
    await connectDB();
    const containerTypes = await ContainerType.find()
      .populate('allowedUoms', 'name abbreviation')
      .sort({ name: 1 });
    const transformedContainerTypes = containerTypes.map(transformContainerType);
    return NextResponse.json(transformedContainerTypes);
  } catch (error) {
    console.error('Error fetching container types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch container types' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    await connectDB();

    const containerType = new ContainerType(data);
    await containerType.save();
    await containerType.populate('allowedUoms', 'name abbreviation');

    return NextResponse.json(transformContainerType(containerType), { status: 201 });
  } catch (error) {
    console.error('Error creating container type:', error);
    return NextResponse.json(
      { error: 'Failed to create container type' },
      { status: 500 }
    );
  }
}