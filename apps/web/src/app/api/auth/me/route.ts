import { getCurrentUser } from '@/lib/supabase/server-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          role: user.role || 'STUDENT',
          avatarUrl: user.avatarUrl || null,
        },
      },
    })
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json({ user: null }, { status: 200 })
  }
}