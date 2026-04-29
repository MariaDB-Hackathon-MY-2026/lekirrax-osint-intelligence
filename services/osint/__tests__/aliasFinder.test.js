import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PassThrough } from 'stream';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

import { runAliasFinder } from '../aliasFinder.js';
import { clearAliasFinderCache } from '../aliasFinder.js';

function makeHtmlResponse({ url, html }) {
  const headers = new Map([['content-type', 'text/html; charset=utf-8']]);
  return {
    status: 200,
    url,
    headers: { get: (k) => headers.get(String(k).toLowerCase()) || null },
    text: async () => html,
    clone() {
      return makeHtmlResponse({ url, html });
    }
  };
}

function makeHangingHtmlResponse({ url, signal }) {
  const headers = new Map([['content-type', 'text/html; charset=utf-8']]);
  const body = new PassThrough();
  return {
    status: 200,
    url,
    headers: { get: (k) => headers.get(String(k).toLowerCase()) || null },
    body,
    text: async () =>
      new Promise((_, reject) => {
        const onAbort = () => {
          const err = new Error('AbortError');
          err.name = 'AbortError';
          body.emit('error', err);
          reject(err);
        };
        if (signal?.aborted) return onAbort();
        signal?.addEventListener?.('abort', onAbort, { once: true });
      }),
    clone() {
      return makeHangingHtmlResponse({ url, signal });
    }
  };
}

describe('runAliasFinder', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    clearAliasFinderCache();
    vi.stubGlobal('fetch', fetchMock);
  });
  
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('classifies Twitter "This account doesn’t exist" as available (not found)', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('x.com/') || String(url).includes('twitter.com/')) {
        return makeHtmlResponse({
          url: String(url),
          html: '<div>This account doesn&#x27;t exist</div><div>Try searching for another.</div>'
        });
      }
      return makeHtmlResponse({ url: String(url), html: '<html></html>' });
    });

    const res = await runAliasFinder('baeanip_');
    const twitter = res.data.results.find((r) => r.platform === 'Twitter');
    expect(twitter.status).toBe('available');
  });

  it('keeps Twitter as taken when no not-found markers are present', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('x.com/') || String(url).includes('twitter.com/')) {
        return makeHtmlResponse({
          url: String(url),
          html: '<html><head><title>Profile</title></head><body>Some profile shell</body></html>'
        });
      }
      return makeHtmlResponse({ url: String(url), html: '<html></html>' });
    });

    const res = await runAliasFinder('someuser');
    const twitter = res.data.results.find((r) => r.platform === 'Twitter');
    expect(twitter.status).toBe('taken');
  });

  it('does not hang when HTML sniffing stalls', async () => {
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('x.com/')) {
        return makeHangingHtmlResponse({ url: String(url), signal: init?.signal });
      }
      return makeHtmlResponse({ url: String(url), html: '<html></html>' });
    });

    const start = Date.now();
    const res = await runAliasFinder('ddd');
    expect(Date.now() - start).toBeLessThan(6000);
    const twitter = res.data.results.find((r) => r.platform === 'Twitter');
    expect(['rate-limited', 'error', 'taken', 'available']).toContain(twitter.status);
  });
});
