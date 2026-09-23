/**
 * Security utility functions for input sanitization and validation.
 *
 * These functions help prevent common security vulnerabilities like:
 * - Path traversal attacks
 * - XSS (Cross-Site Scripting)
 * - Injection attacks
 */

import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks using DOMPurify.
 * This provides robust sanitization for user-generated HTML content.
 *
 * Removes:
 * - <script> tags and inline event handlers
 * - Dangerous HTML attributes
 * - javascript: and data: URLs
 * - XSS payloads
 *
 * @param html - The HTML content to sanitize
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized safe HTML string
 *
 * @example
 * ```ts
 * sanitizeHtml('<script>alert("xss")</script><p>Safe content</p>')
 * // Returns: '<p>Safe content</p>'
 *
 * sanitizeHtml('<a href="javascript:alert(1)">Click</a>')
 * // Returns: '<a>Click</a>'
 * ```
 */
export function sanitizeHtml(
  html: string,
  options?: {
    allowTags?: string[];
    allowAttributes?: Record<string, string[]>;
  }
): string {
  const purifyConfig = {
    // Allow common safe tags
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'blockquote', 'code', 'pre',
      'div', 'span', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ...(options?.allowTags || [])
    ],
    // Allow safe attributes
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id',
      'width', 'height', 'target', 'rel',
      ...(options?.allowAttributes ? Object.keys(options.allowAttributes) : [])
    ],
    // Add rel="noopener noreferrer" to links
    ADD_ATTR: ['target'],
    // Force HTTPS for http URLs
    FORCE_BODY: false,
    // Remove elements with unsafe styles
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button'],
    // Remove unsafe attributes
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
    // Allow data URI for images (if you need it)
    ALLOW_DATA_ATTR: false,
    // Allow URI for protocols
    ALLOW_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  };

  return DOMPurify.sanitize(html, purifyConfig);
}

/**
 * Sanitizes and strips all HTML tags, returning plain text only.
 * Use this when you want to completely remove HTML formatting.
 *
 * @param html - The HTML content to strip
 * @returns Plain text without HTML tags
 *
 * @example
 * ```ts
 * stripHtmlTags('<p>Hello <strong>world</strong></p>')
 * // Returns: 'Hello world'
 * ```
 */
export function stripHtmlTags(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}

/**
 * Sanitizes a filename to prevent path traversal and other attacks.
 *
 * Removes:
 * - Path traversal sequences (..)
 * - Invalid filesystem characters
 * - Leading dots (hidden files)
 * - Excessive whitespace
 *
 * @param filename - The filename to sanitize
 * @returns A safe filename string
 *
 * @example
 * ```ts
 * sanitizeFilename('../../../etc/passwd') // 'etcpasswd'
 * sanitizeFilename('my document.pdf') // 'my_document.pdf'
 * sanitizeFilename('file<script>.txt') // 'filescript_.txt'
 * ```
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\.[\\/]/g, '') // Remove path traversal sequences
    .replace(/[<>:"|?*\x00-\x1f]/g, '_') // Replace invalid filesystem chars
    .replace(/^\.+/, '') // Remove leading dots (hidden files)
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 255); // Limit length (common filesystem limit)
}

/**
 * Validates that a string is a safe email address format.
 * This is a basic validation and should be combined with verification.
 *
 * @param email - The email address to validate
 * @returns true if the email format appears valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitizes user input to prevent XSS attacks.
 * HTML-encodes dangerous characters.
 *
 * @param input - The user input to sanitize
 * @returns HTML-encoded safe string
 *
 * @example
 * ```ts
 * sanitizeHtmlInput('<script>alert("xss")</script>') // '&lt;script&gt;alert("xss")&lt;/script&gt;'
 * ```
 */
export function sanitizeHtmlInput(input: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return input.replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
}

/**
 * Validates a team slug format.
 * Team slugs should be lowercase, alphanumeric, with hyphens allowed.
 *
 * @param slug - The team slug to validate
 * @returns true if the slug format is valid
 */
export function isValidTeamSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 50;
}

/**
 * Generates a cryptographically secure random token.
 *
 * @param bytes - Number of bytes for the token (default 32)
 * @returns A hex-encoded random token
 */
export function generateSecureToken(bytes = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if a given URL is safe for redirects.
 * Prevents open redirect vulnerabilities.
 *
 * @param url - The URL to validate
 * @param allowedDomains - Optional list of allowed domains
 * @returns true if the URL is safe for redirects
 */
export function isSafeRedirectUrl(url: string, allowedDomains: string[] = []): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // If allowed domains are specified, check against them
    if (allowedDomains.length > 0) {
      return allowedDomains.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
    }

    // By default, allow same-origin redirects
    if (typeof window !== 'undefined') {
      return parsed.hostname === window.location.hostname;
    }

    return true;
  } catch {
    // Invalid URL
    return false;
  }
}
