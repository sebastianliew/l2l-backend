import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { User } from '@/models/User'

export async function POST(_request: NextRequest) {
  try {
    await connectDB()

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'bem@gyocc.org' })
    
    if (existingAdmin) {
      return NextResponse.json(
        { message: 'Admin user already exists' },
        { status: 400 }
      )
    }

    // Create admin user with environment-based password
    if (!process.env.ADMIN_INITIAL_PASSWORD) {
    return NextResponse.json(
      { error: 'ADMIN_INITIAL_PASSWORD environment variable is required' },
      { status: 500 }
    );
  }
  
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
    
    const adminUser = await User.create({
      username: 'admin',
      email: 'bem@gyocc.org',
      password: adminPassword,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'Administrator',
      discountPermissions: {
        canApplyDiscounts: true,
        maxDiscountPercent: 100,
        maxDiscountAmount: 999999,
        unlimitedDiscounts: true,
        canApplyProductDiscounts: true,
        canApplyBillDiscounts: true
      },
      permissions: [
        {
          resource: 'discounts',
          actions: ['create', 'read', 'update', 'delete', 'unlimited']
        },
        {
          resource: 'inventory', 
          actions: ['create', 'read', 'update', 'delete']
        },
        {
          resource: 'transactions',
          actions: ['create', 'read', 'update', 'delete']
        },
        {
          resource: 'reports',
          actions: ['create', 'read', 'update', 'delete']
        },
        {
          resource: 'admin',
          actions: ['create', 'read', 'update', 'delete']
        }
      ],
      isActive: true,
      createdBy: 'system'
    })

    return NextResponse.json({
      message: 'Admin user created successfully',
      user: {
        id: adminUser._id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      }
    })

  } catch (error) {
    console.error('Create admin error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}