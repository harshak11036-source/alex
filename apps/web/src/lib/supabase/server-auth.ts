import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma-edge-edge'
import { getLocalUserId } from '@/lib/local-auth'

function isLocalAuth() {
  return (process.env.AUTH_MODE || 'local').toLowerCase() === 'local'
}

export async function getCurrentUser() {
  const cookieStore = await cookies()

  // Local auth mode - use signed cookie
  if (isLocalAuth()) {
    const localSession = cookieStore.get('alex_local_session')?.value
    const userId = getLocalUserId(localSession)
    if (!userId) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
      },
    })
    return user
  }

  // Firebase auth mode (requires Firebase Admin SDK)
  // This would need Firebase Admin to be configured
  return null
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

// Placeholder functions for Firebase mode compatibility
export async function createSessionCookie(idToken: string) {
  throw new Error('Firebase Admin SDK not configured. Use local auth mode.')
}

export async function revokeSessionCookie(sessionCookie: string) {
  return false
}

export const adminAuth = null
export const adminDb = null

