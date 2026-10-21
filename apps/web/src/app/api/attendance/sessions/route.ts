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

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        subject: {
          enrollments: { some: { userId: user.id, isActive: true } },
        },
      },
      orderBy: { date: 'desc' },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        records: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Attendance sessions list error:', error)
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subjectId, date, period, topic } = body

    const session = await prisma.attendanceSession.create({
      data: {
        subjectId,
        semesterId: '', // Will be set from subject
        date: new Date(date),
        period,
        topic,
        conductedBy: user.id,
      },
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Attendance session create error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}