"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useRouter } from "next/navigation"
import { StudentDashboard } from "./student-dashboard"
import { LecturerDashboard } from "./lecturer-dashboard"
import { AdminDashboard } from "./admin-dashboard"
import { useAuth } from "@/hooks/use-auth"

interface UserWithRole {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: string
  activeMembership?: {
    role: string
    institutionId: string
    departmentId: string | null
    courseId: string | null
    semesterId: string | null
  }
}

export default function DashboardPage() {
  const { user, loading, refreshUser } = useAuth()
  const router = useRouter()
  const [userWithRole, setUserWithRole] = useState<UserWithRole | null>(null)
  const [userLoading, setUserLoading] = useState(true)

  useEffect(() => {
    async function fetchUserProfile() {
      if (!user) {
        setUserLoading(false)
        return
      }

      try {
        // Fetch user profile with role and membership from Firebase Function
        const functionsUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL || ''
        if (functionsUrl) {
          const response = await fetch(`${functionsUrl}/getUserProfile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          })
          if (response.ok) {
            const data = await response.json()
            // Merge Firebase user data with profile data
            setUserWithRole({
              id: user.id,
              email: user.email || '',
              firstName: data.firstName || user.user_metadata?.firstName || '',
              lastName: data.lastName || user.user_metadata?.lastName || '',
              avatarUrl: data.avatarUrl || user.user_metadata?.avatarUrl || null,
              role: data.role || 'STUDENT',
              activeMembership: data.activeMembership
            })
            setUserLoading(false)
            return
          }
        }

        // Fallback: use Firebase user metadata
        setUserWithRole({
          id: user.id,
          email: user.email || '',
          firstName: user.user_metadata?.firstName || '',
          lastName: user.user_metadata?.lastName || '',
          avatarUrl: user.user_metadata?.avatarUrl || null,
          role: 'STUDENT',
          activeMembership: undefined
        })
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
        setUserWithRole({
          id: user.id,
          email: user.email || '',
          firstName: user.user_metadata?.firstName || '',
          lastName: user.user_metadata?.lastName || '',
          avatarUrl: user.user_metadata?.avatarUrl || null,
          role: 'STUDENT',
          activeMembership: undefined
        })
      } finally {
        setUserLoading(false)
      }
    }

    fetchUserProfile()
  }, [user])

  if (loading || userLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!userWithRole) {
    router.push("/login")
    return null
  }

  const role = userWithRole.activeMembership?.role ?? userWithRole.role

  return (
    <DashboardLayout>
      {role === "ADMIN" && <AdminDashboard user={userWithRole} />}
      {role === "LECTURER" && <LecturerDashboard user={userWithRole} />}
      {role === "STUDENT" && <StudentDashboard user={userWithRole} />}
      {role === "PROJECT_MENTOR" && <LecturerDashboard user={userWithRole} />}
    </DashboardLayout>
  )
}