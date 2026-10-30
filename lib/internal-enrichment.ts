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
 *
 * Operational notes:
 * - The header value is a credential. Nothing logs request headers on the
 *   internal path today (the audit logger records only x-forwarded-for and
 *   user-agent) — keep it that way if header logging or APM is ever added.
 * - Keep `INTERNAL_URL` on loopback or an https:// endpoint. A remote
 *   http:// `INTERNAL_URL` carries the secret and the forwarded session
 *   cookie across that hop in cleartext.
 * - A configured `INTERNAL_ENRICHMENT_SECRET` that cannot be sent as an
 *   HTTP header value (empty after trim, or not printable ASCII) is ignored
 *   with a one-time warning and the per-process fallback secret is used, so
 *   a misconfigured value cannot break the chat routes' self-fetch.
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
let warnedAboutEnvSecret = false;

/**
 * Header values must survive the chat routes' fetch: the fetch spec rejects
 * values with control characters (a trailing newline from config tooling is
 * the usual offender) or non-ASCII bytes, and a thrown fetch silently costs
 * the chat turn its RAG context.
 */
function isUsableHeaderValue(value: string): boolean {
  return /^[\x20-\x7E]+$/.test(value);
}

/**
 * Secret the chat routes must present in `x-internal-chat-enrichment`.
 */
export function internalEnrichmentHeaderValue(): string {
  const configured = process.env.INTERNAL_ENRICHMENT_SECRET;
  if (configured !== undefined) {
    const trimmed = configured.trim();
    if (trimmed.length > 0 && isUsableHeaderValue(trimmed)) {
      return trimmed;
    }
    if (!warnedAboutEnvSecret) {
      warnedAboutEnvSecret = true;
      console.warn(
        '[internal-enrichment] INTERNAL_ENRICHMENT_SECRET is set but cannot be used as an HTTP header value (empty after trim, or contains non-printable/non-ASCII characters); using the per-process fallback secret instead. Multi-worker deployments will see doubled RAG_ABSTENTION_GATE entries until the env secret is replaced with printable ASCII without surrounding whitespace.'
      );
    }
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
  // URL.hostname keeps IPv6 hosts bracketed, so only '[::1]' is reachable.
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
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
  warnedAboutEnvSecret = false;
}
