import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, records } = body

    await prisma.$transaction(async (tx) => {
      for (const record of records) {
        await tx.attendanceRecord.upsert({
          where: { sessionId_userId: { sessionId, userId: record.userId } },
          update: { status: record.status, markedBy: user.id, markedAt: new Date() },
          create: { sessionId, userId: record.userId, status: record.status, markedBy: user.id },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark attendance error:', error)
    return NextResponse.json({ error: 'Failed to mark attendance' }, { status: 500 })
  }
}