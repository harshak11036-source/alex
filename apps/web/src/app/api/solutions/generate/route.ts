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
    const { question, sourceDocumentIds, supportingDocumentIds, answerMode, subjectId } = body

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }
    if (!sourceDocumentIds || !Array.isArray(sourceDocumentIds) || sourceDocumentIds.length === 0) {
      return NextResponse.json({ error: 'At least one source document is required' }, { status: 400 })
    }

    const chatProvider = await getUserChatProvider(user.id)
    if (!chatProvider) {
      return NextResponse.json({ error: 'No AI provider configured for chat' }, { status: 400 })
    }

    // Verify document access
    const docs = await prisma.document.findMany({
      where: { id: { in: [...sourceDocumentIds, ...supportingDocumentIds] } },
      select: { id: true, ownerId: true },
    })
    const unauthorized = docs.some(d => d.ownerId !== user.id)
    if (unauthorized) {
      return NextResponse.json({ error: 'Unauthorized access to documents' }, { status: 403 })
    }

    // Perform hybrid search on source documents
    const searchResults = await hybridSearch({
      query: question,
      userId: user.id,
      subjectId,
      documentIds: sourceDocumentIds,
      limit: 15,
      threshold: 0.6,
    })

    // Also search supporting documents
    let supportingResults: Awaited<ReturnType<typeof hybridSearch>> = []
    if (supportingDocumentIds.length > 0) {
      supportingResults = await hybridSearch({
        query: question,
        userId: user.id,
        subjectId,
        documentIds: supportingDocumentIds,
        limit: 10,
        threshold: 0.5,
      })
    }

    const allResults = [...searchResults, ...supportingResults]

    if (allResults.length === 0) {
      return NextResponse.json({
        error: 'No relevant information found in the selected documents',
        answer: 'I could not find any relevant information in your selected documents to answer this question.',
        citations: [],
        sources: [],
      }, { status: 404 })
    }

    // Build context for the model
    const primaryContext = searchResults.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const supportingContext = supportingResults.length > 0 
      ? '\n\nSUPPORTING REFERENCES:\n' + supportingResults.map((c, i) => 
          `[Ref ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
        ).join('\n\n---\n\n')
      : ''

    // Build system prompt based on answer mode
    const modePrompts = {
      short: `Provide a concise, direct answer. Include only the essential steps and final result.`,
      exam: `Provide a structured answer suitable for an exam response. Include: key definitions, relevant formulas, step-by-step derivation, and final answer clearly marked.`,
      detailed: `Provide a comprehensive, detailed solution. Include: topic overview, all relevant definitions, formulas with explanations, step-by-step calculations, tables where appropriate, diagram descriptions, and final answer with verification.`,
    }

    const systemPrompt = `You are ALEX, an expert academic solution generator. Generate a structured solution for the given question using ONLY the provided sources.

ANSWER MODE: ${answerMode.toUpperCase()}
${modePrompts[answerMode as keyof typeof modePrompts]}

OUTPUT FORMAT (JSON):
{
  "questionNumber": "1",
  "originalQuestion": "${question}",
  "topic": "Main topic/subject area",
  "explanation": "Clear explanation of the approach and key concepts",
  "definitions": ["Definition 1", "Definition 2", ...],
  "formulas": ["Formula 1", "Formula 2", ...],
  "calculations": "Step-by-step mathematical derivations",
  "tables": [{"headers": ["col1", "col2"], "rows": [["val1", "val2"]]}],
  "diagrams": [{"type": "mermaid|graphviz|plantuml|description", "definition": "diagram code or description", "title": "Diagram title"}],
  "finalAnswer": "Final answer clearly stated",
  "citations": [{"id": "source-id", "documentTitle": "Title", "pageNumber": 1, "excerpt": "relevant excerpt"}]
}

RULES:
- Use ONLY information from the provided sources
- Cite sources using [Source X] format in explanations
- If sources don't support an answer, state "Not supported by sources"
- Never fabricate citations, page numbers, or formulas
- Distinguish between source-derived claims and general knowledge
- For diagrams, provide actual Mermaid/GraphViz code when applicable`

    const response = await chatProvider.generate({
      query: question,
      context: allResults,
      systemPrompt,
      temperature: 0.2,
      maxTokens: 4000,
    })

    // Parse the JSON response
    let solutionData
    try {
      // Extract JSON from the response (handle potential markdown code blocks)
      const jsonMatch = response.answer.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : response.answer
      solutionData = JSON.parse(jsonStr)
    } catch (_parseError) {
      // Fallback: structure the response manually
      solutionData = {
        questionNumber: "1",
        originalQuestion: question,
        topic: "General",
        explanation: response.answer,
        definitions: [],
        formulas: [],
        calculations: "",
        tables: [],
        diagrams: [],
        finalAnswer: response.answer,
        citations: response.citations,
      }
    }

    // Ensure citations are properly formatted
    solutionData.citations = response.citations.map((c: any, i: number) => ({
      id: c.id || allResults[i]?.id || `cite-${i}`,
      documentTitle: c.documentTitle || allResults[i]?.document?.title || "Unknown",
      pageNumber: c.pageNumber || allResults[i]?.pageNumber || null,
      excerpt: c.excerpt || allResults[i]?.content?.slice(0, 200) || "",
    }))

    solutionData.sources = allResults.map(r => ({
      id: r.id,
      documentId: r.documentId,
      content: r.content,
      pageNumber: r.pageNumber,
      similarity: r.similarity,
    }))
    solutionData.answerMode = answerMode
    solutionData.generatedAt = new Date().toISOString()

    return NextResponse.json(solutionData)
  } catch (error) {
    console.error('Solution generation error:', error)
    return NextResponse.json({ error: 'Solution generation failed' }, { status: 500 })
  }
}