/**
 * Tests for the internal chat-enrichment flag contract (see
 * internal-enrichment.ts): hostname allowlist, optional shared secret, and
 * the headers the chat routes attach to their internal fetches.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  SECRET_HEADER as INTERNAL_ENRICHMENT_SECRET_HEADER,
  internalEnrichmentHeaders,
  servesInternalChatEnrichment,
  type InternalRequestLike,
} from './internal-enrichment';

function request(url: string, headers: Record<string, string> = {}): InternalRequestLike {
  const lower: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    lower[name.toLowerCase()] = value;
  }
  return {
    url,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
  };
}

const flagged = (url: string, extra: Record<string, string> = {}) =>
  request(url, { 'x-internal-chat-enrichment': '1', ...extra });

describe('servesInternalChatEnrichment — hostname allowlist', () => {
  it('honors the flag for loopback hosts', () => {
    expect(servesInternalChatEnrichment(flagged('http://127.0.0.1:3000/api/rag/query'))).toBe(true);
    expect(servesInternalChatEnrichment(flagged('http://localhost:3000/api/rag/query'))).toBe(true);
    expect(servesInternalChatEnrichment(flagged('http://[::1]:3000/api/rag/query'))).toBe(true);
  });

  it('honors the flag for the INTERNAL_URL host', () => {
    const prev = process.env.INTERNAL_URL;
    process.env.INTERNAL_URL = 'https://nexary.internal.example:8443';
    try {
      expect(
        servesInternalChatEnrichment(flagged('https://nexary.internal.example:8443/api/rag/query')),
      ).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.INTERNAL_URL;
      else process.env.INTERNAL_URL = prev;
    }
  });

  it('rejects non-internal hosts even when flagged', () => {
    expect(servesInternalChatEnrichment(flagged('https://nexary.example.com/api/rag/query'))).toBe(false);
  });

  it('rejects unflagged requests on loopback', () => {
    expect(servesInternalChatEnrichment(request('http://127.0.0.1:3000/api/rag/query'))).toBe(false);
  });

  it('rejects malformed URLs safely', () => {
    expect(servesInternalChatEnrichment(flagged('not-a-url'))).toBe(false);
  });
});

describe('servesInternalChatEnrichment — shared secret', () => {
  const SECRET = 'enrichment-shared-secret';
  let prevSecret: string | undefined;

  beforeEach(() => {
    prevSecret = process.env.INTERNAL_ENRICHMENT_SECRET;
    process.env.INTERNAL_ENRICHMENT_SECRET = SECRET;
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.INTERNAL_ENRICHMENT_SECRET;
    else process.env.INTERNAL_ENRICHMENT_SECRET = prevSecret;
  });

  it('rejects a flagged loopback request without the secret header', () => {
    expect(servesInternalChatEnrichment(flagged('http://127.0.0.1:3000/api/rag/query'))).toBe(false);
  });

  it('rejects a flagged loopback request with a wrong secret', () => {
    expect(
      servesInternalChatEnrichment(
        flagged('http://127.0.0.1:3000/api/rag/query', { [INTERNAL_ENRICHMENT_SECRET_HEADER]: 'wrong' }),
      ),
    ).toBe(false);
  });

  it('honors a flagged loopback request with the correct secret', () => {
    expect(
      servesInternalChatEnrichment(
        flagged('http://127.0.0.1:3000/api/rag/query', { [INTERNAL_ENRICHMENT_SECRET_HEADER]: SECRET }),
      ),
    ).toBe(true);
  });

  it('still requires the hostname allowlist even with the correct secret', () => {
    expect(
      servesInternalChatEnrichment(
        flagged('https://nexary.example.com/api/rag/query', { [INTERNAL_ENRICHMENT_SECRET_HEADER]: SECRET }),
      ),
    ).toBe(false);
  });

  it('treats an empty secret env as unconfigured', () => {
    process.env.INTERNAL_ENRICHMENT_SECRET = '';
    expect(servesInternalChatEnrichment(flagged('http://127.0.0.1:3000/api/rag/query'))).toBe(true);
  });
});

describe('internalEnrichmentHeaders', () => {
  const withEnv = (vars: Record<string, string | undefined>, fn: () => void) => {
    const saved: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(vars)) {
      saved[key] = process.env[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      fn();
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };

  it('sends only the flag when no secret is configured', () => {
    withEnv({ INTERNAL_ENRICHMENT_SECRET: undefined }, () => {
      expect(internalEnrichmentHeaders()).toEqual({ 'x-internal-chat-enrichment': '1' });
    });
  });

  it('attaches the configured secret for the internal fetches', () => {
    withEnv({ INTERNAL_ENRICHMENT_SECRET: 's3cret' }, () => {
      expect(internalEnrichmentHeaders()).toEqual({
        'x-internal-chat-enrichment': '1',
        [INTERNAL_ENRICHMENT_SECRET_HEADER]: 's3cret',
      });
    });
  });

  it('produces headers the verifier accepts on an internal host', () => {
    withEnv({ INTERNAL_ENRICHMENT_SECRET: 's3cret' }, () => {
      const headers = internalEnrichmentHeaders();
      expect(servesInternalChatEnrichment(request('http://127.0.0.1:3000/api/rag/query', headers))).toBe(true);
    });
  });
});
