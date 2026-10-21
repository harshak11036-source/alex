import { getCurrentUser } from './server-auth'

interface SupabaseUser {
  id: string
  email: string
  user_metadata: {
    firstName: string
    lastName: string
    role: string
    avatarUrl?: string | null
  }
}

function createSupabaseCompatibleUser(user: { id: string; email: string; firstName?: string; lastName?: string; role?: string; avatarUrl?: string | null } | null): SupabaseUser | null {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    user_metadata: {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role || 'STUDENT',
      avatarUrl: user.avatarUrl || null,
    },
  }
}

export async function createServerClientSupabase() {
  const user = await getCurrentUser()
  const supabaseUser = createSupabaseCompatibleUser(user)

  return {
    auth: {
      getUser: async () => ({
        data: { user: supabaseUser },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      exchangeCodeForSession: async (code: string) => ({ error: new Error('Email confirmation is not used in local auth mode') }),
      // Mock other auth methods that might be used
      onAuthStateChange: (callback: (event: string, session: { user: SupabaseUser | null } | null) => void) => {
        callback('INITIAL_SESSION', supabaseUser ? { user: supabaseUser } : null)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  }
}

export { getCurrentUser }