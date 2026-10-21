import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { processDocument, createDocumentRecord } from '@/lib/document-processing/pipeline'
import { DocumentType } from '@prisma/client'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const subjectId = formData.get('subjectId') as string | null
    const projectId = formData.get('projectId') as string | null
    const notebookId = formData.get('notebookId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: `File size exceeds ${process.env.MAX_FILE_SIZE_MB}MB limit` }, { status: 400 })
    }

    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,txt,md,csv,xls,xlsx,ppt,pptx,png,jpg,jpeg').split(',')
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (!fileExt || !allowedTypes.includes(fileExt)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    const { document, buffer } = await createDocumentRecord(user.id, file, subjectId || undefined, projectId || undefined, notebookId || undefined)

    await prisma.documentProcessingJob.create({
      data: {
        documentId: document.id,
        step: 'queued',
        status: 'QUEUED',
      },
    })

    processDocument({
      documentId: document.id,
      userId: user.id,
      fileBuffer: buffer,
      fileName: file.name,
      mimeType: file.type,
      documentType: document.documentType,
      subjectId: subjectId || undefined,
      projectId: projectId || undefined,
      notebookId: notebookId || undefined,
    }).catch(console.error)

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        fileName: document.fileName,
        status: document.status,
        createdAt: document.createdAt,
      },
    })
  } catch (error) {
    console.error('Document upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('subjectId')
    const projectId = searchParams.get('projectId')
    const notebookId = searchParams.get('notebookId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { ownerId: user.id }
    if (subjectId) where.subjectId = subjectId
    if (projectId) where.projectId = projectId
    if (notebookId) where.notebookId = notebookId
    if (status) where.status = status

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          project: { select: { id: true, title: true } },
          notebook: { select: { id: true, title: true } },
          _count: { select: { chunks: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count({ where }),
    ])

    return NextResponse.json({
      documents: documents.map(d => ({
        id: d.id,
        title: d.title,
        description: d.description,
        fileName: d.fileName,
        fileSize: d.fileSize.toString(),
        mimeType: d.mimeType,
        documentType: d.documentType,
        status: d.status,
        errorMessage: d.errorMessage,
        pageCount: d.pageCount,
        subject: d.subject,
        project: d.project,
        notebook: d.notebook,
        chunksCount: d._count.chunks,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        processedAt: d.processedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Document list error:', error)
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 })
  }
}