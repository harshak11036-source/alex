import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getUserChatProvider } from '@/lib/rag/generation'
import { hybridSearch } from '@/lib/rag/vector-search'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      sourceType, 
      prompt, 
      title, 
      outputFormat, 
      includeDiagrams, 
      includeTables, 
      includeCitations,
      templateId,
      templateVariables,
    } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const chatProvider = await getUserChatProvider(user.id)
    if (!chatProvider) {
      return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 })
    }

    let searchResults: any[] = []
    let context = ""

    // If RAG-based, search documents
    if (sourceType === "rag") {
      searchResults = await hybridSearch({
        query: prompt,
        userId: user.id,
        limit: 10,
        threshold: 0.6,
      })
      context = searchResults.map((c, i) => 
        `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
      ).join('\n\n---\n\n')
    }

    // Build system prompt based on output format
    const formatPrompts = {
      markdown: "Generate a well-structured Markdown document with proper headings, lists, code blocks, and tables.",
      html: "Generate a complete HTML document with semantic markup, proper styling, and responsive design.",
      pdf: "Generate content suitable for PDF export with clear page structure.",
      docx: "Generate content suitable for Word document with proper formatting hints.",
    }

    const featurePrompts = []
    if (includeDiagrams) featurePrompts.push("Include Mermaid diagram code blocks where appropriate")
    if (includeTables) featurePrompts.push("Include well-formatted tables with headers")
    if (includeCitations && searchResults.length > 0) featurePrompts.push("Cite sources using [Source X] format")

    const systemPrompt = `You are ALEX, a professional document generator. Create a high-quality ${outputFormat} document based on the user's request.

FORMAT: ${outputFormat.toUpperCase()}
${formatPrompts[outputFormat as keyof typeof formatPrompts]}

FEATURES:
${featurePrompts.map(f => `- ${f}`).join('\n')}

RULES:
- Create professional, well-structured content
- Use appropriate formatting for the output format
- Be comprehensive but concise
- Include practical examples where relevant
- Maintain consistent style and tone
${context ? `\nUSE THE FOLLOWING SOURCES:\n${context}` : ''}`

    const response = await chatProvider.generate({
      query: prompt,
      context: searchResults,
      systemPrompt,
      temperature: 0.3,
      maxTokens: 4000,
    })

    // Parse sections from the response
    const sections = parseSections(response.answer)

    const document: any = {
      id: `doc-${Date.now()}`,
      title: title || "Generated Document",
      content: response.answer,
      format: outputFormat,
      sections,
      metadata: {
        wordCount: response.answer.split(/\s+/).length,
        readingTime: Math.ceil(response.answer.split(/\s+/).length / 200),
        createdAt: new Date().toISOString(),
      },
    }

    // Add citations if available
    if (includeCitations && response.citations.length > 0) {
      document.citations = response.citations
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Document generation error:', error)
    return NextResponse.json({ error: 'Document generation failed' }, { status: 500 })
  }
}

function parseSections(content: string): Array<{
  id: string
  type: "heading" | "paragraph" | "list" | "table" | "code" | "diagram" | "quote"
  content: any
  level?: number
}> {
  const sections: Array<{
    id: string
    type: "heading" | "paragraph" | "list" | "table" | "code" | "diagram" | "quote"
    content: any
    level?: number
  }> = []

  const lines = content.split('\n')
  let currentSection: any = null
  let inCodeBlock = false
  let codeContent = ""
  let codeLang = ""

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Handle code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLang = line.slice(3).trim()
        codeContent = ""
      } else {
        inCodeBlock = false
        sections.push({
          id: `section-${sections.length}`,
          type: "code",
          content: { code: codeContent, language: codeLang },
        })
        codeContent = ""
      }
      continue
    }
    
    if (inCodeBlock) {
      codeContent += line + '\n'
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      sections.push({
        id: `section-${sections.length}`,
        type: "heading",
        content: headingMatch[2],
        level: headingMatch[1].length,
      })
      continue
    }

    // Tables (simple detection)
    if (line.includes('|') && line.includes('---')) {
      // This is a table row, collect full table
      const tableLines = [line]
      let j = i + 1
      while (j < lines.length && (lines[j].includes('|') || lines[j].trim() === '')) {
        if (lines[j].trim()) tableLines.push(lines[j])
        j++
      }
      i = j - 1
      sections.push({
        id: `section-${sections.length}`,
        type: "table",
        content: tableLines.join('\n'),
      })
      continue
    }

    // Mermaid diagrams
    if (line.trim().startsWith('```mermaid')) {
      // Already handled by code block above
      continue
    }

    // Regular paragraphs
    if (line.trim()) {
      if (!currentSection || currentSection.type !== "paragraph") {
        currentSection = {
          id: `section-${sections.length}`,
          type: "paragraph",
          content: "",
        }
        sections.push(currentSection)
      }
      currentSection.content += (currentSection.content ? '\n' : '') + line
    } else {
      currentSection = null
    }
  }

  // If no sections were parsed, create one from the whole content
  if (sections.length === 0 && content.trim()) {
    sections.push({
      id: `section-${sections.length}`,
      type: "paragraph",
      content: content.trim(),
    })
  }

  return sections
}