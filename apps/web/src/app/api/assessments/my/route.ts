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
            assessments: {
              where: { isPublished: true },
              include: { _count: { select: { results: true } } },
            },
          },
        },
      },
    })

    const assessments = enrollments.flatMap(e => 
      e.subject.assessments.map(a => ({
        ...a,
        subject: { id: e.subject.id, name: e.subject.name, code: e.subject.code },
      }))
    )

    return NextResponse.json({ assessments })
  } catch (error) {
    console.error('My assessments list error:', error)
    return NextResponse.json({ error: 'Failed to list assessments' }, { status: 500 })
  }
}