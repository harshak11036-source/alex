import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET() {
  // Force dynamic rendering by using headers()
  headers()
  
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subjects = await prisma.subject.findMany({
      where: {
        enrollments: { some: { userId: user.id, isActive: true } },
      },
      include: {
        institution: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        semester: { select: { id: true, name: true, number: true } },
        lecturers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { enrollments: true, resources: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ subjects })
  } catch (error) {
    console.error('My subjects list error:', error)
    return NextResponse.json({ error: 'Failed to list subjects' }, { status: 500 })
  }
}