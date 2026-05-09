import { describe, it, expect, vi } from 'vitest';

describe('runPhishingDetect', () => {
  it('returns low risk when no keyword, SSL valid, and domain age unknown', async () => {
    vi.resetModules();
    vi.doMock('../../sslInfo.js', () => ({
      getSSLInfo: vi.fn(async () => ({
        issuer: { CN: 'Test CA' },
        validTo: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      }))
    }));

    const { runPhishingDetect } = await import('../phishingDetect.js');
    const res = await runPhishingDetect('example.com', { domainAgePyLookupEnabled: false });

    expect(res.module).toBe('PhishingDetect');
    expect(res.risk).toBe('Low');
    expect(res.data.phishing_score).toBe(10);
    expect(Array.isArray(res.data.indicators)).toBe(true);
  });

  it('raises score when suspicious keyword is present', async () => {
    vi.resetModules();
    vi.doMock('../../sslInfo.js', () => ({
      getSSLInfo: vi.fn(async () => ({
        issuer: { CN: 'Test CA' },
        validTo: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      }))
    }));

    const { runPhishingDetect } = await import('../phishingDetect.js');
    const res = await runPhishingDetect('secure-login.example.com', { domainAgePyLookupEnabled: false });

    expect(res.data.phishing_score).toBe(70);
    expect(res.risk).toBe('High');
  });

  it('treats expired SSL as suspicious', async () => {
    vi.resetModules();
    vi.doMock('../../sslInfo.js', () => ({
      getSSLInfo: vi.fn(async () => ({
        issuer: { CN: 'Expired CA' },
        validTo: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      }))
    }));

    const { runPhishingDetect } = await import('../phishingDetect.js');
    const res = await runPhishingDetect('example.com', { domainAgePyLookupEnabled: false });

    expect(res.data.phishing_score).toBe(30);
    expect(res.risk).toBe('Medium');
    expect(res.data.indicators.some((s) => String(s).includes('SSL Certificate missing or invalid'))).toBe(true);
  });

  it('adds age penalty when domain is very new', async () => {
    vi.resetModules();
    vi.doMock('../../sslInfo.js', () => ({
      getSSLInfo: vi.fn(async () => ({
        issuer: { CN: 'Test CA' },
        validTo: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      }))
    }));

    const { runPhishingDetect } = await import('../phishingDetect.js');
    const res = await runPhishingDetect('example.com', {
      domainAgePyLookupEnabled: false,
      domainAgeLookup: vi.fn(async () => ({ ok: true, domain: 'example.com', created: '2026-01-01', age_days: 10 }))
    });

    expect(res.data.phishing_score).toBe(50);
    expect(res.risk).toBe('High');
  });
});
