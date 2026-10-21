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

    const events = await prisma.plannerEvent.findMany({
      where: { userId: user.id },
      orderBy: { startTime: 'asc' },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        task: { select: { id: true, title: true, isCompleted: true } },
      },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Planner events list error:', error)
    return NextResponse.json({ error: 'Failed to list events' }, { status: 500 })
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
    const { title, description, startTime, endTime, allDay, eventType, subjectId, taskId } = body

    const event = await prisma.plannerEvent.create({
      data: {
        userId: user.id,
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        allDay: allDay || false,
        eventType: eventType || 'STUDY',
        subjectId,
        taskId,
      },
    })

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Planner event create error:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}