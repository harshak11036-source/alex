import { createServerClientSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getDiagramTemplates } from '@/lib/diagrams/generator'

export async function GET() {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = getDiagramTemplates()
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Diagram templates error:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}