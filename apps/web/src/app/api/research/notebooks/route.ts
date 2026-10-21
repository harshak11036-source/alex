import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notebooks = await prisma.researchNotebook.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { sources: true, notes: true } },
        project: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ notebooks })
  } catch (error) {
    console.error('Research notebooks list error:', error)
    return NextResponse.json({ error: 'Failed to list notebooks' }, { status: 500 })
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
    const { title, description, projectId } = body

    const notebook = await prisma.researchNotebook.create({
      data: {
        ownerId: user.id,
        title,
        description,
        projectId,
      },
    })

    return NextResponse.json({ notebook })
  } catch (error) {
    console.error('Research notebook create error:', error)
    return NextResponse.json({ error: 'Failed to create notebook' }, { status: 500 })
  }
}