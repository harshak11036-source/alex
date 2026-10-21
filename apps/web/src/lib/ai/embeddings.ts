import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma-edge-edge'
import { decrypt } from '@/lib/encryption'

// Extend for local development mock provider
type AIProviderType = PrismaAIProviderType | 'MOCK'

export interface EmbeddingResult {
  embeddings: number[][]
  tokenCount: number
  model: string
}

export interface EmbeddingProvider {
  generateEmbeddings(texts: string[]): Promise<EmbeddingResult>
}

async function getActiveCredential(userId: string, provider: PrismaAIProviderType): Promise<AICredential | null> {
  return prisma.aICredential.findFirst({
    where: { userId, provider, isActive: true, isDefault: true },
  })
}

async function getCredentialKey(credential: AICredential): Promise<string> {
  return decrypt(credential.encryptedKey)
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'text-embedding-3-small') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        encoding_format: 'float',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI embeddings error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      tokenCount: data.usage.total_tokens,
      model: this.model,
    }
  }
}

export class GoogleEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'text-embedding-004') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: `models/${this.model}`,
            content: { parts: [{ text }] },
          })),
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Google embeddings error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return {
      embeddings: data.embeddings?.map((e: { values: number[] }) => e.values) || [],
      tokenCount: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: this.model,
    }
  }
}

export class MistralEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'mistral-embed') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Mistral embeddings error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      tokenCount: data.usage.total_tokens,
      model: this.model,
    }
  }
}

export function createEmbeddingProvider(
  provider: AIProviderType,
  apiKey: string,
  model?: string
): EmbeddingProvider {
  switch (provider) {
    case 'OPENAI':
      return new OpenAIEmbeddingProvider(apiKey, model)
    case 'GOOGLE_GEMINI':
      return new GoogleEmbeddingProvider(apiKey, model)
    case 'MISTRAL':
      return new MistralEmbeddingProvider(apiKey, model)
    case 'MOCK':
      return new MockEmbeddingProvider()
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`)
  }
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    // Generate deterministic mock embeddings based on text content
    const embeddings = texts.map(text => {
      // Simple hash-based embedding for consistency
      let hash = 0
      for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i)
        hash |= 0
      }
      
      // Generate 1536-dimensional vector (matching OpenAI)
      const embedding = new Array(1536).fill(0).map((_, i) => {
        const val = Math.sin(hash + i) * 0.5
        return val
      })
      
      // Normalize
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
      return embedding.map(val => val / (norm || 1))
    })
    
    return {
      embeddings,
      tokenCount: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: 'mock',
    }
  }
}

export async function getUserEmbeddingProvider(
  userId: string,
  provider?: AIProviderType
): Promise<{ provider: EmbeddingProvider; model: string; credential: AICredential } | null> {
  const cred = await prisma.aICredential.findFirst({
    where: {
      userId,
      provider: provider as PrismaAIProviderType | undefined,
      isActive: true,
      isDefault: true,
    },
  })

  if (!cred) {
    // Return mock embedding provider for local development
    return {
      provider: new MockEmbeddingProvider(),
      model: 'mock',
      credential: null as any,
    }
  }

  const apiKey = await getCredentialKey(cred)
  const modelConfig = await prisma.aIModelConfig.findFirst({
    where: { userId, provider: cred.provider, taskType: 'embeddings', isDefault: true },
  })

  const embeddingProvider = createEmbeddingProvider(cred.provider, apiKey, modelConfig?.modelId)
  
  return {
    provider: embeddingProvider,
    model: modelConfig?.modelId || (cred.provider === 'OPENAI' ? 'text-embedding-3-small' : 'default'),
    credential: cred,
  }
}

