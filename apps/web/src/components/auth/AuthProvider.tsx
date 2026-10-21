'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ExtendedUser {
  id: string
  email: string | undefined
  firstName?: string
  lastName?: string
  avatarUrl?: string | null
  role?: string
  activeMembership?: {
    role: string
    institutionId: string
    departmentId: string | null
    courseId: string | null
    semesterId: string | null
  }
  user_metadata?: {
    firstName?: string
    lastName?: string
    role?: string
    avatarUrl?: string | null
  }
}

interface AuthContextType {
  user: ExtendedUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const refreshUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user as ExtendedUser | null)
  }

  useEffect(() => {
    refreshUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { user: ExtendedUser | null } | null) => {
      setUser(session?.user as ExtendedUser | null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <AuthContext.Provider value={{ user, loading: false, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}