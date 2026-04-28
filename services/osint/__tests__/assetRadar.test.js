import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { fetchMock, resolve4Mock } = vi.hoisted(() => {
  return {
    fetchMock: vi.fn(),
    resolve4Mock: vi.fn()
  };
});

vi.mock('node-fetch', () => ({ default: fetchMock }));
import { promises as dns } from 'node:dns';

import { runAssetRadar } from '../assetRadar.js';

function makeResponse({ ok, status, statusText, headers, json, text }) {
  const map = new Map(Object.entries(headers || {}));
  return {
    ok,
    status,
    statusText,
    headers: { get: (k) => map.get(String(k).toLowerCase()) || map.get(String(k)) || null },
    json: async () => json,
    text: async () => text
  };
}

describe('runAssetRadar', () => {
  const originalEnv = { ...process.env };
  const originalResolve4 = dns.resolve4;

  beforeEach(() => {
    process.env = { ...originalEnv };
    fetchMock.mockReset();
    resolve4Mock.mockReset();
    dns.resolve4 = resolve4Mock;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    dns.resolve4 = originalResolve4;
  });

  it('falls back to alternatives when Censys returns plan/auth error', async () => {
    process.env.CENSYS_API_TOKEN = 'censys_test';
    process.env.SECURITYTRAILS_API_KEY = 'st_test';
    process.env.SHODAN_API_KEY = 'shodan_test';
    process.env.IPINFO_API_KEY = 'ipinfo_test';

    resolve4Mock.mockResolvedValue(['1.1.1.1']);

    fetchMock.mockImplementation(async (url, options) => {
      const u = String(url);
      if (u.startsWith('https://search.censys.io/api/v2/hosts/search')) {
        return makeResponse({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'text/plain' },
          text: 'This endpoint requires an organization ID for API access. Free users can only access this endpoint through the Platform'
        });
      }
      if (u.includes('api.securitytrails.com/v1/domain/') && u.includes('/subdomains')) {
        return makeResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          json: { subdomains: ['www'] },
          text: ''
        });
      }
      if (u.startsWith('https://api.shodan.io/shodan/host/')) {
        return makeResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          json: { ports: [80, 443], last_update: '2026-01-01T00:00:00.000Z' },
          text: ''
        });
      }
      if (u.startsWith('https://ipinfo.io/')) {
        return makeResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          json: { city: 'X', country: 'Y' },
          text: ''
        });
      }
      throw new Error(`Unexpected url: ${u}`);
    });

    const res = await runAssetRadar('example.com');
    expect(res.module).toBe('AssetRadar');
    expect(res.data.source).not.toBe('Censys Search API');
    expect(res.data.hosts.length).toBeGreaterThan(0);
    expect(res.data.hosts[0].services).toEqual([80, 443]);
  });
});
