import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { AuditLogService } from '@/lib/audit-log'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true, semesterId: true } },
        semester: { select: { id: true, name: true, number: true } },
        results: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, memberships: { select: { studentId: true } } } },
          },
        },
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No active membership' }, { status: 400 })
    }

    if (membership.role === 'STUDENT') {
      if (!assessment.isPublished) {
        return NextResponse.json({ error: 'Assessment not published' }, { status: 403 })
      }
      const enrollment = await prisma.subjectEnrollment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId, isActive: true },
      })
      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled in this subject' }, { status: 403 })
      }
      assessment.results = assessment.results.filter((r: any) => r.userId === user.id)
    } else if (membership.role === 'LECTURER' || membership.role === 'ADMIN') {
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId },
      })
      if (!assignment && membership.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Not assigned to this subject' }, { status: 403 })
      }
    }

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Get assessment error:', error)
    return NextResponse.json({ error: 'Failed to get assessment' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { isPublished, results } = body

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: { 
        subject: true, 
        results: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, memberships: { select: { studentId: true } } } }
          }
        }
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

    if (!membership || !['LECTURER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (membership.role === 'LECTURER') {
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId },
      })
      if (!assignment) {
        return NextResponse.json({ error: 'Not assigned to this subject' }, { status: 403 })
      }
    }

    const oldValues: any = {
      isPublished: assessment.isPublished,
      publishedAt: assessment.publishedAt,
      results: assessment.results.map((r: any) => ({
        userId: r.userId,
        marksObtained: r.marksObtained,
        feedback: r.feedback,
        isPublished: r.isPublished,
      })),
    }

    const updateData: any = {}
    if (typeof isPublished === 'boolean') {
      updateData.isPublished = isPublished
      if (isPublished && !assessment.isPublished) {
        updateData.publishedAt = new Date()
      } else if (!isPublished && assessment.isPublished) {
        updateData.publishedAt = null
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.assessment.update({
          where: { id },
          data: updateData,
        })
      }

      if (results && Array.isArray(results)) {
        for (const result of results) {
          const { userId, marksObtained, feedback, isPublished: resultPublished } = result
          if (userId === undefined || marksObtained === undefined) continue

          if (marksObtained < 0 || marksObtained > assessment.maxMarks) {
            throw new Error(`Invalid marks for user ${userId}: must be between 0 and ${assessment.maxMarks}`)
          }

          await tx.assessmentResult.upsert({
            where: { assessmentId_userId: { assessmentId: id, userId } },
            update: {
              marksObtained,
              feedback,
              gradedBy: user.id,
              gradedAt: new Date(),
              isPublished: resultPublished ?? false,
              publishedAt: resultPublished ? new Date() : null,
            },
            create: {
              assessmentId: id,
              userId,
              marksObtained,
              feedback,
              gradedBy: user.id,
              gradedAt: new Date(),
              isPublished: resultPublished ?? false,
              publishedAt: resultPublished ? new Date() : null,
            },
          })
        }
      }
    })

    const updatedAssessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        results: {
          include: { user: { select: { id: true, firstName: true, lastName: true, memberships: { select: { studentId: true } } } } },
        },
      },
    })

    const newValues = {
      isPublished: updatedAssessment?.isPublished,
      publishedAt: updatedAssessment?.publishedAt,
      results: updatedAssessment?.results.map((r: any) => ({
        userId: r.userId,
        marksObtained: r.marksObtained,
        feedback: r.feedback,
        isPublished: r.isPublished,
      })),
    }

    await AuditLogService.log({
      institutionId: membership.institutionId,
      userId: user.id,
      action: isPublished !== undefined && isPublished !== assessment.isPublished 
        ? (isPublished ? 'ASSESSMENT_PUBLISH' : 'ASSESSMENT_UNPUBLISH')
        : 'ASSESSMENT_UPDATE_RESULTS',
      entityType: 'Assessment',
      entityId: id,
      oldValues,
      newValues,
    })

    return NextResponse.json({ assessment: updatedAssessment })
  } catch (error) {
    console.error('Update assessment error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update assessment' }, { status: 500 })
  }
}