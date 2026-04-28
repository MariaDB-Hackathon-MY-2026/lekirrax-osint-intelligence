import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { openAiListMock, exaMock, fetchMock, scrapeMock } = vi.hoisted(() => {
  return {
    openAiListMock: vi.fn(),
    exaMock: vi.fn(),
    fetchMock: vi.fn(),
    scrapeMock: vi.fn()
  };
});

vi.mock('openai', () => {
  return {
    default: class OpenAI {
      constructor() {}
      models = { list: openAiListMock };
    }
  };
});

vi.mock('exa-js', () => {
  return {
    default: class Exa {
      constructor() {}
      searchAndContents = exaMock;
    }
  };
});

vi.mock('node-fetch', () => {
  return { default: fetchMock };
});

vi.mock('../ai/firecrawl.js', () => {
  return { firecrawlService: { scrapeTarget: scrapeMock } };
});

import { getProviderStatus } from '../providerStatus.js';

function setAllKeys() {
  process.env.OPENAI_API_KEY = 'OPENAI_SECRET_12345678';
  process.env.EXA_API_KEY = 'EXA_SECRET_12345678';
  process.env.FIRECRAWL_API_KEY = 'FIRECRAWL_SECRET_12345678';
  process.env.WHOIS_API_KEY = 'WHOIS_SECRET_12345678';
  process.env.CENSYS_API_TOKEN = 'CENSYS_SECRET_12345678';
  delete process.env.CENSYS_API_ID;
  delete process.env.CENSYS_API_SECRET;
}

describe('getProviderStatus', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    openAiListMock.mockReset();
    exaMock.mockReset();
    fetchMock.mockReset();
    scrapeMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('presence mode reports configured/missing without leaking secrets', async () => {
    setAllKeys();
    const res = await getProviderStatus({ mode: 'presence' });
    expect(res.mode).toBe('presence');
    expect(res.providers.openai.configured).toBe(true);
    expect(res.providers.exa.configured).toBe(true);
    expect(res.providers.firecrawl.configured).toBe(true);
    expect(res.providers.censys.configured).toBe(true);
    expect(res.providers.whois.configured).toBe(true);

    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain('OPENAI_SECRET_12345678');
    expect(serialized).not.toContain('EXA_SECRET_12345678');
    expect(serialized).not.toContain('FIRECRAWL_SECRET_12345678');
    expect(serialized).not.toContain('WHOIS_SECRET_12345678');
    expect(serialized).not.toContain('CENSYS_SECRET_12345678');
  });

  it('active mode returns ok when provider calls succeed', async () => {
    setAllKeys();
    openAiListMock.mockResolvedValue({ data: [] });
    exaMock.mockResolvedValue({ results: [] });
    scrapeMock.mockResolvedValue({ success: true });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => ''
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => ''
    });

    const res = await getProviderStatus({ mode: 'active', timeoutMs: 50 });
    expect(res.mode).toBe('active');
    expect(res.providers.openai.status).toBe('ok');
    expect(res.providers.exa.status).toBe('ok');
    expect(res.providers.firecrawl.status).toBe('ok');
    expect(res.providers.censys.status).toBe('ok');
    expect(res.providers.whois.status).toBe('ok');
  });

  it('active mode redacts secrets from error details', async () => {
    setAllKeys();
    openAiListMock.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    exaMock.mockRejectedValue(Object.assign(new Error('Rate limited'), { status: 429 }));
    scrapeMock.mockRejectedValue(new Error(`Firecrawl failed for key ${process.env.FIRECRAWL_API_KEY}`));

    fetchMock.mockRejectedValueOnce(new Error(`Censys failed token ${process.env.CENSYS_API_TOKEN}`));
    fetchMock.mockRejectedValueOnce(new Error(`Whois failed url apiKey=${process.env.WHOIS_API_KEY}`));

    const res = await getProviderStatus({ mode: 'active', timeoutMs: 50 });
    const serialized = JSON.stringify(res);

    expect(serialized).not.toContain('FIRECRAWL_SECRET_12345678');
    expect(serialized).not.toContain('CENSYS_SECRET_12345678');
    expect(serialized).not.toContain('WHOIS_SECRET_12345678');
    expect(serialized).toContain('[REDACTED]');
  });
});

