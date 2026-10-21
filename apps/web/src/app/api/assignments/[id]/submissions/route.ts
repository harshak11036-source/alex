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
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: id, userId: user.id },
      orderBy: { submissionNumber: 'desc' },
      include: {
        attachments: true,
      },
    })

    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('Assignment submissions list error:', error)
    return NextResponse.json({ error: 'Failed to list submissions' }, { status: 500 })
  }
}