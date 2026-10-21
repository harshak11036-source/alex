import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { uploadFile } from '@/lib/storage/client'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const assignmentId = formData.get('assignmentId') as string
    const content = formData.get('content') as string
    const files = formData.getAll('files') as File[]

    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } })
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const existingSubmissions = await prisma.assignmentSubmission.count({
      where: { assignmentId, userId: user.id },
    })

    if (existingSubmissions >= assignment.maxSubmissions && !assignment.allowResubmission) {
      return NextResponse.json({ error: 'Maximum submissions reached' }, { status: 400 })
    }

    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId,
        userId: user.id,
        status: new Date(assignment.dueDate) < new Date() ? 'LATE' : 'SUBMITTED',
        submissionNumber: existingSubmissions + 1,
        content,
        submittedAt: new Date(),
      },
    })

    for (const file of files) {
      if (file.size > 0) {
        const storagePath = `${user.id}/assignments/${assignmentId}/${submission.id}/${file.name}`
        await uploadFile('documents', storagePath, file, { contentType: file.type })
        
        await prisma.submissionAttachment.create({
          data: {
            submissionId: submission.id,
            fileName: file.name,
            storagePath,
            fileSize: BigInt(file.size),
            mimeType: file.type,
          },
        })
      }
    }

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('Assignment submit error:', error)
    return NextResponse.json({ error: 'Failed to submit assignment' }, { status: 500 })
  }
}