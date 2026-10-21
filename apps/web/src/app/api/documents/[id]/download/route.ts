import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSignedUrl } from '@/lib/storage/client'

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
    const document = await prisma.document.findUnique({ where: { id } })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = document.ownerId === user.id || await checkDocumentAccess(user.id, document)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const signedUrl = await getSignedUrl(document.storageBucket, document.storagePath, 3600)
    
    return NextResponse.redirect(signedUrl)
  } catch (error) {
    console.error('Document download error:', error)
    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
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