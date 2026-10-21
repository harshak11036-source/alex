import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateDiagramFromTemplate, saveDiagram } from '@/lib/diagrams/generator'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { templateId, variables, customCode, customType, title, sourceDocId, subjectId } = body

    let definition

    if (templateId) {
      definition = await generateDiagramFromTemplate(templateId, variables || {})
      if (title) definition.title = title
    } else if (customCode && customType) {
      definition = {
        type: customType,
        code: customCode,
        title: title || "Custom Diagram",
      }
    } else {
      return NextResponse.json({ error: 'Either templateId or customCode+customType required' }, { status: 400 })
    }

    // Save to database
    const saved = await saveDiagram(user.id, definition, sourceDocId, subjectId)

    return NextResponse.json({
      id: saved.id,
      title: saved.title,
      type: saved.type,
      definition: saved.definition,
      createdAt: saved.createdAt,
    })
  } catch (error) {
    console.error('Diagram generation error:', error)
    return NextResponse.json({ error: 'Diagram generation failed' }, { status: 500 })
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
    const diagramId = searchParams.get('id')

    if (diagramId) {
      const diagram = await prisma.diagram.findUnique({
        where: { id: diagramId, userId: user.id },
      })
      if (!diagram) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json(diagram)
    }

    const diagrams = await prisma.diagram.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(diagrams)
  } catch (error) {
    console.error('Diagrams fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch diagrams' }, { status: 500 })
  }
}