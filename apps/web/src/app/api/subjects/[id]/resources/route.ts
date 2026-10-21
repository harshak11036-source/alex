import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

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
    const resources = await prisma.subjectResource.findMany({
      where: { subjectId: id, isPublished: true },
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ resources })
  } catch (error) {
    console.error('Subject resources list error:', error)
    return NextResponse.json({ error: 'Failed to list resources' }, { status: 500 })
  }
}

export async function POST(
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
    const { title, description, category, fileName, storagePath, fileSize, mimeType } = body

    const resource = await prisma.subjectResource.create({
      data: {
        subjectId: id,
        title,
        description,
        category,
        fileName,
        storagePath,
        fileSize,
        mimeType,
        uploadedBy: user.id,
      },
    })

    return NextResponse.json({ resource })
  } catch (error) {
    console.error('Subject resource create error:', error)
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
  }
}