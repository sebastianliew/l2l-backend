import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User } from '@/models/User';
import { UserAuditLog } from '@/models/UserAuditLog';
import { getJwtService } from '@/lib/auth/jwt';
import { securityLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security-logger';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Get current user from headers (should be root user)
    const rootUserId = request.headers.get('x-user-id');
    const rootUserRole = request.headers.get('x-user-role');

    // Verify root user permissions
    if (!rootUserId || !['super_admin', 'admin'].includes(rootUserRole || '')) {
      return NextResponse.json(
        { error: { message: 'Unauthorized: Root access required', code: 'UNAUTHORIZED' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: { message: 'Target user ID is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    // Get root user details
    const rootUser = await User.findById(rootUserId).select('username email role');
    if (!rootUser) {
      return NextResponse.json(
        { error: { message: 'Root user not found', code: 'USER_NOT_FOUND' } },
        { status: 404 }
      );
    }

    // Get target user
    const targetUser = await User.findById(targetUserId).select('username email role isActive password');
    if (!targetUser) {
      return NextResponse.json(
        { error: { message: 'Target user not found', code: 'USER_NOT_FOUND' } },
        { status: 404 }
      );
    }

    // Verify target user is active
    if (!targetUser.isActive) {
      return NextResponse.json(
        { error: { message: 'Cannot switch to inactive user', code: 'USER_INACTIVE' } },
        { status: 400 }
      );
    }

    // Prevent switching to another root user
    if (['super_admin', 'admin'].includes(targetUser.role) && targetUser.role === rootUser.role) {
      return NextResponse.json(
        { error: { message: 'Cannot switch to another root-level user', code: 'INVALID_TARGET' } },
        { status: 400 }
      );
    }

    // Generate new tokens for the target user with root session metadata
    const tokenData = {
      userId: targetUser._id.toString(),
      email: targetUser.email,
      role: targetUser.role,
      username: targetUser.username,
      rootSession: {
        rootUserId: rootUser._id.toString(),
        rootUsername: rootUser.username,
        rootRole: rootUser.role,
        switchedAt: new Date().toISOString()
      }
    };

    const { accessToken, refreshToken } = await getJwtService().generateTokenPair(
      tokenData.userId,
      tokenData.email,
      tokenData.role,
      tokenData.username
    );

    // Log the user switch event
    await UserAuditLog.create({
      userId: rootUser._id,
      action: 'user_switch',
      details: {
        rootUserId: rootUser._id,
        rootUsername: rootUser.username,
        rootRole: rootUser.role,
        targetUserId: targetUser._id,
        targetUsername: targetUser.username,
        targetRole: targetUser.role,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // Also log in the target user's audit trail
    await UserAuditLog.create({
      userId: targetUser._id,
      action: 'switched_to_by_root',
      details: {
        rootUserId: rootUser._id,
        rootUsername: rootUser.username,
        rootRole: rootUser.role,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // Log security event
    securityLogger.log(
      SecurityEventType.SECURITY_CONFIG_CHANGE,
      SecurityEventSeverity.WARNING,
      `Root user switch: ${rootUser.username} switched to ${targetUser.username}`,
      request,
      {
        rootUser: {
          id: rootUser._id,
          username: rootUser.username,
          role: rootUser.role
        },
        targetUser: {
          id: targetUser._id,
          username: targetUser.username,
          role: targetUser.role
        }
      }
    );

    // Create response with new tokens
    const response = NextResponse.json({
      success: true,
      message: 'User switch successful',
      user: {
        _id: targetUser._id,
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role
      },
      rootSession: tokenData.rootSession
    });

    const isProduction = process.env.NODE_ENV === 'production';

    // Set new tokens as cookies
    response.cookies.set('authToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60, // 15 minutes
      path: '/'
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    // Set a special cookie to indicate this is a root session
    response.cookies.set('rootSession', 'true', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('User switch error:', error);
    return NextResponse.json(
      { error: { message: 'Failed to switch user', code: 'SWITCH_USER_ERROR' } },
      { status: 500 }
    );
  }
}