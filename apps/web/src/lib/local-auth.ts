import crypto from 'node:crypto'

export const LOCAL_AUTH_COOKIE = 'alex_local_session'
function secret() { return process.env.NEXTAUTH_SECRET || 'alex-local-development-secret-change-me' }
export function createLocalSession(userId: string) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}
export function getLocalUserId(token?: string | null) {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Date.now() ? String(data.sub) : null } catch { return null }
}
export function isLocalAuth() { return (process.env.AUTH_MODE || 'local').toLowerCase() === 'local' }


