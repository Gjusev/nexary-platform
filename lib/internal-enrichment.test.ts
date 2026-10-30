/**
 * Tests for internal chat-enrichment authentication (lib/internal-enrichment)
 *
 * Covers the MOK-81 hardening: the x-internal-chat-enrichment flag is only
 * honored with the shared secret (env-provided or per-process random) on an
 * internal host, so a spoofed `Host: localhost` header cannot silence the
 * RAG_ABSTENTION_GATE audit annotation for direct /api/rag/query calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  INTERNAL_ENRICHMENT_HEADER,
  __resetInternalEnrichmentForTests,
  internalEnrichmentHeaderValue,
  servesInternalChatEnrichment,
} from './internal-enrichment';

const asEnv = (vars: Record<string, string | undefined>) =>
  vars as unknown as NodeJS.ProcessEnv;

let savedEnv: { INTERNAL_ENRICHMENT_SECRET?: string; INTERNAL_URL?: string };

function request(url: string, flagValue?: string) {
  return {
    url,
    headers: {
      get(name: string) {
        return name.toLowerCase() === INTERNAL_ENRICHMENT_HEADER
          ? (flagValue ?? null)
          : null;
      },
    },
  };
}

beforeEach(() => {
  savedEnv = {
    INTERNAL_ENRICHMENT_SECRET: process.env.INTERNAL_ENRICHMENT_SECRET,
    INTERNAL_URL: process.env.INTERNAL_URL,
  };
  delete process.env.INTERNAL_ENRICHMENT_SECRET;
  delete process.env.INTERNAL_URL;
  __resetInternalEnrichmentForTests();
});

afterEach(() => {
  Object.assign(process.env, savedEnv);
  __resetInternalEnrichmentForTests();
});

describe('internal enrichment secret', () => {
  it('returns the configured env secret verbatim', () => {
    process.env = asEnv({
      ...process.env,
      INTERNAL_ENRICHMENT_SECRET: 'deploy-shared-secret',
    });
    expect(internalEnrichmentHeaderValue()).toBe('deploy-shared-secret');
  });

  it('trims surrounding whitespace from the configured env secret', () => {
    // Config tooling loves to leave a trailing newline on env values; the
    // trimmed form must be sent AND verified, otherwise self-fetches break.
    process.env = asEnv({
      ...process.env,
      INTERNAL_ENRICHMENT_SECRET: '  deploy-shared-secret\n',
    });
    expect(internalEnrichmentHeaderValue()).toBe('deploy-shared-secret');
    expect(
      servesInternalChatEnrichment(
        request('http://127.0.0.1:3000/api/rag/query', 'deploy-shared-secret')
      )
    ).toBe(true);
  });

  it('falls back to the per-process secret and warns once on an unusable env secret', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // An interior newline makes the value unsuitable as a header value.
      process.env = asEnv({
        ...process.env,
        INTERNAL_ENRICHMENT_SECRET: 'secret-with\nnewline-inside',
      });
      const fallback = internalEnrichmentHeaderValue();
      expect(fallback.length).toBeGreaterThanOrEqual(32);
      expect(internalEnrichmentHeaderValue()).toBe(fallback);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      // The fallback still authenticates this process's own fetches.
      expect(
        servesInternalChatEnrichment(request('http://localhost/api/rag/query', fallback))
      ).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('falls back to a stable per-process random secret', () => {
    const first = internalEnrichmentHeaderValue();
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(internalEnrichmentHeaderValue()).toBe(first);
  });

  it('regenerates the fallback secret after a reset and ignores empty env values', () => {
    const first = internalEnrichmentHeaderValue();
    __resetInternalEnrichmentForTests();
    expect(internalEnrichmentHeaderValue()).not.toBe(first);
    // An empty INTERNAL_ENRICHMENT_SECRET must not become the shared secret.
    process.env = asEnv({ ...process.env, INTERNAL_ENRICHMENT_SECRET: '' });
    expect(internalEnrichmentHeaderValue()).not.toBe('');
  });
});

describe('servesInternalChatEnrichment', () => {
  const secret = 'test-secret-value';
  const loopbackUrls = [
    'http://127.0.0.1:3000/api/rag/query',
    'http://localhost:3000/api/rag/query',
    'http://[::1]:3000/api/rag/query',
  ];

  it('honors the flag for loopback chat fetches carrying the shared secret', () => {
    process.env = asEnv({ ...process.env, INTERNAL_ENRICHMENT_SECRET: secret });
    for (const url of loopbackUrls) {
      expect(servesInternalChatEnrichment(request(url, secret))).toBe(true);
    }
  });

  it('honors the INTERNAL_URL hostname as internal host', () => {
    process.env = asEnv({
      ...process.env,
      INTERNAL_ENRICHMENT_SECRET: secret,
      INTERNAL_URL: 'http://app-internal:8443',
    });
    expect(
      servesInternalChatEnrichment(
        request('http://app-internal:8443/api/rag/query', secret)
      )
    ).toBe(true);
    expect(
      servesInternalChatEnrichment(
        request('http://app-internal:8443/api/rag/query', 'wrong')
      )
    ).toBe(false);
  });

  it('rejects the MOK-81 spoof: Host: localhost with a bare flag header', () => {
    process.env = asEnv({ ...process.env, INTERNAL_ENRICHMENT_SECRET: secret });
    // Old behavior accepted this (flag value '1' + allowlisted Host); the
    // spoofed Host passes the hostname allowlist but fails the secret.
    expect(servesInternalChatEnrichment(request('http://localhost/api/rag/query', '1'))).toBe(
      false
    );
    // Same for a guessed secret that only matches in length.
    expect(
      servesInternalChatEnrichment(request('http://localhost/api/rag/query', 'x'.repeat(secret.length)))
    ).toBe(false);
  });

  it('rejects a missing or wrong flag even on internal hosts', () => {
    process.env = asEnv({ ...process.env, INTERNAL_ENRICHMENT_SECRET: secret });
    expect(
      servesInternalChatEnrichment(request('http://127.0.0.1:3000/api/rag/query'))
    ).toBe(false);
    expect(
      servesInternalChatEnrichment(request('http://127.0.0.1:3000/api/rag/query', 'wrong'))
    ).toBe(false);
    expect(
      servesInternalChatEnrichment(request('http://127.0.0.1:3000/api/rag/query', ''))
    ).toBe(false);
  });

  it('rejects a correct secret from a non-internal host (second factor)', () => {
    process.env = asEnv({ ...process.env, INTERNAL_ENRICHMENT_SECRET: secret });
    expect(
      servesInternalChatEnrichment(request('https://app.example.com/api/rag/query', secret))
    ).toBe(false);
  });

  it('rejects malformed request URLs even with a valid secret', () => {
    process.env = asEnv({ ...process.env, INTERNAL_ENRICHMENT_SECRET: secret });
    expect(servesInternalChatEnrichment(request('not-a-url', secret))).toBe(false);
  });

  it('rejects guessed flag values when only the per-process fallback secret is in effect', () => {
    // No secret configured: the per-process fallback is in effect, so any
    // client-guessable value fails.
    const real = internalEnrichmentHeaderValue();
    expect(
      servesInternalChatEnrichment(request('http://localhost/api/rag/query', '1'))
    ).toBe(false);
    expect(
      servesInternalChatEnrichment(request('http://localhost/api/rag/query', real))
    ).toBe(true);
  });
});
