import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { AuditLogService } from '@/lib/audit-log'

export async function GET() {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No active membership' }, { status: 400 })
    }

    const whereClause: any = {}
    if (membership.role === 'LECTURER') {
      const assignments = await prisma.lecturerAssignment.findMany({
        where: { userId: user.id },
        select: { subjectId: true },
      })
      whereClause.subjectId = { in: assignments.map(a => a.subjectId) }
    } else if (membership.role === 'STUDENT') {
      whereClause.isPublished = true
      whereClause.subject = {
        enrollments: { some: { userId: user.id, isActive: true } },
      }
    }

    const assessments = await prisma.assessment.findMany({
      where: whereClause,
      include: {
        subject: { select: { id: true, name: true, code: true, semesterId: true } },
        semester: { select: { id: true, name: true, number: true } },
        _count: { select: { results: true } },
      },
      orderBy: { assessmentDate: 'desc' },
    })

    return NextResponse.json({ assessments })
  } catch (error) {
    console.error('Assessments list error:', error)
    return NextResponse.json({ error: 'Failed to list assessments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

    if (!membership || !['LECTURER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { subjectId, name, type, maxMarks, weight, assessmentDate, description } = body

    if (!subjectId || !name || !type || !maxMarks || !assessmentDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (membership.role === 'LECTURER') {
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId },
      })
      if (!assignment) {
        return NextResponse.json({ error: 'Not assigned to this subject' }, { status: 403 })
      }
    }

    const assessment = await prisma.assessment.create({
      data: {
        subjectId,
        semesterId: body.semesterId || (await prisma.subject.findUnique({ where: { id: subjectId }, select: { semesterId: true } }))?.semesterId || '',
        name,
        type,
        maxMarks,
        weight: weight || 1.0,
        assessmentDate: new Date(assessmentDate),
        description,
        createdBy: user.id,
        isPublished: false,
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
    })

    await AuditLogService.log({
      institutionId: membership.institutionId,
      userId: user.id,
      action: 'ASSESSMENT_CREATE',
      entityType: 'Assessment',
      entityId: assessment.id,
      newValues: { subjectId, name, type, maxMarks, weight, assessmentDate, isPublished: false },
    })

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Create assessment error:', error)
    return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 })
  }
}