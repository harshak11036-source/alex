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
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id },
      include: {
        cards: { orderBy: { nextReview: 'asc' } },
        _count: { select: { cards: true } },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    if (deck.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ deck, cards: deck.cards })
  } catch (error) {
    console.error('Flashcard deck get error:', error)
    return NextResponse.json({ error: 'Failed to get deck' }, { status: 500 })
  }
}