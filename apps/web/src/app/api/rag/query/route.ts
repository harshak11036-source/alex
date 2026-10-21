import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hybridSearch } from '@/lib/rag/vector-search'
import { getUserChatProvider } from '@/lib/rag/generation'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { query, subjectId, projectId, notebookId, documentIds, limit, threshold, stream, conversationId, context: extraContext } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const chatProvider = await getUserChatProvider(user.id)

    // Load conversation history if conversationId provided
    let conversationHistory: Array<{ role: string; content: string }> = []
    let targetConversationId: string | null = conversationId
    
    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      })
      if (conversation && conversation.userId === user.id) {
        conversationHistory = conversation.messages.map(m => ({ role: m.role, content: m.content }))
      }
    }

    // Load user memories
    const memories = await prisma.userMemory.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    // Load academic context
    const [enrollments, upcomingAssignments, attendanceSummary, plannerEvents] = await Promise.all([
      prisma.subjectEnrollment.findMany({
        where: { userId: user.id, isActive: true },
        include: { subject: { include: { semester: true } } },
        take: 10,
      }),
      prisma.assignment.findMany({
        where: {
          subject: { enrollments: { some: { userId: user.id, isActive: true } } },
          dueDate: { gte: new Date() },
          isPublished: true,
        },
        include: { subject: true },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      prisma.attendanceRecord.findMany({
        where: { userId: user.id },
        include: { session: { include: { subject: true } } },
        orderBy: { markedAt: 'desc' },
        take: 50,
      }),
      prisma.plannerEvent.findMany({
        where: { userId: user.id, startTime: { gte: new Date() } },
        orderBy: { startTime: 'asc' },
        take: 10,
      }),
    ])

    // Perform hybrid search
    const searchResults = await hybridSearch({
      query,
      userId: user.id,
      subjectId,
      projectId,
      notebookId,
      documentIds,
      limit: limit || 10,
      threshold: threshold || 0.7,
    })

    if (searchResults.length === 0) {
      // Still save conversation even if no search results
      let newConversationId = targetConversationId
      if (!newConversationId) {
        const newConv = await prisma.conversation.create({
          data: {
            userId: user.id,
            title: query.slice(0, 100),
            messages: {
              create: [
                { role: 'user', content: query, senderId: user.id },
                { role: 'assistant', content: 'I could not find any relevant information in your documents to answer this question.', senderId: user.id, metadata: { citations: [], sources: [] } },
              ],
            },
          },
        })
        newConversationId = newConv.id
      }

      return NextResponse.json({
        answer: 'I could not find any relevant information in your documents to answer this question.',
        citations: [],
        sources: [],
        model: 'none',
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        conversationId: newConversationId,
      })
    }

    // Build enhanced context with memories and academic info
    const memoryContext = memories.length > 0 
      ? '\n\nUSER MEMORIES (authoritative facts):\n' + memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join('\n')
      : ''

    const academicContext = `
${enrollments.length > 0 ? '\nCURRENT ENROLLMENTS:\n' + enrollments.map(e => `- ${e.subject.code}: ${e.subject.name} (${e.subject.semester?.name || 'N/A'})`).join('\n') : ''}
${upcomingAssignments.length > 0 ? '\nUPCOMING ASSIGNMENTS:\n' + upcomingAssignments.map(a => `- ${a.subject?.code}: ${a.title} (Due: ${new Date(a.dueDate).toLocaleDateString()})`).join('\n') : ''}
${attendanceSummary.length > 0 ? '\nRECENT ATTENDANCE:\n' + [...new Set(attendanceSummary.map(a => `${a.session.subject.code}: ${a.status}`))].slice(0, 10).join('\n') : ''}
${plannerEvents.length > 0 ? '\nUPCOMING EVENTS:\n' + plannerEvents.map(e => `- ${e.title} (${new Date(e.startTime).toLocaleString()})`).join('\n') : ''}
`.trim()

    // Build conversation history messages for the model
    const historyMessages = conversationHistory.slice(-10).flatMap(m => [
      { role: m.role as 'user' | 'assistant', content: m.content }
    ])

    const systemPrompt = `You are ALEX, a personal AI academic assistant for a student. You have access to:
1. Retrieved document sources (primary evidence)
2. User-approved persistent memories (authoritative facts)
3. Academic context (enrollments, assignments, attendance, calendar)
4. Current page context (what the user is viewing)

Guidelines:
- Answer using ONLY the provided sources and memories
- Cite document sources using [Source X] format
- Reference memories as "According to your saved memory..."
- Use academic context to personalize answers (e.g., "For your ${enrollments[0]?.subject?.code} class...")
- Use current page context to provide relevant assistance
- If sources don't contain enough information, say so clearly
- Distinguish between retrieved facts, memories, and your own reasoning
- Be concise but thorough
- Never fabricate citations, page numbers, or memories
- If asked about something not in sources/memories, offer to search or create a memory`

    if (stream && 'generateStream' in chatProvider && typeof chatProvider.generateStream === 'function') {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of chatProvider.generateStream({
              query,
              context: searchResults,
              systemPrompt: systemPrompt + `\n\nConversation History:\n${historyMessages.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nMemories & Academic Context:\n${memoryContext}\n${academicContext}\n\nCurrent Page Context:\n${extraContext || 'None'}`,
            })) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`))
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', citations: [] })}\n\n`))
} catch {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Generation failed' })}\n\n`))
          } finally {
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    const response = await chatProvider.generate({
      query,
      context: searchResults,
      systemPrompt: systemPrompt + `\n\nConversation History:\n${historyMessages.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nMemories & Academic Context:\n${memoryContext}\n${academicContext}\n\nCurrent Page Context:\n${extraContext || 'None'}`,
    })

    // Save to conversation
    if (!targetConversationId) {
      const newConv = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: query.slice(0, 100),
          messages: {
            create: [
              { role: 'user', content: query, senderId: user.id },
              { role: 'assistant', content: response.answer, senderId: user.id, metadata: { citationIds: response.citations.map(c => c.id), sourceIds: response.sources.map(s => s.id) } },
            ],
          },
        },
      })
      targetConversationId = newConv.id
    } else {
      await prisma.message.createMany({
        data: [
          { conversationId: targetConversationId, role: 'user', content: query, senderId: user.id },
          { conversationId: targetConversationId, role: 'assistant', content: response.answer, senderId: user.id, metadata: { citationIds: response.citations.map(c => c.id), sourceIds: response.sources.map(s => s.id) } },
        ],
      })
    }

    return NextResponse.json({ ...response, conversationId: targetConversationId })
  } catch (_error) {
    console.error('RAG query error:', _error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}