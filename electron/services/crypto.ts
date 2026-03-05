import { safeStorage } from 'electron'

const ENCRYPTED_PREFIX = 'enc:'

export function encrypt(plainText: string): string {
  if (!plainText || !safeStorage.isEncryptionAvailable()) return plainText
  const buffer = safeStorage.encryptString(plainText)
  return ENCRYPTED_PREFIX + buffer.toString('base64')
}

export function decrypt(stored: string): string {
  if (!stored || !isEncrypted(stored)) return stored
  if (!safeStorage.isEncryptionAvailable()) return stored
  const base64 = stored.slice(ENCRYPTED_PREFIX.length)
  const buffer = Buffer.from(base64, 'base64')
  return safeStorage.decryptString(buffer)
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX)
}
