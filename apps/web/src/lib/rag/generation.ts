import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma-edge'
import { decrypt } from '@/lib/encryption'
import { SearchResult } from './vector-search'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

// Extend the Prisma AIProviderType to include NVIDIA_NEMOTRON and MOCK for local dev
type AIProviderType = PrismaAIProviderType | 'NVIDIA_NEMOTRON' | 'MOCK'

export interface RAGResponse {
  answer: string
  citations: Citation[]
  sources: SearchResult[]
  model: string
  tokenUsage: { prompt: number; completion: number; total: number }
}

export interface Citation {
  id: string
  documentId: string
  documentTitle: string
  pageNumber: number | null
  sectionTitle: string | null
  excerpt: string
  relevanceScore: number
}

export interface GenerationOptions {
  query: string
  context: SearchResult[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

async function getActiveCredential(userId: string, provider: AIProviderType): Promise<AICredential | null> {
  const prismaProvider = provider === 'NVIDIA_NEMOTRON' ? undefined : provider as PrismaAIProviderType | undefined
  return prisma.aICredential.findFirst({
    where: { userId, provider: prismaProvider, isActive: true, isDefault: true },
  })
}

async function getCredentialKey(credential: AICredential): Promise<string> {
  return decrypt(credential.encryptedKey)
}

export class OpenAIChatProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.apiKey = apiKey
    this.model = model
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer questions using ONLY the provided sources. 
- Cite sources using [Source X] format
- If the sources don't contain enough information, say so clearly
- Distinguish between retrieved facts and your own reasoning
- Be concise but thorough
- Never fabricate citations or page numbers`

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        stream: options.stream ?? false,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI chat error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const answer = data.choices[0].message.content

    return {
      answer,
      citations: this.extractCitations(answer, options.context),
      sources: options.context,
      model: this.model,
      tokenUsage: {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      },
    }
  }

  async *generateStream(options: GenerationOptions): AsyncGenerator<string> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer questions using ONLY the provided sources.`

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI chat error: ${error.error?.message || response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    
    if (!reader) return

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices[0]?.delta?.content
            if (content) yield content
          } catch {}
        }
      }
    }
  }

  private extractCitations(answer: string, context: SearchResult[]): Citation[] {
    const citations: Citation[] = []
    const sourceRegex = /\[Source (\d+)\]/g
    let match
    
    while ((match = sourceRegex.exec(answer)) !== null) {
      const sourceIndex = parseInt(match[1]) - 1
      if (sourceIndex >= 0 && sourceIndex < context.length) {
        const source = context[sourceIndex]
        citations.push({
          id: source.id,
          documentId: source.documentId,
          documentTitle: source.document.title,
          pageNumber: source.pageNumber,
          sectionTitle: source.sectionTitle,
          excerpt: source.content.slice(0, 200) + (source.content.length > 200 ? '...' : ''),
          relevanceScore: source.similarity,
        })
      }
    }
    
    return citations
  }
}

export class GoogleChatProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'gemini-1.5-pro') {
    this.apiKey = apiKey
    this.model = model
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer using ONLY the provided sources. Cite sources using [Source X] format.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nQuestion: ${options.query}\n\nSources:\n${contextText}` }] },
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.3,
            maxOutputTokens: options.maxTokens ?? 2000,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Google chat error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const answer = data.candidates[0].content.parts[0].text

    return {
      answer,
      citations: this.extractCitations(answer, options.context),
      sources: options.context,
      model: this.model,
      tokenUsage: {
        prompt: data.usageMetadata?.promptTokenCount || 0,
        completion: data.usageMetadata?.candidatesTokenCount || 0,
        total: data.usageMetadata?.totalTokenCount || 0,
      },
    }
  }

  private extractCitations(answer: string, context: SearchResult[]): Citation[] {
    const citations: Citation[] = []
    const sourceRegex = /\[Source (\d+)\]/g
    let match
    
    while ((match = sourceRegex.exec(answer)) !== null) {
      const sourceIndex = parseInt(match[1]) - 1
      if (sourceIndex >= 0 && sourceIndex < context.length) {
        const source = context[sourceIndex]
        citations.push({
          id: source.id,
          documentId: source.documentId,
          documentTitle: source.document.title,
          pageNumber: source.pageNumber,
          sectionTitle: source.sectionTitle,
          excerpt: source.content.slice(0, 200),
          relevanceScore: source.similarity,
        })
      }
    }
    
    return citations
  }
}

export class AnthropicChatProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey
    this.model = model
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer using ONLY the provided sources. Cite sources using [Source X] format.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` }],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Anthropic chat error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const answer = data.content[0].text

    return {
      answer,
      citations: this.extractCitations(answer, options.context),
      sources: options.context,
      model: this.model,
      tokenUsage: {
        prompt: data.usage.input_tokens,
        completion: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
      },
    }
  }

  private extractCitations(answer: string, context: SearchResult[]): Citation[] {
    const citations: Citation[] = []
    const sourceRegex = /\[Source (\d+)\]/g
    let match
    
    while ((match = sourceRegex.exec(answer)) !== null) {
      const sourceIndex = parseInt(match[1]) - 1
      if (sourceIndex >= 0 && sourceIndex < context.length) {
        const source = context[sourceIndex]
        citations.push({
          id: source.id,
          documentId: source.documentId,
          documentTitle: source.document.title,
          pageNumber: source.pageNumber,
          sectionTitle: source.sectionTitle,
          excerpt: source.content.slice(0, 200),
          relevanceScore: source.similarity,
        })
      }
    }
    
    return citations
  }
}

export class NemotronChatProvider {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model = 'nvidia/nemotron-3-ultra') {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })
    this.model = model
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer questions using ONLY the provided sources. 
- Cite sources using [Source X] format
- If the sources don't contain enough information, say so clearly
- Distinguish between retrieved facts and your own reasoning
- Be concise but thorough
- Never fabricate citations or page numbers`

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
    ]

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
      stream: false,
    })

    if (!response.choices[0]?.message?.content) {
      throw new Error('Nemotron returned empty response')
    }

    const answer = response.choices[0].message.content

    return {
      answer,
      citations: this.extractCitations(answer, options.context),
      sources: options.context,
      model: this.model,
      tokenUsage: {
        prompt: response.usage?.prompt_tokens ?? 0,
        completion: response.usage?.completion_tokens ?? 0,
        total: response.usage?.total_tokens ?? 0,
      },
    }
  }

  async *generateStream(options: GenerationOptions): AsyncGenerator<string> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer questions using ONLY the provided sources.`

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
    ]

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) yield content
    }
  }

  private extractCitations(answer: string, context: SearchResult[]): Citation[] {
    const citations: Citation[] = []
    const sourceRegex = /\[Source (\d+)\]/g
    let match
    
    while ((match = sourceRegex.exec(answer)) !== null) {
      const sourceIndex = parseInt(match[1]) - 1
      if (sourceIndex >= 0 && sourceIndex < context.length) {
        const source = context[sourceIndex]
        citations.push({
          id: source.id,
          documentId: source.documentId,
          documentTitle: source.document.title,
          pageNumber: source.pageNumber,
          sectionTitle: source.sectionTitle,
          excerpt: source.content.slice(0, 200) + (source.content.length > 200 ? '...' : ''),
          relevanceScore: source.similarity,
        })
      }
    }
    
    return citations
  }
}

export class MockChatProvider {
  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    // Mock response based on query
    const answer = this.generateMockResponse(options.query, contextText)

    return {
      answer,
      citations: [],
      sources: options.context,
      model: 'mock',
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
    }
  }

  async *generateStream(options: GenerationOptions): AsyncGenerator<string> {
    const answer = this.generateMockResponse(options.query, 
      options.context.map((c, i) => 
        `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
      ).join('\n\n---\n\n')
    )
    
    // Simulate streaming
    const words = answer.split(' ')
    for (const word of words) {
      yield word + ' '
      await new Promise(resolve => setTimeout(resolve, 30))
    }
  }

  private generateMockResponse(query: string, context: string): string {
    const lowerQuery = query.toLowerCase()
    
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      return 'Hello! I\'m running in mock mode (no AI provider configured). I can help you explore the ALEX platform. Try asking about your documents, assignments, or academic schedule!'
    }
    
    if (lowerQuery.includes('mock') || lowerQuery.includes('test')) {
      return 'Mock mode is working! This is a simulated response for local development testing.'
    }
    
    if (context && context.length > 0) {
      return `Based on your documents (mock response): ${context.slice(0, 300)}...\n\nNote: This is a mock response. Configure an AI provider in Settings â†’ AI Settings for real AI responses.`
    }
    
    return `I'm running in mock mode for local development. To get real AI responses, configure an AI provider (NVIDIA Nemotron, OpenAI, Gemini, etc.) in Settings â†’ AI Settings. Your question was: "${query}"`
  }
}

export function createChatProvider(
  provider: AIProviderType,
  apiKey: string,
  model?: string
) {
  switch (provider) {
    case 'OPENAI':
      return new OpenAIChatProvider(apiKey, model)
    case 'GOOGLE_GEMINI':
      return new GoogleChatProvider(apiKey, model)
    case 'ANTHROPIC':
      return new AnthropicChatProvider(apiKey, model)
    case 'NVIDIA_NEMOTRON':
      return new NemotronChatProvider(apiKey, model)
    case 'MOCK':
      return new MockChatProvider()
    default:
      throw new Error(`Unsupported chat provider: ${provider}`)
  }
}

export async function getUserChatProvider(
  userId: string,
  provider?: AIProviderType
) {
  // Cast provider to Prisma's AIProviderType for the query, filtering out NVIDIA_NEMOTRON and MOCK
  const prismaProvider = provider === 'NVIDIA_NEMOTRON' || provider === 'MOCK' ? undefined : provider as PrismaAIProviderType | undefined
  
  const cred = await prisma.aICredential.findFirst({
    where: {
      userId,
      provider: prismaProvider,
      isActive: true,
      isDefault: true,
    },
  })

  if (!cred) {
    if (process.env.AI_MODE === 'nemotron' && process.env.NVIDIA_NEMOTRON_API_KEY) {
      return new NemotronChatProvider(process.env.NVIDIA_NEMOTRON_API_KEY, process.env.NVIDIA_NEMOTRON_MODEL || 'nvidia/nemotron-3-ultra')
    }
    // Return an explicitly local mock provider without API keys
    return new MockChatProvider()
  }

  const apiKey = await getCredentialKey(cred)
  const modelConfig = await prisma.aIModelConfig.findFirst({
    where: { userId, provider: cred.provider as PrismaAIProviderType, taskType: 'chat', isDefault: true },
  })

  return createChatProvider(cred.provider as AIProviderType, apiKey, modelConfig?.modelId)
}


