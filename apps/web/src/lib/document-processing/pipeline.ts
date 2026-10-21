import { prisma } from '@/lib/prisma'
import { DocumentStatus, DocumentType } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { extractContent } from '@/lib/document-processing/extractors'
import { chunkBySemanticUnits } from '@/lib/document-processing/chunker'
import { getUserEmbeddingProvider } from '@/lib/ai/embeddings'
import { uploadFile } from '@/lib/storage/client'

export interface ProcessingContext {
  documentId: string
  userId: string
  fileBuffer: Buffer
  fileName: string
  mimeType: string
  documentType: DocumentType
  subjectId?: string
  projectId?: string
  notebookId?: string
}

export async function processDocument(context: ProcessingContext): Promise<void> {
  const { documentId, userId, fileBuffer, fileName, mimeType, documentType, subjectId, projectId, notebookId } = context

  try {
    await updateStatus(documentId, DocumentStatus.EXTRACTING)
    
    const extracted = await extractContent(fileBuffer, documentType, mimeType)
    const pageCount = extracted.pages.length

    await prisma.document.update({
      where: { id: documentId },
      data: {
        pageCount,
        metadata: extracted.metadata as Prisma.InputJsonValue,
        status: DocumentStatus.CHUNKING,
      },
    })

    await updateStatus(documentId, DocumentStatus.CHUNKING)
    
    const chunks = chunkBySemanticUnits(extracted.text, extracted.pages)

    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.EMBEDDING },
    })

    await updateStatus(documentId, DocumentStatus.EMBEDDING)
    
    const embeddingProvider = await getUserEmbeddingProvider(userId)
    if (!embeddingProvider) {
      throw new Error('No embedding provider configured for user')
    }

    const chunkTexts = chunks.map(c => c.content)
    const { embeddings, tokenCount } = await embeddingProvider.provider.generateEmbeddings(chunkTexts)

    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.INDEXING },
    })

    await updateStatus(documentId, DocumentStatus.INDEXING)

    await prisma.$transaction(async (tx) => {
      const createdChunks: { id: string; chunkIndex: number }[] = []
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        
        const created = await tx.documentChunk.create({
          data: {
            documentId,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            sectionTitle: chunk.sectionTitle,
            tokenCount: chunk.tokenCount,
            metadata: chunk.metadata as Prisma.InputJsonValue,
          },
        })
        createdChunks.push({ id: created.id, chunkIndex: chunk.chunkIndex })
      }

      // Update embeddings using raw SQL since Prisma doesn't support vector type
      for (let i = 0; i < createdChunks.length; i++) {
        const chunk = createdChunks[i]
        const embedding = embeddings[i]
        const embeddingStr = '[' + embedding.join(',') + ']'
        await tx.$executeRawUnsafe(`UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2`, embeddingStr, chunk.id)
      }

      await tx.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
          processedAt: new Date(),
          processorId: userId,
        },
      })
    })

    await prisma.documentProcessingJob.create({
      data: {
        documentId,
        step: 'completed',
        status: DocumentStatus.READY,
        completedAt: new Date(),
        metadata: { chunksCreated: chunks.length, tokensUsed: tokenCount },
      },
    })
  } catch (error) {
    console.error('Document processing error:', error)
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    
    await prisma.documentProcessingJob.create({
      data: {
        documentId,
        step: 'failed',
        status: DocumentStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    })
    throw error
  }
}

async function updateStatus(documentId: string, status: DocumentStatus) {
  await prisma.documentProcessingJob.create({
    data: {
      documentId,
      step: status.toLowerCase(),
      status,
      startedAt: new Date(),
    },
  })
}

export async function createDocumentRecord(
  userId: string,
  file: File,
  subjectId?: string,
  projectId?: string,
  notebookId?: string
) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  const crypto = await import('crypto')
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
  
  const documentType = getDocumentType(file.name, file.type)
  const storagePath = `${userId}/${Date.now()}-${file.name}`

  await uploadFile(
    process.env.STORAGE_BUCKET_DOCUMENTS || 'documents',
    storagePath,
    file,
    { contentType: file.type }
  )

  const document = await prisma.document.create({
    data: {
      title: file.name,
      fileName: file.name,
      fileSize: BigInt(file.size),
      mimeType: file.type,
      documentType,
      storagePath,
      storageBucket: process.env.STORAGE_BUCKET_DOCUMENTS || 'documents',
      checksum,
      ownerId: userId,
      subjectId,
      projectId,
      notebookId,
      status: DocumentStatus.UPLOADED,
    },
  })

  return { document, buffer, storagePath }
}

function getDocumentType(fileName: string, mimeType: string): DocumentType {
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  const typeMap: Record<string, DocumentType> = {
    pdf: DocumentType.PDF,
    doc: DocumentType.DOC,
    docx: DocumentType.DOCX,
    txt: DocumentType.TXT,
    md: DocumentType.MARKDOWN,
    csv: DocumentType.CSV,
    xls: DocumentType.XLS,
    xlsx: DocumentType.XLSX,
    ppt: DocumentType.PPT,
    pptx: DocumentType.PPTX,
    png: DocumentType.PNG,
    jpg: DocumentType.JPG,
    jpeg: DocumentType.JPEG,
  }
  
  return typeMap[ext || ''] || DocumentType.OTHER
}

export async function reprocessDocument(documentId: string, userId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  if (!document) throw new Error('Document not found')
  if (document.ownerId !== userId) throw new Error('Unauthorized')

  await prisma.documentChunk.deleteMany({ where: { documentId } })
  await prisma.documentProcessingJob.deleteMany({ where: { documentId } })

  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.QUEUED },
  })

  const file = await downloadFile(document.storageBucket, document.storagePath)
  const buffer = Buffer.from(await file.arrayBuffer())

  await processDocument({
    documentId,
    userId,
    fileBuffer: buffer,
    fileName: document.fileName,
    mimeType: document.mimeType,
    documentType: document.documentType,
    subjectId: document.subjectId || undefined,
    projectId: document.projectId || undefined,
    notebookId: document.notebookId || undefined,
  })
}

async function downloadFile(bucket: string, path: string): Promise<Blob> {
  const { downloadFile } = await import('@/lib/storage/client')
  return downloadFile(bucket, path)
}
