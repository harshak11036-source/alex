"use client"

interface SupabaseUser {
  id: string
  email: string | null
  user_metadata: {
    firstName: string
    lastName: string
    role?: string
    avatarUrl?: string | null
  }
}

interface SupabaseSession {
  user: SupabaseUser | null
  access_token?: string
  refresh_token?: string
  expires_at?: number
}

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION' | 'USER_UPDATED'

// Singleton auth instance
let localAuthInstance: ReturnType<typeof createLocalAuth> | null = null

function createLocalAuth() {
  let currentUser: SupabaseUser | null = null
  let currentSession: SupabaseSession | null = null
  const subscribers = new Set<(event: AuthEvent, session: SupabaseSession | null) => void>()

  const fetchCurrentUser = async (): Promise<SupabaseUser | null> => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' })
      if (!r.ok) return null
      const data = await r.json()
      return data.user || null
    } catch {
      return null
    }
  }

  const notifySubscribers = (event: AuthEvent, session: SupabaseSession | null) => {
    subscribers.forEach(cb => cb(event, session))
  }

  const initializeAuth = async () => {
    const user = await fetchCurrentUser()
    currentUser = user
    currentSession = user ? { user } : null
    notifySubscribers('INITIAL_SESSION', currentSession)
  }

  // Initialize on first creation
  if (typeof window !== 'undefined') {
    initializeAuth()
  }

  return {
    getUser: async () => {
      const user = await fetchCurrentUser()
      currentUser = user
      currentSession = user ? { user } : null
      return { data: { user }, error: null }
    },

    getSession: async () => {
      const user = await fetchCurrentUser()
      const session = user ? { user, access_token: '', refresh_token: '', expires_at: 0 } : null
      return { data: { session }, error: null }
    },

    onAuthStateChange: (callback: (event: AuthEvent, session: SupabaseSession | null) => void) => {
      subscribers.add(callback)
      // Immediately fire with current state
      if (currentSession) {
        callback('INITIAL_SESSION', currentSession)
      } else {
        callback('INITIAL_SESSION', null)
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              subscribers.delete(callback)
            },
          },
        },
      }
    },

    signInWithPassword: async (credentials: { email: string; password: string }, redirectUrl?: string) => {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'include',
      })
      const data = await r.json()
      if (r.ok) {
        // Use full page reload to ensure cookie is sent with subsequent requests
        // This avoids the client-side navigation cookie race condition
        if (typeof window !== 'undefined') {
          window.location.href = redirectUrl || '/dashboard'
        }
        return { error: null }
      }
      return { error: { message: data.error || 'Login failed' } }
    },

    signUp: async (payload: { email: string; password: string; options?: { data?: Record<string, string> } }, redirectUrl?: string) => {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          ...payload.options?.data,
        }),
        credentials: 'include',
      })
      const data = await r.json()
      if (r.ok) {
        // Use full page reload to ensure cookie is sent with subsequent requests
        if (typeof window !== 'undefined') {
          window.location.href = redirectUrl || '/dashboard'
        }
        return { error: null }
      }
      return { error: { message: data.error || 'Registration failed' } }
    },

    signOut: async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      currentUser = null
      currentSession = null
      notifySubscribers('SIGNED_OUT', null)
      // Full page reload to clear any cached state
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
      return { error: null }
    },
  }
}

function createMockAuth() {
  return {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (callback: (event: string, session: SupabaseSession | null) => void) => {
      callback('INITIAL_SESSION', null)
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      }
    },
    signInWithPassword: async () => ({ error: { message: 'Auth not configured' } }),
    signUp: async () => ({ error: { message: 'Auth not configured' } }),
    signOut: async () => ({ error: null }),
  }
}

// Singleton getter
function getLocalAuthInstance() {
  if (!localAuthInstance) {
    localAuthInstance = createLocalAuth()
  }
  return localAuthInstance
}

export function createClient() {
  if (typeof window === 'undefined') {
    return { auth: createMockAuth() } as any
  }

  // Local auth mode - use API routes (singleton)
  return { auth: getLocalAuthInstance() } as any
}

// Empty exports for compatibility
export const app = null
export const auth = null
export const storage = null
export const db = null

