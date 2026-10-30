/**
 * Internal chat-enrichment flag — shared contract between the chat routes
 * and /api/rag/query.
 *
 * The chat routes fetch /api/rag/query on loopback to enrich their prompts
 * and evaluate the abstention gate themselves against the exact context
 * slice they prompt with. A flagged request therefore skips the annotate
 * evaluation in /api/rag/query, so each chat turn logs exactly one
 * RAG_ABSTENTION_GATE audit entry instead of two conflicting ones.
 *
 * Trust model: the flag is only honored for internal hosts. In Next.js route
 * handlers the host of `request.url` is derived from the incoming Host
 * header — behind an edge proxy that forwards client-supplied Host headers,
 * an authenticated external caller could send `Host: localhost` plus the
 * flag and suppress the annotate-only audit entry for their own direct
 * /api/rag/query calls. Deployments behind such a proxy must set
 * INTERNAL_ENRICHMENT_SECRET: the chat routes then attach that shared
 * secret to their internal fetches, and the flag is only honored when it
 * matches (timing-safe comparison). Without the secret, the hostname
 * allowlist applies as before — document that the proxy must normalize
 * Host, or set the secret.
 */

import { createHash, timingSafeEqual } from 'crypto';

/** Request header marking a chat-route internal enrichment fetch. */
const FLAG_HEADER = 'x-internal-chat-enrichment';
/** Request header carrying the INTERNAL_ENRICHMENT_SECRET value. */
export const SECRET_HEADER = 'x-internal-enrichment-secret';

/** Minimal shape of a Next.js request — keeps the helpers unit-testable. */
export interface InternalRequestLike {
  url: string;
  headers: { get(name: string): string | null };
}

function expectedSecret(): string | undefined {
  const value = process.env.INTERNAL_ENRICHMENT_SECRET;
  return value && value.length > 0 ? value : undefined;
}

/**
 * Headers the chat routes attach to their internal /api/rag/query fetches:
 * the enrichment flag plus the shared secret when one is configured.
 */
export function internalEnrichmentHeaders(): Record<string, string> {
  const headers: Record<string, string> = { [FLAG_HEADER]: '1' };
  const secret = expectedSecret();
  if (secret) {
    headers[SECRET_HEADER] = secret;
  }
  return headers;
}

function secretMatches(provided: string | null): boolean {
  const secret = expectedSecret();
  if (!secret) {
    // Not configured — the hostname allowlist below is the only check.
    return true;
  }
  if (!provided) {
    return false;
  }
  // Compare fixed-length SHA-256 digests so neither content nor length of
  // the secret leaks through comparison timing (timingSafeEqual requires
  // equal-length inputs).
  const expected = createHash('sha256').update(secret).digest();
  const actual = createHash('sha256').update(provided).digest();
  return timingSafeEqual(expected, actual);
}

/**
 * True when this request serves chat-context enrichment from one of the chat
 * routes. Those routes evaluate the gate themselves; also running the
 * annotate evaluation in /api/rag/query would log a second, conflicting
 * RAG_ABSTENTION_GATE entry per chat turn and double-count calibration
 * data. The flag is only honored for internal hosts, and — when
 * INTERNAL_ENRICHMENT_SECRET is set — only with a matching secret header,
 * so external clients cannot silence the audit annotation by spoofing Host.
 */
export function servesInternalChatEnrichment(request: InternalRequestLike): boolean {
  if (request.headers.get(FLAG_HEADER) !== '1') {
    return false;
  }
  if (!secretMatches(request.headers.get(SECRET_HEADER))) {
    return false;
  }
  try {
    const host = new URL(request.url).hostname;
    const internalHost = process.env.INTERNAL_URL
      ? new URL(process.env.INTERNAL_URL).hostname
      : null;
    return (
      host === '127.0.0.1' ||
      host === 'localhost' ||
      host === '::1' ||
      host === '[::1]' ||
      (internalHost !== null && host === internalHost)
    );
  } catch {
    return false;
  }
}
