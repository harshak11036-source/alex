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

    const enrollments = await prisma.subjectEnrollment.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        subject: {
          include: {
            attendanceSessions: {
              include: {
                records: { where: { userId: user.id } },
              },
            },
          },
        },
      },
    })

    let totalPresent = 0
    let totalAbsent = 0
    let totalConducted = 0

    const subjects = enrollments.map(enrollment => {
      const sessions = enrollment.subject.attendanceSessions.filter(s => !s.isCancelled)
      let present = 0
      let absent = 0
      
      sessions.forEach(session => {
        const record = session.records[0]
        if (record) {
          if (record.status === 'PRESENT' || record.status === 'LATE') present++
          else absent++
        }
      })
      
      totalPresent += present
      totalAbsent += absent
      totalConducted += sessions.length

      return {
        subjectId: enrollment.subject.id,
        subjectName: enrollment.subject.name,
        subjectCode: enrollment.subject.code,
        present,
        absent,
        total: sessions.length,
        percentage: sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 0,
      }
    })

    return NextResponse.json({
      subjects,
      overallPercentage: totalConducted > 0 ? Math.round((totalPresent / totalConducted) * 100) : 0,
      totalPresent,
      totalAbsent,
      totalConducted,
    })
  } catch (error) {
    console.error('My attendance error:', error)
    return NextResponse.json({ error: 'Failed to get attendance' }, { status: 500 })
  }
}