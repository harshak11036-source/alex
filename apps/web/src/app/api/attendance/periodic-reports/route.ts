import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notifications'
import { AuditLogService } from '@/lib/audit-log'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'student'
    const period = searchParams.get('period') || 'midterm'
    const semesterId = searchParams.get('semesterId')

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { institution: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No active membership' }, { status: 400 })
    }

    if (reportType === 'student') {
      return generateStudentPeriodicReport(user.id, period, semesterId)
    } else if (reportType === 'guardian') {
      return generateGuardianPeriodicReport(user.id, period, semesterId, membership.institutionId)
    } else if (reportType === 'institution') {
      if (!['ADMIN', 'LECTURER'].includes(membership.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return generateInstitutionPeriodicReport(membership.institutionId, period, semesterId)
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  } catch (error) {
    console.error('Periodic report error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
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
    const { action, institutionId, period, semesterId } = body

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { institution: true },
    })

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (action === 'generate_and_send') {
      return generateAndSendPeriodicReports(membership.institutionId, period, semesterId)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Periodic report generation error:', error)
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 })
  }
}

async function generateStudentPeriodicReport(userId: string, period: string, semesterId: string | null) {
  const enrollments = await prisma.subjectEnrollment.findMany({
    where: { userId, isActive: true, ...(semesterId ? { subject: { semesterId } } : {}) },
    include: {
      subject: {
        include: {
          semester: true,
          attendanceSessions: {
            include: { records: { where: { userId } } },
            where: { isCancelled: false },
          },
          assessments: {
            where: { isPublished: true },
            include: { results: { where: { userId } } },
          },
        },
      },
    },
  })

  const subjects = enrollments.map(enrollment => {
    const sessions = enrollment.subject.attendanceSessions
    let present = 0
    sessions.forEach(session => {
      const record = session.records[0]
      if (record && (record.status === 'PRESENT' || record.status === 'LATE')) present++
    })

    const assessments = enrollment.subject.assessments.map(assessment => {
      const result = assessment.results[0]
      return {
        assessmentId: assessment.id,
        name: assessment.name,
        type: assessment.type,
        maxMarks: assessment.maxMarks,
        weight: assessment.weight,
        marksObtained: result?.marksObtained ?? null,
        percentage: result && assessment.maxMarks > 0 ? Math.round((result.marksObtained / assessment.maxMarks) * 100) : null,
        isPublished: assessment.isPublished,
      }
    })

    const publishedAssessments = assessments.filter(a => a.isPublished && a.marksObtained !== null)
    const avgMarks = publishedAssessments.length > 0
      ? Math.round(publishedAssessments.reduce((sum, a) => sum + (a.percentage || 0), 0) / publishedAssessments.length)
      : null

    return {
      subjectId: enrollment.subject.id,
      subjectName: enrollment.subject.name,
      subjectCode: enrollment.subject.code,
      semester: enrollment.subject.semester.name,
      attendance: {
        present,
        total: sessions.length,
        percentage: sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 100,
      },
      assessments,
      averageMarks: avgMarks,
    }
  })

  const overallAttendance = subjects.length > 0
    ? Math.round(subjects.reduce((sum, s) => sum + s.attendance.percentage, 0) / subjects.length)
    : 100

  const overallMarks = subjects.filter(s => s.averageMarks !== null).length > 0
    ? Math.round(subjects.filter(s => s.averageMarks !== null).reduce((sum, s) => sum + (s.averageMarks || 0), 0) / subjects.filter(s => s.averageMarks !== null).length)
    : null

  return NextResponse.json({
    period,
    generatedAt: new Date().toISOString(),
    subjects,
    summary: {
      overallAttendance,
      overallMarks,
      subjectsCount: subjects.length,
      lowAttendanceSubjects: subjects.filter(s => s.attendance.percentage < 75).length,
    },
  })
}

async function generateGuardianPeriodicReport(userId: string, period: string, semesterId: string | null, institutionId: string) {
  const guardianContacts = await prisma.guardianContact.findMany({
    where: { institutionId, consentGiven: true },
    include: { student: { include: { memberships: { where: { status: 'ACTIVE' }, include: { institution: true } } } } },
  })

  const studentIds = guardianContacts.map(gc => gc.studentId)
  const uniqueStudentIds = [...new Set(studentIds)]

  const reports = []

  for (const studentId of uniqueStudentIds) {
    const studentReport = await generateStudentPeriodicReport(studentId, period, semesterId)
    const studentData = await studentReport.json()

    const guardians = guardianContacts.filter(gc => gc.studentId === studentId)
    reports.push({
      studentId,
      guardians: guardians.map(g => ({ id: g.id, name: g.name, relationship: g.relationship, email: g.email, phone: g.phone })),
      report: studentData,
    })
  }

  return NextResponse.json({ period, generatedAt: new Date().toISOString(), reports })
}

async function generateInstitutionPeriodicReport(institutionId: string, period: string, semesterId: string | null) {
  const enrollments = await prisma.subjectEnrollment.findMany({
    where: { isActive: true, ...(semesterId ? { subject: { semesterId } } : {}) },
    include: {
      subject: {
        include: {
          semester: true,
          attendanceSessions: {
            include: { records: true },
            where: { isCancelled: false },
          },
          assessments: {
            where: { isPublished: true },
            include: { results: true },
          },
        },
      },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  const studentReports = new Map<string, any>()

  for (const enrollment of enrollments) {
    const studentId = enrollment.userId
    if (!studentReports.has(studentId)) {
      studentReports.set(studentId, {
        studentId,
        studentName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
        studentEmail: enrollment.user.email,
        subjects: [],
      })
    }

    const sessions = enrollment.subject.attendanceSessions
    let present = 0
    sessions.forEach(session => {
      const record = session.records.find(r => r.userId === studentId)
      if (record && (record.status === 'PRESENT' || record.status === 'LATE')) present++
    })

    const assessments = enrollment.subject.assessments.map(assessment => {
      const result = assessment.results.find(r => r.userId === studentId)
      return {
        assessmentId: assessment.id,
        name: assessment.name,
        type: assessment.type,
        maxMarks: assessment.maxMarks,
        marksObtained: result?.marksObtained ?? null,
        percentage: result && assessment.maxMarks > 0 ? Math.round((result.marksObtained / assessment.maxMarks) * 100) : null,
      }
    })

    const publishedAssessments = assessments.filter(a => a.marksObtained !== null)
    const avgMarks = publishedAssessments.length > 0
      ? Math.round(publishedAssessments.reduce((sum, a) => sum + (a.percentage || 0), 0) / publishedAssessments.length)
      : null

    studentReports.get(studentId).subjects.push({
      subjectId: enrollment.subject.id,
      subjectName: enrollment.subject.name,
      subjectCode: enrollment.subject.code,
      attendance: {
        present,
        total: sessions.length,
        percentage: sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 100,
      },
      assessments,
      averageMarks: avgMarks,
    })
  }

  const allReports = Array.from(studentReports.values()).map(report => {
    const overallAttendance = report.subjects.length > 0
      ? Math.round(report.subjects.reduce((sum: number, s: any) => sum + s.attendance.percentage, 0) / report.subjects.length)
      : 100
    const overallMarks = report.subjects.filter((s: any) => s.averageMarks !== null).length > 0
      ? Math.round(report.subjects.filter((s: any) => s.averageMarks !== null).reduce((sum: number, s: any) => sum + (s.averageMarks || 0), 0) / report.subjects.filter((s: any) => s.averageMarks !== null).length)
      : null

    return { ...report, overallAttendance, overallMarks }
  })

  return NextResponse.json({
    period,
    semesterId,
    generatedAt: new Date().toISOString(),
    totalStudents: allReports.length,
    reports: allReports,
    summary: {
      avgAttendance: allReports.length > 0 ? Math.round(allReports.reduce((sum, r) => sum + r.overallAttendance, 0) / allReports.length) : 0,
      avgMarks: allReports.filter(r => r.overallMarks !== null).length > 0
        ? Math.round(allReports.filter(r => r.overallMarks !== null).reduce((sum, r) => sum + (r.overallMarks || 0), 0) / allReports.filter(r => r.overallMarks !== null).length)
        : null,
      atRiskStudents: allReports.filter(r => r.overallAttendance < 75 || (r.overallMarks !== null && r.overallMarks < 40)).length,
    },
  })
}

async function generateAndSendPeriodicReports(institutionId: string, period: string, semesterId: string | null) {
  const guardianContacts = await prisma.guardianContact.findMany({
    where: { institutionId, consentGiven: true },
    include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
  })

  const studentIds = [...new Set(guardianContacts.map(gc => gc.studentId))]
  const notificationConfigs = await prisma.notificationConfig.findMany({
    where: { institutionId, isActive: true },
  })

  const results = []

  for (const studentId of studentIds) {
    const studentReport = await generateStudentPeriodicReport(studentId, period, semesterId)
    const reportData = await studentReport.json()

    const studentGuardians = guardianContacts.filter(gc => gc.studentId === studentId)

    for (const guardian of studentGuardians) {
      for (const config of notificationConfigs) {
        try {
          const subject = `${period.charAt(0).toUpperCase() + period.slice(1)} Report: ${guardian.student.firstName} ${guardian.student.lastName}`
          const message = formatReportMessage(guardian.student, reportData, period)

          const providerConfig = (config.providerConfig as Record<string, any>) || {}
          const result = await NotificationService.send({
            provider: config.provider,
            config: providerConfig,
            recipient: guardian.email || guardian.phone || guardian.whatsapp || '',
            subject,
            message,
          })

          await prisma.notificationDelivery.create({
            data: {
              notificationId: `periodic-${studentId}-${period}-${Date.now()}`,
              provider: config.provider,
              recipient: guardian.email || guardian.phone || guardian.whatsapp || '',
              status: result.success ? 'DELIVERED' : 'FAILED',
              providerResponse: result.response,
              errorMessage: result.error,
              sentAt: new Date(),
              deliveredAt: result.success ? new Date() : null,
            },
          })

          results.push({ studentId, guardianId: guardian.id, provider: config.provider, status: result.success ? 'DELIVERED' : 'FAILED' })
        } catch (error) {
          results.push({ studentId, guardianId: guardian.id, provider: config.provider, status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown' })
        }
      }
    }
  }

  await AuditLogService.log({
    institutionId,
    action: 'PERIODIC_REPORTS_SENT',
    entityType: 'PeriodicReport',
    newValues: { period, semesterId, totalStudents: studentIds.length, deliveries: results.length },
  })

  return NextResponse.json({ sent: results.length, results })
}

function formatReportMessage(student: any, report: any, period: string): string {
  const lines = [
    `Dear Guardian,`,
    ``,
    `This is the ${period} academic report for ${student.firstName} ${student.lastName}.`,
    ``,
    `Overall Attendance: ${report.summary.overallAttendance}%`,
    `Overall Average Marks: ${report.summary.overallMarks !== null ? report.summary.overallMarks + '%' : 'N/A'}`,
    ``,
    `Subject-wise Details:`,
  ]

  for (const subject of report.subjects) {
    lines.push(`  ${subject.subjectCode} - ${subject.subjectName}:`)
    lines.push(`    Attendance: ${subject.attendance.percentage}% (${subject.attendance.present}/${subject.attendance.total})`)
    if (subject.averageMarks !== null) {
      lines.push(`    Average Marks: ${subject.averageMarks}%`)
    }
  }

  lines.push(``, `Please contact the institution for any queries.`, `Regards,`, `ALEX Academic System`)

  return lines.join('\n')
}