/**
 * Two-Factor Authentication (2FA) / MFA Utilities
 *
 * Implements TOTP (Time-based One-Time Password) for 2FA
 * Compatible with Google Authenticator, Authy, etc.
 */

import { randomBytes, createHash } from 'crypto';

/**
 * Generate a secret key for TOTP
 * Base32 encoded secret compatible with most authenticator apps
 */
export function generateTOTPSecret(): string {
  const buffer = randomBytes(20); // 160 bits = 32 Base32 chars
  const base32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';

  for (let i = 0; i < buffer.length; i += 5) {
    const bytes = buffer.slice(i, i + 5);
    // Pad last chunk if needed
    const padded = Buffer.concat([bytes, Buffer.alloc(5 - bytes.length)]);
    const value = padded.readUInt32BE(0);

    for (let j = 0; j < 8; j++) {
      const index = (value >> (28 - j * 4)) & 0x0f;
      secret += base32[index];
    }
  }

  return secret;
}

/**
 * Generate a TOTP code for a given secret and time
 *
 * @param secret - Base32 encoded secret
 * @param time - Unix timestamp (defaults to current time)
 * @param digits - Number of digits in code (default 6)
 * @param period - Time period in seconds (default 30)
 * @returns The TOTP code
 */
export function generateTOTP(
  secret: string,
  time: number = Date.now(),
  digits: number = 6,
  period: number = 30
): string {
  // Convert time to counter
  const counter = Math.floor(time / 1000 / period);

  // Decode Base32 secret
  const secretBuffer = base32Decode(secret);

  // Create HMAC-SHA1 hash
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha1', secretBuffer);

  // Convert counter to 8-byte buffer - browser compatible version
  const counterBuffer = Buffer.alloc(8);

  // Write the 64-bit counter as big-endian
  // This is the browser-compatible way to do writeBigUInt64BE
  const bigIntValue = BigInt(counter);
  counterBuffer[0] = Number((bigIntValue >> 56n) & 0xFFn);
  counterBuffer[1] = Number((bigIntValue >> 48n) & 0xFFn);
  counterBuffer[2] = Number((bigIntValue >> 40n) & 0xFFn);
  counterBuffer[3] = Number((bigIntValue >> 32n) & 0xFFn);
  counterBuffer[4] = Number((bigIntValue >> 24n) & 0xFFn);
  counterBuffer[5] = Number((bigIntValue >> 16n) & 0xFFn);
  counterBuffer[6] = Number((bigIntValue >> 8n) & 0xFFn);
  counterBuffer[7] = Number(bigIntValue & 0xFFn);

  hmac.update(counterBuffer);
  const hash = hmac.digest();

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const code = binary % Math.pow(10, digits);

  return code.toString().padStart(digits, '0');
}

/**
 * Verify a TOTP code
 *
 * @param secret - Base32 encoded secret
 * @param token - Token to verify
 * @param window - Number of time periods to check before/after (default 1)
 * @returns true if token is valid
 */
export function verifyTOTP(
  secret: string,
  token: string,
  window: number = 1
): boolean {
  const now = Date.now();
  const period = 30; // 30 seconds per code

  // Check current period and surrounding windows
  for (let i = -window; i <= window; i++) {
    const time = now + i * period * 1000;
    const expected = generateTOTP(secret, time);

    if (expected === token) {
      return true;
    }
  }

  return false;
}

/**
 * Decode Base32 string to buffer
 * Fixed implementation with proper buffer index tracking
 */
function base32Decode(secret: string): Buffer {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanSecret = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');

  // Each Base32 character represents 5 bits
  // We need to convert these 5-bit chunks into 8-bit bytes
  const byteCount = Math.floor(cleanSecret.length * 5 / 8);
  const buffer = Buffer.alloc(byteCount);

  let bufferIndex = 0;
  let bitsRemaining = 0;
  let currentByte = 0;

  for (let i = 0; i < cleanSecret.length; i++) {
    const value = base32Chars.indexOf(cleanSecret[i]);
    if (value === -1) continue;

    // Add 5 bits to the current byte
    currentByte = (currentByte << 5) | value;
    bitsRemaining += 5;

    // When we have at least 8 bits, extract a byte
    if (bitsRemaining >= 8) {
      const bitsToExtract = bitsRemaining - 8;
      buffer[bufferIndex++] = (currentByte >> bitsToExtract) & 0xFF;
      currentByte = currentByte & ((1 << bitsToExtract) - 1);
      bitsRemaining = bitsToExtract;
    }
  }

  // Handle any remaining bits (if less than 8, we ignore them)
  if (bitsRemaining > 0 && bufferIndex < buffer.length) {
    buffer[bufferIndex] = (currentByte << (8 - bitsRemaining)) & 0xFF;
  }

  return buffer;
}

/**
 * Generate backup codes for account recovery
 * Users can use these if they lose access to their authenticator
 *
 * @param count - Number of backup codes to generate (default 10)
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8 character alphanumeric code
    const code = randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }

  return codes;
}

/**
 * Hash a backup code for secure storage
 */
export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Generate a QR code URL for easy authenticator setup
 * Format: otpauth://totp/Service:Account?secret=SECRET&issuer=Service
 *
 * @param account - User account name (email or username)
 * @param secret - Base32 encoded secret
 * @param issuer - Application name
 * @returns QR code URL
 */
export function generateTOTPQRCodeURL(
  account: string,
  secret: string,
  issuer: string = 'Nexary'
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });

  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params.toString()}`;
}
