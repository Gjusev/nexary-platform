/**
 * Cryptographic utilities for secure credential storage
 * Uses AES-256-GCM for encryption of sensitive data
 */

import crypto from 'crypto';

// Get encryption key from environment or generate one
// In production, this should be set as a secure environment variable
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY
  ? Buffer.from(process.env.CREDENTIALS_ENCRYPTION_KEY, 'hex')
  : (() => {
      console.warn('CREDENTIALS_ENCRYPTION_KEY not set, using insecure key for development');
      return crypto.randomBytes(32); // Insecure! Only for development
    })();

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypted data structure
 */
interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
}

/**
 * Encrypt credentials using AES-256-GCM
 * @param credentials - Object containing sensitive credentials
 * @returns Encrypted data structure as JSON string
 */
export async function encryptCredentials(
  credentials: Record<string, unknown>
): Promise<string> {
  try {
    // Convert credentials to JSON string
    const plaintext = JSON.stringify(credentials);

    // Generate random IV and salt
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from password + salt using PBKDF2
    const key = crypto.pbkdf2Sync(
      ENCRYPTION_KEY,
      salt,
      100000, // Iterations
      KEY_LENGTH,
      'sha256'
    );

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Return as JSON structure
    const result: EncryptedData = {
      encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex')
    };

    return JSON.stringify(result);
  } catch (error) {
    console.error('Error encrypting credentials:', error);
    throw new Error('Failed to encrypt credentials');
  }
}

/**
 * Decrypt credentials encrypted with encryptCredentials
 * @param encryptedData - JSON string containing encrypted data
 * @returns Decrypted credentials object
 */
export async function decryptCredentials(
  encryptedData: string
): Promise<Record<string, unknown>> {
  try {
    // Parse encrypted data structure
    let data: EncryptedData;
    if (typeof encryptedData === 'string') {
      data = JSON.parse(encryptedData);
    } else {
      data = encryptedData as unknown as EncryptedData;
    }

    // Validate structure
    if (!data.encrypted || !data.iv || !data.salt || !data.authTag) {
      throw new Error('Invalid encrypted data structure');
    }

    // Convert hex strings to buffers
    const iv = Buffer.from(data.iv, 'hex');
    const salt = Buffer.from(data.salt, 'hex');
    const authTag = Buffer.from(data.authTag, 'hex');

    // Derive key from password + salt using PBKDF2
    const key = crypto.pbkdf2Sync(
      ENCRYPTION_KEY,
      salt,
      100000, // Iterations
      KEY_LENGTH,
      'sha256'
    );

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Parse back to object
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error decrypting credentials:', error);
    throw new Error('Failed to decrypt credentials');
  }
}

/**
 * Generate a cryptographically secure random webhook secret
 * @returns 64-character hex string (256 bits)
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a cryptographically secure random API key
 * @param prefix - Optional prefix for the key (e.g., 'nxak_')
 * @returns API key with prefix + 32 random characters
 */
export function generateApiKey(prefix: string = ''): string {
  const randomBytes = crypto.randomBytes(32);
  const randomKey = randomBytes.toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 32);
  return prefix ? `${prefix}${randomKey}` : randomKey;
}

/**
 * Hash an API key using SHA-256 for secure storage
 * @param apiKey - The plain API key
 * @returns SHA-256 hash as hex string
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Verify webhook signature using HMAC-SHA256
 * @param payload - The raw request payload as string
 * @param signature - The signature from the request header
 * @param secret - The webhook secret
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computed = hmac.digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(computed, 'hex')
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Generate a checksum for content change detection
 * @param content - The content to checksum
 * @returns SHA-256 hash as hex string
 */
export function generateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Validate if a string is a valid hex-encoded string
 * @param str - String to validate
 * @returns True if valid hex
 */
export function isValidHex(str: string): boolean {
  return /^[0-9a-fA-F]+$/.test(str);
}

/**
 * Generate a secure random token for state parameters in OAuth flows
 * @returns Random token
 */
export function generateStateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Derive a key from a password using PBKDF2
 * @param password - The password
 * @param salt - The salt (hex string or buffer)
 * @returns Derived key as buffer
 */
export function deriveKey(
  password: string,
  salt: string | Buffer
): Buffer {
  const saltBuffer = typeof salt === 'string' ? Buffer.from(salt, 'hex') : salt;
  return crypto.pbkdf2Sync(password, saltBuffer, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Securely compare two strings in constant time
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Redact sensitive information from an object for logging
 * @param obj - Object to redact
 * @param keysToRedact - Array of keys to redact (e.g., ['password', 'token'])
 * @returns Object with sensitive values redacted
 */
export function redactSensitiveInfo<T extends Record<string, unknown>>(
  obj: T,
  keysToRedact: string[] = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken']
): Partial<T> {
  const redacted: Partial<T> = { ...obj };

  for (const key of keysToRedact) {
    if (key in obj) {
      const value = obj[key as keyof T];
      if (typeof value === 'string') {
        // Show first 4 and last 4 characters, mask the middle
        if (value.length > 8) {
          (redacted as any)[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          (redacted as any)[key] = '***';
        }
      } else {
        (redacted as any)[key] = '[REDACTED]';
      }
    }
  }

  return redacted;
}

/**
 * Validate encryption key format
 * @returns True if key is valid
 */
export function validateEncryptionKey(): boolean {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key) {
    return false;
  }

  // Key should be 64 hex characters (32 bytes)
  return key.length === 64 && isValidHex(key);
}

// Legacy CryptoUtils class for backward compatibility
export class CryptoUtils {
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  static async hashData(data: string, algorithm: string = 'SHA-256'): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback for environments without crypto.subtle
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16);
    }
  }
}
