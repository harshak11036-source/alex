import { DocumentType } from '@prisma/client'

export interface ChunkOptions {
  chunkSize?: number
  chunkOverlap?: number
  separators?: string[]
}

export interface DocumentChunk {
  content: string
  chunkIndex: number
  pageNumber?: number
  sectionTitle?: string
  tokenCount: number
  metadata: Record<string, unknown>
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '],
}

function countTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function splitText(text: string, separators: string[]): string[] {
  if (separators.length === 0) return [text]
  
  const separator = separators[0]
  const parts = text.split(separator)
  
  if (parts.length === 1) {
    return splitText(text, separators.slice(1))
  }
  
  const result: string[] = []
  let current = ''
  
  for (const part of parts) {
    const testChunk = current + (current ? separator : '') + part
    if (countTokens(testChunk) > 1000 && current) {
      result.push(current)
      current = part
    } else {
      current = testChunk
    }
  }
  
  if (current) result.push(current)
  return result
}

export function chunkContent(
  content: string,
  pages: { pageNumber: number; text: string }[],
  options: ChunkOptions = {}
): DocumentChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const chunks: DocumentChunk[] = []
  let chunkIndex = 0
  let currentPosition = 0
  
  const textSegments = pages.map(p => ({
    pageNumber: p.pageNumber,
    text: p.text,
    startPos: currentPosition,
    endPos: currentPosition + p.text.length,
  }))
  currentPosition += pages.reduce((sum, p) => sum + p.text.length + 2, 0)
  
  const fullText = pages.map(p => p.text).join('\n\n')
  const segments = splitText(fullText, opts.separators)
  
  let currentChunk = ''
  
  for (const segment of segments) {
    const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + segment
    const tokenCount = countTokens(testChunk)
    
    if (tokenCount > opts.chunkSize && currentChunk) {
      const pageNumber = findPageForPosition(
        fullText.indexOf(currentChunk),
        textSegments
      )
      
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        pageNumber,
        tokenCount: countTokens(currentChunk),
        metadata: {},
        sectionTitle: extractSectionTitle(currentChunk),
      })
      
      const overlapText = getOverlapText(currentChunk, opts.chunkOverlap)
      currentChunk = overlapText + '\n\n' + segment
    } else {
      currentChunk = testChunk
    }
  }
  
  if (currentChunk.trim()) {
    const pageNumber = findPageForPosition(
      fullText.indexOf(currentChunk),
      textSegments
    )
    
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex: chunkIndex++,
      pageNumber,
      tokenCount: countTokens(currentChunk),
      metadata: {},
      sectionTitle: extractSectionTitle(currentChunk),
    })
  }
  
  return chunks
}

function findPageForPosition(position: number, segments: { pageNumber: number; startPos: number; endPos: number }[]): number {
  for (const segment of segments) {
    if (position >= segment.startPos && position < segment.endPos) {
      return segment.pageNumber
    }
  }
  return segments[0]?.pageNumber || 1
}

function getOverlapText(text: string, overlapTokens: number): string {
  const words = text.split(/\s+/)
  const overlapWords = Math.min(words.length, Math.ceil(overlapTokens / 4))
  return words.slice(-overlapWords).join(' ')
}

function extractSectionTitle(text: string): string | undefined {
  const lines = text.split('\n').filter(l => l.trim())
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length < 100 && /^[A-Z][^.]*$/.test(trimmed)) {
      return trimmed
    }
  }
  return undefined
}

export function chunkBySemanticUnits(
  content: string,
  pages: { pageNumber: number; text: string }[],
  options: ChunkOptions = {}
): DocumentChunk[] {
  return chunkContent(content, pages, options)
}

