import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('node-fetch', () => ({ default: fetchMock }));

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

describe('runAliasFinder', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    clearAliasFinderCache();
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
});
