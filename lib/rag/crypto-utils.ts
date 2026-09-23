// Web Crypto API compatible utilities for Edge Runtime
export class CryptoUtils {
  /**
   * Generate random bytes using Web Crypto API
   */
  static generateRandomBytes(length: number): Uint8Array {
    const array = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  }

  /**
   * Generate random hex string
   */
  static generateRandomHex(length: number): string {
    const bytes = this.generateRandomBytes(length);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate random base64 string
   */
  static generateRandomBase64(length: number): string {
    const bytes = this.generateRandomBytes(length);
    return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
  }

  /**
   * Generate UUID v4
   */
  static generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Hash data using Web Crypto API
   */
  static async hashData(data: string, algorithm: 'SHA-256' | 'SHA-1' | 'SHA-512' = 'SHA-256'): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback: simple hash (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Timing safe equals (prevents timing attacks)
   */
  static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Simple encryption using Web Crypto API
   */
  static async encryptData(data: string, key: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(key.padEnd(32, '0').substring(0, 32));
      const dataBuffer = encoder.encode(data);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        dataBuffer
      );
      
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode.apply(null, Array.from(result)));
    }
    
    // Fallback: simple obfuscation (not secure)
    return btoa(data);
  }

  /**
   * Simple decryption using Web Crypto API
   */
  static async decryptData(encryptedData: string, key: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(key.padEnd(32, '0').substring(0, 32));
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      const iv = encryptedBuffer.slice(0, 12);
      const data = encryptedBuffer.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    }
    
    // Fallback: simple deobfuscation
    return atob(encryptedData);
  }
}
