import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const enrollments = await prisma.subjectEnrollment.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        subject: {
          include: {
            assignments: {
              where: { isPublished: true },
              include: { _count: { select: { submissions: true } } },
            },
          },
        },
      },
    })

    const assignments = enrollments.flatMap(e => 
      e.subject.assignments.map(a => ({
        ...a,
        subject: { id: e.subject.id, name: e.subject.name, code: e.subject.code },
      }))
    )

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('My assignments list error:', error)
    return NextResponse.json({ error: 'Failed to list assignments' }, { status: 500 })
  }
}