import { DocumentType } from '@prisma/client'

export interface ExtractedContent {
  text: string
  pages: PageContent[]
  metadata: Record<string, unknown>
}

export interface PageContent {
  pageNumber: number
  text: string
  tables?: TableData[]
  images?: ImageData[]
}

export interface TableData {
  headers: string[]
  rows: string[][]
  pageNumber: number
}

export interface ImageData {
  pageNumber: number
  imageIndex: number
  mimeType: string
  data: Buffer
}

export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedContent> {
  try {
    interface PDFPage {
  text?: string;
}

    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    
    const pages: PageContent[] = result.pages.map((page: PDFPage, index: number) => ({
      pageNumber: index + 1,
      text: page.text?.trim() || '',
    })).filter((p: PageContent) => p.text.length > 0)

return {
      text: result.text,
      pages,
      metadata: {
        pageCount: result.total,
        info: {},
        metadata: {},
      },
    }
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract text from PDF')
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<ExtractedContent> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    
    return {
      text: result.value,
      pages: [{ pageNumber: 1, text: result.value }],
      metadata: { messages: result.messages },
    }
  } catch (error) {
    console.error('DOCX extraction error:', error)
    throw new Error('Failed to extract text from DOCX')
  }
}

export async function extractTextFromText(buffer: Buffer): Promise<ExtractedContent> {
  const text = buffer.toString('utf-8')
  return {
    text,
    pages: [{ pageNumber: 1, text }],
    metadata: {},
  }
}

export async function extractTextFromMarkdown(buffer: Buffer): Promise<ExtractedContent> {
  const text = buffer.toString('utf-8')
  return {
    text,
    pages: [{ pageNumber: 1, text }],
    metadata: {},
  }
}

export async function extractTextFromCSV(buffer: Buffer): Promise<ExtractedContent> {
  try {
    const Papa = (await import('papaparse')).default
    const text = buffer.toString('utf-8')
    const result = Papa.parse(text, { header: true })
    
    return {
      text: JSON.stringify(result.data, null, 2),
      pages: [{ pageNumber: 1, text: JSON.stringify(result.data, null, 2) }],
      metadata: { rows: result.data.length, errors: result.errors },
    }
  } catch (error) {
    console.error('CSV extraction error:', error)
    throw new Error('Failed to extract text from CSV')
  }
}

export async function extractTextFromExcel(buffer: Buffer): Promise<ExtractedContent> {
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheets: Record<string, unknown[]> = {}
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName]
      sheets[sheetName] = XLSX.utils.sheet_to_json(worksheet)
    })
    
    return {
      text: JSON.stringify(sheets, null, 2),
      pages: [{ pageNumber: 1, text: JSON.stringify(sheets, null, 2) }],
      metadata: { sheets: workbook.SheetNames },
    }
  } catch (error) {
    console.error('Excel extraction error:', error)
    throw new Error('Failed to extract text from Excel')
  }
}

export async function extractTextFromPPTX(buffer: Buffer): Promise<ExtractedContent> {
  // PPTX extraction requires a separate package that may not be installed
  // This is a placeholder implementation
  console.warn('PPTX extraction not fully implemented - install pptx-extractor package for full support')
  throw new Error('PPTX extraction not available. Please install pptx-extractor package or convert to PDF first.')
}

export async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<ExtractedContent> {
  try {
    const Tesseract = (await import('tesseract.js')).default
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
      logger: m => console.log(m),
    })
    
    return {
      text,
      pages: [{ pageNumber: 1, text }],
      metadata: { mimeType },
    }
  } catch (error) {
    console.error('Image OCR error:', error)
    throw new Error('Failed to extract text from image')
  }
}

export async function extractContent(
  buffer: Buffer,
  documentType: DocumentType,
  mimeType: string
): Promise<ExtractedContent> {
  switch (documentType) {
    case DocumentType.PDF:
      return extractTextFromPDF(buffer)
    case DocumentType.DOCX:
      return extractTextFromDocx(buffer)
    case DocumentType.TXT:
    case DocumentType.MARKDOWN:
      return extractTextFromText(buffer)
    case DocumentType.CSV:
      return extractTextFromCSV(buffer)
    case DocumentType.XLS:
    case DocumentType.XLSX:
      return extractTextFromExcel(buffer)
    case DocumentType.PPTX:
      return extractTextFromPPTX(buffer)
    case DocumentType.PNG:
    case DocumentType.JPG:
    case DocumentType.JPEG:
      return extractTextFromImage(buffer, mimeType)
    default:
      return extractTextFromText(buffer)
  }
}

