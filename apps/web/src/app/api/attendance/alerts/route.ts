import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notifications'
import { AuditLogService } from '@/lib/audit-log'

const LOW_ATTENDANCE_THRESHOLD = 35

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, studentId, subjectId, threshold } = body

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { institution: true },
    })

    if (!membership || !['LECTURER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const effectiveThreshold = threshold || LOW_ATTENDANCE_THRESHOLD

    if (action === 'check_and_notify') {
      return checkAndNotifyLowAttendance(membership.institutionId, effectiveThreshold)
    } else if (action === 'notify_student') {
      if (!studentId || !subjectId) {
        return NextResponse.json({ error: 'Student ID and Subject ID required' }, { status: 400 })
      }
      return notifyStudentLowAttendance(studentId, subjectId, effectiveThreshold, membership.institutionId)
    } else if (action === 'get_low_attendance') {
      return getLowAttendanceStudents(membership.institutionId, effectiveThreshold, subjectId)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Attendance alerts error:', error)
    return NextResponse.json({ error: 'Failed to process alerts' }, { status: 500 })
  }
}

async function checkAndNotifyLowAttendance(institutionId: string, threshold: number) {
  const students = await getLowAttendanceStudentsInternal(institutionId, threshold)
  const results = []

  for (const student of students) {
    const result = await notifyStudentLowAttendance(
      student.userId,
      student.subjectId,
      threshold,
      institutionId
    )
    results.push({ studentId: student.userId, subjectId: student.subjectId, ...await result.json() })
  }

  return NextResponse.json({ checked: students.length, notifications: results })
}

async function getLowAttendanceStudents(institutionId: string, threshold: number, subjectId?: string | null) {
  const students = await getLowAttendanceStudentsInternal(institutionId, threshold, subjectId)
  return NextResponse.json({ students, threshold })
}

async function getLowAttendanceStudentsInternal(
  institutionId: string,
  threshold: number,
  subjectId?: string | null
) {
  const whereClause: any = {
    institutionId,
    role: 'STUDENT',
    status: 'ACTIVE',
  }

  const memberships = await prisma.collegeMembership.findMany({
    where: whereClause,
    include: { user: true },
  })

  const studentIds = memberships.map(m => m.userId)

  const enrollmentWhere: any = {
    userId: { in: studentIds },
    isActive: true,
  }
  if (subjectId) enrollmentWhere.subjectId = subjectId

  const enrollments = await prisma.subjectEnrollment.findMany({
    where: enrollmentWhere,
    include: {
      subject: {
        include: {
          attendanceSessions: {
            include: {
              records: { where: { userId: { in: studentIds } } },
            },
            where: { isCancelled: false },
          },
        },
      },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  const lowAttendanceStudents: any[] = []

  for (const enrollment of enrollments) {
    const sessions = enrollment.subject.attendanceSessions
    if (sessions.length === 0) continue

    let present = 0
    let total = sessions.length

    sessions.forEach(session => {
      const record = session.records.find(r => r.userId === enrollment.userId)
      if (record && (record.status === 'PRESENT' || record.status === 'LATE')) {
        present++
      }
    })

    const percentage = total > 0 ? Math.round((present / total) * 100) : 100

    if (percentage < threshold) {
      lowAttendanceStudents.push({
        userId: enrollment.userId,
        studentName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
        studentEmail: enrollment.user.email,
        subjectId: enrollment.subject.id,
        subjectName: enrollment.subject.name,
        subjectCode: enrollment.subject.code,
        present,
        total,
        percentage,
      })
    }
  }

  return lowAttendanceStudents
}

async function notifyStudentLowAttendance(
  studentId: string,
  subjectId: string,
  threshold: number,
  institutionId: string
) {
  const enrollment = await prisma.subjectEnrollment.findUnique({
    where: { userId_subjectId: { userId: studentId, subjectId } },
    include: {
      subject: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: { subjectId, isCancelled: false },
    include: { records: { where: { userId: studentId } } },
  })

  let present = 0
  sessions.forEach(session => {
    const record = session.records[0]
    if (record && (record.status === 'PRESENT' || record.status === 'LATE')) present++
  })

  const total = sessions.length
  const percentage = total > 0 ? Math.round((present / total) * 100) : 100

  if (percentage >= threshold) {
    return NextResponse.json({ error: 'Attendance above threshold' }, { status: 400 })
  }

  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId: studentId,
      category: 'ATTENDANCE',
      referenceId: subjectId,
      referenceType: 'ATTENDANCE_ALERT',
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  })

  if (existingNotification) {
    return NextResponse.json({ skipped: true, reason: 'Already notified recently' })
  }

  const notification = await prisma.notification.create({
    data: {
      userId: studentId,
      category: 'ATTENDANCE',
      title: `Low Attendance Alert: ${enrollment.subject.code}`,
      message: `Your attendance in ${enrollment.subject.name} (${enrollment.subject.code}) is ${percentage}%, which is below the ${threshold}% threshold. Please attend classes regularly to avoid academic consequences.`,
      referenceId: subjectId,
      referenceType: 'ATTENDANCE_ALERT',
      metadata: { percentage, threshold, present, total, subjectCode: enrollment.subject.code },
    },
  })

  const guardianContacts = await prisma.guardianContact.findMany({
    where: {
      institutionId,
      studentId,
      consentGiven: true,
    },
  })

  const notificationConfigs = await prisma.notificationConfig.findMany({
    where: { institutionId, isActive: true },
  })

  const deliveryResults = []

  for (const guardian of guardianContacts) {
    for (const config of notificationConfigs) {
      try {
        const providerConfig = (config.providerConfig as Record<string, any>) || {}
        const result = await NotificationService.send({
          provider: config.provider,
          config: providerConfig,
          recipient: guardian.email || guardian.phone || guardian.whatsapp || '',
          subject: `Attendance Alert: ${enrollment.subject.code}`,
          message: `Dear Guardian,\n\nYour ward ${enrollment.user.firstName} ${enrollment.user.lastName} has low attendance (${percentage}%) in ${enrollment.subject.name} (${enrollment.subject.code}). The minimum required is ${threshold}%.\n\nPlease encourage regular class attendance.\n\nRegards,\nALEX Academic System`,
        })

        await prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            provider: config.provider,
recipient: guardian.email || guardian.phone || guardian.whatsapp || '',
            status: result.success ? 'DELIVERED' : 'FAILED',
            providerResponse: result.response,
            errorMessage: result.error,
            sentAt: new Date(),
            deliveredAt: result.success ? new Date() : null,
          },
        })

        deliveryResults.push({
          guardianId: guardian.id,
          provider: config.provider,
          status: result.success ? 'DELIVERED' : 'FAILED',
        })
      } catch (error) {
        deliveryResults.push({
          guardianId: guardian.id,
          provider: config.provider,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  await AuditLogService.log({
    institutionId,
    userId: studentId,
    action: 'LOW_ATTENDANCE_ALERT_SENT',
    entityType: 'Notification',
    entityId: notification.id,
    newValues: { percentage, threshold, subjectId, guardianNotifications: deliveryResults.length },
  })

  return NextResponse.json({
    notified: true,
    studentId,
    subjectId,
    percentage,
    threshold,
    inAppNotification: notification.id,
    guardianDeliveries: deliveryResults,
  })
}