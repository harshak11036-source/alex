import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'student'
    const subjectId = searchParams.get('subjectId')
    const semesterId = searchParams.get('semesterId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { institution: true, department: true, course: true, semester: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No active membership' }, { status: 400 })
    }

    if (reportType === 'student') {
      return generateStudentAttendanceReport(user.id, subjectId, semesterId, startDate, endDate)
    } else if (reportType === 'lecturer') {
      return generateLecturerAttendanceReport(user.id, subjectId, semesterId, startDate, endDate)
    } else if (reportType === 'institution') {
      if (!['ADMIN', 'LECTURER'].includes(membership.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return generateInstitutionAttendanceReport(membership.institutionId, subjectId, semesterId, startDate, endDate)
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  } catch (error) {
    console.error('Attendance report error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

async function generateStudentAttendanceReport(
  userId: string,
  subjectId: string | null,
  semesterId: string | null,
  startDate: string | null,
  endDate: string | null
) {
  const whereClause: any = { userId }
  if (subjectId) whereClause.session = { subjectId }
  if (semesterId) whereClause.session = { ...whereClause.session, semesterId }
  if (startDate || endDate) {
    whereClause.session = { ...whereClause.session, date: {} }
    if (startDate) whereClause.session.date.gte = new Date(startDate)
    if (endDate) whereClause.session.date.lte = new Date(endDate)
  }

  const records = await prisma.attendanceRecord.findMany({
    where: whereClause,
    include: {
      session: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          semester: { select: { id: true, name: true, number: true } },
        },
      },
    },
    orderBy: { session: { date: 'asc' } },
  })

  const subjectStats = new Map<string, { present: number; absent: number; late: number; excused: number; total: number; subject: any }>()

  records.forEach(record => {
    const subjectCode = record.session.subject.code
    if (!subjectStats.has(subjectCode)) {
      subjectStats.set(subjectCode, { present: 0, absent: 0, late: 0, excused: 0, total: 0, subject: record.session.subject })
    }
    const stat = subjectStats.get(subjectCode)!
    stat.total++
    if (record.status === 'PRESENT' || record.status === 'LATE') {
      stat.present++
      if (record.status === 'LATE') stat.late++
    } else if (record.status === 'ABSENT') {
      stat.absent++
    } else if (record.status === 'EXCUSED') {
      stat.excused++
    }
  })

  const subjects = Array.from(subjectStats.values()).map(s => ({
    subjectId: s.subject.id,
    subjectName: s.subject.name,
    subjectCode: s.subject.code,
    present: s.present,
    absent: s.absent,
    late: s.late,
    excused: s.excused,
    total: s.total,
    percentage: s.total > 0 ? Math.round(((s.present + s.excused) / s.total) * 100) : 0,
  }))

  const totalPresent = subjects.reduce((sum, s) => sum + s.present, 0)
  const totalAbsent = subjects.reduce((sum, s) => sum + s.absent, 0)
  const totalConducted = subjects.reduce((sum, s) => sum + s.total, 0)

  return NextResponse.json({
    subjects,
    overallPercentage: totalConducted > 0 ? Math.round((totalPresent / totalConducted) * 100) : 0,
    totalPresent,
    totalAbsent,
    totalConducted,
    generatedAt: new Date().toISOString(),
  })
}

async function generateLecturerAttendanceReport(
  userId: string,
  subjectId: string | null,
  semesterId: string | null,
  startDate: string | null,
  endDate: string | null
) {
  const assignments = await prisma.lecturerAssignment.findMany({
    where: { userId },
    include: { subject: { include: { semester: true } } },
  })

  const subjectIds = assignments.map(a => a.subjectId)
  if (subjectId) {
    if (!subjectIds.includes(subjectId)) {
      return NextResponse.json({ error: 'Not authorized for this subject' }, { status: 403 })
    }
  }

  const targetSubjectIds = subjectId ? [subjectId] : subjectIds

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      subjectId: { in: targetSubjectIds },
      ...(semesterId ? { semesterId } : {}),
      ...(startDate || endDate ? {
        date: {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate ? { lte: new Date(endDate) } : {}),
        }
      } : {}),
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      semester: { select: { id: true, name: true, number: true } },
      records: {
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
    orderBy: { date: 'desc' },
  })

  const sessionReports = sessions.map(session => {
    const records = session.records
    const present = records.filter(r => r.status === 'PRESENT').length
    const absent = records.filter(r => r.status === 'ABSENT').length
    const late = records.filter(r => r.status === 'LATE').length
    const excused = records.filter(r => r.status === 'EXCUSED').length
    const onDuty = records.filter(r => r.status === 'ON_DUTY').length
    const total = records.length

    return {
      sessionId: session.id,
      subjectCode: session.subject.code,
      subjectName: session.subject.name,
      date: session.date,
      period: session.period,
      topic: session.topic,
      isCancelled: session.isCancelled,
      totalStudents: total,
      present,
      absent,
      late,
      excused,
      onDuty,
      percentage: total > 0 ? Math.round(((present + late + excused + onDuty) / total) * 100) : 0,
      records: records.map(r => ({
        userId: r.user.id,
        name: `${r.user.firstName} ${r.user.lastName}`,
        email: r.user.email,
        status: r.status,
        markedAt: r.markedAt,
      })),
    }
  })

  return NextResponse.json({
    sessions: sessionReports,
    generatedAt: new Date().toISOString(),
  })
}

async function generateInstitutionAttendanceReport(
  institutionId: string,
  subjectId: string | null,
  semesterId: string | null,
  startDate: string | null,
  endDate: string | null
) {
  const whereClause: any = { institutionId }
  if (subjectId) whereClause.subjectId = subjectId
  if (semesterId) whereClause.semesterId = semesterId
  if (startDate || endDate) {
    whereClause.date = {}
    if (startDate) whereClause.date.gte = new Date(startDate)
    if (endDate) whereClause.date.lte = new Date(endDate)
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: whereClause,
    include: {
      subject: { select: { id: true, name: true, code: true, departmentId: true } },
      semester: { select: { id: true, name: true, number: true } },
      records: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: { date: 'desc' },
  })

  const departmentStats = new Map<string, { present: number; absent: number; total: number; sessions: number }>()

  sessions.forEach(session => {
    const deptId = session.subject.departmentId
    if (!departmentStats.has(deptId)) {
      departmentStats.set(deptId, { present: 0, absent: 0, total: 0, sessions: 0 })
    }
    const stat = departmentStats.get(deptId)!
    stat.sessions++
    session.records.forEach(r => {
      stat.total++
      if (r.status === 'PRESENT' || r.status === 'LATE') stat.present++
      else if (r.status === 'ABSENT') stat.absent++
    })
  })

  return NextResponse.json({
    sessions: sessions.map(s => ({
      sessionId: s.id,
      subjectCode: s.subject.code,
      subjectName: s.subject.name,
      departmentId: s.subject.departmentId,
      date: s.date,
      period: s.period,
      isCancelled: s.isCancelled,
      totalStudents: s.records.length,
      present: s.records.filter(r => r.status === 'PRESENT').length,
      absent: s.records.filter(r => r.status === 'ABSENT').length,
    })),
    departmentSummary: Array.from(departmentStats.entries()).map(([deptId, stat]) => ({
      departmentId: deptId,
      sessions: stat.sessions,
      totalRecords: stat.total,
      present: stat.present,
      absent: stat.absent,
      percentage: stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0,
    })),
    generatedAt: new Date().toISOString(),
  })
}