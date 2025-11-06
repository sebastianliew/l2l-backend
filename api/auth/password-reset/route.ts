import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/UserService'
import { passwordResetRequestSchema } from '@/lib/validations/userSchemas'
import { errorResponse } from '@/lib/errors/customErrors'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = passwordResetRequestSchema.parse(body)
    
    const userService = new UserService()
    const result = await userService.resetPassword(validatedData.email)

    return NextResponse.json({
      message: result.message
    })

  } catch (error) {
    console.error('Password reset error:', error)
    const errorData = errorResponse(error)
    const statusCode = error && typeof error === 'object' && 'statusCode' in error 
      ? (error as { statusCode: number }).statusCode 
      : 500
    return NextResponse.json(errorData, { status: statusCode })
  }
}