import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import connectDB from '@/lib/mongodb'
import { User } from '@/backend/models/User'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string }
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    await connectDB()

    // Find user by email
    const user = await User.findOne({ 
      email: email.toLowerCase() 
    }).select('+password')

    if (!user) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 401 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 401 }
      )
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        username: user.username
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    )

    return NextResponse.json({
      message: 'Login successful',
      accessToken: token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        name: user.name,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}