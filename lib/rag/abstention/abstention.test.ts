/**
 * Tests for conformal abstention (support scoring, calibration, gate, config)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Keep lib/db (env validation at import time) out of the test process.
vi.mock('@/lib/audit/audit-logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { resolveAbstentionConfig } from './config';
import { computeSupportScore } from './support';
import { calibrateThreshold, conformalQuantile, MIN_SUPPORTED_SAMPLES } from './conformal';
import { DEFAULT_PRIOR_THRESHOLD, gateTemplate, resolveGate } from './gate';
import { evaluateRagGate } from './index';
import { logGateDecision } from './log';
import { logAuditEvent } from '@/lib/audit/audit-logger';

const baseConfig = (overrides: Partial<ReturnType<typeof resolveAbstentionConfig>> = {}) => ({
  enabled: true,
  mode: 'enforce' as const,
  alpha: 0.1,
  thresholdOverride: null,
  clarifyBand: 0.08,
  calibrationFile: null,
  ...overrides,
});

// Next.js augments ProcessEnv (NODE_ENV required), so env fixtures go through
// unknown to satisfy the resolver's NodeJS.ProcessEnv parameter.
const asEnv = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

// Deterministic PRNG so the statistical coverage test is stable.
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('conformal calibration', () => {
  it('computes the finite-sample conformal quantile', () => {
    const scores = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    // rank = ceil((9+1)*(1-0.1)) = 9 -> 9th smallest
    expect(conformalQuantile(scores, 0.1)).toBeCloseTo(0.9);
    // rank = ceil(10*0.5) = 5 -> 5th smallest
    expect(conformalQuantile(scores, 0.5)).toBeCloseTo(0.5);
  });

  it('returns null when alpha demands more data than available (under-covering guard)', () => {
    const scores = [0.4, 0.5, 0.6];
    // rank = ceil((3+1)*0.95) = 4 > n -> no defensible threshold
    expect(conformalQuantile(scores, 0.05)).toBeNull();
    // Review finding F4 repro: rank = ceil((8+1)*0.9) = 9 > 8 — must not
    // degrade to the minimum observed score (under-covers 1-alpha).
    expect(
      conformalQuantile([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], 0.1),
    ).toBeNull();
  });

  it('rejects calibration sets whose sample size cannot support the requested alpha', () => {
    const examples = Array.from({ length: MIN_SUPPORTED_SAMPLES }, (_, i) => ({
      support: 0.4 + i * 0.05,
      supported: true,
    }));
    const result = calibrateThreshold(examples, 0.1);
    expect(result.threshold).toBeNull();
    expect(result.reason).toBe('insufficient_sample');
  });

  it('returns null for empty input or out-of-range alpha', () => {
    expect(conformalQuantile([], 0.1)).toBeNull();
    expect(conformalQuantile([0.5], 0)).toBeNull();
    expect(conformalQuantile([0.5], 1)).toBeNull();
  });

  it('rejects calibration sets without enough supported examples', () => {
    const examples = Array.from({ length: MIN_SUPPORTED_SAMPLES - 1 }, (_, i) => ({
      support: 0.5,
      supported: true,
    }));
    const result = calibrateThreshold(examples, 0.1);
    expect(result.threshold).toBeNull();
    expect(result.reason).toBe('insufficient_sample');
  });

  it('rejects calibration sets with no supported examples', () => {
    const examples = [{ support: 0.1, supported: false }];
    const result = calibrateThreshold(examples, 0.1);
    expect(result.threshold).toBeNull();
    expect(result.reason).toBe('no_supported_examples');
  });

  it('achieves at least 1-alpha empirical coverage on fresh draws', () => {
    const rand = lcg(42);
    const draw = (supported: boolean) =>
      supported
        ? Math.min(1, 0.55 + rand() * 0.35) // supported scores in [0.55, 0.9]
        : rand() * 0.5; // unsupported scores in [0, 0.5]

    // Calibration set: n=200, ~half supported.
    const calibration = Array.from({ length: 200 }, () => {
      const supported = rand() < 0.5;
      return { support: draw(supported), supported };
    });

    const alpha = 0.1;
    const { threshold } = calibrateThreshold(calibration, alpha);
    expect(threshold).not.toBeNull();

    // Fresh evaluation draws.
    let answered = 0;
    let supportedAndAnswered = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      const supported = rand() < 0.5;
      const s = draw(supported);
      if (s >= (threshold as number)) {
        answered++;
        if (supported) supportedAndAnswered++;
      }
    }
    // Guarantee applies to the answered population: precision >= 1-alpha.
    expect(answered).toBeGreaterThan(0);
    expect(supportedAndAnswered / answered).toBeGreaterThanOrEqual(1 - alpha - 0.02);
  });
});

describe('support scoring', () => {
  it('scores empty candidate sets as zero (fail-closed)', () => {
    const s = computeSupportScore({ query: 'Kündigungsfrist', results: [] });
    expect(s.score).toBe(0);
    expect(s.candidates).toBe(0);
  });

  it('tolerates malformed entries', () => {
    const s = computeSupportScore({
      query: 'Kündigungsfrist Vertrag',
      results: [null as any, {}, { score: Number.NaN }],
    });
    expect(s.score).toBe(0);
    expect(s.candidates).toBe(3);
  });

  it('returns a deterministic score in [0,1] that rewards lexical overlap', () => {
    const query = 'Kündigungsfrist des Mietvertrags';
    const strong = [
      { score: 0.85, content: 'Die Kündigungsfrist des Mietvertrags beträgt drei Monate zum Ende des Quartals.' },
      { score: 0.78, content: 'Für die Kündigungsfrist gilt die schriftliche Form.' },
    ];
    const weak = [{ score: 0.41, content: 'Allgemeine Geschäftsbedingungen für Lieferungen.' }];

    const sStrong = computeSupportScore({ query, results: strong });
    const sWeak = computeSupportScore({ query, results: weak });

    expect(sStrong.score).toBeGreaterThan(sWeak.score);
    expect(sStrong.score).toBeLessThanOrEqual(1);
    expect(sStrong.score).toBeGreaterThanOrEqual(0);
    // Deterministic
    expect(computeSupportScore({ query, results: strong }).score).toBeCloseTo(sStrong.score);
  });

  it('penalizes weak chunks below the top hit via rank decay', () => {
    const query = 'Kündigungsfrist Mietvertrag';
    const consistent = [
      { score: 0.8, content: 'Kündigungsfrist Mietvertrag' },
      { score: 0.8, content: 'Kündigungsfrist Mietvertrag Schriftform' },
      { score: 0.8, content: 'Mietvertrag Kündigungsfrist drei Monate' },
    ];
    const mixed = [
      { score: 0.8, content: 'Kündigungsfrist Mietvertrag' },
      { score: 0.3, content: 'Lieferbedingungen' },
      { score: 0.3, content: 'Impressum' },
    ];
    expect(computeSupportScore({ query, results: consistent }).rank).toBeGreaterThan(
      computeSupportScore({ query, results: mixed }).rank,
    );
  });
});

describe('gate resolution', () => {
  it('prefers override over calibrated over prior', () => {
    const cfg = baseConfig({ thresholdOverride: 0.7 });
    expect(resolveGate({ config: cfg, support: 0.65, calibratedThreshold: 0.5 }).thresholdSource).toBe('override');
    expect(resolveGate({ config: cfg, support: 0.65, calibratedThreshold: 0.5 }).threshold).toBe(0.7);

    const cfgNoOverride = baseConfig();
    expect(
      resolveGate({ config: cfgNoOverride, support: 0.45, calibratedThreshold: 0.5 }).thresholdSource,
    ).toBe('calibrated');
    expect(resolveGate({ config: cfgNoOverride, support: 0.45 }).thresholdSource).toBe('prior');
    expect(resolveGate({ config: cfgNoOverride, support: 0.45 }).threshold).toBe(DEFAULT_PRIOR_THRESHOLD);
  });

  it('applies the tripartite decision boundaries', () => {
    const cfg = baseConfig({ thresholdOverride: 0.5, clarifyBand: 0.08 });
    expect(resolveGate({ config: cfg, support: 0.5 }).decision).toBe('answer');
    expect(resolveGate({ config: cfg, support: 0.49 }).decision).toBe('clarify');
    // Clarify floor is inclusive: 0.5 - 0.08 = 0.42 still clarifies.
    expect(resolveGate({ config: cfg, support: 0.42 }).decision).toBe('clarify');
    expect(resolveGate({ config: cfg, support: 0.41 }).decision).toBe('abstain');
  });

  it('never produces clarify when the band is zero', () => {
    const cfg = baseConfig({ thresholdOverride: 0.5, clarifyBand: 0 });
    expect(resolveGate({ config: cfg, support: 0.49 }).decision).toBe('abstain');
    expect(resolveGate({ config: cfg, support: 0.5 }).decision).toBe('answer');
  });
});

describe('templates', () => {
  it('produces deterministic abstention text pointing at nearest sources', () => {
    const args = {
      decision: 'abstain' as const,
      query: 'Was steht über Frist X?',
      sources: [{ filename: 'vertrag.pdf' }, { filename: 'anhang-b.docx' }],
    };
    const text = gateTemplate(args);
    expect(text).toContain('vertrag.pdf');
    expect(text).toContain('anhang-b.docx');
    expect(gateTemplate(args)).toBe(text);
  });

  it('handles missing sources without crashing', () => {
    const text = gateTemplate({ decision: 'abstain', query: 'q', sources: [] });
    expect(text).toContain('keine relevanten Dokumente');
  });

  it('localizes the clarify template', () => {
    const de = gateTemplate({ decision: 'clarify', query: 'Frist?', sources: [], targetLanguageCode: 'de' });
    const en = gateTemplate({ decision: 'clarify', query: 'Frist?', sources: [], targetLanguageCode: 'en' });
    expect(de).toContain('geringe Konfidenz');
    expect(en).toContain('Low confidence');
  });
});

describe('config resolution', () => {
  it('defaults to enabled enforce mode with alpha 0.1', () => {
    const cfg = resolveAbstentionConfig(asEnv({}));
    expect(cfg.enabled).toBe(true);
    expect(cfg.mode).toBe('enforce');
    expect(cfg.alpha).toBe(0.1);
    expect(cfg.thresholdOverride).toBeNull();
    expect(cfg.clarifyBand).toBe(0.08);
  });

  it('parses and sanitizes environment values', () => {
    const cfg = resolveAbstentionConfig(asEnv({
      RAG_ABSTENTION_ENABLED: 'false',
      RAG_ABSTENTION_MODE: 'annotate',
      RAG_ABSTENTION_ALPHA: '0.05',
      RAG_ABSTENTION_THRESHOLD: '0.62',
      RAG_ABSTENTION_CLARIFY_BAND: '0.2',
    }));
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).toBe('annotate');
    expect(cfg.alpha).toBe(0.05);
    expect(cfg.thresholdOverride).toBe(0.62);
    expect(cfg.clarifyBand).toBe(0.2);
  });

  it('rejects invalid values with safe defaults', () => {
    const cfg = resolveAbstentionConfig(asEnv({
      RAG_ABSTENTION_ALPHA: '1.5',
      RAG_ABSTENTION_THRESHOLD: 'abc',
      RAG_ABSTENTION_CLARIFY_BAND: '-1',
    }));
    expect(cfg.alpha).toBe(0.1);
    expect(cfg.thresholdOverride).toBeNull();
    expect(cfg.clarifyBand).toBe(0.08);
  });
});

describe('evaluateRagGate', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'abstention-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('abstains on empty retrieval results even with a low override', async () => {
    const result = await evaluateRagGate({
      query: 'beliebige Frage',
      results: [],
      skipLog: true,
    });
    expect(result.gateEnabled).toBe(true);
    expect(result.decision).toBe('abstain');
    expect(result.template).toBeTruthy();
  });

  it('names route-shaped documents (metadata.filename) in the abstain template', async () => {
    // Review finding F2 regression: chat routes pass /api/rag/query-shaped
    // results where the filename lives at r.metadata.filename, not r.filename.
    const original = process.env.RAG_ABSTENTION_THRESHOLD;
    process.env.RAG_ABSTENTION_THRESHOLD = '0.9';
    try {
      const result = await evaluateRagGate({
        query: 'Was steht über die Kündigungsfrist?',
        results: [
          {
            score: 0.72,
            content: 'Die Kündigungsfrist beträgt drei Monate zum Ende des Quartals.',
            metadata: { filename: 'vertrag.pdf' },
          },
        ] as any,
        skipLog: true,
      });
      expect(result.decision).toBe('abstain');
      expect(result.template).toContain('vertrag.pdf');
      expect(result.template).not.toContain('keine relevanten Dokumente');
    } finally {
      if (original === undefined) delete process.env.RAG_ABSTENTION_THRESHOLD;
      else process.env.RAG_ABSTENTION_THRESHOLD = original;
    }
  });

  it('answers for well-supported retrieval', async () => {
    const result = await evaluateRagGate({
      query: 'Kündigungsfrist des Mietvertrags',
      results: [
        { score: 0.9, content: 'Die Kündigungsfrist des Mietvertrags beträgt drei Monate.' },
        { score: 0.82, content: 'Kündigungsfrist: drei Monate zum Quartalsende.' },
      ],
      skipLog: true,
    });
    expect(result.decision).toBe('answer');
    expect(result.template).toBeUndefined();
  });

  it('uses a calibration file when configured', async () => {
    // Seed a calibration set whose conformal quantile is ~0.66 for alpha=0.1.
    const lines: string[] = [];
    for (let i = 0; i < 20; i++) {
      lines.push(JSON.stringify({ support: 0.5 + i * 0.01, supported: true }));
      lines.push(JSON.stringify({ support: i * 0.02, supported: false }));
    }
    const file = join(tempDir, 'calibration.jsonl');
    await writeFile(file, lines.join('\n'), 'utf8');

    const original = process.env.RAG_ABSTENTION_CALIBRATION_FILE;
    process.env.RAG_ABSTENTION_CALIBRATION_FILE = file;
    try {
      const result = await evaluateRagGate({
        query: 'Kündigungsfrist Mietvertrag',
        results: [{ score: 0.68, content: 'Kündigungsfrist Mietvertrag' }],
        skipLog: true,
      });
      expect(result.outcome.thresholdSource).toBe('calibrated');
      expect(result.outcome.threshold).not.toBe(DEFAULT_PRIOR_THRESHOLD);
    } finally {
      if (original === undefined) delete process.env.RAG_ABSTENTION_CALIBRATION_FILE;
      else process.env.RAG_ABSTENTION_CALIBRATION_FILE = original;
    }
  });

  it('treats a broken calibration file as a fallback to prior, not a crash', async () => {
    const original = process.env.RAG_ABSTENTION_CALIBRATION_FILE;
    process.env.RAG_ABSTENTION_CALIBRATION_FILE = join(tempDir, 'does-not-exist.jsonl');
    try {
      const result = await evaluateRagGate({
        query: 'q',
        results: [{ score: 0.9, content: 'beleg' }],
        skipLog: true,
      });
      expect(result.outcome.thresholdSource).toBe('prior');
      expect(result.decision).toBe('answer');
    } finally {
      if (original === undefined) delete process.env.RAG_ABSTENTION_CALIBRATION_FILE;
      else process.env.RAG_ABSTENTION_CALIBRATION_FILE = original;
    }
  });

  it('reports answer without enforcement when the gate is disabled', async () => {
    const original = process.env.RAG_ABSTENTION_ENABLED;
    process.env.RAG_ABSTENTION_ENABLED = 'false';
    try {
      const result = await evaluateRagGate({
        query: 'q',
        results: [],
        skipLog: true,
      });
      expect(result.gateEnabled).toBe(false);
      expect(result.enforce).toBe(false);
      expect(result.decision).toBe('answer');
    } finally {
      if (original === undefined) delete process.env.RAG_ABSTENTION_ENABLED;
      else process.env.RAG_ABSTENTION_ENABLED = original;
    }
  });

  it('persists gate decisions to the audit sink without raw query text', async () => {
    // Review finding F6 regression: the audit_logs sink must not carry the
    // user query (not even truncated) — data minimization for the compliance
    // table. Only scores, thresholds and identifiers belong in metadata.
    await logGateDecision({
      outcome: {
        decision: 'abstain',
        threshold: 0.45,
        thresholdSource: 'prior',
        clarifyBand: 0.08,
      },
      support: { score: 0.12, top: 0.3, rank: 0.1, lexical: 0, candidates: 2 },
      decision: 'abstain',
      enforced: true,
      alpha: 0.1,
      conversationId: 'conv-1',
    });

    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    const call = vi.mocked(logAuditEvent).mock.calls[0][0];
    const metadata = (call.metadata ?? {}) as Record<string, unknown>;
    expect(call.action).toBe('RAG_ABSTENTION_GATE');
    expect(metadata).not.toHaveProperty('queryPreview');
    expect(metadata).not.toHaveProperty('query');
    expect(metadata.thresholdSource).toBe('prior');
    expect(metadata.supportScore).toBeCloseTo(0.12);
  });
});
