import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const supabase = await createServerClientSupabase(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const segments = await params; const [bucket, ...fileParts] = segments.path || []; const filePath = fileParts.join('/')
  const document = await prisma.document.findFirst({ where: { storageBucket: bucket, storagePath: filePath } })
  if (!document || document.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const root = path.resolve(process.cwd(), 'storage'); const target = path.resolve(root, bucket, filePath)
  if (!target.startsWith(root + path.sep)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  try { return new NextResponse(await readFile(target), { headers: { 'Content-Type': document.mimeType || 'application/octet-stream', 'Content-Disposition': `inline; filename="${document.fileName.replace(/"/g, '')}"` } }) } catch { return NextResponse.json({ error: 'File not found' }, { status: 404 }) }
}
