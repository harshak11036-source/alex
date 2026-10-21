import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { AuditLogService } from '@/lib/audit-log'

export async function PUT(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { recordId, status, reason } = body

    if (!recordId || !status) {
      return NextResponse.json({ error: 'Record ID and status are required' }, { status: 400 })
    }

    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'ON_DUTY']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: {
        session: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    if (!existingRecord) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

    const isLecturer = membership?.role === 'LECTURER' || membership?.role === 'ADMIN'
    const isAuthorized = isLecturer || existingRecord.userId === user.id

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Not authorized to edit this record' }, { status: 403 })
    }

    if (!isLecturer && existingRecord.userId === user.id) {
      return NextResponse.json({ error: 'Students cannot edit their own attendance' }, { status: 403 })
    }

    const assignment = await prisma.lecturerAssignment.findFirst({
      where: { userId: user.id, subjectId: existingRecord.session.subjectId },
    })

    if (isLecturer && !assignment && membership?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not assigned to this subject' }, { status: 403 })
    }

    const oldStatus = existingRecord.status
    const oldMarkedBy = existingRecord.markedBy
    const oldMarkedAt = existingRecord.markedAt

    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        status,
        markedBy: user.id,
        markedAt: new Date(),
        notes: reason ? `Edited: ${reason}` : existingRecord.notes,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        session: { include: { subject: { select: { id: true, code: true } } } },
      },
    })

    await AuditLogService.log({
      institutionId: membership?.institutionId || '',
      userId: user.id,
      action: 'ATTENDANCE_EDIT',
      entityType: 'AttendanceRecord',
      entityId: recordId,
      oldValues: { status: oldStatus, markedBy: oldMarkedBy, markedAt: oldMarkedAt },
      newValues: { status, markedBy: user.id, markedAt: new Date(), reason },
    })

    return NextResponse.json({ record: updatedRecord })
  } catch (error) {
    console.error('Edit attendance error:', error)
    return NextResponse.json({ error: 'Failed to edit attendance' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const recordId = searchParams.get('id')

    if (!recordId) {
      return NextResponse.json({ error: 'Record ID required' }, { status: 400 })
    }

    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: { session: { include: { subject: true } } },
    })

    if (!existingRecord) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

    if (membership?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can delete attendance records' }, { status: 403 })
    }

    await prisma.attendanceRecord.delete({ where: { id: recordId } })

    await AuditLogService.log({
      institutionId: membership.institutionId,
      userId: user.id,
      action: 'ATTENDANCE_DELETE',
      entityType: 'AttendanceRecord',
      entityId: recordId,
      oldValues: { status: existingRecord.status, userId: existingRecord.userId, sessionId: existingRecord.sessionId },
      newValues: undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete attendance error:', error)
    return NextResponse.json({ error: 'Failed to delete attendance' }, { status: 500 })
  }
}