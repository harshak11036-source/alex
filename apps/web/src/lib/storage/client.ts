import { mkdir, writeFile, readFile, unlink, readdir } from 'node:fs/promises'
import path from 'node:path'

const localStorageRoot = path.join(process.cwd(), 'storage')
const useLocalStorage = () => (process.env.STORAGE_MODE || 'local') === 'local'

export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { contentType?: string; upsert?: boolean }
) {
  if (!useLocalStorage()) {
    throw new Error('Only local storage mode is supported')
  }

  const target = pathModule(localStorageRoot, bucket, path)
  await mkdir(pathModule(localStorageRoot, bucket), { recursive: true })
  await writeFile(target, Buffer.from(await file.arrayBuffer()))
  return { path: `${bucket}/${path}` } as any
}

export async function downloadFile(bucket: string, path: string) {
  if (!useLocalStorage()) {
    throw new Error('Only local storage mode is supported')
  }
  return new Blob([await readFile(pathModule(localStorageRoot, bucket, path))])
}

export async function deleteFile(bucket: string, paths: string[]) {
  if (!useLocalStorage()) {
    throw new Error('Only local storage mode is supported')
  }
  await Promise.all(paths.map(p => unlink(pathModule(localStorageRoot, bucket, p)).catch(() => undefined)))
  return [] as any
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
  if (!useLocalStorage()) {
    throw new Error('Only local storage mode is supported')
  }
  return `/api/documents/local/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`
}

export async function listFiles(bucket: string, folder: string) {
  if (!useLocalStorage()) {
    throw new Error('Only local storage mode is supported')
  }
  return (await readdir(pathModule(localStorageRoot, bucket, folder), { withFileTypes: true })).map(entry => ({ name: entry.name })) as any
}

export function getPublicUrl(bucket: string, path: string) {
  if (!useLocalStorage()) {
    throw new Error('Only local storage mode is supported')
  }
  return `/api/documents/local/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`
}

function pathModule(...parts: string[]) { return path.resolve(...parts) }

