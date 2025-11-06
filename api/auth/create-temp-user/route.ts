import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'

// Temporary user schema to read old data
import mongoose from 'mongoose'

const TempUserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: String,
  isActive: Boolean,
  firebaseUid: String,
}, { collection: 'users' })

const TempUser = mongoose.models.TempUser || mongoose.model('TempUser', TempUserSchema)

export async function GET() {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development' },
        { status: 403 }
      )
    }

    await connectDB()
    
    // Get all users with passwords
    const users = await TempUser.find({ password: { $exists: true } }).select('email username role password')
    
    const userList = users.map(user => ({
      email: user.email,
      username: user.username,
      role: user.role,
      hasPassword: !!user.password,
      // For bem@gyocc.org, we know the password
      suggestedPassword: user.email === 'bem@gyocc.org' ? 'Use: Digitalmi$ion2126!' : 'Reset password via Firebase'
    }))
    
    return NextResponse.json({
      message: 'Users with passwords in MongoDB',
      users: userList,
      note: 'These users need to reset their passwords in Firebase or use Google login'
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Failed to get users' },
      { status: 500 }
    )
  }
}