import { prisma } from '@/lib/prisma-edge-edge'
import { getUserEmbeddingProvider } from '@/lib/ai/embeddings'
import { Prisma } from '@prisma/client'

export interface SearchOptions {
  query: string
  userId: string
  subjectId?: string
  projectId?: string
  notebookId?: string
  documentIds?: string[]
  limit?: number
  threshold?: number
  filter?: Record<string, unknown>
}

export interface SearchResult {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  pageNumber: number | null
  sectionTitle: string | null
  similarity: number
  metadata: Record<string, unknown>
  document: {
    id: string
    title: string
    fileName: string
    documentType: string
    ownerId: string
  }
}

interface RawSearchResult {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  pageNumber: number | null
  sectionTitle: string | null
  similarity: number
  metadata: Record<string, unknown>
  document_id: string
  document_title: string
  document_fileName: string
  document_documentType: string
  document_ownerId: string
}

export async function vectorSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, userId, subjectId, projectId, notebookId, documentIds, limit = 10, threshold = 0.7 } = options

  const embeddingProvider = await getUserEmbeddingProvider(userId)
  if (!embeddingProvider) {
    // No embedding provider available, return empty results
    // Keyword search will still work
    return []
  }

  try {
    const { embeddings } = await embeddingProvider.provider.generateEmbeddings([query])
    const queryEmbedding = embeddings[0]

    const chunks = await prisma.$queryRaw<RawSearchResult[]>`
      SELECT 
        dc.id,
        dc."documentId",
        dc.content,
        dc."chunkIndex",
        dc."pageNumber",
        dc."sectionTitle",
        1 - (dc.embedding <=> ${queryEmbedding}::vector) as similarity,
        dc.metadata,
        d.id as "document_id",
        d.title as "document_title",
        d."fileName" as "document_fileName",
        d."documentType" as "document_documentType",
        d."ownerId" as "document_ownerId"
      FROM "DocumentChunk" dc
      JOIN "Document" d ON dc."documentId" = d.id
      WHERE 1 - (dc.embedding <=> ${queryEmbedding}::vector) >= ${threshold}
      AND (
        d."ownerId" = ${userId}
        OR EXISTS (
          SELECT 1 FROM "SubjectEnrollment" se 
          WHERE se."subjectId" = d."subjectId" 
          AND se."userId" = ${userId} 
          AND se."isActive" = true
        )
        OR EXISTS (
          SELECT 1 FROM "ProjectMember" pm 
          WHERE pm."projectId" = d."projectId" 
          AND pm."userId" = ${userId}
        )
        OR EXISTS (
          SELECT 1 FROM "ResearchNotebook" rn 
          WHERE rn.id = d."notebookId" 
          AND rn."ownerId" = ${userId}
        )
      )
      ${subjectId ? Prisma.sql`AND d."subjectId" = ${subjectId}` : Prisma.empty}
      ${projectId ? Prisma.sql`AND d."projectId" = ${projectId}` : Prisma.empty}
      ${notebookId ? Prisma.sql`AND d."notebookId" = ${notebookId}` : Prisma.empty}
      ${documentIds && documentIds.length > 0 ? Prisma.sql`AND d.id IN (${Prisma.join(documentIds)})` : Prisma.empty}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `

    return chunks.map(chunk => ({
      id: chunk.id,
      documentId: chunk.documentId,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      sectionTitle: chunk.sectionTitle,
      similarity: Number(chunk.similarity),
      metadata: chunk.metadata,
      document: {
        id: chunk.document_id,
        title: chunk.document_title,
        fileName: chunk.document_fileName,
        documentType: chunk.document_documentType,
        ownerId: chunk.document_ownerId,
      },
    }))
  } catch (error) {
    // Vector search failed (e.g., pgvector not available in SQLite)
    // Fall back to keyword search only
    console.warn('Vector search failed, falling back to keyword search:', error)
    return []
  }
}

export async function keywordSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, userId, subjectId, projectId, notebookId, documentIds, limit = 10 } = options

  if ((process.env.DATABASE_URL || '').startsWith('file:')) {
    const rows = await prisma.documentChunk.findMany({ where: { document: { ownerId: userId, ...(subjectId ? { subjectId } : {}), ...(projectId ? { projectId } : {}), ...(notebookId ? { notebookId } : {}), ...(documentIds?.length ? { id: { in: documentIds } } : {}) } }, include: { document: true }, take: 500 })
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return rows.map(row => ({ row, score: terms.filter(term => row.content.toLowerCase().includes(term)).length / Math.max(terms.length, 1) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ row, score }) => ({ id: row.id, documentId: row.documentId, content: row.content, chunkIndex: row.chunkIndex, pageNumber: row.pageNumber, sectionTitle: row.sectionTitle, similarity: score, metadata: (row.metadata || {}) as Record<string, unknown>, document: { id: row.document.id, title: row.document.title, fileName: row.document.fileName, documentType: row.document.documentType, ownerId: row.document.ownerId } }))
  }
  const chunks = await prisma.$queryRaw<RawSearchResult[]>`
    SELECT 
      dc.id,
      dc."documentId",
      dc.content,
      dc."chunkIndex",
      dc."pageNumber",
      dc."sectionTitle",
      ts_rank_cd(to_tsvector('english', dc.content), websearch_to_tsquery('english', ${query})) as similarity,
      dc.metadata,
      d.id as "document_id",
      d.title as "document_title",
      d."fileName" as "document_fileName",
      d."documentType" as "document_documentType",
      d."ownerId" as "document_ownerId"
    FROM "DocumentChunk" dc
    JOIN "Document" d ON dc."documentId" = d.id
    WHERE to_tsvector('english', dc.content) @@ websearch_to_tsquery('english', ${query})
    AND (
      d."ownerId" = ${userId}
      OR EXISTS (
        SELECT 1 FROM "SubjectEnrollment" se 
        WHERE se."subjectId" = d."subjectId" 
        AND se."userId" = ${userId} 
        AND se."isActive" = true
      )
      OR EXISTS (
        SELECT 1 FROM "ProjectMember" pm 
        WHERE pm."projectId" = d."projectId" 
        AND pm."userId" = ${userId}
      )
      OR EXISTS (
        SELECT 1 FROM "ResearchNotebook" rn 
        WHERE rn.id = d."notebookId" 
        AND rn."ownerId" = ${userId}
      )
    )
    ${subjectId ? Prisma.sql`AND d."subjectId" = ${subjectId}` : Prisma.empty}
    ${projectId ? Prisma.sql`AND d."projectId" = ${projectId}` : Prisma.empty}
    ${notebookId ? Prisma.sql`AND d."notebookId" = ${notebookId}` : Prisma.empty}
    ${documentIds && documentIds.length > 0 ? Prisma.sql`AND d.id IN (${Prisma.join(documentIds)})` : Prisma.empty}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `

  return chunks.map(chunk => ({
    id: chunk.id,
    documentId: chunk.documentId,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber,
    sectionTitle: chunk.sectionTitle,
    similarity: Number(chunk.similarity),
    metadata: chunk.metadata,
    document: {
      id: chunk.document_id,
      title: chunk.document_title,
      fileName: chunk.document_fileName,
      documentType: chunk.document_documentType,
      ownerId: chunk.document_ownerId,
    },
  }))
}

export async function hybridSearch(options: SearchOptions): Promise<SearchResult[]> {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(options),
    keywordSearch(options),
  ])

  const combined = new Map<string, SearchResult>()
  
  for (const result of vectorResults) {
    combined.set(result.id, { ...result, similarity: result.similarity * 0.7 })
  }
  
  for (const result of keywordResults) {
    const existing = combined.get(result.id)
    if (existing) {
      existing.similarity = Math.max(existing.similarity, result.similarity * 0.3)
    } else {
      combined.set(result.id, { ...result, similarity: result.similarity * 0.3 })
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options.limit || 10)
}

export async function rerankResults(
  query: string,
  results: SearchResult[],
  userId: string
): Promise<SearchResult[]> {
  return results
}


