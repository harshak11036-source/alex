import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const KEY_LENGTH = 32

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(password, salt, KEY_LENGTH) as Promise<Buffer>
}

export async function encrypt(text: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = await deriveKey(ENCRYPTION_KEY, salt)
  
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  
  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64')
}

export async function decrypt(encryptedData: string): Promise<string> {
  const buffer = Buffer.from(encryptedData, 'base64')
  
  const salt = buffer.subarray(0, SALT_LENGTH)
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16)
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + 16)
  
  const key = await deriveKey(ENCRYPTION_KEY, salt)
  
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

export function generateKeyHash(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

