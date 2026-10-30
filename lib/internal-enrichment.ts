/**
 * Internal chat-enrichment authentication
 *
 * The chat routes fetch /api/rag/query over loopback to retrieve document
 * context and evaluate the abstention gate themselves; the flag header tells
 * the search route to skip its own annotate-only evaluation (otherwise every
 * chat turn logs two conflicting RAG_ABSTENTION_GATE entries and double-counts
 * calibration data).
 *
 * Skipping the annotation must be reserved for callers the server itself
 * issued: an external caller silencing it would quietly opt their direct
 * searches out of the audit trail. A hostname allowlist alone is not proof of
 * origin — Next.js derives request.url's host from the client-supplied Host
 * header, so behind a proxy that forwards client Host headers an
 * authenticated caller can present themselves as `localhost`. Callers
 * therefore authenticate with a shared secret:
 *
 * - `INTERNAL_ENRICHMENT_SECRET`, when set, is the shared secret. Set it in
 *   multi-process deployments (cluster/PM2) where the loopback fetch may land
 *   in a different worker than the one that minted the fallback secret.
 * - Otherwise a random per-process secret is generated on first use. The
 *   standard single-process `next start` deployment (see Dockerfile
 *   `node server.js`) always returns the self-fetch to the process that
 *   minted the secret, so no configuration is needed.
 *
 * The internal-host allowlist stays in place as a second factor: a guessed or
 * leaked secret alone is not sufficient, the request must also arrive with an
 * internal Host (as the in-process fetches always do).
 */

import crypto from 'crypto';
import { secureCompare } from '@/lib/crypto-utils';

export const INTERNAL_ENRICHMENT_HEADER = 'x-internal-chat-enrichment';

/**
 * Minimal request shape needed for the check; satisfied by NextRequest.
 */
export interface InternalEnrichmentRequest {
  url: string;
  headers: { get(name: string): string | null };
}

let processSecret: string | null = null;

/**
 * Secret the chat routes must present in `x-internal-chat-enrichment`.
 */
export function internalEnrichmentHeaderValue(): string {
  const configured = process.env.INTERNAL_ENRICHMENT_SECRET;
  if (configured && configured.length > 0) {
    return configured;
  }
  if (processSecret === null) {
    processSecret = crypto.randomBytes(32).toString('base64url');
  }
  return processSecret;
}

function isInternalHost(hostname: string): boolean {
  const internalHost = process.env.INTERNAL_URL
    ? new URL(process.env.INTERNAL_URL).hostname
    : null;
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    (internalHost !== null && hostname === internalHost)
  );
}

/**
 * True when this request serves chat-context enrichment from one of the chat
 * routes: the flag header carries the shared secret AND the request host is
 * internal. External callers cannot forge either factor (see module doc).
 */
export function servesInternalChatEnrichment(
  request: InternalEnrichmentRequest
): boolean {
  const provided = request.headers.get(INTERNAL_ENRICHMENT_HEADER);
  if (provided === null || !secureCompare(provided, internalEnrichmentHeaderValue())) {
    return false;
  }
  try {
    return isInternalHost(new URL(request.url).hostname);
  } catch {
    return false;
  }
}

/**
 * Test hook: drop the memoized per-process secret so tests can exercise the
 * generation and env fallback paths independently.
 */
export function __resetInternalEnrichmentForTests(): void {
  processSecret = null;
}
