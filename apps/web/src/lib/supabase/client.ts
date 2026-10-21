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

function createLocalAuth() {
  return {
    currentUser: null,
    onAuthStateChanged: (callback: (user: SupabaseUser | null) => void) => {
      callback(null)
      return () => {}
    },
    signOut: async () => {},
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) })
      const d = await r.json()
      return { error: r.ok ? null : { message: d.error || 'Login failed' } }
    },
    signUp: async (payload: any) => {
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: payload.email, password: payload.password, ...payload.options?.data }) })
      const d = await r.json()
      return { error: r.ok ? null : { message: d.error || 'Registration failed' } }
    },
  }
}

function createMockAuth() {
  return {
    currentUser: null,
    onAuthStateChanged: (callback: (user: SupabaseUser | null) => void) => {
      callback(null)
      return () => {}
    },
    signOut: async () => {},
    signInWithPassword: async () => ({ error: { message: 'Auth not configured' } }),
    signUp: async () => ({ error: { message: 'Auth not configured' } }),
  }
}

export function createClient() {
  if (typeof window === 'undefined') {
    return { auth: createMockAuth() } as any
  }

  const authMode = process.env.NEXT_PUBLIC_AUTH_MODE?.toLowerCase()

  // Local auth mode - use API routes
  if (authMode === 'local') {
    return { auth: createLocalAuth() } as any
  }

  // Fallback to mock
  return { auth: createMockAuth() } as any
}

// Empty exports for compatibility
export const app = null
export const auth = null
export const storage = null
export const db = null

