import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

const { createMock } = vi.hoisted(() => {
  return { createMock: vi.fn() };
});

vi.mock('openai', () => {
  return {
    default: class OpenAI {
      constructor() {
        this.chat = { completions: { create: createMock } };
      }
    }
  };
});

import { LLMService } from '../llm.js';

function makeReconData() {
  return {
    target: 'example.com',
    systems: [
      {
        ports: { results: [{ port: 443, status: 'open' }, { port: 22, status: 'open' }] },
        headers: { headers: { server: 'nginx/1.18.0' } },
        risk: { score: 45, level: 'Medium', reasons: ['SSH port (22) exposed'] }
      }
    ],
    firewall: { firewall: true, waf_name: 'TestWAF' },
    ssl: { valid: true },
    dns: { a: ['1.2.3.4'] }
  };
}

describe('LLMService', () => {
  beforeEach(() => {
    createMock.mockReset();
    process.env.OPENAI_MODEL_PRIMARY = 'gpt-4o';
    process.env.OPENAI_MODEL_FALLBACK = 'gpt-4o-mini';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when OPENAI_API_KEY is missing', async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const svc = new LLMService();
      const res = await svc.analyzeThreatData('content', makeReconData());
      expect(res).toBeNull();
      expect(createMock).not.toHaveBeenCalled();
    } finally {
      process.env.OPENAI_API_KEY = prev;
    }
  });

  it('falls back from primary to fallback model on insufficient quota', async () => {
    const svc = new LLMService();

    const quotaError = new Error('You exceeded your current quota');
    quotaError.status = 429;
    quotaError.code = 'insufficient_quota';

    createMock
      .mockRejectedValueOnce(quotaError)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                threat_level: 2,
                summary: 'ok',
                vulnerabilities: [],
                remediation: []
              })
            }
          }
        ]
      });

    const res = await svc.analyzeThreatData('content', makeReconData());
    expect(res.threat_level).toBe(2);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock.mock.calls[0][0].model).toBe('gpt-4o');
    expect(createMock.mock.calls[1][0].model).toBe('gpt-4o-mini');
  });

  it('retries on rate limit, then falls back to gpt-4o-mini', async () => {
    vi.useFakeTimers();
    const svc = new LLMService();

    const rateError = new Error('Rate limit reached');
    rateError.status = 429;
    rateError.code = 'rate_limit_exceeded';

    createMock
      .mockRejectedValueOnce(rateError)
      .mockRejectedValueOnce(rateError)
      .mockRejectedValueOnce(rateError)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                threat_level: 3,
                summary: 'ok',
                vulnerabilities: [],
                remediation: []
              })
            }
          }
        ]
      });

    const p = svc.analyzeThreatData('content', makeReconData());
    await vi.runAllTimersAsync();
    const res = await p;

    expect(res.threat_level).toBe(3);
    expect(createMock).toHaveBeenCalledTimes(4);
    expect(createMock.mock.calls[0][0].model).toBe('gpt-4o');
    expect(createMock.mock.calls[1][0].model).toBe('gpt-4o');
    expect(createMock.mock.calls[2][0].model).toBe('gpt-4o');
    expect(createMock.mock.calls[3][0].model).toBe('gpt-4o-mini');
  });

  it('returns fallback JSON when both primary and fallback fail', async () => {
    const svc = new LLMService();

    const quotaError = new Error('You exceeded your current quota');
    quotaError.status = 429;
    quotaError.code = 'insufficient_quota';

    createMock.mockRejectedValue(quotaError);

    const res = await svc.analyzeThreatData('content', makeReconData());
    expect(res).toBeTruthy();
    expect(typeof res.threat_level).toBe('number');
    expect(res.threat_level).toBeGreaterThanOrEqual(1);
    expect(res.threat_level).toBeLessThanOrEqual(10);
    expect(typeof res.summary).toBe('string');
    expect(res.summary.toLowerCase()).toContain('ai analysis unavailable');
  });
});
