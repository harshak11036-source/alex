import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { reprocessDocument } from '@/lib/document-processing/pipeline'

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
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        project: { select: { id: true, title: true } },
        notebook: { select: { id: true, title: true } },
        chunks: { orderBy: { chunkIndex: 'asc' }, take: 5 },
        processingJobs: { orderBy: { createdAt: 'desc' } },
        versions: { orderBy: { version: 'desc' }, take: 5 },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.ownerId !== user.id) {
      const hasAccess = await checkDocumentAccess(user.id, document)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        description: document.description,
        fileName: document.fileName,
        fileSize: document.fileSize.toString(),
        mimeType: document.mimeType,
        documentType: document.documentType,
        status: document.status,
        errorMessage: document.errorMessage,
        pageCount: document.pageCount,
        metadata: document.metadata,
        subject: document.subject,
        project: document.project,
        notebook: document.notebook,
        chunks: document.chunks.map(c => ({
          id: c.id,
          chunkIndex: c.chunkIndex,
          pageNumber: c.pageNumber,
          sectionTitle: c.sectionTitle,
          tokenCount: c.tokenCount,
        })),
        processingJobs: document.processingJobs,
        versions: document.versions,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        processedAt: document.processedAt,
      },
    })
  } catch (error) {
    console.error('Document get error:', error)
    return NextResponse.json({ error: 'Failed to get document' }, { status: 500 })
  }
}

export async function DELETE(
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
    const document = await prisma.document.findUnique({ where: { id } })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.documentChunk.deleteMany({ where: { documentId: id } })
    await prisma.documentProcessingJob.deleteMany({ where: { documentId: id } })
    await prisma.document.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Document delete error:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}

export async function PATCH(
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
    const { title, description, subjectId, projectId, notebookId } = body

    const document = await prisma.document.findUnique({ where: { id } })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { title, description, subjectId, projectId, notebookId },
    })

    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('Document update error:', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

async function checkDocumentAccess(userId: string, document: { subjectId: string | null; projectId: string | null; notebookId: string | null }): Promise<boolean> {
  if (document.subjectId) {
    const enrollment = await prisma.subjectEnrollment.findFirst({
      where: { userId, subjectId: document.subjectId, isActive: true },
    })
    if (enrollment) return true
  }
  if (document.projectId) {
    const member = await prisma.projectMember.findFirst({
      where: { userId, projectId: document.projectId },
    })
    if (member) return true
  }
  if (document.notebookId) {
    const notebook = await prisma.researchNotebook.findFirst({
      where: { id: document.notebookId, ownerId: userId },
    })
    if (notebook) return true
  }
  return false
}